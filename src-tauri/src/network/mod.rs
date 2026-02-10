// Allow some clippy warnings in this module for now - to be cleaned up
#![allow(
    clippy::similar_names,
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_possible_wrap,
    clippy::redundant_else,
    clippy::option_if_let_else,
    clippy::single_match_else,
    clippy::wildcard_in_or_patterns,
    clippy::wildcard_enum_match_arm,
    clippy::default_trait_access,
    clippy::needless_continue,
    clippy::uninlined_format_args,
    clippy::print_stderr,
    clippy::if_same_then_else,
    clippy::match_same_arms,
    clippy::single_match,
    clippy::collapsible_else_if,
    clippy::collapsible_if,
    clippy::unnecessary_unwrap,
    clippy::doc_markdown,
    clippy::manual_range_contains,
    clippy::trivially_copy_pass_by_ref,
    clippy::redundant_closure,
    clippy::redundant_closure_for_method_calls,
    clippy::or_fun_call,
    clippy::missing_const_for_fn,
    clippy::case_sensitive_file_extension_comparisons,
    clippy::manual_let_else,
    clippy::bool_to_int_with_if,
    clippy::if_not_else,
    clippy::ref_option,
    clippy::option_as_ref_cloned,
    clippy::bind_instead_of_map,
    clippy::collapsible_match,
    clippy::unnecessary_map_or,
    clippy::match_wildcard_for_single_variants
)]

//! Network scanning module
//!
//! Provides TCP port scanning functionality with:
//! - Single IP and CIDR range support (IPv4 and IPv6)
//! - Parallel scanning with configurable concurrency
//! - Service detection via banner grabbing
//! - DNS reverse lookup
//! - Real-time progress events
//! - Local network interface discovery
//! - mDNS/Bonjour service discovery
//! - Host discovery (ICMP, ARP, TCP SYN, mDNS)
//! - `NetBIOS` name resolution
//!
//! All scanning operations are delegated to the `net-scanner` sidecar binary
//! for privilege isolation. The main process acts as a thin proxy.

mod arp_cache;
pub mod discovery;
pub mod interfaces;
mod llmnr;
mod netbios;
mod oui;
mod ports;
pub mod privileges;
pub mod scanner;
pub mod sidecar;
mod snmp;
#[cfg(target_os = "macos")]
pub mod swift_bridge;
mod tls_info;
pub mod types;
mod ws_discovery;

use std::collections::HashMap;
use std::sync::Mutex;

use tauri_plugin_shell::process::CommandChild;

pub use discovery::{
    check_privileges, discover_hosts, get_available_methods, DiscoveryEvent, DiscoveryEventSink,
    DiscoveryMethod, DiscoveryOptions,
};
pub use interfaces::{discover_mdns_services, get_local_interfaces};
pub use types::{MdnsDiscoveryRequest, ScanProgress, ScanProgressSink, ScanRequest};

// =============================================================================
// Scan State Management (process-based cancellation)
// =============================================================================

/// State for managing active sidecar processes.
///
/// Each active scan/discovery operation is tracked by its ID and associated
/// sidecar child process. Cancellation is achieved by killing the process.
#[derive(Default)]
pub struct NetworkScannerState {
    /// Active sidecar processes indexed by operation ID
    processes: Mutex<HashMap<String, CommandChild>>,
}

impl NetworkScannerState {
    /// Create a new scanner state
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a sidecar child process for an operation
    pub fn register(&self, operation_id: String, child: CommandChild) {
        self.processes
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .insert(operation_id, child);
    }

    /// Cancel an active operation by killing its sidecar process
    pub fn cancel(&self, operation_id: &str) -> bool {
        let mut map = self
            .processes
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if let Some(child) = map.remove(operation_id) {
            child.kill().is_ok()
        } else {
            false
        }
    }

    /// Remove a completed operation
    pub fn remove(&self, operation_id: &str) {
        self.processes
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(operation_id);
    }
}
