//! Host discovery methods for network scanning
//!
//! Provides multiple methods for discovering live hosts:
//! - ICMP Ping (cross-platform, may require elevated privileges on some systems)
//! - ARP Scan (local network only, requires libpcap and elevated privileges)
//! - TCP SYN Scan (requires raw socket and elevated privileges)
//! - mDNS/Bonjour (no special privileges, discovers advertised services)

use std::collections::HashSet;
use std::net::{IpAddr, Ipv4Addr};
use std::sync::Arc;
use std::time::Duration;

use ipnetwork::IpNetwork;
use pnet::datalink::{self, Channel, NetworkInterface};
use pnet::packet::arp::{ArpHardwareTypes, ArpOperations, ArpPacket, MutableArpPacket};
use pnet::packet::ethernet::{EtherTypes, EthernetPacket, MutableEthernetPacket};
use pnet::packet::ip::IpNextHeaderProtocols;
use pnet::packet::tcp::{MutableTcpPacket, TcpFlags};
use pnet::packet::Packet;
use pnet::transport::{self, TransportChannelType, TransportProtocol, TransportSender};
use pnet::util::MacAddr;
use serde::{Deserialize, Serialize};
use surge_ping::{Client, Config, PingIdentifier, PingSequence};
use tokio::sync::Semaphore;
use tokio::time::timeout;

use super::interfaces::discover_mdns_services;

/// Discovery method to use for finding live hosts
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum DiscoveryMethod {
    /// ICMP Echo Request (ping)
    #[default]
    IcmpPing,
    /// ARP scan (local network only)
    ArpScan,
    /// TCP SYN scan to common ports (requires raw sockets)
    TcpSyn,
    /// TCP Connect scan to common ports (no privileges needed)
    TcpConnect,
    /// mDNS/Bonjour service discovery
    Mdns,
    /// Skip host discovery, scan all targets
    None,
}

/// Host metadata collected during discovery
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HostMetadata {
    /// Hostname (from mDNS, DNS reverse lookup, `NetBIOS`, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    /// Source of the hostname resolution (dns, mdns, netbios)
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
#[derive(Debug, Clone, Deserialize)]
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
            methods: vec![DiscoveryMethod::IcmpPing],
            timeout_ms: 1000,
            concurrency: 100,
            syn_ports: Some(vec![80, 443, 22, 445, 139]),
            mdns_services: None,
            resolve_netbios: false,
        }
    }
}

/// Common ports for TCP SYN discovery
pub const SYN_DISCOVERY_PORTS: &[u16] = &[
    22,   // SSH
    80,   // HTTP
    443,  // HTTPS
    445,  // SMB
    139,  // NetBIOS
    3389, // RDP
    8080, // HTTP Alt
];

/// Discover live hosts using specified methods
pub async fn discover_hosts(
    targets: &[IpAddr],
    options: &DiscoveryOptions,
) -> Vec<DiscoveryResult> {
    let mut results = Vec::new();

    for method in &options.methods {
        let result = match method {
            DiscoveryMethod::IcmpPing => icmp_ping_discovery(targets, options).await,
            DiscoveryMethod::ArpScan => arp_scan_discovery(targets, options).await,
            DiscoveryMethod::TcpSyn => tcp_syn_discovery(targets, options).await,
            DiscoveryMethod::TcpConnect => tcp_connect_discovery(targets, options).await,
            DiscoveryMethod::Mdns => mdns_discovery(options).await,
            DiscoveryMethod::None => DiscoveryResult {
                method: "none".to_string(),
                hosts: targets.iter().map(ToString::to_string).collect(),
                hostnames: std::collections::HashMap::new(),
                host_metadata: std::collections::HashMap::new(),
                unreachable: vec![],
                duration_ms: 0,
                error: None,
                requires_privileges: false,
            },
        };
        results.push(result);
    }

    // Resolve NetBIOS names for all discovered hosts if enabled
    if options.resolve_netbios {
        resolve_netbios_for_results(&mut results, options).await;
    }

    results
}

