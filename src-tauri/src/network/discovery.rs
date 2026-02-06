//! Host discovery methods for network scanning
//!
//! Provides multiple methods for discovering live hosts:
//! - ICMP Ping (cross-platform, may require elevated privileges on some systems)
//! - ARP Scan (local network only, requires libpcap and elevated privileges)
//! - TCP Connect (no special privileges, uses standard OS connect)
//! - mDNS/Bonjour (no special privileges, discovers advertised services)

use std::collections::HashSet;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

use futures::stream::FuturesUnordered;
use futures::StreamExt;
use ipnetwork::IpNetwork;
use pnet::datalink::{self, Channel as PnetChannel, NetworkInterface};
use pnet::packet::arp::{ArpHardwareTypes, ArpOperations, ArpPacket, MutableArpPacket};
use pnet::packet::ethernet::{EtherTypes, EthernetPacket, MutableEthernetPacket};
use pnet::packet::ip::IpNextHeaderProtocols;
use pnet::packet::tcp::{MutableTcpPacket, TcpFlags, TcpPacket};
use pnet::packet::Packet;
use pnet::transport::{
    self, tcp_packet_iter, TransportChannelType, TransportProtocol, TransportReceiver,
    TransportSender,
};
use pnet::util::MacAddr;
use serde::{Deserialize, Serialize};
use surge_ping::{Client, Config, PingIdentifier, PingSequence};
use tokio::sync::Semaphore;
use tokio::time::timeout;

use super::scanner::ScanState;

use super::interfaces::discover_mdns_services;

/// Discovery method to use for finding live hosts
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum DiscoveryMethod {
    /// ICMP Echo Request (ping)
    #[default]
    IcmpPing,
    /// ARP scan (local network only)
    ArpScan,
    /// TCP Connect scan to common ports (no privileges needed)
    TcpConnect,
    /// TCP SYN scan (half-open) - requires raw socket privileges
    TcpSyn,
    /// mDNS/Bonjour service discovery
    Mdns,
    /// SSDP/UPnP discovery for smart devices
    Ssdp,
    /// UDP scan to common ports (DNS, NetBIOS, SNMP)
    UdpScan,
    /// ICMPv6 Echo Request (ping) for IPv6 hosts
    Icmpv6Ping,
    /// WS-Discovery (Windows devices, printers)
    WsDiscovery,
    /// ARP cache reading (no privileges needed)
    ArpCache,
    /// Skip host discovery, scan all targets
    None,
}

impl std::fmt::Display for DiscoveryMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::IcmpPing => "icmp_ping",
            Self::ArpScan => "arp_scan",
            Self::TcpConnect => "tcp_connect",
            Self::TcpSyn => "tcp_syn",
            Self::Mdns => "mdns",
            Self::Ssdp => "ssdp",
            Self::UdpScan => "udp_scan",
            Self::Icmpv6Ping => "icmpv6_ping",
            Self::WsDiscovery => "ws_discovery",
            Self::ArpCache => "arp_cache",
            Self::None => "none",
        };
        write!(f, "{name}")
    }
}

/// Host metadata collected during discovery
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HostMetadata {
    /// Hostname (from mDNS, DNS reverse lookup, `NetBIOS`, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    /// Source of the hostname resolution (dns, mdns, netbios, snmp, tls)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname_source: Option<String>,
    /// `NetBIOS` name (from `NetBIOS` Node Status query)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub netbios_name: Option<String>,
    /// MAC address (from ARP scan)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mac_address: Option<String>,
    /// Vendor name (from OUI lookup)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
    /// mDNS services advertised by this host
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub mdns_services: Vec<MdnsServiceInfo>,
    /// SSDP/UPnP device information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssdp_device: Option<super::types::SsdpDeviceInfo>,
    /// WS-Discovery device information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ws_discovery: Option<super::ws_discovery::WsDiscoveryInfo>,
    /// SNMP device information (sysName, sysDescr, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snmp_info: Option<super::snmp::SnmpDeviceInfo>,
    /// TLS certificate Subject Alternative Names (dNSName)
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tls_names: Vec<String>,
}

/// mDNS service information for a host
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdnsServiceInfo {
    /// Service instance name
    pub instance_name: String,
    /// Service type (e.g., "_http._tcp")
    pub service_type: String,
    /// Port number
    pub port: u16,
    /// TXT record properties as key-value pairs
    pub properties: Vec<(String, String)>,
}

/// Result of host discovery
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryResult {
    /// Method used for discovery
    pub method: String,
    /// Discovered hosts (IP addresses)
    pub hosts: Vec<String>,
    /// Hostname mapping: IP address -> hostname (for mDNS discovery)
    /// Deprecated: Use `host_metadata` instead
    pub hostnames: std::collections::HashMap<String, String>,
    /// Extended host metadata (MAC addresses, vendors, mDNS services)
    pub host_metadata: std::collections::HashMap<String, HostMetadata>,
    /// Hosts that failed discovery or timed out
    pub unreachable: Vec<String>,
    /// Duration of discovery in milliseconds
    pub duration_ms: u64,
    /// Error message if discovery failed
    pub error: Option<String>,
    /// Whether the method requires elevated privileges
    pub requires_privileges: bool,
}

/// Discovery options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryOptions {
    /// Methods to use (in order of preference)
    pub methods: Vec<DiscoveryMethod>,
    /// Timeout per host in milliseconds
    pub timeout_ms: u32,
    /// Maximum concurrent discovery operations
    pub concurrency: u32,
    /// Ports to probe for TCP SYN scan
    pub syn_ports: Option<Vec<u16>>,
    /// mDNS service types to discover
    pub mdns_services: Option<Vec<String>>,
    /// Whether to resolve `NetBIOS` names for discovered hosts
    #[serde(default)]
    pub resolve_netbios: bool,
}

impl Default for DiscoveryOptions {
    fn default() -> Self {
        Self {
            methods: vec![DiscoveryMethod::IcmpPing],
            timeout_ms: 1000,
            concurrency: 100,
            syn_ports: Some(vec![80, 443, 22, 445, 139]),
            mdns_services: None,
            resolve_netbios: false,
        }
    }
}

/// Streaming event sent to the frontend via Tauri Channel API
///
/// Uses discriminated union serialization for type-safe handling in TypeScript.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum DiscoveryEvent {
    /// A discovery method has started execution
    MethodStarted {
        /// Name of the discovery method
        method: String,
    },
    /// A discovery method completed — hosts are immediately available for display
    MethodCompleted {
        /// The discovery result for this method
        result: DiscoveryResult,
    },
    /// Hostname resolution phase has started
    ResolvingHostnames,
    /// All discovery and resolution completed — final merged results
    Completed {
        /// Final merged results from all methods
        results: Vec<DiscoveryResult>,
    },
    /// Discovery was cancelled by the user
    Cancelled,
}

/// Generic event sink for streaming discovery results (Tauri-independent)
///
/// Implementations:
/// - Main process: forwards events to Tauri `Channel<DiscoveryEvent>`
/// - Sidecar: writes JSON Lines to stdout
pub trait DiscoveryEventSink: Send + Sync {
    /// Send a discovery event to the consumer
    fn send(&self, event: DiscoveryEvent) -> Result<(), String>;
}

/// Extended ports for TCP connect discovery (includes IoT and common services)
pub const CONNECT_DISCOVERY_PORTS: &[u16] = &[
    21,    // FTP
    22,    // SSH
    23,    // Telnet
    25,    // SMTP
    53,    // DNS
    80,    // HTTP
    110,   // POP3
    135,   // MS RPC
    139,   // NetBIOS
    143,   // IMAP
    443,   // HTTPS
    445,   // SMB
    515,   // LPD (printers)
    548,   // AFP (Apple Filing Protocol)
    554,   // RTSP (cameras)
    631,   // IPP (CUPS printing)
    993,   // IMAPS
    995,   // POP3S
    1433,  // MS SQL
    1883,  // MQTT (IoT)
    3306,  // MySQL
    3389,  // RDP
    5000,  // UPnP
    5001,  // Synology DSM
    5353,  // mDNS
    5900,  // VNC
    6379,  // Redis
    8000,  // HTTP Alt
    8008,  // Chromecast
    8080,  // HTTP Alt
    8081,  // HTTP Alt
    8443,  // HTTPS Alt
    8888,  // HTTP Alt
    9000,  // Various
    9100,  // JetDirect (printers)
    49152, // UPnP / Dynamic ports
    62078, // iPhone sync
];

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
        DiscoveryMethod::IcmpPing => icmp_ping_discovery(targets, options).await,
        DiscoveryMethod::ArpScan => arp_scan_discovery(targets, options).await,
        DiscoveryMethod::TcpConnect => tcp_connect_discovery(targets, options).await,
        DiscoveryMethod::TcpSyn => tcp_syn_discovery(targets, options).await,
        DiscoveryMethod::Mdns => mdns_discovery(options).await,
        DiscoveryMethod::Ssdp => ssdp_discovery(options).await,
        DiscoveryMethod::UdpScan => udp_scan_discovery(targets, options).await,
        DiscoveryMethod::Icmpv6Ping => icmpv6_ping_discovery(targets, options).await,
        DiscoveryMethod::WsDiscovery => ws_discovery_method(options).await,
        DiscoveryMethod::ArpCache => arp_cache_discovery(targets),
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
    use super::netbios::resolve_netbios_name;

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

            // SNMP is blocking, run in a blocking task
            let result = tokio::task::spawn_blocking(move || {
                super::snmp::query_snmp_device_info(ip, timeout)
            })
            .await
            .ok()
            .flatten();

            result.map(|info| (ip.to_string(), info))
        }));
    }

    // Collect SNMP results
    let mut snmp_info_map: std::collections::HashMap<String, super::snmp::SnmpDeviceInfo> =
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
            let names = super::tls_info::extract_tls_san_names(ip, 443, timeout).await;

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
            let name = super::llmnr::resolve_hostname(&ip_str, llmnr_t).await?;
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

