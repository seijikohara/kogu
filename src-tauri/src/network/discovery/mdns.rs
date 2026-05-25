//! mDNS/Bonjour host discovery.

use std::collections::HashSet;

use super::super::interfaces::discover_mdns_services;
use super::types::{DiscoveryOptions, DiscoveryResult, HostMetadata, MdnsServiceInfo};

/// Minimum timeout for mDNS discovery (mDNS needs time for service resolution)
const MDNS_MIN_TIMEOUT_MS: u32 = 5000;

/// Common mDNS/Bonjour service types for host discovery
///
/// These service types are based on:
/// - RFC 6763 (DNS-Based Service Discovery)
/// - IANA Service Name and Transport Protocol Port Number Registry
/// - Apple Bonjour Printing Specification
/// - Common IoT and smart home protocols
const DEFAULT_MDNS_SERVICE_TYPES: &[&str] = &[
    // Web Services
    "_http._tcp",  // HTTP web servers
    "_https._tcp", // HTTPS web servers
    // Remote Access
    "_ssh._tcp",      // SSH servers
    "_sftp-ssh._tcp", // SFTP over SSH
    "_rfb._tcp",      // VNC (Remote Frame Buffer)
    // File Sharing
    "_smb._tcp",        // SMB/CIFS (Windows file sharing)
    "_afpovertcp._tcp", // AFP (Apple Filing Protocol)
    "_ftp._tcp",        // FTP servers
    "_nfs._tcp",        // NFS (Network File System)
    "_webdav._tcp",     // WebDAV
    // Printing
    "_ipp._tcp",            // Internet Printing Protocol
    "_ipps._tcp",           // IPP over HTTPS
    "_printer._tcp",        // LPR printers
    "_pdl-datastream._tcp", // PDL Data Stream printers
    "_scanner._tcp",        // Scanners
    // Media & Streaming
    "_airplay._tcp",         // Apple AirPlay
    "_raop._tcp",            // Remote Audio Output Protocol (AirPlay audio)
    "_daap._tcp",            // iTunes/DAAP (Digital Audio Access Protocol)
    "_googlecast._tcp",      // Google Cast / Chromecast
    "_spotify-connect._tcp", // Spotify Connect
    // Smart Home / IoT
    "_hap._tcp",     // HomeKit Accessory Protocol
    "_homekit._tcp", // HomeKit
    "_hue._tcp",     // Philips Hue
    // Apple Services
    "_device-info._tcp",    // Device information
    "_companion-link._tcp", // Apple Watch companion
    "_sleep-proxy._udp",    // Sleep Proxy (Wake-on-LAN)
    "_adisk._tcp",          // Time Machine / Apple Disk
    // Workstation Discovery
    "_workstation._tcp", // macOS/Linux workstations
    "_presence._tcp",    // Presence/availability
    // Database Services
    "_postgresql._tcp", // PostgreSQL
    "_mysql._tcp",      // MySQL
    // NAS Devices
    "_nas._tcp",   // Generic NAS
    "_iscsi._tcp", // iSCSI targets
];

/// Discover hosts using mDNS/Bonjour
pub(super) async fn mdns_discovery(options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();

    let service_types = options.mdns_services.clone().unwrap_or_else(|| {
        DEFAULT_MDNS_SERVICE_TYPES
            .iter()
            .map(|s| (*s).to_string())
            .collect()
    });

    // mDNS requires longer timeout for service discovery and resolution
    let mdns_timeout = options.timeout_ms.max(MDNS_MIN_TIMEOUT_MS);

    match discover_mdns_services(service_types, mdns_timeout).await {
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
                            mdns_services: vec![service_info.clone()],
                            ..Default::default()
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
