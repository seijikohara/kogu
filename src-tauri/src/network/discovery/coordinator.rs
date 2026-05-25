//! Discovery orchestrator: runs configured methods in parallel, streams
//! per-method results to the frontend, and performs post-discovery hostname
//! resolution across DNS PTR, SNMP, TLS SAN, NetBIOS, and LLMNR.

use std::collections::HashSet;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;

use futures::stream::FuturesUnordered;
use futures::StreamExt;
use tokio::sync::Semaphore;

use super::super::llmnr;
use super::super::netbios;
use super::super::scanner::ScanState;
use super::super::snmp;
use super::super::tls_info;

use super::arp::arp_cache_discovery;
use super::dns::resolve_dns_ptr_batch;
use super::llmnr_method::llmnr_discovery;
use super::mdns::mdns_discovery;
use super::privileges::get_local_ip_addresses;
use super::snmp_method::snmp_discovery;
use super::ssdp::ssdp_discovery;
use super::tcp_connect::tcp_connect_discovery;
use super::types::{
    DiscoveryEvent, DiscoveryEventSink, DiscoveryMethod, DiscoveryOptions, DiscoveryResult,
    HostMetadata,
};
use super::udp_scan::udp_scan_discovery;
use super::ws::ws_discovery_method;

/// Discover live hosts using specified methods in parallel with streaming results
///
/// Discovery methods run concurrently via `FuturesUnordered`, streaming each method's
/// result to the frontend via the Tauri Channel API as soon as it completes.
/// Supports cancellation via `ScanState`. Local IP addresses are automatically included.
pub async fn discover_hosts(
    targets: &[IpAddr],
    options: &DiscoveryOptions,
    on_event: &dyn DiscoveryEventSink,
    cancel_state: &Arc<ScanState>,
) -> Vec<DiscoveryResult> {
    let methods = options.methods.clone();

    // Get local IP addresses to auto-include them in results
    let local_ips = get_local_ip_addresses();
    let local_ips_in_targets: Vec<String> = targets
        .iter()
        .filter(|ip| local_ips.contains(ip))
        .map(ToString::to_string)
        .collect();

    // Separate ARP cache from other methods for deferred execution.
    // Running ARP cache after other methods improves detection: packets sent during
    // Phase 1 (ICMP, TCP Connect, etc.) populate the OS ARP table, which Phase 2 reads.
    let has_arp_cache = methods.contains(&DiscoveryMethod::ArpCache);
    let phase1_methods: Vec<DiscoveryMethod> = methods
        .iter()
        .filter(|m| **m != DiscoveryMethod::ArpCache)
        .copied()
        .collect();

    // Phase 1: Execute non-ARP-cache methods in parallel, streaming results
    let mut results =
        run_discovery_methods_streaming(&phase1_methods, targets, options, on_event, cancel_state)
            .await;

    // Check cancellation after Phase 1
    if cancel_state.is_cancelled() {
        return results;
    }

    // Phase 2: Execute ARP cache after other methods complete
    // Brief delay allows OS ARP table to be populated by Phase 1 packets
    if has_arp_cache {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        let arp_results = run_discovery_methods_streaming(
            &[DiscoveryMethod::ArpCache],
            targets,
            options,
            on_event,
            cancel_state,
        )
        .await;
        results.extend(arp_results);

        if cancel_state.is_cancelled() {
            return results;
        }
    }

    // Add local IP addresses to results (they are always "alive")
    if !local_ips_in_targets.is_empty() {
        // Add local IPs to every successful discovery result
        for result in &mut results {
            if result.error.is_none() {
                for local_ip in &local_ips_in_targets {
                    if !result.hosts.contains(local_ip) {
                        result.hosts.push(local_ip.clone());
                    }
                    // Remove from unreachable if present
                    result.unreachable.retain(|ip| ip != local_ip);
                    // Add metadata marking it as local
                    result.host_metadata.entry(local_ip.clone()).or_default();
                }
            }
        }

        // Also add a special "local" discovery result for tracking
        let local_result = DiscoveryResult {
            method: "local".to_string(),
            hosts: local_ips_in_targets.clone(),
            hostnames: std::collections::HashMap::new(),
            host_metadata: local_ips_in_targets
                .iter()
                .map(|ip| (ip.clone(), HostMetadata::default()))
                .collect(),
            unreachable: vec![],
            duration_ms: 0,
            error: None,
            requires_privileges: false,
        };
        let _ = on_event.send(DiscoveryEvent::MethodCompleted {
            result: local_result.clone(),
        });
        results.push(local_result);
    }

    // Resolve hostnames for all discovered hosts if enabled
    if options.resolve_netbios {
        let _ = on_event.send(DiscoveryEvent::ResolvingHostnames);
        resolve_hostnames_for_results(&mut results, options).await;
    }

    // Send final completed event with fully resolved results
    let _ = on_event.send(DiscoveryEvent::Completed {
        results: results.clone(),
    });

    results
}

