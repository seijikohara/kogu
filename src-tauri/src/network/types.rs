//! Type definitions for network scanning operations

use serde::{Deserialize, Serialize};

// =============================================================================
// Network Interface Types
// =============================================================================

/// Information about a network interface
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterface {
    /// Interface name (e.g., "en0", "eth0")
    pub name: String,
    /// IP address
    pub ip: String,
    /// Whether this is IPv6
    pub is_ipv6: bool,
    /// Whether this is a loopback interface
    pub is_loopback: bool,
    /// Suggested CIDR notation for scanning the local subnet
    pub suggested_cidr: Option<String>,
    /// Netmask prefix length
    pub prefix_len: u8,
}

/// Result of getting local network interfaces
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalNetworkInfo {
    /// All network interfaces
    pub interfaces: Vec<NetworkInterface>,
    /// Primary IPv4 interface (non-loopback)
    pub primary_ipv4: Option<NetworkInterface>,
    /// Primary IPv6 interface (non-loopback, non-link-local)
    pub primary_ipv6: Option<NetworkInterface>,
}

// =============================================================================
// Detailed Network Interface Types (via netdev)
// =============================================================================

/// Interface operational state flags
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InterfaceStateFlags {
    /// Whether the interface has the UP flag set
    pub is_up: bool,
    /// Whether the interface has the RUNNING flag set
    pub is_running: bool,
    /// Whether this is the system default interface
    pub is_default: bool,
}

/// Interface kind flags
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InterfaceKindFlags {
    /// Whether this is a loopback interface
    pub is_loopback: bool,
    /// Whether this is a physical (non-virtual) interface
    pub is_physical: bool,
    /// Whether the interface is point-to-point
    pub is_point_to_point: bool,
}

/// Interface capability flags
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InterfaceCapabilityFlags {
    /// Whether the interface supports broadcast
    pub is_broadcast: bool,
    /// Whether the interface supports multicast
    pub is_multicast: bool,
}

/// Comprehensive network interface information
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailedNetworkInterface {
    /// OS-assigned interface index
    pub index: u32,
    /// Interface name (e.g., "en0", "eth0")
    pub name: String,
    /// Windows-style friendly name
    pub friendly_name: Option<String>,
    /// Interface description
    pub description: Option<String>,
    /// Interface type (e.g., "Ethernet", "Wi-Fi", "Loopback")
    pub interface_type: String,
    /// MAC address in colon-separated hex (e.g., "AA:BB:CC:DD:EE:FF")
    pub mac_address: Option<String>,
    /// All IPv4 addresses assigned to this interface
    pub ipv4_addresses: Vec<Ipv4AddressInfo>,
    /// All IPv6 addresses assigned to this interface
    pub ipv6_addresses: Vec<Ipv6AddressInfo>,
    /// Maximum transmission unit
    pub mtu: Option<u32>,
    /// Interface operational state flags
    #[serde(flatten)]
    pub state_flags: InterfaceStateFlags,
    /// Interface kind flags
    #[serde(flatten)]
    pub kind_flags: InterfaceKindFlags,
    /// Interface capability flags
    #[serde(flatten)]
    pub capability_flags: InterfaceCapabilityFlags,
    /// Operational state (e.g., "Up", "Down", "Unknown")
    pub oper_state: String,
    /// Transmit speed in bits per second
    pub transmit_speed_bps: Option<u64>,
    /// Receive speed in bits per second
    pub receive_speed_bps: Option<u64>,
    /// Total received bytes
    pub rx_bytes: Option<u64>,
    /// Total transmitted bytes
    pub tx_bytes: Option<u64>,
    /// Default gateway information
    pub gateway: Option<GatewayInfo>,
    /// DNS server addresses
    pub dns_servers: Vec<String>,
}

/// IPv4 address with network information
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ipv4AddressInfo {
    /// IPv4 address (e.g., "192.168.1.5")
    pub address: String,
    /// Subnet prefix length (e.g., 24)
    pub prefix_len: u8,
    /// Network in CIDR notation (e.g., "192.168.1.0/24")
    pub network: String,
}

/// IPv6 address with scope information
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ipv6AddressInfo {
    /// IPv6 address (e.g., "fe80::1")
    pub address: String,
    /// Subnet prefix length (e.g., 64)
    pub prefix_len: u8,
    /// Scope ID for link-local addresses
    pub scope_id: u32,
}

/// Default gateway information
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayInfo {
    /// Gateway MAC address
    pub mac_address: Option<String>,
    /// Gateway IPv4 addresses
    pub ipv4_addresses: Vec<String>,
    /// Gateway IPv6 addresses
    pub ipv6_addresses: Vec<String>,
}

// =============================================================================
// mDNS/Bonjour Types
// =============================================================================

/// Discovered mDNS service
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdnsService {
    /// Service instance name
    pub instance_name: String,
    /// Service type (e.g., "_http._tcp")
    pub service_type: String,
    /// Hostname
    pub hostname: String,
    /// IP addresses
    pub addresses: Vec<String>,
    /// Port number
    pub port: u16,
    /// TXT record properties
    pub properties: Vec<(String, String)>,
}

/// mDNS discovery request
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MdnsDiscoveryRequest {
    /// Service types to discover (e.g., `["_http._tcp", "_ssh._tcp"]`)
    pub service_types: Vec<String>,
    /// Discovery duration in milliseconds
    pub duration_ms: u32,
}

/// mDNS discovery results
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdnsDiscoveryResults {
    /// Discovered services
    pub services: Vec<MdnsService>,
    /// Discovery duration (actual)
    pub duration_ms: u64,
}

// =============================================================================
// SSDP/UPnP Types
// =============================================================================