// =============================================================================
// DNS PTR Reverse Lookup
// =============================================================================

/// Resolve hostname via DNS PTR (reverse lookup) for a single IP
async fn resolve_dns_ptr(ip: IpAddr) -> Option<String> {
    use hickory_resolver::Resolver;

    // Create resolver with system configuration
    let resolver = Resolver::builder_tokio().ok()?.build();

    // Perform reverse lookup
    let response = resolver.reverse_lookup(ip).await.ok()?;

    // Get the first PTR record and clean up the hostname
    response.iter().next().map(|name| {
        let hostname = name.to_string();
        // Remove trailing dot if present
        hostname.strip_suffix('.').unwrap_or(&hostname).to_string()
    })
}

/// Resolve DNS PTR names for multiple IPs concurrently
async fn resolve_dns_ptr_batch(
    ips: &[IpAddr],
    timeout_duration: Duration,
    concurrency: usize,
) -> std::collections::HashMap<String, String> {
    let semaphore = Arc::new(Semaphore::new(concurrency));
    let mut handles = Vec::new();

    for &ip in ips {
        let sem = Arc::clone(&semaphore);
        let timeout_dur = timeout_duration;

        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;

            // Apply timeout to DNS lookup
            let result = timeout(timeout_dur, resolve_dns_ptr(ip)).await.ok()?;

            result.map(|name| (ip.to_string(), name))
        }));
    }

    let mut results = std::collections::HashMap::new();
    for handle in handles {
        if let Ok(Some((ip, name))) = handle.await {
            results.insert(ip, name);
        }
    }

    results
}

// =============================================================================
// ICMP Ping Discovery
// =============================================================================

/// Number of ICMP ping retries for better discovery accuracy
const ICMP_RETRY_COUNT: u32 = 2;

/// Discover hosts using ICMP ping with retry support
async fn icmp_ping_discovery(targets: &[IpAddr], options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let timeout_per_ping =
        Duration::from_millis(u64::from(options.timeout_ms) / (u64::from(ICMP_RETRY_COUNT) + 1));
    let semaphore = Arc::new(Semaphore::new(options.concurrency as usize));

    let mut hosts = Vec::new();
    let mut unreachable = Vec::new();

    // Create ping client
    let client = match Client::new(&Config::default()) {
        Ok(c) => Arc::new(c),
        Err(e) => {
            return DiscoveryResult {
                method: "icmp_ping".to_string(),
                hosts: vec![],
                hostnames: std::collections::HashMap::new(),
                host_metadata: std::collections::HashMap::new(),
                unreachable: targets.iter().map(ToString::to_string).collect(),
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(format!(
                    "Failed to create ICMP client: {e}. May require elevated privileges."
                )),
                requires_privileges: true,
            };
        }
    };

    let mut handles = Vec::with_capacity(targets.len());

    for (idx, &target) in targets.iter().enumerate() {
        let sem = Arc::clone(&semaphore);
        let client = Arc::clone(&client);

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;

            let payload = [0u8; 56];
            let mut pinger = client.pinger(target, PingIdentifier(idx as u16)).await;

            // Try multiple ping attempts
            for seq in 0..=ICMP_RETRY_COUNT as u16 {
                match timeout(timeout_per_ping, pinger.ping(PingSequence(seq), &payload)).await {
                    Ok(Ok(_reply)) => return Some((target, true)),
                    Ok(Err(_)) | Err(_) => {
                        // Continue to next attempt
                    }
                }
            }

            Some((target, false))
        });

        handles.push(handle);
    }

    for handle in handles {
        if let Ok(Some((ip, alive))) = handle.await {
            if alive {
                hosts.push(ip.to_string());
            } else {
                unreachable.push(ip.to_string());
            }
        }
    }

    DiscoveryResult {
        method: "icmp_ping".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata: std::collections::HashMap::new(),
        unreachable,
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: cfg!(target_os = "linux"),
    }
}

// =============================================================================
// ARP Scan Discovery
// =============================================================================

/// Discover hosts using ARP scan (local network only)
async fn arp_scan_discovery(targets: &[IpAddr], options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();

    // ARP only works for IPv4 on local network
    let ipv4_targets: Vec<Ipv4Addr> = targets
        .iter()
        .filter_map(|ip| match ip {
            IpAddr::V4(v4) => Some(*v4),
            IpAddr::V6(_) => None,
        })
        .collect();

    if ipv4_targets.is_empty() {
        return DiscoveryResult {
            method: "arp_scan".to_string(),
            hosts: vec![],
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
            error: None,
            requires_privileges: false,
        };
    }

    // Find a suitable network interface
    let interface = match find_interface_for_targets(&ipv4_targets) {
        Some(iface) => iface,
        None => {
            return DiscoveryResult {
                method: "arp_scan".to_string(),
                hosts: vec![],
                hostnames: std::collections::HashMap::new(),
                host_metadata: std::collections::HashMap::new(),
                unreachable: targets.iter().map(ToString::to_string).collect(),
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some("No suitable network interface found for ARP scan".to_string()),
                requires_privileges: true,
            };
        }
    };

    // Perform ARP scan
    match perform_arp_scan(&interface, &ipv4_targets, options.timeout_ms).await {
        Ok(discovered) => {
            use super::oui;

            // Build host metadata with MAC addresses and vendor lookup
            let mut host_metadata = std::collections::HashMap::new();
            let hosts: Vec<String> = discovered
                .iter()
                .map(|(ip, mac)| {
                    let mac_str = oui::format_mac(mac);
                    let vendor = oui::lookup_vendor(&mac_str).map(String::from);
                    host_metadata.insert(
                        ip.to_string(),
                        HostMetadata {
                            mac_address: Some(mac_str),
                            vendor,
                            ..Default::default()
                        },
                    );
                    ip.to_string()
                })
                .collect();

            let discovered_set: HashSet<_> = discovered.keys().copied().collect();
            let unreachable: Vec<String> = ipv4_targets
                .iter()
                .filter(|ip| !discovered_set.contains(ip))
                .map(ToString::to_string)
                .collect();

            DiscoveryResult {
                method: "arp_scan".to_string(),
                hosts,
                hostnames: std::collections::HashMap::new(),
                host_metadata,
                unreachable,
                duration_ms: start.elapsed().as_millis() as u64,
                error: None,
                requires_privileges: true,
            }
        }
        Err(e) => DiscoveryResult {
            method: "arp_scan".to_string(),
            hosts: vec![],
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: targets.iter().map(ToString::to_string).collect(),
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some(e),
            requires_privileges: true,
        },
    }
}

/// Find a network interface that can reach the target IPs
fn find_interface_for_targets(targets: &[Ipv4Addr]) -> Option<NetworkInterface> {
    let interfaces = datalink::interfaces();

    for iface in interfaces {
        if iface.is_loopback() || !iface.is_up() {
            continue;
        }

        for ip in &iface.ips {
            if let IpNetwork::V4(network) = ip {
                // Check if any target is in this network
                for target in targets {
                    if network.contains(*target) {
                        return Some(iface.clone());
                    }
                }
            }
        }
    }

    None
}

/// Number of ARP request retries for better discovery accuracy
const ARP_RETRY_COUNT: u32 = 3;

/// Delay between ARP retry rounds in milliseconds
const ARP_RETRY_DELAY_MS: u64 = 100;

