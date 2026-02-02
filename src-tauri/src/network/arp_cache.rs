//! ARP cache reading for non-privileged MAC address discovery
//!
//! Reads the OS ARP/neighbor cache to discover hosts and their MAC addresses
//! without requiring elevated privileges.

use serde::Serialize;

/// An entry from the system ARP/neighbor cache
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArpCacheEntry {
    pub ip: String,
    pub mac: String,
    pub interface: Option<String>,
}

/// Read the system ARP cache (no privileges required).
///
/// Returns a list of ARP cache entries with IP, MAC, and interface info.
/// Platform-specific:
/// - macOS: Parses output of `arp -an`
/// - Linux: Parses `/proc/net/arp`
/// - Windows: Parses output of `arp -a`
pub fn read_arp_cache() -> Vec<ArpCacheEntry> {
    #[cfg(target_os = "macos")]
    {
        read_arp_cache_macos()
    }
    #[cfg(target_os = "linux")]
    {
        read_arp_cache_linux()
    }
    #[cfg(target_os = "windows")]
    {
        read_arp_cache_windows()
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Vec::new()
    }
}

/// Check if a MAC address is incomplete/invalid
fn is_incomplete_mac(mac: &str) -> bool {
    mac.is_empty()
        || mac == "(incomplete)"
        || mac == "ff:ff:ff:ff:ff:ff"
        || mac == "00:00:00:00:00:00"
}

// =============================================================================
// macOS: Parse `arp -an` output
// =============================================================================

#[cfg(target_os = "macos")]
fn read_arp_cache_macos() -> Vec<ArpCacheEntry> {
    let output = match std::process::Command::new("arp").arg("-an").output() {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_arp_macos(&stdout)
}

/// Parse macOS `arp -an` output.
/// Format: `? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]`
#[cfg(target_os = "macos")]
fn parse_arp_macos(output: &str) -> Vec<ArpCacheEntry> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            // Extract IP from parentheses
            let ip_start = line.find('(')? + 1;
            let ip_end = line.find(')')?;
            let ip = &line[ip_start..ip_end];

            // Find "at " followed by MAC
            let at_idx = line.find(" at ")? + 4;
            let after_at = &line[at_idx..];
            let mac_end = after_at.find(' ').unwrap_or(after_at.len());
            let mac = &after_at[..mac_end];

            if is_incomplete_mac(mac) {
                return None;
            }

            // Find "on " followed by interface name
            let interface = line.find(" on ").map(|idx| {
                let after_on = &line[idx + 4..];
                let iface_end = after_on.find(' ').unwrap_or(after_on.len());
                after_on[..iface_end].to_string()
            });

            Some(ArpCacheEntry {
                ip: ip.to_string(),
                mac: mac.to_string(),
                interface,
            })
        })
        .collect()
}

// =============================================================================
// Linux: Parse `/proc/net/arp`
// =============================================================================

#[cfg(target_os = "linux")]
fn read_arp_cache_linux() -> Vec<ArpCacheEntry> {
    let content = match std::fs::read_to_string("/proc/net/arp") {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    parse_arp_linux(&content)
}

/// Parse Linux `/proc/net/arp` output.
/// Format: `IP address  HW type  Flags  HW address  Mask  Device`
#[cfg(target_os = "linux")]
fn parse_arp_linux(content: &str) -> Vec<ArpCacheEntry> {
    content
        .lines()
        .skip(1) // Skip header line
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 6 {
                return None;
            }
            let ip = parts[0];
            let mac = parts[3];
            let device = parts[5];

            if is_incomplete_mac(mac) {
                return None;
            }

            Some(ArpCacheEntry {
                ip: ip.to_string(),
                mac: mac.to_string(),
                interface: Some(device.to_string()),
            })
        })
        .collect()
}

// =============================================================================
// Windows: Parse `arp -a` output
// =============================================================================

