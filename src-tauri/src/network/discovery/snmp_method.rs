//! Discovery-layer wrapper around the sysName SNMP probe.
//!
//! The real SNMP client lives in the sibling `snmp` module; this file only
//! issues a sysName GetRequest per target and translates the result into a
//! `DiscoveryResult`.

use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Semaphore;

use super::super::snmp;
use super::types::{DiscoveryOptions, DiscoveryResult, HostMetadata};

/// Maximum concurrent SNMP probes
const SNMP_DISCOVERY_CONCURRENCY: usize = 64;

/// Per-host SNMP query timeout
const SNMP_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(1);

/// SNMP communities to try, in order
const SNMP_DISCOVERY_COMMUNITIES: &[&str] = &["public", "private"];

/// Discover hosts via SNMP sysName GetRequest across the target range.
///
/// For each target, sends an SNMPv2c `sysName.0` query in a blocking task,
/// trying each community in [`SNMP_DISCOVERY_COMMUNITIES`]. Successful
/// responses are recorded as reachable hosts with populated `snmp_info`.
pub(super) async fn snmp_discovery(
    targets: &[IpAddr],
    _options: &DiscoveryOptions,
) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let semaphore = Arc::new(Semaphore::new(SNMP_DISCOVERY_CONCURRENCY));

    let handles: Vec<_> = targets
        .iter()
        .copied()
        .map(|target| {
            let sem = Arc::clone(&semaphore);
            tokio::spawn(async move {
                let _permit = sem.acquire().await.ok()?;
                let mut found = None;
                for community in SNMP_DISCOVERY_COMMUNITIES {
                    if let Some(info) = snmp::query_snmp_device_info_with_community(
                        target,
                        community.as_bytes(),
                        SNMP_DISCOVERY_TIMEOUT,
                    )
                    .await
                    {
                        found = Some(info);
                        break;
                    }
                }
                found.map(|info| (target, info))
            })
        })
        .collect();

    let mut hosts = Vec::new();
    let mut host_metadata: std::collections::HashMap<String, HostMetadata> =
        std::collections::HashMap::new();
    let mut unreachable: Vec<String> = targets.iter().map(ToString::to_string).collect();

    for handle in handles {
        if let Ok(Some((target, info))) = handle.await {
            let ip_str = target.to_string();
            unreachable.retain(|ip| ip != &ip_str);
            hosts.push(ip_str.clone());

            let hostname = info.sys_name.clone();
            host_metadata.insert(
                ip_str,
                HostMetadata {
                    hostname: hostname.clone(),
                    hostname_source: hostname.as_ref().map(|_| "snmp".to_string()),
                    snmp_info: Some(info),
                    ..Default::default()
                },
            );
        }
    }

    DiscoveryResult {
        method: "snmp".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata,
        unreachable,
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}