/// Device information fetched from UPnP device description XML
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SsdpDeviceInfo {
    /// User-friendly device name (e.g., "Living Room Router")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub friendly_name: Option<String>,
    /// Device manufacturer (e.g., "NETGEAR")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manufacturer: Option<String>,
    /// Device model name (e.g., "Nighthawk R7000")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_name: Option<String>,
    /// Device model number
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_number: Option<String>,
    /// UPnP device type URN (e.g., "urn:schemas-upnp-org:device:InternetGatewayDevice:1")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_type: Option<String>,
    /// UPnP LOCATION URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    /// SERVER header value from SSDP response
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server: Option<String>,
}

/// Scan mode determining port range to scan
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScanMode {
    /// Quick scan - common ports only
    Quick,
    /// Full scan - all 65535 ports
    Full,
    /// Custom scan - user-defined ports
    Custom,
}

/// Port preset for quick selection
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PortPreset {
    /// Well-known ports (1-1024)
    WellKnown,
    /// Web service ports
    Web,
    /// Database ports
    Database,
    /// Custom port range
    Custom,
}

/// Port state after scanning
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PortState {
    /// Port is open and accepting connections
    Open,
    /// Port is closed (connection refused)
    Closed,
    /// Port is filtered (timeout or no response)
    Filtered,
}

/// Hostname resolution options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostnameResolutionOptions {
    /// Enable DNS reverse lookup (PTR records)
    #[serde(default = "default_true")]
    pub dns: bool,
    /// Enable mDNS/Bonjour resolution (.local)
    #[serde(default = "default_true")]
    pub mdns: bool,
    /// Enable `NetBIOS` name resolution (Windows)
    #[serde(default)]
    pub netbios: bool,
    /// Resolution timeout in milliseconds
    #[serde(default = "default_resolution_timeout")]
    pub timeout_ms: u32,
}

const fn default_true() -> bool {
    true
}

const fn default_resolution_timeout() -> u32 {
    2000
}

impl Default for HostnameResolutionOptions {
    fn default() -> Self {
        Self {
            dns: true,
            mdns: true,
            netbios: false,
            timeout_ms: default_resolution_timeout(),
        }
    }
}

/// Network scan request from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRequest {
    /// Target IP, hostname, or CIDR notation
    pub target: String,
    /// Scan mode
    pub mode: ScanMode,
    /// Port preset
    pub port_preset: PortPreset,
    /// Custom port range (e.g., "80,443,8080" or "1-1024")
    pub port_range: Option<String>,
    /// Maximum concurrent connections
    pub concurrency: u32,
    /// Connection timeout in milliseconds
    pub timeout_ms: u32,
    /// Hostname resolution options
    pub resolution: Option<HostnameResolutionOptions>,
}

/// TLS certificate information extracted from HTTPS ports
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TlsCertInfo {
    /// Common Name (CN) from the certificate subject
    #[serde(skip_serializing_if = "Option::is_none")]
    pub common_name: Option<String>,
    /// Subject Alternative Names (SAN)
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub subject_alt_names: Vec<String>,
    /// Certificate issuer (CN or Organization)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issuer: Option<String>,
    /// Whether the certificate is self-signed
    pub is_self_signed: bool,
}

/// Information about a scanned port
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    /// Port number
    pub port: u16,
    /// Port state
    pub state: PortState,
    /// Service name (if known)
    pub service: Option<String>,
    /// Banner grabbed from service
    pub banner: Option<String>,
    /// TLS certificate info (for HTTPS ports)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tls_cert: Option<TlsCertInfo>,
}

/// Result for a single host
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostResult {
    /// IP address
    pub ip: String,
    /// Resolved hostname
    pub hostname: Option<String>,
    /// Open ports found
    pub ports: Vec<PortInfo>,
    /// Time taken to scan this host (ms)
    pub scan_duration_ms: u64,
}

/// Final scan results
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResults {
    /// All scanned hosts with open ports
    pub hosts: Vec<HostResult>,
    /// Total hosts scanned
    pub total_hosts_scanned: u32,
    /// Hosts with at least one open port
    pub hosts_with_open_ports: u32,
    /// Total open ports found
    pub total_open_ports: u32,
    /// Total scan duration (ms)
    pub scan_duration_ms: u64,
    /// Scan start time (ISO 8601)
    pub start_time: String,
    /// Scan end time (ISO 8601)
    pub end_time: String,
}

// =============================================================================
// Scan Progress Sink Trait
// =============================================================================

/// Generic progress sink for port scanning (Tauri-independent)
///
/// Implementations:
/// - Main process: forwards events via `AppHandle.emit()`
/// - Sidecar: writes JSON Lines to stdout
pub trait ScanProgressSink: Send + Sync {
    /// Emit a scan progress event
    fn emit(&self, progress: ScanProgress) -> Result<(), String>;
}

// =============================================================================
// Scan Progress Types
// =============================================================================

/// Progress events emitted during scan
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ScanProgress {
    /// Scan has started
    Started {
        /// Total hosts to scan
        total_hosts: u32,
        /// Total ports per host
        total_ports: u32,
    },
    /// A host with open ports was discovered
    HostDiscovered {
        /// The discovered host
        host: HostResult,
    },
    /// Progress update
    Progress {
        /// Hosts scanned so far
        scanned_hosts: u32,
        /// Total hosts to scan
        total_hosts: u32,
        /// Percentage complete
        percentage: f32,
        /// Currently scanning IP (if available)
        current_ip: Option<String>,
        /// Number of hosts discovered with open ports so far
        discovered_hosts: u32,
        /// Total open ports found so far
        discovered_ports: u32,
    },
    /// Scan completed
    Completed {
        /// Final results
        results: ScanResults,
    },
}
