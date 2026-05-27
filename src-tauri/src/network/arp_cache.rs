//! ARP/NDP cache reading for non-privileged MAC address discovery
//!
//! Reads the OS ARP (IPv4) and NDP (IPv6) neighbor caches to discover hosts and
//! their MAC addresses without requiring elevated privileges.

use std::fmt;

use serde::Serialize;

/// An entry from the system ARP/neighbor cache
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArpCacheEntry {
    pub ip: String,
    pub mac: String,
    pub interface: Option<String>,
}

/// Failures that prevent the OS ARP / NDP cache from being read.
///
/// Callers receive these instead of an empty `Vec` so the UI can
/// distinguish a quiet network (cache really is empty) from a probe
/// failure (cache is unreadable on this host).
#[derive(Debug, Clone)]
pub enum ArpError {
    /// External command (`arp`, `ndp`, `ip`, `netsh`) could not be
    /// launched, typically because the binary is not on `PATH`.
    CommandUnavailable {
        command: &'static str,
        detail: String,
    },
    /// External command launched but exited with a non-zero status.
    CommandFailed {
        command: &'static str,
        detail: String,
    },
    /// Filesystem read failed (Linux `/proc/net/arp`).
    #[cfg(target_os = "linux")]
    ReadFailed { path: &'static str, detail: String },
    /// Target OS has no implementation in this build.
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    UnsupportedPlatform,
}

impl fmt::Display for ArpError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CommandUnavailable { command, detail } => {
                write!(f, "`{command}` not available: {detail}")
            }
            Self::CommandFailed { command, detail } => {
                write!(f, "`{command}` failed: {detail}")
            }
            #[cfg(target_os = "linux")]
            Self::ReadFailed { path, detail } => write!(f, "read `{path}` failed: {detail}"),
            #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
            Self::UnsupportedPlatform => f.write_str("unsupported platform"),
        }
    }
}

impl std::error::Error for ArpError {}

/// Read the system ARP cache (IPv4, no privileges required).
///
/// Returns a list of ARP cache entries with IP, MAC, and interface info.
/// Platform-specific:
/// - macOS: Parses output of `arp -an`.
/// - Linux: Parses `/proc/net/arp`, falling back to `ip -4 neigh show`
///   if the proc entry is empty (some containers).
/// - Windows: Parses output of `arp -a`.
///
/// # Errors
///
/// Returns [`ArpError`] when no probe succeeds. An empty `Vec` is a
/// successful but quiet result, distinct from a failure.
pub fn read_arp_cache() -> Result<Vec<ArpCacheEntry>, ArpError> {
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
        Err(ArpError::UnsupportedPlatform)
    }
}

/// Read the system NDP cache (IPv6, no privileges required).
///
/// Returns a list of neighbor cache entries with IPv6 address, MAC, and interface info.
/// Platform-specific:
/// - macOS: Parses output of `ndp -an`.
/// - Linux: Parses output of `ip -6 neigh show`.
/// - Windows: Parses output of `netsh interface ipv6 show neighbors`.
///
/// # Errors
///
/// See [`read_arp_cache`].
pub fn read_ndp_cache() -> Result<Vec<ArpCacheEntry>, ArpError> {
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
        Err(ArpError::UnsupportedPlatform)
    }
}

/// Read both the IPv4 ARP cache and the IPv6 NDP cache, merging by IP.
///
/// When the same IP appears in both caches, the last-written entry wins (NDP
/// entries override ARP entries). The returned vector preserves discovery
/// ordering of unique IPs: ARP entries first, then any new NDP-only entries.
///
/// Returns the merged vector together with an optional error string
/// describing which probe failed; partial results are still surfaced
/// (e.g. ARP entries returned when NDP enumeration failed) so the UI
/// can render what was discovered alongside a warning banner.
pub fn read_neighbor_cache() -> (Vec<ArpCacheEntry>, Option<String>) {
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

    let mut errors: Vec<String> = Vec::new();
    match read_arp_cache() {
        Ok(entries) => extend_with(entries),
        Err(e) => errors.push(format!("ARP: {e}")),
    }
    match read_ndp_cache() {
        Ok(entries) => extend_with(entries),
        Err(e) => errors.push(format!("NDP: {e}")),
    }

    let merged = order
        .into_iter()
        .filter_map(|ip| by_ip.remove(&ip))
        .collect();

    let error = if errors.is_empty() {
        None
    } else {
        Some(errors.join("; "))
    };
    (merged, error)
}

