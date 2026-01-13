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

mod discovery;
mod interfaces;
mod netbios;
mod oui;
mod ports;
mod scanner;
mod types;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tauri::AppHandle;

pub use discovery::{
    check_privileges, discover_hosts, get_available_methods, DiscoveryMethod, DiscoveryOptions,
    DiscoveryResult,
};
pub use interfaces::{discover_mdns_services, get_local_interfaces};
pub use scanner::ScanState;
pub use types::{
    LocalNetworkInfo, MdnsDiscoveryRequest, MdnsDiscoveryResults, ScanRequest, ScanResults,
};

/// State for managing network scans
#[derive(Default)]
pub struct NetworkScannerState {
    /// Active scans indexed by scan ID
    scans: Mutex<HashMap<String, Arc<ScanState>>>,
}

impl NetworkScannerState {
    /// Create a new scanner state
    pub fn new() -> Self {
        Self::default()
    }

    /// Start a new scan and return the scan state
    pub fn start_scan(&self, scan_id: String) -> Arc<ScanState> {
        let (state, _rx) = ScanState::new();
        let state = Arc::new(state);
        self.scans
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .insert(scan_id, Arc::clone(&state));
        state
    }

    /// Cancel a running scan
    pub fn cancel_scan(&self, scan_id: &str) -> bool {
        self.scans
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .get(scan_id)
            .map_or(false, |state| {
                state.cancel();
                true
            })
    }

    /// Remove a completed scan
    pub fn remove_scan(&self, scan_id: &str) {
        self.scans
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(scan_id);
    }
}

/// Start a network scan
pub async fn start_scan(
    request: ScanRequest,
    app: AppHandle,
    state: &NetworkScannerState,
) -> Result<(String, ScanResults), String> {
    let scan_id = uuid::Uuid::new_v4().to_string();
    let scan_state = state.start_scan(scan_id.clone());

    let result = scanner::run_scan(request, app, scan_state).await;

    state.remove_scan(&scan_id);

    result.map(|results| (scan_id, results))
}
