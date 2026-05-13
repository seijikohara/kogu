//! ARP/NDP cache reading for non-privileged MAC address discovery
//!
//! Reads the OS ARP (IPv4) and NDP (IPv6) neighbor caches to discover hosts and
//! their MAC addresses without requiring elevated privileges.

use serde::Serialize;

/// An entry from the system ARP/neighbor cache
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArpCacheEntry {
    pub ip: String,
    pub mac: String,
    pub interface: Option<String>,
}

/// Read the system ARP cache (IPv4, no privileges required).
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

/// Read the system NDP cache (IPv6, no privileges required).
///
/// Returns a list of neighbor cache entries with IPv6 address, MAC, and interface info.
/// Platform-specific:
/// - macOS: Parses output of `ndp -an`
/// - Linux: Parses output of `ip -6 neigh show`
/// - Windows: Parses output of `netsh interface ipv6 show neighbors`
pub fn read_ndp_cache() -> Vec<ArpCacheEntry> {
    #[cfg(target_os = "macos")]
    {
        read_ndp_cache_macos()
    }
    #[cfg(target_os = "linux")]
    {
        read_ndp_cache_linux()
    }
    #[cfg(target_os = "windows")]
    {
        read_ndp_cache_windows()
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Vec::new()
    }
}

/// Read both the IPv4 ARP cache and the IPv6 NDP cache, merging by IP.
///
/// When the same IP appears in both caches, the last-written entry wins (NDP
/// entries override ARP entries). The returned vector preserves discovery
/// ordering of unique IPs: ARP entries first, then any new NDP-only entries.
pub fn read_neighbor_cache() -> Vec<ArpCacheEntry> {
    use std::collections::HashMap;

    let mut by_ip: HashMap<String, ArpCacheEntry> = HashMap::new();
    let mut order: Vec<String> = Vec::new();

    let mut extend_with = |entries: Vec<ArpCacheEntry>| {
        for entry in entries {
            if !by_ip.contains_key(&entry.ip) {
                order.push(entry.ip.clone());
            }
            by_ip.insert(entry.ip.clone(), entry);
        }
    };

    extend_with(read_arp_cache());
    extend_with(read_ndp_cache());

    order
        .into_iter()
        .filter_map(|ip| by_ip.remove(&ip))
        .collect()
}

/// Check if a MAC address is incomplete/invalid
fn is_incomplete_mac(mac: &str) -> bool {
    mac.is_empty()
        || mac == "(incomplete)"
        || mac == "ff:ff:ff:ff:ff:ff"
        || mac == "00:00:00:00:00:00"
}

/// Strip an optional `%ifname` zone suffix from an IPv6 address string.
fn strip_zone_suffix(ip: &str) -> &str {
    match ip.find('%') {
        Some(idx) => &ip[..idx],
        None => ip,
    }
}