/// Resolve `NetBIOS` names for all discovered hosts in the results
async fn resolve_netbios_for_results(results: &mut [DiscoveryResult], options: &DiscoveryOptions) {
    use super::netbios::resolve_netbios_name;

    let timeout_duration = Duration::from_millis(u64::from(options.timeout_ms));

    // Collect all unique discovered IPs
    let all_ips: Vec<IpAddr> = results
        .iter()
        .flat_map(|r| r.hosts.iter())
        .filter_map(|h| h.parse::<IpAddr>().ok())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    // Resolve NetBIOS names concurrently
    let semaphore = Arc::new(Semaphore::new(options.concurrency as usize));
    let mut handles: Vec<tokio::task::JoinHandle<Option<(String, String)>>> = Vec::new();

    for ip in all_ips {
        let sem = Arc::clone(&semaphore);
        let timeout = timeout_duration;

        let handle: tokio::task::JoinHandle<Option<(String, String)>> = tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;

            // NetBIOS resolution is blocking, run in a blocking task
            let result = tokio::task::spawn_blocking(move || resolve_netbios_name(ip, timeout))
                .await
                .ok()
                .flatten();

            result.map(|name| (ip.to_string(), name))
        });

        handles.push(handle);
    }

    // Collect results
    let mut netbios_names: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    for handle in handles {
        if let Ok(Some((ip, name))) = handle.await {
            netbios_names.insert(ip, name);
        }
    }

    // Update host_metadata in all results with NetBIOS names
    for result in results.iter_mut() {
        for host_ip in &result.hosts {
            if let Some(netbios_name) = netbios_names.get(host_ip) {
                let metadata = result
                    .host_metadata
                    .entry(host_ip.clone())
                    .or_insert_with(HostMetadata::default);

                metadata.netbios_name = Some(netbios_name.clone());

                // Note: We intentionally do NOT add NetBIOS name to hostnames map.
                // This is because NetBIOS names may differ from mDNS/DNS hostnames,
                // and adding them would prevent proper host merging when the same
                // host has both IPv4 (with NetBIOS) and IPv6 (with mDNS) addresses.
                // The NetBIOS name is preserved in metadata.netbios_name for display.
            }
        }
    }
}

// =============================================================================
// ICMP Ping Discovery
// =============================================================================

/// Discover hosts using ICMP ping
async fn icmp_ping_discovery(targets: &[IpAddr], options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let timeout_duration = Duration::from_millis(u64::from(options.timeout_ms));
    let semaphore = Arc::new(Semaphore::new(options.concurrency as usize));

    let mut hosts = Vec::new();
    let mut unreachable = Vec::new();

    // Create ping client
    let client = match Client::new(&Config::default()) {
        Ok(c) => Arc::new(c),
        Err(e) => {
            return DiscoveryResult {
                method: "icmp_ping".to_string(),
                hosts: vec![],
                hostnames: std::collections::HashMap::new(),
                host_metadata: std::collections::HashMap::new(),
                unreachable: targets.iter().map(ToString::to_string).collect(),
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(format!(
                    "Failed to create ICMP client: {e}. May require elevated privileges."
                )),
                requires_privileges: true,
            };
        }
    };

    let mut handles = Vec::with_capacity(targets.len());

    for (idx, &target) in targets.iter().enumerate() {
        let sem = Arc::clone(&semaphore);
        let client = Arc::clone(&client);

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;

            let payload = [0u8; 56];
            let mut pinger = client.pinger(target, PingIdentifier(idx as u16)).await;

            match timeout(timeout_duration, pinger.ping(PingSequence(0), &payload)).await {
                Ok(Ok(_reply)) => Some((target, true)),
                Ok(Err(_)) | Err(_) => Some((target, false)),
            }
        });

        handles.push(handle);
    }

    for handle in handles {
        if let Ok(Some((ip, alive))) = handle.await {
            if alive {
                hosts.push(ip.to_string());
            } else {
                unreachable.push(ip.to_string());
            }
        }
    }

    DiscoveryResult {
        method: "icmp_ping".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata: std::collections::HashMap::new(),
        unreachable,
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: cfg!(target_os = "linux"),
    }
}

// =============================================================================
// ARP Scan Discovery
// =============================================================================