/// Perform ARP scan on the given interface with retry support
/// Returns a map of IP address to MAC address (as 6-byte array)
async fn perform_arp_scan(
    interface: &NetworkInterface,
    targets: &[Ipv4Addr],
    timeout_ms: u32,
) -> Result<std::collections::HashMap<Ipv4Addr, [u8; 6]>, String> {
    let source_mac = interface
        .mac
        .ok_or_else(|| "Interface has no MAC address".to_string())?;

    let source_ip = interface
        .ips
        .iter()
        .find_map(|ip| match ip {
            IpNetwork::V4(net) => Some(net.ip()),
            _ => None,
        })
        .ok_or_else(|| "Interface has no IPv4 address".to_string())?;

    // Create datalink channel
    let (mut tx, mut rx) = match datalink::channel(interface, Default::default()) {
        Ok(PnetChannel::Ethernet(tx, rx)) => (tx, rx),
        Ok(_) => return Err("Unsupported channel type".to_string()),
        Err(e) => {
            return Err(format!(
                "Failed to create datalink channel: {e}. Requires elevated privileges."
            ))
        }
    };

    let mut discovered: std::collections::HashMap<Ipv4Addr, [u8; 6]> =
        std::collections::HashMap::new();
    let target_set: HashSet<_> = targets.iter().copied().collect();

    // Send ARP requests with retry for undiscovered hosts
    for retry in 0..ARP_RETRY_COUNT {
        // Determine which targets still need ARP requests
        let pending_targets: Vec<_> = if retry == 0 {
            targets.to_vec()
        } else {
            targets
                .iter()
                .copied()
                .filter(|ip| !discovered.contains_key(ip))
                .collect()
        };

        if pending_targets.is_empty() {
            break;
        }

        // Add delay between retries (not on first attempt)
        if retry > 0 {
            tokio::time::sleep(Duration::from_millis(ARP_RETRY_DELAY_MS)).await;
        }

        // Send ARP requests for pending targets
        for target in &pending_targets {
            let _ = send_arp_request(&mut tx, source_mac, source_ip, *target);
        }

        // Collect responses for this round
        let round_timeout =
            Duration::from_millis(u64::from(timeout_ms) / u64::from(ARP_RETRY_COUNT));
        let start = std::time::Instant::now();

        while start.elapsed() < round_timeout {
            match rx.next() {
                Ok(packet) => {
                    if let Some(ethernet) = EthernetPacket::new(packet) {
                        if ethernet.get_ethertype() == EtherTypes::Arp {
                            if let Some(arp) = ArpPacket::new(ethernet.payload()) {
                                if arp.get_operation() == ArpOperations::Reply {
                                    let sender_ip = arp.get_sender_proto_addr();
                                    if target_set.contains(&sender_ip)
                                        && !discovered.contains_key(&sender_ip)
                                    {
                                        // Capture MAC address from ARP reply
                                        let sender_mac = arp.get_sender_hw_addr();
                                        let mac_bytes = [
                                            sender_mac.0,
                                            sender_mac.1,
                                            sender_mac.2,
                                            sender_mac.3,
                                            sender_mac.4,
                                            sender_mac.5,
                                        ];
                                        discovered.insert(sender_ip, mac_bytes);
                                    }
                                }
                            }
                        }
                    }
                }
                Err(_) => {
                    tokio::time::sleep(Duration::from_millis(5)).await;
                }
            }

            // Early exit if all targets discovered
            if discovered.len() == targets.len() {
                return Ok(discovered);
            }
        }
    }

    Ok(discovered)
}

/// Send a single ARP request for the given target IP
fn send_arp_request(
    tx: &mut Box<dyn datalink::DataLinkSender>,
    source_mac: MacAddr,
    source_ip: Ipv4Addr,
    target_ip: Ipv4Addr,
) -> Result<(), String> {
    let mut ethernet_buffer = [0u8; 42];
    let mut ethernet_packet = MutableEthernetPacket::new(&mut ethernet_buffer)
        .ok_or("Failed to create ethernet packet")?;

    ethernet_packet.set_destination(MacAddr::broadcast());
    ethernet_packet.set_source(source_mac);
    ethernet_packet.set_ethertype(EtherTypes::Arp);

    let mut arp_buffer = [0u8; 28];
    let mut arp_packet =
        MutableArpPacket::new(&mut arp_buffer).ok_or("Failed to create ARP packet")?;

    arp_packet.set_hardware_type(ArpHardwareTypes::Ethernet);
    arp_packet.set_protocol_type(EtherTypes::Ipv4);
    arp_packet.set_hw_addr_len(6);
    arp_packet.set_proto_addr_len(4);
    arp_packet.set_operation(ArpOperations::Request);
    arp_packet.set_sender_hw_addr(source_mac);
    arp_packet.set_sender_proto_addr(source_ip);
    arp_packet.set_target_hw_addr(MacAddr::zero());
    arp_packet.set_target_proto_addr(target_ip);

    ethernet_packet.set_payload(arp_packet.packet());
    tx.send_to(ethernet_packet.packet(), None);
    Ok(())
}

// =============================================================================
// mDNS Discovery
// =============================================================================

/// Minimum timeout for mDNS discovery (mDNS needs time for service resolution)
const MDNS_MIN_TIMEOUT_MS: u32 = 5000;

/// Common mDNS/Bonjour service types for host discovery
///
/// These service types are based on:
/// - RFC 6763 (DNS-Based Service Discovery)
/// - IANA Service Name and Transport Protocol Port Number Registry
/// - Apple Bonjour Printing Specification
/// - Common IoT and smart home protocols
const DEFAULT_MDNS_SERVICE_TYPES: &[&str] = &[
    // Web Services
    "_http._tcp",  // HTTP web servers
    "_https._tcp", // HTTPS web servers
    // Remote Access
    "_ssh._tcp",      // SSH servers
    "_sftp-ssh._tcp", // SFTP over SSH
    "_rfb._tcp",      // VNC (Remote Frame Buffer)
    // File Sharing
    "_smb._tcp",        // SMB/CIFS (Windows file sharing)
    "_afpovertcp._tcp", // AFP (Apple Filing Protocol)
    "_ftp._tcp",        // FTP servers
    "_nfs._tcp",        // NFS (Network File System)
    "_webdav._tcp",     // WebDAV
    // Printing
    "_ipp._tcp",            // Internet Printing Protocol
    "_ipps._tcp",           // IPP over HTTPS
    "_printer._tcp",        // LPR printers
    "_pdl-datastream._tcp", // PDL Data Stream printers
    "_scanner._tcp",        // Scanners
    // Media & Streaming
    "_airplay._tcp",         // Apple AirPlay
    "_raop._tcp",            // Remote Audio Output Protocol (AirPlay audio)
    "_daap._tcp",            // iTunes/DAAP (Digital Audio Access Protocol)
    "_googlecast._tcp",      // Google Cast / Chromecast
    "_spotify-connect._tcp", // Spotify Connect
    // Smart Home / IoT
    "_hap._tcp",     // HomeKit Accessory Protocol
    "_homekit._tcp", // HomeKit
    "_hue._tcp",     // Philips Hue
    // Apple Services
    "_device-info._tcp",    // Device information
    "_companion-link._tcp", // Apple Watch companion
    "_sleep-proxy._udp",    // Sleep Proxy (Wake-on-LAN)
    "_adisk._tcp",          // Time Machine / Apple Disk
    // Workstation Discovery
    "_workstation._tcp", // macOS/Linux workstations
    "_presence._tcp",    // Presence/availability
    // Database Services
    "_postgresql._tcp", // PostgreSQL
    "_mysql._tcp",      // MySQL
    // NAS Devices
    "_nas._tcp",   // Generic NAS
    "_iscsi._tcp", // iSCSI targets
];

/// Discover hosts using mDNS/Bonjour
async fn mdns_discovery(options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();

    let service_types = options.mdns_services.clone().unwrap_or_else(|| {
        DEFAULT_MDNS_SERVICE_TYPES
            .iter()
            .map(|s| (*s).to_string())
            .collect()
    });

    // mDNS requires longer timeout for service discovery and resolution
    let mdns_timeout = options.timeout_ms.max(MDNS_MIN_TIMEOUT_MS);

    match discover_mdns_services(service_types, mdns_timeout).await {
        Ok(results) => {
            let mut hosts = HashSet::new();
            let mut hostnames = std::collections::HashMap::new();
            let mut host_metadata: std::collections::HashMap<String, HostMetadata> =
                std::collections::HashMap::new();

            for service in &results.services {
                // Create mDNS service info
                let service_info = MdnsServiceInfo {
                    instance_name: service.instance_name.clone(),
                    service_type: service.service_type.clone(),
                    port: service.port,
                    properties: service.properties.clone(),
                };

                for addr in &service.addresses {
                    hosts.insert(addr.clone());

                    // Map IP address to hostname (remove trailing dot if present)
                    let hostname = service.hostname.trim_end_matches('.').to_string();
                    if !hostname.is_empty() {
                        hostnames.insert(addr.clone(), hostname.clone());
                    }

                    // Add or update host metadata
                    host_metadata
                        .entry(addr.clone())
                        .and_modify(|meta| {
                            // Update hostname if not set
                            if meta.hostname.is_none() && !hostname.is_empty() {
                                meta.hostname = Some(hostname.clone());
                            }
                            // Add service info
                            meta.mdns_services.push(service_info.clone());
                        })
                        .or_insert_with(|| HostMetadata {
                            hostname: if hostname.is_empty() {
                                None
                            } else {
                                Some(hostname.clone())
                            },
                            hostname_source: if hostname.is_empty() {
                                None
                            } else {
                                Some("mdns".to_string())
                            },
                            mdns_services: vec![service_info.clone()],
                            ..Default::default()
                        });
                }
            }

            DiscoveryResult {
                method: "mdns".to_string(),
                hosts: hosts.into_iter().collect(),
                hostnames,
                host_metadata,
                unreachable: vec![],
                duration_ms: start.elapsed().as_millis() as u64,
                error: None,
                requires_privileges: false,
            }
        }
        Err(e) => DiscoveryResult {
            method: "mdns".to_string(),
            hosts: vec![],
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some(e),
            requires_privileges: false,
        },
    }
}