/// Strict MAC validation: matches `xx:xx:xx:xx:xx:xx` where each byte is
/// a pair of ASCII hex digits. Used together with [`is_incomplete_mac`]
/// to reject both wrong-format tokens (localized header rows) and
/// reserved / placeholder values.
fn is_valid_mac(mac: &str) -> bool {
    let bytes: Vec<&str> = mac.split(':').collect();
    if bytes.len() != 6 {
        return false;
    }
    bytes
        .iter()
        .all(|b| b.len() == 2 && b.chars().all(|c| c.is_ascii_hexdigit()))
}

/// Check if a MAC address is incomplete/invalid
fn is_incomplete_mac(mac: &str) -> bool {
    mac.is_empty()
        || mac == "(incomplete)"
        || mac == "ff:ff:ff:ff:ff:ff"
        || mac == "00:00:00:00:00:00"
}

/// Combined predicate: returns `true` when the token cannot be used as a
/// routable MAC. Drops malformed strings (covers localized header rows
/// on Windows / macOS) and reserved / placeholder values.
fn is_unusable_mac(mac: &str) -> bool {
    !is_valid_mac(mac) || is_incomplete_mac(mac)
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
fn read_arp_cache_macos() -> Result<Vec<ArpCacheEntry>, ArpError> {
    let output = std::process::Command::new("arp")
        .arg("-an")
        .output()
        .map_err(|e| ArpError::CommandUnavailable {
            command: "arp",
            detail: e.to_string(),
        })?;
    if !output.status.success() {
        return Err(ArpError::CommandFailed {
            command: "arp",
            detail: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_arp_macos(&stdout))
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

            if is_unusable_mac(mac) {
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
fn read_ndp_cache_macos() -> Result<Vec<ArpCacheEntry>, ArpError> {
    let output = std::process::Command::new("ndp")
        .arg("-an")
        .output()
        .map_err(|e| ArpError::CommandUnavailable {
            command: "ndp",
            detail: e.to_string(),
        })?;
    if !output.status.success() {
        return Err(ArpError::CommandFailed {
            command: "ndp",
            detail: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_ndp_macos(&stdout))
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

            if is_unusable_mac(mac) {
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
fn read_arp_cache_linux() -> Result<Vec<ArpCacheEntry>, ArpError> {
    // Primary source: kernel-exported `/proc/net/arp`. Locale-free and
    // available on every Linux host that has IPv4 networking.
    match std::fs::read_to_string("/proc/net/arp") {
        Ok(content) => {
            let entries = parse_arp_linux(&content);
            if !entries.is_empty() {
                return Ok(entries);
            }
            // Fall through: some sandboxed containers mount an empty
            // proc entry, so try iproute2 as a backup.
        }
        Err(e) => {
            // Even if proc is unreadable, attempt the iproute2 path
            // before surfacing the error so the network scanner still
            // produces results when only one source is unavailable.
            let fallback = read_arp_cache_linux_ip();
            return match fallback {
                Ok(entries) => Ok(entries),
                Err(_) => Err(ArpError::ReadFailed {
                    path: "/proc/net/arp",
                    detail: e.to_string(),
                }),
            };
        }
    }
    read_arp_cache_linux_ip()
}

#[cfg(target_os = "linux")]
fn read_arp_cache_linux_ip() -> Result<Vec<ArpCacheEntry>, ArpError> {
    let output = std::process::Command::new("ip")
        .args(["-4", "neigh", "show"])
        .output()
        .map_err(|e| ArpError::CommandUnavailable {
            command: "ip",
            detail: e.to_string(),
        })?;
    if !output.status.success() {
        return Err(ArpError::CommandFailed {
            command: "ip",
            detail: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_ip_neigh(&stdout, false))
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

            if is_unusable_mac(mac) {
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
fn read_ndp_cache_linux() -> Result<Vec<ArpCacheEntry>, ArpError> {
    let output = std::process::Command::new("ip")
        .args(["-6", "neigh", "show"])
        .output()
        .map_err(|e| ArpError::CommandUnavailable {
            command: "ip",
            detail: e.to_string(),
        })?;
    if !output.status.success() {
        return Err(ArpError::CommandFailed {
            command: "ip",
            detail: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_ip_neigh(&stdout, true))
}

/// Parse iproute2 `ip [-4|-6] neigh show` output.
/// Format: `<ip> dev <iface> lladdr <mac> <STATE>`. The format is
/// identical for IPv4 and IPv6 — only the address family differs.
///
/// `ipv6_only` filters out non-routable IPv6 addresses (multicast,
/// loopback). Pass `false` for the IPv4 path.
#[cfg(target_os = "linux")]
fn parse_ip_neigh(content: &str, ipv6_only: bool) -> Vec<ArpCacheEntry> {
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

            if is_unusable_mac(mac) {
                return None;
            }

            let ip = strip_zone_suffix(raw_ip);
            if ipv6_only && !is_acceptable_ipv6(ip) {
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
fn read_arp_cache_windows() -> Result<Vec<ArpCacheEntry>, ArpError> {
    let output = std::process::Command::new("arp")
        .arg("-a")
        .output()
        .map_err(|e| ArpError::CommandUnavailable {
            command: "arp",
            detail: e.to_string(),
        })?;
    if !output.status.success() {
        return Err(ArpError::CommandFailed {
            command: "arp",
            detail: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_arp_windows(&stdout))
}

/// Parse Windows `arp -a` output.
/// Format:
/// ```text
/// Interface: 192.168.1.100 --- 0xc
///   Internet Address      Physical Address      Type
///   192.168.1.1           aa-bb-cc-dd-ee-ff     dynamic
/// ```
///
/// On localized Windows builds the `Interface:` and `Internet Address`
/// header strings are translated (e.g. Japanese `インターフェイス:`).
/// The data rows themselves use ASCII columns, so the parser does not
/// require the header strings to match — strict MAC validation in
/// [`is_unusable_mac`] rejects header rows when their second token is
/// the translated `Physical Address` label rather than a real MAC.
#[cfg(target_os = "windows")]
fn parse_arp_windows(output: &str) -> Vec<ArpCacheEntry> {
    let mut entries = Vec::new();
    let mut current_interface: Option<String> = None;

    for line in output.lines() {
        let trimmed = line.trim();

        // Detect the per-interface block header. The pattern
        // "<text> <ip> --- 0x<hex>" is locale-free; we only need the
        // IP token. Any line containing ` --- 0x` is treated as such.
        if let Some(ip) = parse_arp_windows_interface_line(trimmed) {
            current_interface = Some(ip);
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 3 {
            continue;
        }

        let ip = parts[0];
        let mac_raw = parts[1];

        // Convert Windows MAC format (aa-bb-cc-dd-ee-ff) to standard.
        let mac = mac_raw.replace('-', ":");
        if is_unusable_mac(&mac) {
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

/// Extract the local interface IP from a Windows `arp -a` block header
/// like `Interface: 192.168.1.100 --- 0xc`. The header text varies by
/// locale; the `--- 0x` marker is the locale-free anchor.
#[cfg(target_os = "windows")]
fn parse_arp_windows_interface_line(line: &str) -> Option<String> {
    if !line.contains("0x") || !line.contains("---") {
        return None;
    }
    let before_dashes = line.split("---").next()?.trim_end();
    // The IP is the last whitespace-separated token before "---".
    before_dashes
        .split_whitespace()
        .next_back()
        .map(str::to_string)
        .filter(|s| s.parse::<std::net::IpAddr>().is_ok())
}

// =============================================================================
// Windows: Parse `netsh interface ipv6 show neighbors` output
// =============================================================================

#[cfg(target_os = "windows")]
fn read_ndp_cache_windows() -> Result<Vec<ArpCacheEntry>, ArpError> {
    let output = std::process::Command::new("netsh")
        .args(["interface", "ipv6", "show", "neighbors"])
        .output()
        .map_err(|e| ArpError::CommandUnavailable {
            command: "netsh",
            detail: e.to_string(),
        })?;
    if !output.status.success() {
        return Err(ArpError::CommandFailed {
            command: "netsh",
            detail: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_ndp_windows(&stdout))
}

/// Parse Windows `netsh interface ipv6 show neighbors` output.
/// Output is grouped per interface with three columns:
/// `Internet Address      Physical Address      Type`
///
/// Locale handling mirrors [`parse_arp_windows`]: header rows pass
/// through the data-row branch and get rejected by [`is_unusable_mac`]
/// because their MAC column holds a translated label, not a real MAC.
#[cfg(target_os = "windows")]
fn parse_ndp_windows(output: &str) -> Vec<ArpCacheEntry> {
    let mut entries = Vec::new();
    let mut current_interface: Option<String> = None;

    for line in output.lines() {
        let trimmed = line.trim();

        // Per-interface header in English builds: "Interface 12: Ethernet".
        // The "Interface " prefix is locale-dependent, so we only use
        // this match opportunistically — the interface name is metadata
        // and missing it does not break data-row parsing.
        if let Some(rest) = trimmed.strip_prefix("Interface ") {
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

        // Decorative separator line of dashes.
        if raw_ip.starts_with('-') {
            continue;
        }

        if state.eq_ignore_ascii_case("Unreachable") {
            continue;
        }

        let mac = mac_raw.replace('-', ":");
        if is_unusable_mac(&mac) {
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
    fn test_is_valid_mac_strict_format() {
        // Six hex pairs separated by colons.
        assert!(is_valid_mac("aa:bb:cc:dd:ee:ff"));
        assert!(is_valid_mac("00:11:22:33:44:55"));
        // Wrong shape.
        assert!(!is_valid_mac(""));
        assert!(!is_valid_mac("aa-bb-cc-dd-ee-ff")); // dashes not converted yet
        assert!(!is_valid_mac("aabbccddeeff"));
        assert!(!is_valid_mac("aa:bb:cc:dd:ee"));
        // Non-hex characters such as a localized header row.
        assert!(!is_valid_mac("Physical:Address:::"));
        assert!(!is_valid_mac("物理:アドレス:::"));
    }

    #[test]
    fn test_is_unusable_mac_combines_strict_and_placeholder() {
        assert!(is_unusable_mac(""));
        assert!(is_unusable_mac("(incomplete)"));
        assert!(is_unusable_mac("ff:ff:ff:ff:ff:ff"));
        assert!(is_unusable_mac("Physical Address"));
        assert!(!is_unusable_mac("aa:bb:cc:dd:ee:ff"));
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
        fn test_parse_ip_neigh_ipv6() {
            let content = "fe80::aabb dev wlan0 lladdr aa:bb:cc:dd:ee:ff REACHABLE\n\
                           2001:db8::1 dev wlan0 lladdr 11:22:33:44:55:66 STALE\n\
                           fe80::bad dev wlan0  FAILED\n\
                           fe80::pending dev wlan0 lladdr 22:22:22:22:22:22 INCOMPLETE\n\
                           ff02::1 dev wlan0 lladdr 33:33:00:00:00:01 PERMANENT";
            let entries = parse_ip_neigh(content, true);
            assert_eq!(entries.len(), 2);
            assert_eq!(entries[0].ip, "fe80::aabb");
            assert_eq!(entries[0].mac, "aa:bb:cc:dd:ee:ff");
            assert_eq!(entries[0].interface.as_deref(), Some("wlan0"));
            assert_eq!(entries[1].ip, "2001:db8::1");
        }

        #[test]
        fn test_parse_ip_neigh_ipv4_keeps_addresses() {
            let content = "192.168.1.10 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE\n\
                           192.168.1.11 dev eth0 lladdr 11:22:33:44:55:66 STALE";
            let entries = parse_ip_neigh(content, false);
            assert_eq!(entries.len(), 2);
            assert_eq!(entries[0].ip, "192.168.1.10");
            assert_eq!(entries[1].ip, "192.168.1.11");
        }

        #[test]
        fn test_parse_ip_neigh_empty() {
            assert!(parse_ip_neigh("", true).is_empty());
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

        #[test]
        fn test_parse_arp_windows_japanese_locale_interface_header() {
            // Simulated ja-JP `arp -a` output. The "インターフェイス:" prefix
            // replaces the English "Interface:" but the "--- 0x" marker is
            // locale-free, and the column headers fail strict MAC validation.
            let output = "\n\
                インターフェイス: 192.168.1.100 --- 0xc\n\
                  インターネット アドレス      物理アドレス          種類\n\
                  192.168.1.1           aa-bb-cc-dd-ee-ff     動的\n\
                  192.168.1.2           11-22-33-44-55-66     動的\n";
            let entries = parse_arp_windows(output);
            assert_eq!(entries.len(), 2);
            assert_eq!(entries[0].ip, "192.168.1.1");
            assert_eq!(entries[0].mac, "aa:bb:cc:dd:ee:ff");
            assert_eq!(entries[0].interface.as_deref(), Some("192.168.1.100"));
        }

        #[test]
        fn test_parse_arp_windows_interface_line_helper() {
            assert_eq!(
                parse_arp_windows_interface_line("Interface: 10.0.0.5 --- 0x3"),
                Some("10.0.0.5".to_string())
            );
            assert_eq!(
                parse_arp_windows_interface_line("インターフェイス: 10.0.0.5 --- 0x3"),
                Some("10.0.0.5".to_string())
            );
            assert_eq!(parse_arp_windows_interface_line("not a header line"), None);
            assert_eq!(
                parse_arp_windows_interface_line("Interface: not-an-ip --- 0x3"),
                None
            );
        }
    }
}