#[cfg(target_os = "windows")]
fn read_arp_cache_windows() -> Vec<ArpCacheEntry> {
    let output = match std::process::Command::new("arp").arg("-a").output() {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_arp_windows(&stdout)
}

/// Parse Windows `arp -a` output.
/// Format:
/// ```text
/// Interface: 192.168.1.100 --- 0xc
///   Internet Address      Physical Address      Type
///   192.168.1.1           aa-bb-cc-dd-ee-ff     dynamic
/// ```
#[cfg(target_os = "windows")]
fn parse_arp_windows(output: &str) -> Vec<ArpCacheEntry> {
    let mut entries = Vec::new();
    let mut current_interface: Option<String> = None;

    for line in output.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("Interface:") {
            // Extract interface IP
            current_interface = trimmed.split_whitespace().nth(1).map(|s| s.to_string());
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() >= 3 {
            let ip = parts[0];
            let mac_raw = parts[1];

            // Skip header lines and broadcast
            if ip == "Internet" || ip == "Address" {
                continue;
            }

            // Convert Windows MAC format (aa-bb-cc-dd-ee-ff) to standard (aa:bb:cc:dd:ee:ff)
            let mac = mac_raw.replace('-', ":");

            if is_incomplete_mac(&mac) {
                continue;
            }

            entries.push(ArpCacheEntry {
                ip: ip.to_string(),
                mac,
                interface: current_interface.clone(),
            });
        }
    }

    entries
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    #[test]
    fn test_is_incomplete_mac() {
        assert!(is_incomplete_mac(""));
        assert!(is_incomplete_mac("(incomplete)"));
        assert!(is_incomplete_mac("ff:ff:ff:ff:ff:ff"));
        assert!(is_incomplete_mac("00:00:00:00:00:00"));
        assert!(!is_incomplete_mac("aa:bb:cc:dd:ee:ff"));
    }

    #[test]
    fn test_read_arp_cache_filters_incomplete_macs() {
        let entries = [
            ArpCacheEntry {
                ip: "192.168.1.1".to_string(),
                mac: "aa:bb:cc:dd:ee:ff".to_string(),
                interface: Some("en0".to_string()),
            },
            ArpCacheEntry {
                ip: "192.168.1.2".to_string(),
                mac: "(incomplete)".to_string(),
                interface: None,
            },
        ];
        let map: HashMap<String, String> = entries
            .iter()
            .filter(|e| !is_incomplete_mac(&e.mac))
            .map(|e| (e.ip.clone(), e.mac.clone()))
            .collect();
        assert_eq!(map.len(), 1);
        assert_eq!(map.get("192.168.1.1").unwrap(), "aa:bb:cc:dd:ee:ff");
    }

    #[cfg(target_os = "macos")]
    mod macos {
        use super::super::*;

        #[test]
        fn test_parse_arp_macos() {
            let output = "? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]\n\
                          ? (192.168.1.2) at 11:22:33:44:55:66 on en0 ifscope [ethernet]\n\
                          ? (192.168.1.255) at ff:ff:ff:ff:ff:ff on en0 ifscope [ethernet]\n\
                          ? (192.168.1.3) at (incomplete) on en0 ifscope [ethernet]";
            let entries = parse_arp_macos(output);
            assert_eq!(entries.len(), 2);
            assert_eq!(entries[0].ip, "192.168.1.1");
            assert_eq!(entries[0].mac, "aa:bb:cc:dd:ee:ff");
            assert_eq!(entries[0].interface.as_deref(), Some("en0"));
            assert_eq!(entries[1].ip, "192.168.1.2");
        }

        #[test]
        fn test_parse_arp_macos_empty() {
            let entries = parse_arp_macos("");
            assert!(entries.is_empty());
        }
    }

    #[cfg(target_os = "linux")]
    mod linux {
        use super::super::*;

        #[test]
        fn test_parse_arp_linux() {
            let content = "IP address       HW type     Flags       HW address            Mask     Device\n\
                          192.168.1.1      0x1         0x2         aa:bb:cc:dd:ee:ff     *        eth0\n\
                          192.168.1.2      0x1         0x0         00:00:00:00:00:00     *        eth0";
            let entries = parse_arp_linux(content);
            assert_eq!(entries.len(), 1);
            assert_eq!(entries[0].ip, "192.168.1.1");
            assert_eq!(entries[0].mac, "aa:bb:cc:dd:ee:ff");
            assert_eq!(entries[0].interface.as_deref(), Some("eth0"));
        }
    }

    #[cfg(target_os = "windows")]
    mod windows {
        use super::super::*;

        #[test]
        fn test_parse_arp_windows() {
            let output = "\n\
                Interface: 192.168.1.100 --- 0xc\n\
                  Internet Address      Physical Address      Type\n\
                  192.168.1.1           aa-bb-cc-dd-ee-ff     dynamic\n\
                  192.168.1.2           11-22-33-44-55-66     dynamic\n\
                  192.168.1.255         ff-ff-ff-ff-ff-ff     static\n";
            let entries = parse_arp_windows(output);
            assert_eq!(entries.len(), 2);
            assert_eq!(entries[0].ip, "192.168.1.1");
            assert_eq!(entries[0].mac, "aa:bb:cc:dd:ee:ff");
            assert_eq!(entries[1].mac, "11:22:33:44:55:66");
        }
    }
}