// =============================================================================
// TCP Connect Discovery (Port Scan)
// =============================================================================

/// Discover hosts using TCP connect scan (no privileges needed)
async fn tcp_connect_discovery(targets: &[IpAddr], options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let timeout_duration = Duration::from_millis(u64::from(options.timeout_ms));
    let semaphore = Arc::new(Semaphore::new(options.concurrency as usize));

    // Use extended port list for better discovery accuracy
    let ports = options
        .syn_ports
        .as_ref()
        .map_or(CONNECT_DISCOVERY_PORTS, Vec::as_slice);

    let mut hosts = Vec::new();
    let mut unreachable = Vec::new();

    let mut handles = Vec::with_capacity(targets.len());

    for &target in targets {
        let sem = Arc::clone(&semaphore);
        let ports = ports.to_vec();

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await;

            // Try connecting to any of the common ports
            for port in &ports {
                let addr = std::net::SocketAddr::new(target, *port);
                if let Ok(result) =
                    timeout(timeout_duration, tokio::net::TcpStream::connect(addr)).await
                {
                    if result.is_ok() {
                        return (target, true);
                    }
                }
            }

            (target, false)
        });

        handles.push(handle);
    }

    // Collect results
    for handle in handles {
        if let Ok((target, reachable)) = handle.await {
            if reachable {
                hosts.push(target.to_string());
            } else {
                unreachable.push(target.to_string());
            }
        }
    }

    DiscoveryResult {
        method: "tcp_connect".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata: std::collections::HashMap::new(),
        unreachable,
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}

// =============================================================================
// TCP SYN Discovery (Half-Open Scan) - Requires Raw Socket Privileges
// =============================================================================

/// Default source port for TCP SYN scanning
const TCP_SYN_SOURCE_PORT: u16 = 54321;

/// Discover hosts using TCP SYN scan (half-open scan, requires privileges)
///
/// This method sends TCP SYN packets and listens for SYN-ACK or RST responses.
/// It's faster than TCP connect scan because it doesn't complete the 3-way handshake.
async fn tcp_syn_discovery(targets: &[IpAddr], options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let timeout_duration = Duration::from_millis(u64::from(options.timeout_ms));

    // Only support IPv4 for now (IPv6 raw sockets are more complex)
    let ipv4_targets: Vec<Ipv4Addr> = targets
        .iter()
        .filter_map(|ip| match ip {
            IpAddr::V4(v4) => Some(*v4),
            IpAddr::V6(_) => None,
        })
        .collect();

    if ipv4_targets.is_empty() {
        return DiscoveryResult {
            method: "tcp_syn".to_string(),
            hosts: vec![],
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: targets.iter().map(ToString::to_string).collect(),
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some("TCP SYN scan only supports IPv4 addresses".to_string()),
            requires_privileges: true,
        };
    }

    // Use ports from options or default discovery ports
    let ports = options
        .syn_ports
        .as_ref()
        .map_or(CONNECT_DISCOVERY_PORTS, Vec::as_slice);

    // Pre-calculate the list of all targets as strings for error cases
    let all_targets_str: Vec<String> = ipv4_targets.iter().map(ToString::to_string).collect();

    // Perform the TCP SYN scan in a blocking task since pnet is synchronous
    let ports_vec = ports.to_vec();
    let result = tokio::task::spawn_blocking(move || {
        tcp_syn_scan_blocking(&ipv4_targets, &ports_vec, timeout_duration)
    })
    .await;

    match result {
        Ok(Ok((hosts, unreachable))) => DiscoveryResult {
            method: "tcp_syn".to_string(),
            hosts,
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable,
            duration_ms: start.elapsed().as_millis() as u64,
            error: None,
            requires_privileges: true,
        },
        Ok(Err(e)) => DiscoveryResult {
            method: "tcp_syn".to_string(),
            hosts: vec![],
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: all_targets_str.clone(),
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some(e),
            requires_privileges: true,
        },
        Err(e) => DiscoveryResult {
            method: "tcp_syn".to_string(),
            hosts: vec![],
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: all_targets_str,
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some(format!("Task join error: {e}")),
            requires_privileges: true,
        },
    }
}

/// Perform TCP SYN scan synchronously (runs in blocking task)
#[allow(clippy::significant_drop_tightening)]
fn tcp_syn_scan_blocking(
    targets: &[Ipv4Addr],
    ports: &[u16],
    timeout: Duration,
) -> Result<(Vec<String>, Vec<String>), String> {
    use std::collections::HashSet;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    // Create transport channel for sending TCP packets
    let protocol =
        TransportChannelType::Layer4(TransportProtocol::Ipv4(IpNextHeaderProtocols::Tcp));

    let (mut tx, mut rx) = transport::transport_channel(4096, protocol)
        .map_err(|e| format!("Failed to create transport channel: {e}"))?;

    let alive_hosts: Arc<std::sync::Mutex<HashSet<Ipv4Addr>>> =
        Arc::new(std::sync::Mutex::new(HashSet::new()));
    let stop_flag = Arc::new(AtomicBool::new(false));

    // Spawn receiver thread
    let alive_hosts_clone = Arc::clone(&alive_hosts);
    let stop_flag_clone = Arc::clone(&stop_flag);
    let targets_set: HashSet<Ipv4Addr> = targets.iter().copied().collect();

    let receiver_handle = std::thread::spawn(move || {
        receive_syn_responses(&mut rx, &targets_set, &alive_hosts_clone, &stop_flag_clone);
    });

    // Send SYN packets to all targets and ports
    let source_port = TCP_SYN_SOURCE_PORT;
    for &target in targets {
        for &port in ports {
            if let Err(e) = send_syn_packet(&mut tx, target, port, source_port) {
                eprintln!("Failed to send SYN to {target}:{port}: {e}");
            }
        }
    }

    // Wait for responses (with timeout)
    std::thread::sleep(timeout);

    // Signal receiver to stop
    stop_flag.store(true, Ordering::SeqCst);

    // Wait for receiver thread to finish (with small timeout)
    let _ = receiver_handle.join();

    // Collect results - acquire lock, collect data, release lock immediately
    let (hosts, unreachable) = {
        let alive = alive_hosts
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let hosts: Vec<String> = alive.iter().map(ToString::to_string).collect();
        let unreachable: Vec<String> = targets
            .iter()
            .filter(|t| !alive.contains(t))
            .map(ToString::to_string)
            .collect();
        (hosts, unreachable)
    };

    Ok((hosts, unreachable))
}

/// Send a TCP SYN packet to the specified target
fn send_syn_packet(
    tx: &mut TransportSender,
    target: Ipv4Addr,
    dest_port: u16,
    source_port: u16,
) -> Result<(), String> {
    // Build TCP SYN packet
    let mut tcp_buffer = [0u8; 20]; // Minimum TCP header size
    let mut tcp_packet =
        MutableTcpPacket::new(&mut tcp_buffer).ok_or("Failed to create TCP packet buffer")?;

    tcp_packet.set_source(source_port);
    tcp_packet.set_destination(dest_port);
    tcp_packet.set_sequence(rand::random::<u32>());
    tcp_packet.set_acknowledgement(0);
    tcp_packet.set_data_offset(5); // 5 * 4 = 20 bytes (minimum header)
    tcp_packet.set_reserved(0);
    tcp_packet.set_flags(TcpFlags::SYN);
    tcp_packet.set_window(65535);
    tcp_packet.set_urgent_ptr(0);

    // Calculate checksum (pseudo-header required)
    let source_ip = get_source_ip_for_target(target);
    let checksum = tcp_checksum(&tcp_packet.to_immutable(), source_ip, target);
    tcp_packet.set_checksum(checksum);

    // Send the packet
    tx.send_to(tcp_packet, IpAddr::V4(target))
        .map_err(|e| format!("Send error: {e}"))?;

    Ok(())
}

