//! TCP Connect host discovery and per-host probe routine.

use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Semaphore;
use tokio::time::timeout;

use super::super::banner;
use super::types::{DiscoveryOptions, DiscoveryResult, HostMetadata, CONNECT_DISCOVERY_PORTS};

/// Discover hosts using TCP connect scan (no privileges needed)
///
/// After the first successful connect to any probe port, attempts a banner-grab
/// against the recognised banner ports already in the candidate list and
/// attaches the resulting [`ServiceBanner`]s to the host metadata.
pub(super) async fn tcp_connect_discovery(
    targets: &[IpAddr],
    options: &DiscoveryOptions,
) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let timeout_duration = Duration::from_millis(u64::from(options.timeout_ms));
    let semaphore = Arc::new(Semaphore::new(options.concurrency as usize));

    // Use extended port list for better discovery accuracy
    let ports = options
        .syn_ports
        .as_ref()
        .map_or(CONNECT_DISCOVERY_PORTS, Vec::as_slice);

    let handles: Vec<_> = targets
        .iter()
        .copied()
        .map(|target| {
            let sem = Arc::clone(&semaphore);
            let ports = ports.to_vec();
            tokio::spawn(async move {
                let _permit = sem.acquire().await;
                probe_target(target, &ports, timeout_duration).await
            })
        })
        .collect();

    let mut hosts = Vec::new();
    let mut unreachable = Vec::new();
    let mut host_metadata: std::collections::HashMap<String, HostMetadata> =
        std::collections::HashMap::new();

    for handle in handles {
        if let Ok(probe) = handle.await {
            let ip_str = probe.target.to_string();
            if probe.reachable {
                hosts.push(ip_str.clone());
                if !probe.banners.is_empty() {
                    host_metadata
                        .entry(ip_str)
                        .or_default()
                        .banners
                        .extend(probe.banners);
                }
            } else {
                unreachable.push(ip_str);
            }
        }
    }

    DiscoveryResult {
        method: "tcp_connect".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata,
        unreachable,
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}

/// Result of probing a single target during TCP connect discovery.
struct TcpProbeOutcome {
    target: IpAddr,
    reachable: bool,
    banners: Vec<banner::ServiceBanner>,
}

/// Ports for which we know how to parse a banner. Limits banner-grab cost.
const BANNER_GRAB_PORTS: &[u16] = &[21, 22, 23, 25, 80, 443, 587, 6379, 8080, 8443, 11211];

/// Connect to each probe port and gather banners from supported services.
async fn probe_target(
    target: IpAddr,
    ports: &[u16],
    timeout_duration: Duration,
) -> TcpProbeOutcome {
    let mut reachable = false;
    let mut banners = Vec::new();

    for port in ports {
        let addr = SocketAddr::new(target, *port);
        let connect = timeout(timeout_duration, tokio::net::TcpStream::connect(addr)).await;
        let stream = match connect {
            Ok(Ok(stream)) => stream,
            _ => continue,
        };
        reachable = true;

        if BANNER_GRAB_PORTS.contains(port) {
            if let Some(banner) = banner::grab_banner(stream, *port).await {
                if !banners
                    .iter()
                    .any(|existing: &banner::ServiceBanner| existing == &banner)
                {
                    banners.push(banner);
                }
            }
        }
    }

    TcpProbeOutcome {
        target,
        reachable,
        banners,
    }
}
