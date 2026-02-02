//! Network interface discovery and mDNS/Bonjour support

use std::collections::HashMap;
use std::time::{Duration, Instant};

use mdns_sd::{ServiceDaemon, ServiceEvent};

use super::types::{LocalNetworkInfo, MdnsDiscoveryResults, MdnsService, NetworkInterface};

/// Get all local network interfaces
pub fn get_local_interfaces() -> LocalNetworkInfo {
    let mut interfaces = Vec::new();

    if let Ok(addrs) = if_addrs::get_if_addrs() {
        for iface in addrs {
            let ip = iface.addr.ip();
            let is_ipv6 = ip.is_ipv6();
            let is_loopback = ip.is_loopback();

            // Calculate prefix length and suggested CIDR
            let (prefix_len, suggested_cidr) = match &iface.addr {
                if_addrs::IfAddr::V4(v4) => {
                    let prefix = netmask_to_prefix_v4(v4.netmask);
                    let cidr = if !is_loopback {
                        Some(calculate_network_cidr_v4(v4.ip, v4.netmask, prefix))
                    } else {
                        None
                    };
                    (prefix, cidr)
                }
                if_addrs::IfAddr::V6(v6) => {
                    let prefix = netmask_to_prefix_v6(v6.netmask);
                    // For IPv6, suggest /64 for most networks
                    let cidr = if !is_loopback && !is_link_local_v6(&v6.ip) {
                        Some(format!("{}/{}", v6.ip, prefix.min(64)))
                    } else {
                        None
                    };
                    (prefix, cidr)
                }
            };

            interfaces.push(NetworkInterface {
                name: iface.name.clone(),
                ip: ip.to_string(),
                is_ipv6,
                is_loopback,
                suggested_cidr,
                prefix_len,
            });
        }
    }

    // Sort interfaces: non-loopback first, then by name
    interfaces.sort_by(|a, b| {
        a.is_loopback
            .cmp(&b.is_loopback)
            .then_with(|| a.name.cmp(&b.name))
    });

    // Find primary interfaces
    let primary_ipv4 = interfaces
        .iter()
        .find(|i| !i.is_ipv6 && !i.is_loopback)
        .cloned();

    let primary_ipv6 = interfaces
        .iter()
        .find(|i| {
            i.is_ipv6 && !i.is_loopback && !i.ip.starts_with("fe80:") // Not link-local
        })
        .cloned();

    LocalNetworkInfo {
        interfaces,
        primary_ipv4,
        primary_ipv6,
    }
}

/// Check if an IPv6 address is link-local
fn is_link_local_v6(ip: &std::net::Ipv6Addr) -> bool {
    let segments = ip.segments();
    segments[0] == 0xfe80
}

/// Convert IPv4 netmask to prefix length
fn netmask_to_prefix_v4(netmask: std::net::Ipv4Addr) -> u8 {
    netmask.octets().iter().map(|o| o.count_ones() as u8).sum()
}

/// Convert IPv6 netmask to prefix length
fn netmask_to_prefix_v6(netmask: std::net::Ipv6Addr) -> u8 {
    netmask
        .segments()
        .iter()
        .map(|s| s.count_ones() as u8)
        .sum()
}

/// Calculate network CIDR from IP and netmask
fn calculate_network_cidr_v4(
    ip: std::net::Ipv4Addr,
    netmask: std::net::Ipv4Addr,
    prefix: u8,
) -> String {
    let ip_octets = ip.octets();
    let mask_octets = netmask.octets();

    let network: [u8; 4] = [
        ip_octets[0] & mask_octets[0],
        ip_octets[1] & mask_octets[1],
        ip_octets[2] & mask_octets[2],
        ip_octets[3] & mask_octets[3],
    ];

    format!(
        "{}.{}.{}.{}/{}",
        network[0], network[1], network[2], network[3], prefix
    )
}

/// Discover mDNS/Bonjour services on the local network
pub async fn discover_mdns_services(
    service_types: Vec<String>,
    duration_ms: u32,
) -> Result<MdnsDiscoveryResults, String> {
    let start = Instant::now();
    let duration = Duration::from_millis(u64::from(duration_ms));

    // Create the mDNS daemon
    let mdns = ServiceDaemon::new().map_err(|e| format!("Failed to create mDNS daemon: {e}"))?;

    // Map to collect services by full name to avoid duplicates
    let mut services_map: HashMap<String, MdnsService> = HashMap::new();

    // Browse for each service type
    let mut receivers = Vec::new();
    for service_type in &service_types {
        // Ensure the service type ends with .local.
        let full_type = if service_type.ends_with(".local.") {
            service_type.clone()
        } else if service_type.ends_with(".local") {
            format!("{service_type}.")
        } else {
            format!("{service_type}.local.")
        };

        match mdns.browse(&full_type) {
            Ok(receiver) => receivers.push((full_type, receiver)),
            Err(e) => {
                // Log but continue with other service types
                eprintln!("Failed to browse {full_type}: {e}");
            }
        }
    }

    // Collect events until timeout
    let deadline = Instant::now() + duration;

    while Instant::now() < deadline {
        for (service_type, receiver) in &receivers {
            // Non-blocking receive with small timeout
            if let Ok(event) = receiver.recv_timeout(Duration::from_millis(50)) {
                match &event {
                    ServiceEvent::ServiceFound(svc_type, instance) => {
                        // Service found, waiting for resolution
                        #[cfg(debug_assertions)]
                        eprintln!("[mDNS] ServiceFound: {} (type: {})", instance, svc_type);
                    }
                    ServiceEvent::ServiceResolved(info) => {
                        #[cfg(debug_assertions)]
                        eprintln!(
                            "[mDNS] ServiceResolved: {} at {} (addresses: {:?})",
                            info.get_fullname(),
                            info.get_hostname(),
                            info.get_addresses()
                        );
                    }
                    _ => {}
                }

                if let ServiceEvent::ServiceResolved(info) = event {
                    let full_name = info.get_fullname().to_string();

                    // Collect addresses, filtering out loopback addresses
                    let addresses: Vec<String> = info
                        .get_addresses()
                        .iter()
                        .filter(|a| !a.is_loopback())
                        .map(|a| a.to_string())
                        .collect();

                    // Collect TXT properties
                    let properties: Vec<(String, String)> = info
                        .get_properties()
                        .iter()
                        .map(|p| (p.key().to_string(), p.val_str().to_string()))
                        .collect();

                    let service = MdnsService {
                        instance_name: info
                            .get_fullname()
                            .strip_suffix(service_type)
                            .unwrap_or(info.get_fullname())
                            .trim_end_matches('.')
                            .to_string(),
                        service_type: service_type.trim_end_matches('.').to_string(),
                        hostname: info.get_hostname().to_string(),
                        addresses,
                        port: info.get_port(),
                        properties,
                    };

                    services_map.insert(full_name, service);
                }
            }
        }

        // Small sleep to prevent busy loop
        tokio::time::sleep(Duration::from_millis(10)).await;
    }

    // Shutdown the daemon
    drop(mdns);

    let mut services: Vec<MdnsService> = services_map.into_values().collect();
    services.sort_by(|a, b| a.instance_name.cmp(&b.instance_name));

    Ok(MdnsDiscoveryResults {
        services,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}
