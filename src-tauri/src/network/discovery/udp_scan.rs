//! UDP port-probe host discovery.

use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Semaphore;

use super::types::{DiscoveryOptions, DiscoveryResult};

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
pub(super) async fn udp_scan_discovery(
    targets: &[IpAddr],
    options: &DiscoveryOptions,
) -> DiscoveryResult {
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
