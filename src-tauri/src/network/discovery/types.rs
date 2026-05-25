//! Discovery types, options, events, and the event-sink trait.

use serde::{Deserialize, Serialize};

use super::super::banner;
use super::super::snmp;
use super::super::types;
use super::super::ws_discovery;

/// Discovery method to use for finding live hosts
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum DiscoveryMethod {
    /// TCP Connect scan to common ports (no privileges needed)
    #[default]
    TcpConnect,
    /// mDNS/Bonjour service discovery
    Mdns,
    /// SSDP/UPnP discovery for smart devices
    Ssdp,
    /// UDP scan to common ports (DNS, NetBIOS, SNMP)
    UdpScan,
    /// WS-Discovery (Windows devices, printers)
    WsDiscovery,
    /// ARP cache reading (no privileges needed)
    ArpCache,
    /// SNMP sysName broadcast across the target range
    Snmp,
    /// LLMNR multicast PTR queries across the target range
    Llmnr,
    /// Skip host discovery, scan all targets
    None,
}

impl std::fmt::Display for DiscoveryMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::TcpConnect => "tcp_connect",
            Self::Mdns => "mdns",
            Self::Ssdp => "ssdp",
            Self::UdpScan => "udp_scan",
            Self::WsDiscovery => "ws_discovery",
            Self::ArpCache => "arp_cache",
            Self::Snmp => "snmp",
            Self::Llmnr => "llmnr",
            Self::None => "none",
        };
        write!(f, "{name}")
    }
}

/// Host metadata collected during discovery
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HostMetadata {
    /// Hostname (from mDNS, DNS reverse lookup, `NetBIOS`, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    /// Source of the hostname resolution (dns, mdns, netbios, snmp, tls)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname_source: Option<String>,
    /// `NetBIOS` name (from `NetBIOS` Node Status query)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub netbios_name: Option<String>,
    /// MAC address (from ARP scan)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mac_address: Option<String>,
    /// Vendor name (from OUI lookup)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
    /// mDNS services advertised by this host
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub mdns_services: Vec<MdnsServiceInfo>,
    /// SSDP/UPnP device information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssdp_device: Option<types::SsdpDeviceInfo>,
    /// WS-Discovery device information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ws_discovery: Option<ws_discovery::WsDiscoveryInfo>,
    /// SNMP device information (sysName, sysDescr, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snmp_info: Option<snmp::SnmpDeviceInfo>,
    /// TLS certificate Subject Alternative Names (dNSName)
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tls_names: Vec<String>,
    /// Service banners collected via TCP banner-grab
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub banners: Vec<banner::ServiceBanner>,
}

/// mDNS service information for a host
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdnsServiceInfo {
    /// Service instance name
    pub instance_name: String,
    /// Service type (e.g., "_http._tcp")
    pub service_type: String,
    /// Port number
    pub port: u16,
    /// TXT record properties as key-value pairs
    pub properties: Vec<(String, String)>,
}

/// Result of host discovery
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryResult {
    /// Method used for discovery
    pub method: String,
    /// Discovered hosts (IP addresses)
    pub hosts: Vec<String>,
    /// Hostname mapping: IP address -> hostname (for mDNS discovery)
    /// Deprecated: Use `host_metadata` instead
    pub hostnames: std::collections::HashMap<String, String>,
    /// Extended host metadata (MAC addresses, vendors, mDNS services)
    pub host_metadata: std::collections::HashMap<String, HostMetadata>,
    /// Hosts that failed discovery or timed out
    pub unreachable: Vec<String>,
    /// Duration of discovery in milliseconds
    pub duration_ms: u64,
    /// Error message if discovery failed
    pub error: Option<String>,
    /// Whether the method requires elevated privileges
    pub requires_privileges: bool,
}

/// Discovery options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryOptions {
    /// Methods to use (in order of preference)
    pub methods: Vec<DiscoveryMethod>,
    /// Timeout per host in milliseconds
    pub timeout_ms: u32,
    /// Maximum concurrent discovery operations
    pub concurrency: u32,
    /// Ports to probe for TCP SYN scan
    pub syn_ports: Option<Vec<u16>>,
    /// mDNS service types to discover
    pub mdns_services: Option<Vec<String>>,
    /// Whether to resolve `NetBIOS` names for discovered hosts
    #[serde(default)]
    pub resolve_netbios: bool,
}

impl Default for DiscoveryOptions {
    fn default() -> Self {
        Self {
            methods: vec![DiscoveryMethod::TcpConnect],
            timeout_ms: 1000,
            concurrency: 100,
            syn_ports: Some(vec![80, 443, 22, 445, 139]),
            mdns_services: None,
            resolve_netbios: false,
        }
    }
}

/// Streaming event sent to the frontend via Tauri Channel API
///
/// Uses discriminated union serialization for type-safe handling in TypeScript.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum DiscoveryEvent {
    /// A discovery method has started execution
    MethodStarted {
        /// Name of the discovery method
        method: String,
    },
    /// A discovery method completed — hosts are immediately available for display
    MethodCompleted {
        /// The discovery result for this method
        result: DiscoveryResult,
    },
    /// Hostname resolution phase has started
    ResolvingHostnames,
    /// All discovery and resolution completed — final merged results
    Completed {
        /// Final merged results from all methods
        results: Vec<DiscoveryResult>,
    },
    /// Discovery was cancelled by the user
    Cancelled,
}

/// Generic event sink for streaming discovery results (Tauri-independent)
///
/// Implementations:
/// - Main process: forwards events to Tauri `Channel<DiscoveryEvent>`
/// - Sidecar: writes JSON Lines to stdout
pub trait DiscoveryEventSink: Send + Sync {
    /// Send a discovery event to the consumer
    fn send(&self, event: DiscoveryEvent) -> Result<(), String>;
}

/// Extended ports for TCP connect discovery (includes IoT and common services)
pub const CONNECT_DISCOVERY_PORTS: &[u16] = &[
    21,    // FTP
    22,    // SSH
    23,    // Telnet
    25,    // SMTP
    53,    // DNS
    80,    // HTTP
    110,   // POP3
    135,   // MS RPC
    139,   // NetBIOS
    143,   // IMAP
    443,   // HTTPS
    445,   // SMB
    515,   // LPD (printers)
    548,   // AFP (Apple Filing Protocol)
    554,   // RTSP (cameras)
    631,   // IPP (CUPS printing)
    993,   // IMAPS
    995,   // POP3S
    1433,  // MS SQL
    1883,  // MQTT (IoT)
    3306,  // MySQL
    3389,  // RDP
    5000,  // UPnP
    5001,  // Synology DSM
    5353,  // mDNS
    5900,  // VNC
    6379,  // Redis
    8000,  // HTTP Alt
    8008,  // Chromecast
    8080,  // HTTP Alt
    8081,  // HTTP Alt
    8443,  // HTTPS Alt
    8888,  // HTTP Alt
    9000,  // Various
    9100,  // JetDirect (printers)
    49152, // UPnP / Dynamic ports
    62078, // iPhone sync
];
