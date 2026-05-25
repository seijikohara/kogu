//! Discovery privilege checks and local-interface enumeration.

use std::collections::HashSet;
use std::net::IpAddr;

use super::types::DiscoveryMethod;

/// Check if the current process can run a given discovery method.
///
/// All remaining methods are userspace and require no special privileges,
/// so this always returns `true`. Kept for API stability.
pub fn check_privileges(_method: DiscoveryMethod) -> bool {
    true
}

/// Get available discovery methods for the current system.
///
/// All remaining methods are userspace and unconditionally available.
pub fn get_available_methods() -> Vec<(DiscoveryMethod, bool)> {
    vec![
        (DiscoveryMethod::TcpConnect, true),
        (DiscoveryMethod::Mdns, true),
        (DiscoveryMethod::Ssdp, true),
        (DiscoveryMethod::UdpScan, true),
        (DiscoveryMethod::WsDiscovery, true),
        (DiscoveryMethod::ArpCache, true),
        (DiscoveryMethod::Snmp, true),
        (DiscoveryMethod::Llmnr, true),
        (DiscoveryMethod::None, true),
    ]
}

/// Get all local (non-loopback) IP addresses of this machine
pub(super) fn get_local_ip_addresses() -> HashSet<IpAddr> {
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