/// Discover hosts using ARP scan (local network only)
async fn arp_scan_discovery(targets: &[IpAddr], options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();

    // ARP only works for IPv4 on local network
    let ipv4_targets: Vec<Ipv4Addr> = targets
        .iter()
        .filter_map(|ip| match ip {
            IpAddr::V4(v4) => Some(*v4),
            IpAddr::V6(_) => None,
        })
        .collect();

    if ipv4_targets.is_empty() {
        return DiscoveryResult {
            method: "arp_scan".to_string(),
            hosts: vec![],
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: targets.iter().map(ToString::to_string).collect(),
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some("ARP scan only supports IPv4 addresses".to_string()),
            requires_privileges: true,
        };
    }

    // Find a suitable network interface
    let interface = match find_interface_for_targets(&ipv4_targets) {
        Some(iface) => iface,
        None => {
            return DiscoveryResult {
                method: "arp_scan".to_string(),
                hosts: vec![],
                hostnames: std::collections::HashMap::new(),
                host_metadata: std::collections::HashMap::new(),
                unreachable: targets.iter().map(ToString::to_string).collect(),
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some("No suitable network interface found for ARP scan".to_string()),
                requires_privileges: true,
            };
        }
    };

    // Perform ARP scan
    match perform_arp_scan(&interface, &ipv4_targets, options.timeout_ms).await {
        Ok(discovered) => {
            use super::oui;

            // Build host metadata with MAC addresses and vendor lookup
            let mut host_metadata = std::collections::HashMap::new();
            let hosts: Vec<String> = discovered
                .iter()
                .map(|(ip, mac)| {
                    let mac_str = oui::format_mac(mac);
                    let vendor = oui::lookup_vendor(&mac_str).map(String::from);
                    host_metadata.insert(
                        ip.to_string(),
                        HostMetadata {
                            hostname: None,
                            hostname_source: None,
                            netbios_name: None,
                            mac_address: Some(mac_str),
                            vendor,
                            mdns_services: vec![],
                        },
                    );
                    ip.to_string()
                })
                .collect();

            let discovered_set: HashSet<_> = discovered.keys().copied().collect();
            let unreachable: Vec<String> = ipv4_targets
                .iter()
                .filter(|ip| !discovered_set.contains(ip))
                .map(ToString::to_string)
                .collect();

            DiscoveryResult {
                method: "arp_scan".to_string(),
                hosts,
                hostnames: std::collections::HashMap::new(),
                host_metadata,
                unreachable,
                duration_ms: start.elapsed().as_millis() as u64,
                error: None,
                requires_privileges: true,
            }
        }
        Err(e) => DiscoveryResult {
            method: "arp_scan".to_string(),
            hosts: vec![],
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: targets.iter().map(ToString::to_string).collect(),
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some(e),
            requires_privileges: true,
        },
    }
}

/// Find a network interface that can reach the target IPs
fn find_interface_for_targets(targets: &[Ipv4Addr]) -> Option<NetworkInterface> {
    let interfaces = datalink::interfaces();

    for iface in interfaces {
        if iface.is_loopback() || !iface.is_up() {
            continue;
        }

        for ip in &iface.ips {
            if let IpNetwork::V4(network) = ip {
                // Check if any target is in this network
                for target in targets {
                    if network.contains(*target) {
                        return Some(iface.clone());
                    }
                }
            }
        }
    }

    None
}