/// Execute a single discovery method
async fn execute_discovery_method(
    method: DiscoveryMethod,
    targets: &[IpAddr],
    options: &DiscoveryOptions,
) -> DiscoveryResult {
    match method {
        DiscoveryMethod::TcpConnect => tcp_connect_discovery(targets, options).await,
        DiscoveryMethod::Mdns => mdns_discovery(options).await,
        DiscoveryMethod::Ssdp => ssdp_discovery(options).await,
        DiscoveryMethod::UdpScan => udp_scan_discovery(targets, options).await,
        DiscoveryMethod::WsDiscovery => ws_discovery_method(options).await,
        DiscoveryMethod::ArpCache => arp_cache_discovery(targets),
        DiscoveryMethod::Snmp => snmp_discovery(targets, options).await,
        DiscoveryMethod::Llmnr => llmnr_discovery(targets, options).await,
        DiscoveryMethod::None => DiscoveryResult {
            method: "none".to_string(),
            hosts: targets.iter().map(ToString::to_string).collect(),
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: vec![],
            duration_ms: 0,
            error: None,
            requires_privileges: false,
        },
    }
}

/// Execute multiple discovery methods in parallel, streaming results as each completes
///
/// Uses `FuturesUnordered` instead of `join_all` to emit each method's result to the
/// frontend via Channel as soon as it completes. Supports cancellation between method
/// completions via `ScanState`.
async fn run_discovery_methods_streaming(
    methods: &[DiscoveryMethod],
    targets: &[IpAddr],
    options: &DiscoveryOptions,
    on_event: &dyn DiscoveryEventSink,
    cancel_state: &Arc<ScanState>,
) -> Vec<DiscoveryResult> {
    if methods.is_empty() {
        return vec![];
    }

    let mut futs: FuturesUnordered<_> = methods
        .iter()
        .map(|method| {
            let method = *method;
            let method_name = method.to_string();
            async move {
                // Notify frontend that this method has started
                let _ = on_event.send(DiscoveryEvent::MethodStarted {
                    method: method_name,
                });

                execute_discovery_method(method, targets, options).await
            }
        })
        .collect();

    let mut results = Vec::with_capacity(methods.len());

    while let Some(result) = futs.next().await {
        // Check cancellation between method completions
        if cancel_state.is_cancelled() {
            let _ = on_event.send(DiscoveryEvent::Cancelled);
            break;
        }

        // Stream the completed result to the frontend
        let _ = on_event.send(DiscoveryEvent::MethodCompleted {
            result: result.clone(),
        });
        results.push(result);
    }

    results
}