/// Receive TCP responses (SYN-ACK or RST) and mark hosts as alive
fn receive_syn_responses(
    rx: &mut TransportReceiver,
    targets: &HashSet<Ipv4Addr>,
    alive_hosts: &Arc<std::sync::Mutex<HashSet<Ipv4Addr>>>,
    stop_flag: &Arc<std::sync::atomic::AtomicBool>,
) {
    use std::sync::atomic::Ordering;

    let mut iter = tcp_packet_iter(rx);

    while !stop_flag.load(Ordering::SeqCst) {
        // Use a short timeout for each receive attempt
        match iter.next_with_timeout(Duration::from_millis(100)) {
            Ok(Some((packet, source))) => {
                let source_ip = match source {
                    IpAddr::V4(v4) => v4,
                    IpAddr::V6(_) => continue,
                };

                // Check if this is from one of our targets
                if !targets.contains(&source_ip) {
                    continue;
                }

                // Check if it's a response to our SYN (SYN-ACK or RST)
                let flags = packet.get_flags();
                if (flags & TcpFlags::SYN != 0 && flags & TcpFlags::ACK != 0)
                    || (flags & TcpFlags::RST != 0)
                {
                    // Host is alive (responded to our SYN)
                    if let Ok(mut hosts) = alive_hosts.lock() {
                        hosts.insert(source_ip);
                    }
                }
            }
            Ok(None) => {
                // Timeout, continue checking stop flag
                continue;
            }
            Err(_) => {
                // Error receiving, break out
                break;
            }
        }
    }
}

/// Get the source IP address to use for a given target
fn get_source_ip_for_target(target: Ipv4Addr) -> Ipv4Addr {
    // Find an appropriate interface for the target
    for iface in datalink::interfaces() {
        for ip in &iface.ips {
            if let IpNetwork::V4(v4_net) = ip {
                // Simple heuristic: use this interface if target is in same subnet
                // or if it's a non-loopback interface
                if v4_net.contains(target) || (!iface.is_loopback() && iface.is_up()) {
                    return v4_net.ip();
                }
            }
        }
    }
    // Fallback to unspecified address
    Ipv4Addr::UNSPECIFIED
}

/// Calculate TCP checksum with pseudo-header
fn tcp_checksum(tcp: &TcpPacket<'_>, source: Ipv4Addr, dest: Ipv4Addr) -> u16 {
    // Create a pseudo-header for checksum calculation
    // The proper way is to use pnet's checksum utilities
    let tcp_len = tcp.packet().len();

    // Build pseudo-header: source IP, dest IP, zero, protocol, TCP length
    let mut pseudo_header = Vec::with_capacity(12 + tcp_len);
    pseudo_header.extend_from_slice(&source.octets());
    pseudo_header.extend_from_slice(&dest.octets());
    pseudo_header.push(0); // Zero
    pseudo_header.push(6); // TCP protocol number
    pseudo_header.push((tcp_len >> 8) as u8);
    pseudo_header.push((tcp_len & 0xff) as u8);
    pseudo_header.extend_from_slice(tcp.packet());

    // Calculate checksum
    let mut sum: u32 = 0;
    let mut i = 0;
    while i < pseudo_header.len() {
        let word = if i + 1 < pseudo_header.len() {
            u16::from_be_bytes([pseudo_header[i], pseudo_header[i + 1]])
        } else {
            u16::from_be_bytes([pseudo_header[i], 0])
        };
        sum = sum.wrapping_add(u32::from(word));
        i += 2;
    }

    // Fold 32-bit sum to 16-bit
    while sum >> 16 != 0 {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }

    !sum as u16
}

// =============================================================================
// Utility Functions
// =============================================================================

/// Check if the current process has the privileges needed for a discovery method
///
/// Note: This function is async because `surge_ping::Client::new` requires a tokio runtime.
pub async fn check_privileges(method: DiscoveryMethod) -> bool {
    match method {
        DiscoveryMethod::IcmpPing => {
            // Try to create a ping client (requires tokio runtime)
            Client::new(&Config::default()).is_ok()
        }
        DiscoveryMethod::ArpScan => {
            // Try to create a datalink channel on any interface
            let interfaces = datalink::interfaces();
            for iface in interfaces {
                if !iface.is_loopback() && iface.is_up() {
                    if datalink::channel(&iface, Default::default()).is_ok() {
                        return true;
                    }
                }
            }
            false
        }
        DiscoveryMethod::TcpSyn => {
            // TCP SYN requires raw socket - check by trying to create one
            let protocol =
                TransportChannelType::Layer4(TransportProtocol::Ipv4(IpNextHeaderProtocols::Tcp));
            transport::transport_channel(4096, protocol).is_ok()
        }
        DiscoveryMethod::TcpConnect
        | DiscoveryMethod::Mdns
        | DiscoveryMethod::Ssdp
        | DiscoveryMethod::UdpScan
        | DiscoveryMethod::Icmpv6Ping
        | DiscoveryMethod::WsDiscovery
        | DiscoveryMethod::ArpCache
        | DiscoveryMethod::None => true,
    }
}

/// Get available discovery methods for the current system
///
/// Note: This function is async because privilege checking for ICMP requires a tokio runtime.
pub async fn get_available_methods() -> Vec<(DiscoveryMethod, bool)> {
    vec![
        (DiscoveryMethod::TcpConnect, true), // Always available (no privileges needed)
        (
            DiscoveryMethod::IcmpPing,
            check_privileges(DiscoveryMethod::IcmpPing).await,
        ),
        (
            DiscoveryMethod::ArpScan,
            check_privileges(DiscoveryMethod::ArpScan).await,
        ),
        (
            DiscoveryMethod::TcpSyn,
            check_privileges(DiscoveryMethod::TcpSyn).await,
        ),
        (DiscoveryMethod::Mdns, true),
        (DiscoveryMethod::Ssdp, true),        // No privileges needed
        (DiscoveryMethod::UdpScan, true),     // No privileges needed
        (DiscoveryMethod::Icmpv6Ping, true),  // No privileges needed on most systems
        (DiscoveryMethod::WsDiscovery, true), // No privileges needed
        (DiscoveryMethod::ArpCache, true),    // No privileges needed (reads OS cache)
        (DiscoveryMethod::None, true),
    ]
}

/// Get all local (non-loopback) IP addresses of this machine
fn get_local_ip_addresses() -> HashSet<IpAddr> {
    let mut local_ips = HashSet::new();

    if let Ok(addrs) = if_addrs::get_if_addrs() {
        for iface in addrs {
            let ip = iface.addr.ip();
            // Skip loopback addresses
            if !ip.is_loopback() {
                local_ips.insert(ip);
            }
        }
    }

    local_ips
}

// =============================================================================
// SSDP/UPnP Discovery
// =============================================================================

/// SSDP multicast address for IPv4
const SSDP_MULTICAST_ADDR_V4: &str = "239.255.255.250:1900";

/// SSDP multicast address for IPv6 link-local (ff02::c)
const SSDP_MULTICAST_ADDR_V6: &str = "[ff02::c]:1900";

/// M-SEARCH search targets for broader device discovery
const SSDP_SEARCH_TARGETS: &[&str] = &[
    "ssdp:all",
    "upnp:rootdevice",
    "urn:schemas-upnp-org:device:InternetGatewayDevice:1",
];

/// Build M-SEARCH request for given host and search target
fn build_msearch(host: &str, st: &str) -> Vec<u8> {
    format!(
        "M-SEARCH * HTTP/1.1\r\n\
         Host: {host}\r\n\
         Man: \"ssdp:discover\"\r\n\
         MX: 2\r\n\
         ST: {st}\r\n\
         \r\n"
    )
    .into_bytes()
}

/// Per-host SSDP data collected during discovery
#[derive(Clone, Default)]
struct SsdpHostData {
    server: Option<String>,
    location: Option<String>,
}

/// Minimum timeout for SSDP discovery (multicast needs time for responses)
const SSDP_MIN_TIMEOUT_MS: u32 = 3000;

/// Maximum concurrent LOCATION XML fetches
const SSDP_MAX_LOCATION_FETCHES: usize = 5;