/// Perform ARP scan on the given interface
/// Returns a map of IP address to MAC address (as 6-byte array)
async fn perform_arp_scan(
    interface: &NetworkInterface,
    targets: &[Ipv4Addr],
    timeout_ms: u32,
) -> Result<std::collections::HashMap<Ipv4Addr, [u8; 6]>, String> {
    let source_mac = interface
        .mac
        .ok_or_else(|| "Interface has no MAC address".to_string())?;

    let source_ip = interface
        .ips
        .iter()
        .find_map(|ip| match ip {
            IpNetwork::V4(net) => Some(net.ip()),
            _ => None,
        })
        .ok_or_else(|| "Interface has no IPv4 address".to_string())?;

    // Create datalink channel
    let (mut tx, mut rx) = match datalink::channel(interface, Default::default()) {
        Ok(Channel::Ethernet(tx, rx)) => (tx, rx),
        Ok(_) => return Err("Unsupported channel type".to_string()),
        Err(e) => {
            return Err(format!(
                "Failed to create datalink channel: {e}. Requires elevated privileges."
            ))
        }
    };

    let mut discovered: std::collections::HashMap<Ipv4Addr, [u8; 6]> =
        std::collections::HashMap::new();
    let timeout_duration = Duration::from_millis(u64::from(timeout_ms));

    // Send ARP requests for all targets
    for target in targets {
        let mut ethernet_buffer = [0u8; 42];
        let mut ethernet_packet = MutableEthernetPacket::new(&mut ethernet_buffer)
            .ok_or("Failed to create ethernet packet")?;

        ethernet_packet.set_destination(MacAddr::broadcast());
        ethernet_packet.set_source(source_mac);
        ethernet_packet.set_ethertype(EtherTypes::Arp);

        let mut arp_buffer = [0u8; 28];
        let mut arp_packet =
            MutableArpPacket::new(&mut arp_buffer).ok_or("Failed to create ARP packet")?;

        arp_packet.set_hardware_type(ArpHardwareTypes::Ethernet);
        arp_packet.set_protocol_type(EtherTypes::Ipv4);
        arp_packet.set_hw_addr_len(6);
        arp_packet.set_proto_addr_len(4);
        arp_packet.set_operation(ArpOperations::Request);
        arp_packet.set_sender_hw_addr(source_mac);
        arp_packet.set_sender_proto_addr(source_ip);
        arp_packet.set_target_hw_addr(MacAddr::zero());
        arp_packet.set_target_proto_addr(*target);

        ethernet_packet.set_payload(arp_packet.packet());

        if tx.send_to(ethernet_packet.packet(), None).is_none() {
            continue;
        }
    }

    // Collect responses
    let start = std::time::Instant::now();
    let target_set: HashSet<_> = targets.iter().copied().collect();

    while start.elapsed() < timeout_duration {
        match rx.next() {
            Ok(packet) => {
                if let Some(ethernet) = EthernetPacket::new(packet) {
                    if ethernet.get_ethertype() == EtherTypes::Arp {
                        if let Some(arp) = ArpPacket::new(ethernet.payload()) {
                            if arp.get_operation() == ArpOperations::Reply {
                                let sender_ip = arp.get_sender_proto_addr();
                                if target_set.contains(&sender_ip) {
                                    // Capture MAC address from ARP reply
                                    let sender_mac = arp.get_sender_hw_addr();
                                    let mac_bytes = [
                                        sender_mac.0,
                                        sender_mac.1,
                                        sender_mac.2,
                                        sender_mac.3,
                                        sender_mac.4,
                                        sender_mac.5,
                                    ];
                                    discovered.insert(sender_ip, mac_bytes);
                                }
                            }
                        }
                    }
                }
            }
            Err(_) => {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        }

        // Early exit if all targets discovered
        if discovered.len() == targets.len() {
            break;
        }
    }

    Ok(discovered)
}

// =============================================================================
// TCP SYN Scan Discovery
// =============================================================================

/// Discover hosts using TCP SYN scan
async fn tcp_syn_discovery(targets: &[IpAddr], options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();

    let ports = options
        .syn_ports
        .as_ref()
        .map_or(SYN_DISCOVERY_PORTS, |p| p.as_slice());

    // Create transport channel for TCP
    let protocol =
        TransportChannelType::Layer4(TransportProtocol::Ipv4(IpNextHeaderProtocols::Tcp));

    let (mut tx, mut rx) = match transport::transport_channel(4096, protocol) {
        Ok((tx, rx)) => (tx, rx),
        Err(e) => {
            return DiscoveryResult {
                method: "tcp_syn".to_string(),
                hosts: vec![],
                hostnames: std::collections::HashMap::new(),
                host_metadata: std::collections::HashMap::new(),
                unreachable: targets.iter().map(ToString::to_string).collect(),
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(format!(
                    "Failed to create raw socket: {e}. Requires elevated privileges."
                )),
                requires_privileges: true,
            };
        }
    };

    let mut discovered = HashSet::new();
    let timeout_duration = Duration::from_millis(u64::from(options.timeout_ms));

    // Send SYN packets
    for target in targets {
        if let IpAddr::V4(target_v4) = target {
            for &port in ports {
                if let Err(e) = send_syn_packet(&mut tx, *target_v4, port) {
                    // Log error but continue
                    eprintln!("Failed to send SYN to {}:{}: {}", target, port, e);
                }
            }
        }
    }

    // Collect SYN-ACK responses
    let start_recv = std::time::Instant::now();
    let target_set: HashSet<_> = targets.iter().collect();

    while start_recv.elapsed() < timeout_duration {
        let mut iter = transport::tcp_packet_iter(&mut rx);
        match iter.next_with_timeout(Duration::from_millis(100)) {
            Ok(Some((packet, addr))) => {
                if target_set.contains(&addr) {
                    // Check for SYN-ACK
                    if packet.get_flags() & (TcpFlags::SYN | TcpFlags::ACK)
                        == (TcpFlags::SYN | TcpFlags::ACK)
                    {
                        discovered.insert(addr);
                    }
                    // RST also means host is alive
                    else if packet.get_flags() & TcpFlags::RST != 0 {
                        discovered.insert(addr);
                    }
                }
            }
            Ok(None) | Err(_) => {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        }
    }

    let hosts: Vec<String> = discovered.iter().map(ToString::to_string).collect();
    let unreachable: Vec<String> = targets
        .iter()
        .filter(|ip| !discovered.contains(ip))
        .map(ToString::to_string)
        .collect();

    DiscoveryResult {
        method: "tcp_syn".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata: std::collections::HashMap::new(),
        unreachable,
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: true,
    }
}

/// Send a TCP SYN packet
fn send_syn_packet(tx: &mut TransportSender, target: Ipv4Addr, port: u16) -> Result<(), String> {
    let mut tcp_buffer = [0u8; 20];
    let mut tcp_packet =
        MutableTcpPacket::new(&mut tcp_buffer).ok_or("Failed to create TCP packet")?;

    tcp_packet.set_source(rand::random::<u16>().max(1024));
    tcp_packet.set_destination(port);
    tcp_packet.set_sequence(rand::random());
    tcp_packet.set_acknowledgement(0);
    tcp_packet.set_data_offset(5);
    tcp_packet.set_flags(TcpFlags::SYN);
    tcp_packet.set_window(64240);
    tcp_packet.set_urgent_ptr(0);

    tx.send_to(tcp_packet, IpAddr::V4(target))
        .map_err(|e| format!("Failed to send packet: {e}"))?;

    Ok(())
}

// =============================================================================
// mDNS Discovery
// =============================================================================

/// Discover hosts using mDNS/Bonjour
async fn mdns_discovery(options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();

    let service_types = options.mdns_services.clone().unwrap_or_else(|| {
        vec![
            "_http._tcp".to_string(),
            "_https._tcp".to_string(),
            "_ssh._tcp".to_string(),
            "_smb._tcp".to_string(),
            "_afpovertcp._tcp".to_string(),
        ]
    });

    match discover_mdns_services(service_types, options.timeout_ms).await {
        Ok(results) => {
            let mut hosts = HashSet::new();
            let mut hostnames = std::collections::HashMap::new();
            let mut host_metadata: std::collections::HashMap<String, HostMetadata> =
                std::collections::HashMap::new();

            for service in &results.services {
                // Create mDNS service info
                let service_info = MdnsServiceInfo {
                    instance_name: service.instance_name.clone(),
                    service_type: service.service_type.clone(),
                    port: service.port,
                    properties: service.properties.clone(),
                };

                for addr in &service.addresses {
                    hosts.insert(addr.clone());

                    // Map IP address to hostname (remove trailing dot if present)
                    let hostname = service.hostname.trim_end_matches('.').to_string();
                    if !hostname.is_empty() {
                        hostnames.insert(addr.clone(), hostname.clone());
                    }

                    // Add or update host metadata
                    host_metadata
                        .entry(addr.clone())
                        .and_modify(|meta| {
                            // Update hostname if not set
                            if meta.hostname.is_none() && !hostname.is_empty() {
                                meta.hostname = Some(hostname.clone());
                            }
                            // Add service info
                            meta.mdns_services.push(service_info.clone());
                        })
                        .or_insert_with(|| HostMetadata {
                            hostname: if hostname.is_empty() {
                                None
                            } else {
                                Some(hostname.clone())
                            },
                            hostname_source: if hostname.is_empty() {
                                None
                            } else {
                                Some("mdns".to_string())
                            },
                            netbios_name: None,
                            mac_address: None,
                            vendor: None,
                            mdns_services: vec![service_info.clone()],
                        });
                }
            }

            DiscoveryResult {
                method: "mdns".to_string(),
                hosts: hosts.into_iter().collect(),
                hostnames,
                host_metadata,
                unreachable: vec![],
                duration_ms: start.elapsed().as_millis() as u64,
                error: None,
                requires_privileges: false,
            }
        }
        Err(e) => DiscoveryResult {
            method: "mdns".to_string(),
            hosts: vec![],
            hostnames: std::collections::HashMap::new(),
            host_metadata: std::collections::HashMap::new(),
            unreachable: vec![],
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some(e),
            requires_privileges: false,
        },
    }
}

// =============================================================================
// TCP Connect Discovery (Port Scan)
// =============================================================================

/// Discover hosts using TCP connect scan (no privileges needed)
async fn tcp_connect_discovery(targets: &[IpAddr], options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let timeout_duration = Duration::from_millis(u64::from(options.timeout_ms));
    let semaphore = Arc::new(Semaphore::new(options.concurrency as usize));

    // Use SYN ports for connect scan too
    let ports = options
        .syn_ports
        .as_ref()
        .map_or(SYN_DISCOVERY_PORTS, Vec::as_slice);

    let mut hosts = Vec::new();
    let mut unreachable = Vec::new();

    let mut handles = Vec::with_capacity(targets.len());

    for &target in targets {
        let sem = Arc::clone(&semaphore);
        let ports = ports.to_vec();

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await;

            // Try connecting to any of the common ports
            for port in &ports {
                let addr = std::net::SocketAddr::new(target, *port);
                if let Ok(result) =
                    timeout(timeout_duration, tokio::net::TcpStream::connect(addr)).await
                {
                    if result.is_ok() {
                        return (target, true);
                    }
                }
            }

            (target, false)
        });

        handles.push(handle);
    }

    // Collect results
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
        method: "tcp_connect".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata: std::collections::HashMap::new(),
        unreachable,
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}

