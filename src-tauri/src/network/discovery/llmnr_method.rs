//! Discovery-layer wrapper around the LLMNR multicast PTR probe.
//!
//! The real LLMNR client lives in the sibling `llmnr` module.

use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Semaphore;

use super::super::llmnr;
use super::types::{DiscoveryOptions, DiscoveryResult, HostMetadata};

/// Total time budget for LLMNR collection
const LLMNR_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(2);

/// Maximum concurrent LLMNR queries
const LLMNR_DISCOVERY_CONCURRENCY: usize = 64;

/// Discover hosts via LLMNR multicast PTR resolution of every target IP.
///
/// LLMNR has no wildcard concept, so we follow Windows' own approach: issue
/// reverse PTR queries (`x.in-addr.arpa` for IPv4) toward the LLMNR multicast
/// group and treat any responding host as alive with the resolved hostname.
/// The whole batch runs concurrently; the function returns once every spawned
/// probe finishes or its per-query timeout elapses, capped by
/// [`LLMNR_DISCOVERY_TIMEOUT`].
pub(super) async fn llmnr_discovery(
    targets: &[IpAddr],
    _options: &DiscoveryOptions,
) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let semaphore = Arc::new(Semaphore::new(LLMNR_DISCOVERY_CONCURRENCY));

    let handles: Vec<_> = targets
        .iter()
        .copied()
        .map(|target| {
            let sem = Arc::clone(&semaphore);
            tokio::spawn(async move {
                let _permit = sem.acquire().await.ok()?;
                let ip_str = target.to_string();
                let name = llmnr::resolve_hostname(&ip_str, LLMNR_DISCOVERY_TIMEOUT).await?;
                Some((target, name))
            })
        })
        .collect();

    let mut hostnames = std::collections::HashMap::new();
    let mut host_metadata: std::collections::HashMap<String, HostMetadata> =
        std::collections::HashMap::new();
    let mut hosts = Vec::new();
    let mut unreachable: Vec<String> = targets.iter().map(ToString::to_string).collect();

    for handle in handles {
        if let Ok(Some((target, name))) = handle.await {
            let ip_str = target.to_string();
            unreachable.retain(|ip| ip != &ip_str);
            hosts.push(ip_str.clone());
            hostnames.insert(ip_str.clone(), name.clone());
            host_metadata.insert(
                ip_str,
                HostMetadata {
                    hostname: Some(name),
                    hostname_source: Some("llmnr".to_string()),
                    ..Default::default()
                },
            );
        }
    }

    DiscoveryResult {
        method: "llmnr".to_string(),
        hosts,
        hostnames,
        host_metadata,
        unreachable,
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}