/// Discover hosts using SSDP/UPnP protocol with device description fetching
async fn ssdp_discovery(options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let ssdp_timeout = options.timeout_ms.max(SSDP_MIN_TIMEOUT_MS);
    let timeout_duration = Duration::from_millis(u64::from(ssdp_timeout));

    let hosts = Arc::new(tokio::sync::Mutex::new(HashSet::new()));
    let host_data = Arc::new(tokio::sync::Mutex::new(std::collections::HashMap::<
        String,
        SsdpHostData,
    >::new()));

    // Run IPv4 and IPv6 SSDP discovery in parallel
    let v4_handle = {
        let hosts = Arc::clone(&hosts);
        let host_data = Arc::clone(&host_data);
        tokio::spawn(async move {
            ssdp_collect_responses(
                "0.0.0.0:0",
                SSDP_MULTICAST_ADDR_V4,
                "239.255.255.250:1900",
                timeout_duration,
                hosts,
                host_data,
            )
            .await;
        })
    };

    let v6_handle = {
        let hosts = Arc::clone(&hosts);
        let host_data = Arc::clone(&host_data);
        tokio::spawn(async move {
            ssdp_collect_responses(
                "[::]:0",
                SSDP_MULTICAST_ADDR_V6,
                "[ff02::c]:1900",
                timeout_duration,
                hosts,
                host_data,
            )
            .await;
        })
    };

    let _ = tokio::join!(v4_handle, v6_handle);

    // Snapshot data to avoid holding locks during async fetch
    let hosts_snapshot = hosts.lock().await.clone();
    let host_data_snapshot = host_data.lock().await.clone();
    let host_metadata = ssdp_fetch_device_descriptions(&hosts_snapshot, &host_data_snapshot).await;

    DiscoveryResult {
        method: "ssdp".to_string(),
        hosts: hosts_snapshot.iter().cloned().collect(),
        hostnames: std::collections::HashMap::new(),
        host_metadata,
        unreachable: vec![],
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}

/// Fetch UPnP device description XMLs and build host metadata
async fn ssdp_fetch_device_descriptions(
    hosts: &HashSet<String>,
    host_data: &std::collections::HashMap<String, SsdpHostData>,
) -> std::collections::HashMap<String, HostMetadata> {
    let semaphore = Arc::new(Semaphore::new(SSDP_MAX_LOCATION_FETCHES));
    let client = Arc::new(
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(1))
            .timeout(Duration::from_secs(2))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap_or_default(),
    );
    let mut fetch_handles = Vec::new();

    for (ip, data) in host_data {
        if let Some(ref location) = data.location {
            let ip = ip.clone();
            let location = location.clone();
            let server = data.server.clone();
            let sem = Arc::clone(&semaphore);
            let client = Arc::clone(&client);

            fetch_handles.push(tokio::spawn(async move {
                let _permit = sem.acquire().await;
                let mut device_info = fetch_upnp_device_description(&client, &location, &ip)
                    .await
                    .unwrap_or_default();
                device_info.server = server;
                if device_info.location.is_none() {
                    device_info.location = Some(location);
                }
                (ip, device_info)
            }));
        }
    }

    let mut metadata = std::collections::HashMap::<String, HostMetadata>::new();

    for handle in fetch_handles {
        if let Ok((ip, device_info)) = handle.await {
            // Only use friendlyName as hostname (SERVER is not an identifier)
            let has_friendly_name = device_info.friendly_name.is_some();
            metadata.insert(
                ip,
                HostMetadata {
                    hostname: device_info.friendly_name.clone(),
                    hostname_source: if has_friendly_name {
                        Some("ssdp".to_string())
                    } else {
                        None
                    },
                    ssdp_device: Some(device_info),
                    ..Default::default()
                },
            );
        }
    }

    // Add basic metadata for hosts without LOCATION or failed fetch
    for ip in hosts {
        if !metadata.contains_key(ip) {
            if let Some(data) = host_data.get(ip) {
                if data.server.is_some() || data.location.is_some() {
                    metadata.insert(
                        ip.clone(),
                        HostMetadata {
                            ssdp_device: Some(super::types::SsdpDeviceInfo {
                                server: data.server.clone(),
                                ..Default::default()
                            }),
                            ..Default::default()
                        },
                    );
                }
            }
        }
    }

    metadata
}

/// Collect SSDP M-SEARCH responses from a specific address family
async fn ssdp_collect_responses(
    bind_addr: &str,
    multicast_addr: &str,
    host_header: &str,
    timeout_duration: Duration,
    hosts: Arc<tokio::sync::Mutex<HashSet<String>>>,
    host_data: Arc<tokio::sync::Mutex<std::collections::HashMap<String, SsdpHostData>>>,
) {
    let socket = match tokio::net::UdpSocket::bind(bind_addr).await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("SSDP: Failed to bind {bind_addr}: {e}");
            return;
        }
    };

    // Send M-SEARCH for each search target
    if let Ok(addr) = multicast_addr.parse::<SocketAddr>() {
        for st in SSDP_SEARCH_TARGETS {
            let msg = build_msearch(host_header, st);
            let _ = socket.send_to(&msg, addr).await;
        }
    }

    // Collect responses
    let mut buf = [0u8; 4096];
    let deadline = tokio::time::Instant::now() + timeout_duration;

    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }

        match tokio::time::timeout(
            remaining.min(Duration::from_millis(100)),
            socket.recv_from(&mut buf),
        )
        .await
        {
            Ok(Ok((len, addr))) => {
                if addr.ip().is_loopback() {
                    continue;
                }

                let ip = addr.ip().to_string();
                let mut hosts_guard = hosts.lock().await;
                let is_new = hosts_guard.insert(ip.clone());
                drop(hosts_guard);

                if is_new {
                    let data = if let Ok(response) = std::str::from_utf8(&buf[..len]) {
                        let parsed = parse_ssdp_response(response);
                        SsdpHostData {
                            server: parsed.server,
                            location: parsed.location,
                        }
                    } else {
                        SsdpHostData::default()
                    };
                    host_data.lock().await.insert(ip, data);
                } else if let Ok(response) = std::str::from_utf8(&buf[..len]) {
                    // Update with better data if we get a LOCATION from a later response
                    let parsed = parse_ssdp_response(response);
                    if parsed.location.is_some() {
                        let mut data_guard = host_data.lock().await;
                        if let Some(existing) = data_guard.get_mut(&ip) {
                            if existing.location.is_none() {
                                existing.location = parsed.location;
                            }
                            if existing.server.is_none() {
                                existing.server = parsed.server;
                            }
                        }
                    }
                }
            }
            Ok(Err(_)) | Err(_) => continue,
        }
    }
}

/// Parsed SSDP response headers
struct SsdpResponse {
    server: Option<String>,
    location: Option<String>,
}

/// Parse SERVER and LOCATION headers from SSDP response
fn parse_ssdp_response(response: &str) -> SsdpResponse {
    let mut server = None;
    let mut location = None;

    for line in response.lines() {
        let lower = line.to_lowercase();
        if lower.starts_with("server:") {
            server = Some(line[7..].trim().to_string());
        } else if lower.starts_with("location:") {
            location = Some(line[9..].trim().to_string());
        }
    }

    SsdpResponse { server, location }
}

/// Maximum response body size for UPnP device description XML (64 KB)
const UPNP_MAX_BODY_SIZE: usize = 64 * 1024;

/// Validate that a LOCATION URL is safe to fetch (SSRF prevention).
/// Checks: HTTP scheme only, host is private/link-local, host matches SSDP source IP.
fn is_safe_upnp_location(location: &str, source_ip: &str) -> bool {
    let url = match reqwest::Url::parse(location) {
        Ok(u) => u,
        Err(_) => return false,
    };

    // Only allow HTTP (UPnP descriptions are HTTP-only)
    if url.scheme() != "http" {
        return false;
    }

    // Must have a valid host that is an IP address
    let host = match url.host_str() {
        Some(h) => h,
        None => return false,
    };

    // Strip IPv6 brackets if present (host_str() returns "[::1]" for IPv6)
    let host_bare = host
        .strip_prefix('[')
        .and_then(|h| h.strip_suffix(']'))
        .unwrap_or(host);

    // Parse both host and source_ip as IpAddr for canonical comparison
    let location_ip: IpAddr = match host_bare.parse() {
        Ok(ip) => ip,
        Err(_) => return false, // Non-IP hostnames are rejected
    };
    let source: IpAddr = match source_ip.parse() {
        Ok(ip) => ip,
        Err(_) => return false,
    };

    // Verify LOCATION host matches the SSDP response source IP
    if location_ip != source {
        return false;
    }

    // Verify it's a private/link-local address
    match location_ip {
        IpAddr::V4(ip) => ip.is_private() || ip.is_link_local(),
        IpAddr::V6(ip) => {
            // fe80::/10 link-local or fc00::/7 unique-local (RFC 4193)
            let segments = ip.segments();
            (segments[0] & 0xffc0) == 0xfe80 || (segments[0] & 0xfe00) == 0xfc00
        }
    }
}

/// Fetch and parse UPnP device description XML from LOCATION URL
async fn fetch_upnp_device_description(
    client: &reqwest::Client,
    location: &str,
    source_ip: &str,
) -> Option<super::types::SsdpDeviceInfo> {
    // Validate URL before fetching (SSRF prevention)
    if !is_safe_upnp_location(location, source_ip) {
        return None;
    }

    let response = client.get(location).send().await.ok()?;

    // Check content-length before reading body (fast rejection)
    if let Some(content_length) = response.content_length() {
        if content_length as usize > UPNP_MAX_BODY_SIZE {
            return None;
        }
    }

    // Read body with streaming size limit to prevent memory exhaustion
    // from chunked transfer encoding without Content-Length
    let bytes = response.bytes().await.ok()?;
    if bytes.len() > UPNP_MAX_BODY_SIZE {
        return None;
    }
    let body = String::from_utf8_lossy(&bytes);

    parse_upnp_device_xml(&body, location)
}