// =============================================================================
// Utility Functions
// =============================================================================

/// Check if the current process has the privileges needed for a discovery method
///
/// Note: This function is async because `surge_ping::Client::new` requires a tokio runtime.
pub async fn check_privileges(method: DiscoveryMethod) -> bool {
    match method {
        DiscoveryMethod::IcmpPing => {
            // Try to create a ping client (requires tokio runtime)
            Client::new(&Config::default()).is_ok()
        }
        DiscoveryMethod::ArpScan => {
            // Try to create a datalink channel on any interface
            let interfaces = datalink::interfaces();
            for iface in interfaces {
                if !iface.is_loopback() && iface.is_up() {
                    if datalink::channel(&iface, Default::default()).is_ok() {
                        return true;
                    }
                }
            }
            false
        }
        DiscoveryMethod::TcpSyn => {
            // Try to create a raw socket
            let protocol =
                TransportChannelType::Layer4(TransportProtocol::Ipv4(IpNextHeaderProtocols::Tcp));
            transport::transport_channel(4096, protocol).is_ok()
        }
        DiscoveryMethod::TcpConnect | DiscoveryMethod::Mdns | DiscoveryMethod::None => true,
    }
}

/// Get available discovery methods for the current system
///
/// Note: This function is async because privilege checking for ICMP requires a tokio runtime.
pub async fn get_available_methods() -> Vec<(DiscoveryMethod, bool)> {
    vec![
        (DiscoveryMethod::TcpConnect, true), // Always available (no privileges needed)
        (
            DiscoveryMethod::IcmpPing,
            check_privileges(DiscoveryMethod::IcmpPing).await,
        ),
        (
            DiscoveryMethod::ArpScan,
            check_privileges(DiscoveryMethod::ArpScan).await,
        ),
        (
            DiscoveryMethod::TcpSyn,
            check_privileges(DiscoveryMethod::TcpSyn).await,
        ),
        (DiscoveryMethod::Mdns, true),
        (DiscoveryMethod::None, true),
    ]
}
