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
//! - Userspace host discovery (TCP Connect, mDNS, SSDP, UDP, WS-Discovery, ARP cache)
//! - `NetBIOS` name resolution
//!
//! All scanning operations run inside the main process. Cancellation is
//! coordinated through per-operation tokens tracked by [`NetworkScannerState`].

mod arp_cache;
mod banner;
pub mod discovery;
pub mod interfaces;
mod llmnr;
mod netbios;
pub mod oui;
mod ports;
pub mod scanner;
mod snmp;
mod tls_info;
pub mod types;
pub mod wifi;
mod ws_discovery;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tokio_util::sync::CancellationToken;

pub use discovery::{
    discover_hosts, DiscoveryEvent, DiscoveryEventSink, DiscoveryMethod, DiscoveryOptions,
};
pub use types::{MdnsDiscoveryRequest, ScanRequest};

// =============================================================================
// Scan State Management (token-based cancellation)
// =============================================================================

/// State for managing active in-process scan and discovery operations.
///
/// Each active operation is tracked by its ID and associated cancellation token.
/// Cancellation is achieved by signalling the token, which cooperating tasks
/// observe through the corresponding [`scanner::ScanState`].
#[derive(Default)]
pub struct NetworkScannerState {
    /// Active cancellation tokens indexed by operation ID
    tokens: Mutex<HashMap<String, Arc<CancellationToken>>>,
}

impl NetworkScannerState {
    /// Create a new scanner state.
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a cancellation token for an operation.
    pub fn register(&self, operation_id: String, token: Arc<CancellationToken>) {
        self.tokens
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .insert(operation_id, token);
    }

    /// Cancel an active operation by signalling its cancellation token.
    ///
    /// Returns `true` if a matching operation was found and cancelled.
    pub fn cancel(&self, operation_id: &str) -> bool {
        let mut map = self
            .tokens
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        match map.remove(operation_id) {
            Some(token) => {
                token.cancel();
                true
            }
            None => false,
        }
    }

    /// Remove a completed operation.
    pub fn remove(&self, operation_id: &str) {
        self.tokens
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(operation_id);
    }
}