/// Decide whether an IPv6 address should be kept as a routable neighbor entry.
/// Drops multicast and the unspecified / loopback addresses.
fn is_acceptable_ipv6(ip: &str) -> bool {
    let parsed = match ip.parse::<std::net::Ipv6Addr>() {
        Ok(addr) => addr,
        Err(_) => return false,
    };
    !parsed.is_multicast() && !parsed.is_unspecified() && !parsed.is_loopback()
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
// macOS: Parse `ndp -an` output
// =============================================================================

#[cfg(target_os = "macos")]
fn read_ndp_cache_macos() -> Vec<ArpCacheEntry> {
    let output = match std::process::Command::new("ndp").arg("-an").output() {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ndp_macos(&stdout)
}

/// Parse macOS `ndp -an` output.
/// Format (whitespace-separated columns):
/// `Neighbor                Linklayer Address Netif Expire    St Flgs Prbs`
/// `fe80::aabb%en0          aa:bb:cc:dd:ee:ff en0   permanent R`
#[cfg(target_os = "macos")]
fn parse_ndp_macos(output: &str) -> Vec<ArpCacheEntry> {
    output
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() < 3 {
                return None;
            }

            // Header detection: first column starts with literal "Neighbor".
            if parts[0].eq_ignore_ascii_case("Neighbor") {
                return None;
            }

            let raw_ip = parts[0];
            let mac = parts[1];
            let interface = parts.get(2).copied();

            if is_incomplete_mac(mac) {
                return None;
            }

            let ip = strip_zone_suffix(raw_ip);
            if !is_acceptable_ipv6(ip) {
                return None;
            }

            Some(ArpCacheEntry {
                ip: ip.to_string(),
                mac: mac.to_string(),
                interface: interface.map(String::from),
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
// Linux: Parse `ip -6 neigh show` output
// =============================================================================

#[cfg(target_os = "linux")]
fn read_ndp_cache_linux() -> Vec<ArpCacheEntry> {
    let output = match std::process::Command::new("ip")
        .args(["-6", "neigh", "show"])
        .output()
    {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ndp_linux(&stdout)
}

/// Parse Linux `ip -6 neigh show` output.
/// Format: `fe80::abcd dev wlan0 lladdr aa:bb:cc:dd:ee:ff REACHABLE`
#[cfg(target_os = "linux")]
fn parse_ndp_linux(content: &str) -> Vec<ArpCacheEntry> {
    content
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.is_empty() {
                return None;
            }

            let raw_ip = parts[0];

            // State is typically the final token. Skip unusable states.
            let state = parts.last().copied().unwrap_or("");
            if matches!(state, "FAILED" | "INCOMPLETE") {
                return None;
            }

            // Locate "dev <iface>" and "lladdr <mac>" pairs by keyword.
            let interface = parts
                .iter()
                .position(|t| *t == "dev")
                .and_then(|i| parts.get(i + 1).copied())
                .map(String::from);

            let mac = parts
                .iter()
                .position(|t| *t == "lladdr")
                .and_then(|i| parts.get(i + 1).copied())?;

            if is_incomplete_mac(mac) {
                return None;
            }

            let ip = strip_zone_suffix(raw_ip);
            if !is_acceptable_ipv6(ip) {
                return None;
            }

            Some(ArpCacheEntry {
                ip: ip.to_string(),
                mac: mac.to_string(),
                interface,
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

// =============================================================================
// Windows: Parse `netsh interface ipv6 show neighbors` output
// =============================================================================

#[cfg(target_os = "windows")]
fn read_ndp_cache_windows() -> Vec<ArpCacheEntry> {
    let output = match std::process::Command::new("netsh")
        .args(["interface", "ipv6", "show", "neighbors"])
        .output()
    {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_ndp_windows(&stdout)
}

/// Parse Windows `netsh interface ipv6 show neighbors` output.
/// Output is grouped per interface with three columns:
/// `Internet Address      Physical Address      Type`
#[cfg(target_os = "windows")]
fn parse_ndp_windows(output: &str) -> Vec<ArpCacheEntry> {
    let mut entries = Vec::new();
    let mut current_interface: Option<String> = None;

    for line in output.lines() {
        let trimmed = line.trim();

        if let Some(rest) = trimmed.strip_prefix("Interface ") {
            // e.g., "Interface 12: Ethernet"
            current_interface = rest
                .split(':')
                .nth(1)
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 3 {
            continue;
        }

        let raw_ip = parts[0];
        let mac_raw = parts[1];
        let state = parts[2..].join(" ");

        // Header rows have non-IP first token. Skip them.
        if raw_ip.eq_ignore_ascii_case("Internet")
            || raw_ip.eq_ignore_ascii_case("Address")
            || raw_ip.starts_with('-')
        {
            continue;
        }

        if state.eq_ignore_ascii_case("Unreachable") {
            continue;
        }

        let mac = mac_raw.replace('-', ":");
        if is_incomplete_mac(&mac) {
            continue;
        }

        let ip = strip_zone_suffix(raw_ip);
        if !is_acceptable_ipv6(ip) {
            continue;
        }

        entries.push(ArpCacheEntry {
            ip: ip.to_string(),
            mac,
            interface: current_interface.clone(),
        });
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
    fn test_strip_zone_suffix_removes_ifname() {
        assert_eq!(strip_zone_suffix("fe80::1%en0"), "fe80::1");
        assert_eq!(strip_zone_suffix("fe80::1"), "fe80::1");
    }

    #[test]
    fn test_is_acceptable_ipv6_rejects_multicast_and_specials() {
        assert!(!is_acceptable_ipv6("ff02::1"));
        assert!(!is_acceptable_ipv6("ff02::1:ff00:1"));
        assert!(!is_acceptable_ipv6("::"));
        assert!(!is_acceptable_ipv6("::1"));
        assert!(is_acceptable_ipv6("fe80::1"));
        assert!(is_acceptable_ipv6("2001:db8::1"));
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
        assert_eq!(
            map.get("192.168.1.1").map(String::as_str),
            Some("aa:bb:cc:dd:ee:ff")
        );
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

        #[test]
        fn test_parse_ndp_macos_basic() {
            let output = "Neighbor                             Linklayer Address Netif Expire    St Flgs Prbs\n\
                          fe80::aabb:ccdd:eeff%en0             aa:bb:cc:dd:ee:ff en0   permanent R\n\
                          2001:db8::1234%en0                   11:22:33:44:55:66 en0   23h59m45s R\n\
                          fe80::ffff%en0                       (incomplete)      en0   expired   I\n\
                          ff02::1%en0                          aa:bb:cc:dd:ee:ff en0   permanent R";
            let entries = parse_ndp_macos(output);
            assert_eq!(entries.len(), 2);
            assert_eq!(entries[0].ip, "fe80::aabb:ccdd:eeff");
            assert_eq!(entries[0].mac, "aa:bb:cc:dd:ee:ff");
            assert_eq!(entries[0].interface.as_deref(), Some("en0"));
            assert_eq!(entries[1].ip, "2001:db8::1234");
        }

        #[test]
        fn test_parse_ndp_macos_empty() {
            assert!(parse_ndp_macos("").is_empty());
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

        #[test]
        fn test_parse_ndp_linux_basic() {
            let content = "fe80::aabb dev wlan0 lladdr aa:bb:cc:dd:ee:ff REACHABLE\n\
                           2001:db8::1 dev wlan0 lladdr 11:22:33:44:55:66 STALE\n\
                           fe80::bad dev wlan0  FAILED\n\
                           fe80::pending dev wlan0 lladdr 22:22:22:22:22:22 INCOMPLETE\n\
                           ff02::1 dev wlan0 lladdr 33:33:00:00:00:01 PERMANENT";
            let entries = parse_ndp_linux(content);
            assert_eq!(entries.len(), 2);
            assert_eq!(entries[0].ip, "fe80::aabb");
            assert_eq!(entries[0].mac, "aa:bb:cc:dd:ee:ff");
            assert_eq!(entries[0].interface.as_deref(), Some("wlan0"));
            assert_eq!(entries[1].ip, "2001:db8::1");
        }

        #[test]
        fn test_parse_ndp_linux_empty() {
            assert!(parse_ndp_linux("").is_empty());
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

        #[test]
        fn test_parse_ndp_windows_basic() {
            let output = "\n\
                Interface 12: Ethernet\n\
                \n\
                Internet Address                              Physical Address   Type\n\
                --------------------------------------------  -----------------  -----------\n\
                fe80::aabb                                    aa-bb-cc-dd-ee-ff  Reachable\n\
                2001:db8::1                                   11-22-33-44-55-66  Stale\n\
                fe80::dead                                    aa-bb-cc-dd-ee-ff  Unreachable\n\
                fe80::own                                     00-00-00-00-00-00  Permanent\n\
                ff02::1                                       33-33-00-00-00-01  Permanent\n";
            let entries = parse_ndp_windows(output);
            assert_eq!(entries.len(), 2);
            assert_eq!(entries[0].ip, "fe80::aabb");
            assert_eq!(entries[0].mac, "aa:bb:cc:dd:ee:ff");
            assert_eq!(entries[0].interface.as_deref(), Some("Ethernet"));
            assert_eq!(entries[1].ip, "2001:db8::1");
        }
    }
}
