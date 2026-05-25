//! Host discovery methods for network scanning
//!
//! Provides userspace methods for discovering live hosts without requiring
//! raw socket privileges:
//! - TCP Connect (probes common ports via standard OS connect)
//! - mDNS/Bonjour (discovers advertised services)
//! - SSDP/UPnP (discovers UPnP devices)
//! - UDP Scan (probes common UDP ports)
//! - WS-Discovery (discovers Windows devices and printers)
//! - ARP Cache (reads the OS ARP table)

mod arp;
mod coordinator;
mod dns;
mod llmnr_method;
mod mdns;
mod privileges;
mod snmp_method;
mod ssdp;
mod tcp_connect;
mod types;
mod udp_scan;
mod ws;

pub use coordinator::discover_hosts;
pub use privileges::{check_privileges, get_available_methods};
pub use types::{
    DiscoveryEvent, DiscoveryEventSink, DiscoveryMethod, DiscoveryOptions, DiscoveryResult,
};

// The remaining items below were `pub` in the previous flat `discovery.rs`
// (`HostMetadata`, `MdnsServiceInfo`, `CONNECT_DISCOVERY_PORTS`), but they
// are never referenced by name outside the discovery module. They remain
// `pub` inside `types` so they keep their original visibility shape; only
// the redundant facade re-exports are omitted to keep the build warning-free.