/// Resolve hostnames for all discovered hosts via DNS PTR, `NetBIOS`, and LLMNR
///
/// Resolution priority (highest to lowest):
/// 1. mDNS (already resolved during discovery)
/// 2. DNS PTR (reverse lookup)
/// 3. NetBIOS (Windows hosts)
/// 4. LLMNR (Link-Local Multicast Name Resolution)
#[allow(clippy::cognitive_complexity, clippy::too_many_lines)]
async fn resolve_hostnames_for_results(
    results: &mut [DiscoveryResult],
    options: &DiscoveryOptions,
) {
    use netbios::resolve_netbios_name;

    let timeout_duration = Duration::from_millis(u64::from(options.timeout_ms));

    // Collect all unique discovered IPs
    let all_ips_set: HashSet<IpAddr> = results
        .iter()
        .flat_map(|r| r.hosts.iter())
        .filter_map(|h| h.parse::<IpAddr>().ok())
        .collect();
    let all_ips: Vec<IpAddr> = all_ips_set.iter().copied().collect();

    // Phase 1: DNS PTR reverse lookup (fastest, works on corporate networks)
    // Use shorter timeout for DNS as it's typically fast
    let dns_timeout = Duration::from_millis(u64::from(options.timeout_ms).min(3000));
    let dns_ptr_names =
        resolve_dns_ptr_batch(&all_ips, dns_timeout, options.concurrency as usize).await;

    // Apply DNS PTR results to metadata (only if no hostname exists yet)
    for result in results.iter_mut() {
        for host_ip in &result.hosts {
            if let Some(dns_name) = dns_ptr_names.get(host_ip) {
                let metadata = result.host_metadata.entry(host_ip.clone()).or_default();

                // Only set if no hostname exists (mDNS has higher priority)
                if metadata.hostname.is_none() {
                    metadata.hostname = Some(dns_name.clone());
                    metadata.hostname_source = Some("dns".to_string());
                }
            }
        }
    }

    // Phase 2: Query SNMP device info concurrently (sysName, sysDescr, etc.)
    // Use shorter timeout for SNMP as it should respond quickly or not at all
    let snmp_timeout = Duration::from_millis(u64::from(options.timeout_ms).min(2000));
    let snmp_sem = Arc::new(Semaphore::new(options.concurrency as usize));
    let mut snmp_handles = Vec::new();

    for &ip in &all_ips {
        let sem = Arc::clone(&snmp_sem);
        let timeout = snmp_timeout;

        snmp_handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;
            let info = snmp::query_snmp_device_info(ip, timeout).await?;
            Some((ip.to_string(), info))
        }));
    }

    // Collect SNMP results
    let mut snmp_info_map: std::collections::HashMap<String, snmp::SnmpDeviceInfo> =
        std::collections::HashMap::new();
    for handle in snmp_handles {
        if let Ok(Some((ip, info))) = handle.await {
            snmp_info_map.insert(ip, info);
        }
    }

    // Apply SNMP results to metadata
    for result in results.iter_mut() {
        for host_ip in &result.hosts {
            if let Some(snmp_info) = snmp_info_map.remove(host_ip) {
                let metadata = result.host_metadata.entry(host_ip.clone()).or_default();

                // Use sysName as hostname if no hostname exists yet
                if metadata.hostname.is_none() {
                    if let Some(ref sys_name) = snmp_info.sys_name {
                        metadata.hostname = Some(sys_name.clone());
                        metadata.hostname_source = Some("snmp".to_string());
                    }
                }

                metadata.snmp_info = Some(snmp_info);
            }
        }
    }

    // Phase 3: Extract TLS certificate SAN names (HTTPS hosts)
    // Use short timeout as we only probe port 443
    let tls_timeout = Duration::from_millis(u64::from(options.timeout_ms).min(2000));
    let tls_sem = Arc::new(Semaphore::new(options.concurrency as usize));
    let mut tls_handles = Vec::new();

    for &ip in &all_ips {
        let sem = Arc::clone(&tls_sem);
        let timeout = tls_timeout;

        tls_handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;

            // Only probe port 443 for TLS
            let names = tls_info::extract_tls_san_names(ip, 443, timeout).await;

            if names.is_empty() {
                None
            } else {
                Some((ip.to_string(), names))
            }
        }));
    }

    // Collect TLS SAN results
    let mut tls_names_map: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for handle in tls_handles {
        if let Ok(Some((ip, names))) = handle.await {
            tls_names_map.insert(ip, names);
        }
    }

    // Apply TLS SAN results to metadata
    for result in results.iter_mut() {
        for host_ip in &result.hosts {
            if let Some(tls_names) = tls_names_map.remove(host_ip) {
                let metadata = result.host_metadata.entry(host_ip.clone()).or_default();

                // Use first TLS SAN as hostname if no hostname exists yet
                if metadata.hostname.is_none() && !tls_names.is_empty() {
                    metadata.hostname = Some(tls_names[0].clone());
                    metadata.hostname_source = Some("tls".to_string());
                }

                metadata.tls_names = tls_names;
            }
        }
    }

    // Phase 4: Resolve NetBIOS names concurrently (Windows hosts)
    let semaphore = Arc::new(Semaphore::new(options.concurrency as usize));
    let mut handles: Vec<tokio::task::JoinHandle<Option<(String, String)>>> = Vec::new();

    for ip in all_ips {
        let sem = Arc::clone(&semaphore);
        let timeout = timeout_duration;

        let handle: tokio::task::JoinHandle<Option<(String, String)>> = tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;

            // NetBIOS resolution is blocking, run in a blocking task
            let result = tokio::task::spawn_blocking(move || resolve_netbios_name(ip, timeout))
                .await
                .ok()
                .flatten();

            result.map(|name| (ip.to_string(), name))
        });

        handles.push(handle);
    }

    // Collect results
    let mut netbios_names: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    for handle in handles {
        if let Ok(Some((ip, name))) = handle.await {
            netbios_names.insert(ip, name);
        }
    }

    // Phase 5: Try LLMNR for IPs without a hostname (fallback resolution)
    let llmnr_timeout = Duration::from_millis(u64::from(options.timeout_ms).min(2000));
    let mut llmnr_names: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();

    // Collect IPs that don't have a hostname from any discovery method or DNS PTR
    let ips_without_hostname: Vec<String> = {
        let mut has_hostname: HashSet<String> = HashSet::new();
        for result in results.iter() {
            // Check mDNS hostnames
            for ip in result.hostnames.keys() {
                has_hostname.insert(ip.clone());
            }
            // Check host_metadata for DNS PTR resolved hostnames
            for (ip, metadata) in &result.host_metadata {
                if metadata.hostname.is_some() {
                    has_hostname.insert(ip.clone());
                }
            }
        }
        all_ips_set
            .iter()
            .map(ToString::to_string)
            .filter(|ip| !has_hostname.contains(ip))
            .collect()
    };

    let llmnr_sem = Arc::new(Semaphore::new(options.concurrency as usize));
    let mut llmnr_handles = Vec::new();

    for ip_str in ips_without_hostname {
        let sem = Arc::clone(&llmnr_sem);
        let llmnr_t = llmnr_timeout;

        llmnr_handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;
            let name = llmnr::resolve_hostname(&ip_str, llmnr_t).await?;
            Some((ip_str, name))
        }));
    }

    for handle in llmnr_handles {
        if let Ok(Some((ip, name))) = handle.await {
            llmnr_names.insert(ip, name);
        }
    }

    // Update host_metadata in all results with NetBIOS and LLMNR names
    for result in results.iter_mut() {
        for host_ip in &result.hosts {
            if let Some(netbios_name) = netbios_names.get(host_ip) {
                let metadata = result
                    .host_metadata
                    .entry(host_ip.clone())
                    .or_insert_with(HostMetadata::default);

                metadata.netbios_name = Some(netbios_name.clone());

                // Note: We intentionally do NOT add NetBIOS name to hostnames map.
                // This is because NetBIOS names may differ from mDNS/DNS hostnames,
                // and adding them would prevent proper host merging when the same
                // host has both IPv4 (with NetBIOS) and IPv6 (with mDNS) addresses.
                // The NetBIOS name is preserved in metadata.netbios_name for display.
            }

            // Add LLMNR hostname if found and no hostname exists yet
            if let Some(llmnr_name) = llmnr_names.get(host_ip) {
                let metadata = result
                    .host_metadata
                    .entry(host_ip.clone())
                    .or_insert_with(HostMetadata::default);

                if metadata.hostname.is_none() {
                    metadata.hostname = Some(llmnr_name.clone());
                    metadata.hostname_source = Some("llmnr".to_string());
                }
            }
        }
    }
}