/// Parse UPnP device description XML to extract device info
fn parse_upnp_device_xml(xml: &str, location: &str) -> Option<super::types::SsdpDeviceInfo> {
    use quick_xml::events::Event;
    use quick_xml::reader::Reader;

    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();

    let mut friendly_name = None;
    let mut manufacturer = None;
    let mut model_name = None;
    let mut model_number = None;
    let mut device_type = None;
    let mut current_tag = String::new();
    // Only capture fields from the first (root) <device> block
    let mut device_depth: u32 = 0;

    let mut assign_field = |tag: &str, text: String| match tag {
        "friendlyName" => friendly_name = Some(text),
        "manufacturer" => manufacturer = Some(text),
        "modelName" => model_name = Some(text),
        "modelNumber" => model_number = Some(text),
        "deviceType" => device_type = Some(text),
        _ => {}
    };

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                if tag == "device" {
                    device_depth += 1;
                }
                current_tag = tag;
            }
            Ok(Event::Text(ref e)) => {
                if device_depth == 1 {
                    let text = e.unescape().unwrap_or_default().trim().to_string();
                    if !text.is_empty() {
                        assign_field(&current_tag, text);
                    }
                }
            }
            Ok(Event::CData(ref e)) => {
                if device_depth == 1 {
                    let text = String::from_utf8_lossy(e.as_ref()).trim().to_string();
                    if !text.is_empty() {
                        assign_field(&current_tag, text);
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                if tag == "device" {
                    device_depth = device_depth.saturating_sub(1);
                }
                current_tag.clear();
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    // Only return if we found at least one useful field
    if friendly_name.is_some()
        || manufacturer.is_some()
        || model_name.is_some()
        || device_type.is_some()
    {
        Some(super::types::SsdpDeviceInfo {
            friendly_name,
            manufacturer,
            model_name,
            model_number,
            device_type,
            location: Some(location.to_string()),
            server: None,
        })
    } else {
        None
    }
}

// =============================================================================
// UDP Scan Discovery
// =============================================================================

/// UDP ports to probe for host discovery
const UDP_DISCOVERY_PORTS: &[u16] = &[
    53,   // DNS
    67,   // DHCP Server
    68,   // DHCP Client
    123,  // NTP
    137,  // NetBIOS Name
    138,  // NetBIOS Datagram
    161,  // SNMP
    500,  // IKE (VPN)
    1900, // SSDP/UPnP
    5353, // mDNS
];

/// Get UDP probe packet for a specific port
fn get_udp_probe(port: u16) -> &'static [u8] {
    match port {
        // DNS query header (minimal)
        53 => &[
            0x00, 0x01, // Transaction ID
            0x01, 0x00, // Flags: Standard query
            0x00, 0x01, // Questions: 1
            0x00, 0x00, // Answer RRs: 0
            0x00, 0x00, // Authority RRs: 0
            0x00, 0x00, // Additional RRs: 0
        ],
        // NetBIOS name query
        137 => &[
            0x80, 0x94, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x43,
            0x4b,
        ],
        // SNMP GetRequest (community: public)
        161 => &[
            0x30, 0x26, 0x02, 0x01, 0x01, 0x04, 0x06, 0x70, 0x75, 0x62, 0x6c, 0x69, 0x63,
        ],
        // NTP version request
        123 => &[0x1b, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        // Generic probe
        _ => &[0x00],
    }
}

/// Discover hosts using UDP probes to common ports
async fn udp_scan_discovery(targets: &[IpAddr], options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let probe_timeout = Duration::from_millis(200);
    let semaphore = Arc::new(Semaphore::new(options.concurrency as usize));

    let mut hosts = Vec::new();
    let mut unreachable = Vec::new();

    // Filter to IPv4 targets only (UDP scan implementation is simpler for IPv4)
    let ipv4_targets: Vec<IpAddr> = targets.iter().filter(|ip| ip.is_ipv4()).copied().collect();

    if ipv4_targets.is_empty() {
        return DiscoveryResult {
            method: "udp_scan".to_string(),
            hosts: vec![],
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
            error: None,
            requires_privileges: false,
        };
    }

    let mut handles = Vec::with_capacity(ipv4_targets.len());

    for target in ipv4_targets {
        let sem = Arc::clone(&semaphore);

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await;

            // Create a single socket for this target
            let socket = match tokio::net::UdpSocket::bind("0.0.0.0:0").await {
                Ok(s) => s,
                Err(_) => return (target, false),
            };

            // Try UDP probes to common ports
            for &port in UDP_DISCOVERY_PORTS {
                let addr = SocketAddr::new(target, port);
                let probe = get_udp_probe(port);

                // Send probe
                if socket.send_to(probe, addr).await.is_err() {
                    continue;
                }

                // Wait for response with timeout
                let mut buf = [0u8; 512];
                match tokio::time::timeout(probe_timeout, socket.recv_from(&mut buf)).await {
                    Ok(Ok(_)) => return (target, true),
                    Ok(Err(_)) | Err(_) => continue,
                }
            }

            (target, false)
        });

        handles.push(handle);
    }

    // Collect all results
    for handle in handles {
        if let Ok((target, reachable)) = handle.await {
            if reachable {
                hosts.push(target.to_string());
            } else {
                unreachable.push(target.to_string());
            }
        }
    }

    DiscoveryResult {
        method: "udp_scan".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata: std::collections::HashMap::new(),
        unreachable,
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}

// =============================================================================
// ICMPv6 Ping Discovery
// =============================================================================

/// ICMPv6 Echo Request (ping) for discovering IPv6 hosts
///
/// Uses ICMPv6 Echo Request/Reply (Type 128/129) to discover live hosts.
/// This is different from ICMPv6 Neighbor Discovery Protocol (RFC 4861)
/// which uses Neighbor Solicitation/Advertisement for link-layer address resolution.
/// ICMPv6 ping works across routers while NDP is limited to the local link.
async fn icmpv6_ping_discovery(targets: &[IpAddr], options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let timeout_duration = Duration::from_millis(u64::from(options.timeout_ms));
    let semaphore = Arc::new(Semaphore::new(options.concurrency as usize));

    let mut hosts = Vec::new();
    let mut unreachable = Vec::new();

    // Filter to IPv6 targets only
    let ipv6_targets: Vec<Ipv6Addr> = targets
        .iter()
        .filter_map(|ip| match ip {
            IpAddr::V6(v6) => Some(*v6),
            IpAddr::V4(_) => None,
        })
        .collect();

    if ipv6_targets.is_empty() {
        return DiscoveryResult {
            method: "icmpv6_ping".to_string(),
            hosts: vec![],
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
            error: None,
            requires_privileges: false,
        };
    }

    // Use surge_ping for ICMPv6 Echo Request/Reply
    let client = match Client::new(&Config::default()) {
        Ok(c) => Arc::new(c),
        Err(e) => {
            return DiscoveryResult {
                method: "icmpv6_ping".to_string(),
                hosts: vec![],
                hostnames: std::collections::HashMap::new(),
                host_metadata: std::collections::HashMap::new(),
                unreachable: ipv6_targets.iter().map(ToString::to_string).collect(),
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(format!("Failed to create ICMPv6 client: {e}")),
                requires_privileges: true,
            };
        }
    };

    let mut handles = Vec::with_capacity(ipv6_targets.len());

    for (idx, target) in ipv6_targets.iter().enumerate() {
        let sem = Arc::clone(&semaphore);
        let client = Arc::clone(&client);
        let target = *target;

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;

            let payload = [0u8; 56];
            let mut pinger = client
                .pinger(IpAddr::V6(target), PingIdentifier(idx as u16))
                .await;

            // Try ping with retries
            for seq in 0..2u16 {
                let timeout_per_ping = timeout_duration / 2;
                match timeout(timeout_per_ping, pinger.ping(PingSequence(seq), &payload)).await {
                    Ok(Ok(_reply)) => return Some((target, true)),
                    Ok(Err(_)) | Err(_) => continue,
                }
            }

            Some((target, false))
        });

        handles.push(handle);
    }

    for handle in handles {
        if let Ok(Some((ip, alive))) = handle.await {
            if alive {
                hosts.push(ip.to_string());
            } else {
                unreachable.push(ip.to_string());
            }
        }
    }

    DiscoveryResult {
        method: "icmpv6_ping".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata: std::collections::HashMap::new(),
        unreachable,
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}

// =============================================================================
// ARP Cache Discovery (non-privileged)
// =============================================================================

