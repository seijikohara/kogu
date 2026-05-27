//! Discovery-layer wrapper around the OS ARP/NDP cache reader.
//!
//! The real cache-reader implementation lives in the sibling `arp_cache`
//! module; this file only translates that data into a `DiscoveryResult`.

use std::collections::HashSet;
use std::net::IpAddr;

use super::super::arp_cache;
use super::super::oui;
use super::types::{DiscoveryResult, HostMetadata};

/// Discover hosts by reading the OS ARP cache (no privileges required)
pub(super) fn arp_cache_discovery(targets: &[IpAddr]) -> DiscoveryResult {
    let start = std::time::Instant::now();

    // Read both IPv4 ARP and IPv6 NDP caches to expose MAC addresses
    // for both families. The reader returns partial results plus an
    // optional diagnostic; partial entries are still useful, and the
    // diagnostic surfaces tool-unavailable errors in the UI.
    let (entries, probe_error) = arp_cache::read_neighbor_cache();
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
        let vendor = oui::lookup_vendor(&entry.mac).map(String::from);

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
        error: probe_error,
        requires_privileges: false,
    }
}