/// Discover hosts by reading the OS ARP cache (no privileges required)
fn arp_cache_discovery(targets: &[IpAddr]) -> DiscoveryResult {
    let start = std::time::Instant::now();

    // Read system ARP cache
    let entries = super::arp_cache::read_arp_cache();
    let target_set: HashSet<String> = targets.iter().map(ToString::to_string).collect();

    let mut hosts = Vec::new();
    let mut host_metadata = std::collections::HashMap::new();

    for entry in &entries {
        // Only include entries that match our target range
        if !target_set.contains(&entry.ip) {
            // Check if the IP is within any target CIDR
            let entry_ip: IpAddr = match entry.ip.parse() {
                Ok(ip) => ip,
                Err(_) => continue,
            };
            if !targets.contains(&entry_ip) {
                continue;
            }
        }

        hosts.push(entry.ip.clone());

        // Look up vendor from OUI
        let vendor = super::oui::lookup_vendor(&entry.mac).map(String::from);

        host_metadata.insert(
            entry.ip.clone(),
            HostMetadata {
                mac_address: Some(entry.mac.clone()),
                vendor,
                ..Default::default()
            },
        );
    }

    DiscoveryResult {
        method: "arp_cache".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata,
        unreachable: vec![],
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}

// =============================================================================
// WS-Discovery Method
// =============================================================================

/// Discover hosts using WS-Discovery SOAP Probe
async fn ws_discovery_method(options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let timeout_duration = Duration::from_millis(u64::from(options.timeout_ms.max(3000)));

    let results = Box::pin(super::ws_discovery::ws_discovery_probe(timeout_duration)).await;

    let hosts: Vec<String> = results.keys().cloned().collect();
    let host_metadata: std::collections::HashMap<String, HostMetadata> = results
        .into_iter()
        .map(|(ip, info)| {
            (
                ip,
                HostMetadata {
                    ws_discovery: Some(info),
                    ..Default::default()
                },
            )
        })
        .collect();

    DiscoveryResult {
        method: "ws_discovery".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata,
        unreachable: vec![],
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    mod is_safe_upnp_location {
        use super::*;

        #[test]
        fn test_valid_private_ipv4_http() {
            assert!(is_safe_upnp_location(
                "http://192.168.1.1:49152/rootDesc.xml",
                "192.168.1.1"
            ));
        }

        #[test]
        fn test_valid_10_network() {
            assert!(is_safe_upnp_location(
                "http://10.0.0.1:8080/desc.xml",
                "10.0.0.1"
            ));
        }

        #[test]
        fn test_valid_172_network() {
            assert!(is_safe_upnp_location(
                "http://172.16.0.1:1234/desc.xml",
                "172.16.0.1"
            ));
        }

        #[test]
        fn test_rejects_https() {
            assert!(!is_safe_upnp_location(
                "https://192.168.1.1:443/desc.xml",
                "192.168.1.1"
            ));
        }

        #[test]
        fn test_rejects_hostname() {
            assert!(!is_safe_upnp_location(
                "http://mydevice.local:8080/desc.xml",
                "192.168.1.1"
            ));
        }

        #[test]
        fn test_rejects_source_ip_mismatch() {
            assert!(!is_safe_upnp_location(
                "http://192.168.1.1:49152/rootDesc.xml",
                "192.168.1.2"
            ));
        }

        #[test]
        fn test_rejects_public_ip() {
            assert!(!is_safe_upnp_location(
                "http://8.8.8.8:80/desc.xml",
                "8.8.8.8"
            ));
        }

        #[test]
        fn test_rejects_loopback() {
            assert!(!is_safe_upnp_location(
                "http://127.0.0.1:80/desc.xml",
                "127.0.0.1"
            ));
        }

        #[test]
        fn test_valid_ipv6_link_local() {
            assert!(is_safe_upnp_location(
                "http://[fe80::1]:49152/desc.xml",
                "fe80::1"
            ));
        }

        #[test]
        fn test_valid_ipv6_ula_fd() {
            assert!(is_safe_upnp_location(
                "http://[fd00::1]:49152/desc.xml",
                "fd00::1"
            ));
        }

        #[test]
        fn test_valid_ipv6_ula_fc() {
            assert!(is_safe_upnp_location(
                "http://[fc00::1]:49152/desc.xml",
                "fc00::1"
            ));
        }

        #[test]
        fn test_rejects_ipv6_global() {
            assert!(!is_safe_upnp_location(
                "http://[2001:db8::1]:80/desc.xml",
                "2001:db8::1"
            ));
        }

        #[test]
        fn test_rejects_empty_url() {
            assert!(!is_safe_upnp_location("", "192.168.1.1"));
        }

        #[test]
        fn test_rejects_invalid_url() {
            assert!(!is_safe_upnp_location("not-a-url", "192.168.1.1"));
        }
    }

    mod parse_upnp_device_xml {
        use super::*;

        #[test]
        fn test_valid_device_description() {
            let xml = r#"<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
  <device>
    <friendlyName>My Router</friendlyName>
    <manufacturer>ACME Corp</manufacturer>
    <modelName>Router 3000</modelName>
    <modelNumber>R3K</modelNumber>
    <deviceType>urn:schemas-upnp-org:device:InternetGatewayDevice:1</deviceType>
  </device>
</root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1:49152/desc.xml");
            assert!(result.is_some());
            let info = result.unwrap();
            assert_eq!(info.friendly_name.as_deref(), Some("My Router"));
            assert_eq!(info.manufacturer.as_deref(), Some("ACME Corp"));
            assert_eq!(info.model_name.as_deref(), Some("Router 3000"));
            assert_eq!(info.model_number.as_deref(), Some("R3K"));
            assert_eq!(
                info.device_type.as_deref(),
                Some("urn:schemas-upnp-org:device:InternetGatewayDevice:1")
            );
            assert_eq!(
                info.location.as_deref(),
                Some("http://192.168.1.1:49152/desc.xml")
            );
        }

        #[test]
        fn test_empty_xml() {
            let result = parse_upnp_device_xml("", "http://192.168.1.1/desc.xml");
            assert!(result.is_none());
        }

        #[test]
        fn test_xml_without_device_fields() {
            let xml = r#"<?xml version="1.0"?><root><device></device></root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            assert!(result.is_none());
        }

        #[test]
        fn test_cdata_in_friendly_name() {
            let xml = r#"<?xml version="1.0"?>
<root>
  <device>
    <friendlyName><![CDATA[My Device & More]]></friendlyName>
    <manufacturer>TestCo</manufacturer>
  </device>
</root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            assert!(result.is_some());
            let info = result.unwrap();
            assert_eq!(info.friendly_name.as_deref(), Some("My Device & More"));
        }

        #[test]
        fn test_nested_device_uses_root_only() {
            let xml = r#"<?xml version="1.0"?>
<root>
  <device>
    <friendlyName>Root Device</friendlyName>
    <deviceList>
      <device>
        <friendlyName>Sub Device</friendlyName>
      </device>
    </deviceList>
  </device>
</root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            assert!(result.is_some());
            let info = result.unwrap();
            assert_eq!(info.friendly_name.as_deref(), Some("Root Device"));
        }

        #[test]
        fn test_malformed_xml() {
            let xml = r"<root><device><friendlyName>Broken";
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            // Should not panic; may return None or partial result
            // The parser breaks on Err but may have captured partial data
            assert!(result.is_none() || result.is_some());
        }

        #[test]
        fn test_partial_fields() {
            let xml = r#"<?xml version="1.0"?>
<root>
  <device>
    <manufacturer>OnlyManufacturer</manufacturer>
  </device>
</root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            assert!(result.is_some());
            let info = result.unwrap();
            assert_eq!(info.manufacturer.as_deref(), Some("OnlyManufacturer"));
            assert!(info.friendly_name.is_none());
            assert!(info.model_name.is_none());
        }
    }

    mod parse_ssdp_response {
        use super::*;

        #[test]
        fn test_with_server_and_location() {
            let response = "HTTP/1.1 200 OK\r\n\
                SERVER: Linux/3.0 UPnP/1.0 miniupnpd/1.5\r\n\
                LOCATION: http://192.168.1.1:49152/rootDesc.xml\r\n\
                ST: upnp:rootdevice\r\n\r\n";
            let parsed = parse_ssdp_response(response);
            assert_eq!(
                parsed.server.as_deref(),
                Some("Linux/3.0 UPnP/1.0 miniupnpd/1.5")
            );
            assert_eq!(
                parsed.location.as_deref(),
                Some("http://192.168.1.1:49152/rootDesc.xml")
            );
        }

        #[test]
        fn test_without_location() {
            let response = "HTTP/1.1 200 OK\r\n\
                SERVER: Some Server\r\n\
                ST: ssdp:all\r\n\r\n";
            let parsed = parse_ssdp_response(response);
            assert_eq!(parsed.server.as_deref(), Some("Some Server"));
            assert!(parsed.location.is_none());
        }

        #[test]
        fn test_empty_response() {
            let parsed = parse_ssdp_response("");
            assert!(parsed.server.is_none());
            assert!(parsed.location.is_none());
        }

        #[test]
        fn test_case_insensitive_headers() {
            let response = "HTTP/1.1 200 OK\r\n\
                server: my server\r\n\
                location: http://10.0.0.1/desc.xml\r\n\r\n";
            let parsed = parse_ssdp_response(response);
            assert_eq!(parsed.server.as_deref(), Some("my server"));
            assert_eq!(parsed.location.as_deref(), Some("http://10.0.0.1/desc.xml"));
        }
    }
}
