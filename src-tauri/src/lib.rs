// =============================================================================
// Rust Lint Configuration - Strict Mode
// =============================================================================

// Clippy lint groups
#![warn(clippy::all)]
#![warn(clippy::pedantic)]
#![warn(clippy::nursery)]
// Safety lints - forbid unsafe code
#![forbid(unsafe_code)]
// Documentation requirements
#![warn(missing_docs)]
// Rust idioms
#![warn(rust_2018_idioms)]
// Clippy - Avoid panic-prone patterns (allow unwrap in tests)
#![warn(clippy::unwrap_used)]
#![cfg_attr(test, allow(clippy::unwrap_used))]
#![warn(clippy::expect_used)]
#![warn(clippy::panic)]
#![warn(clippy::todo)]
#![warn(clippy::unimplemented)]
// Clippy - Error handling
#![warn(clippy::unwrap_in_result)]
#![warn(clippy::panic_in_result_fn)]
// Clippy - Code quality
#![warn(clippy::cognitive_complexity)]
#![warn(clippy::dbg_macro)]
#![warn(clippy::print_stdout)]
#![warn(clippy::print_stderr)]
// Clippy - Performance
#![warn(clippy::inefficient_to_string)]
#![warn(clippy::needless_collect)]
// Clippy - Correctness
#![warn(clippy::missing_errors_doc)]
#![warn(clippy::missing_panics_doc)]
// Allow specific lints that are too noisy for this project
#![allow(clippy::module_name_repetitions)]
#![allow(clippy::must_use_candidate)]
#![allow(clippy::missing_errors_doc)]
// Re-allow for now as many functions need updates
// Tauri commands require owned State/AppHandle types due to macro constraints
#![allow(clippy::needless_pass_by_value)]

//! Kogu - A collection of useful developer tools
//!
//! This library provides the Rust backend for the Kogu desktop application,
//! including AST parsing functionality for JSON, YAML, XML, and SQL.

mod ast;
mod generators;
mod network;

use tauri::Manager;
use tauri_plugin_decorum::WebviewWindowExt;

use ast::{AstLanguage, AstParseResult};
use generators::{
    bcrypt::{BcryptCostInfo, BcryptHashResult, BcryptVerifyResult},
    cli::CliAvailability,
    gpg::{GpgKeyOptions, GpgKeyResult},
    ssh::{SshKeyOptions, SshKeyResult},
    worker::WorkerProcessState,
};
use network::{
    DiscoveryMethod, DiscoveryOptions, DiscoveryResult, LocalNetworkInfo, MdnsDiscoveryRequest,
    MdnsDiscoveryResults, NetworkScannerState, ScanRequest, ScanResults,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

// =============================================================================
// Worker Commands (with process isolation for true cancellation)
// =============================================================================

/// Cancel any ongoing worker operation by killing the worker process
#[tauri::command]
fn cancel_worker_operation(state: tauri::State<'_, WorkerProcessState>) -> bool {
    state.kill()
}

// =============================================================================
// BCrypt Commands
// =============================================================================

/// Generate a `BCrypt` hash from a password (cancellable via process termination)
#[tauri::command]
async fn generate_bcrypt_hash(
    password: String,
    cost: u32,
    app: tauri::AppHandle,
    state: tauri::State<'_, WorkerProcessState>,
) -> Result<BcryptHashResult, String> {
    generators::bcrypt::generate_hash_isolated(&app, password, cost, &state)
        .await
        .map_err(|e| e.to_string())
}

/// Verify a password against a `BCrypt` hash (cancellable via process termination)
#[tauri::command]
async fn verify_bcrypt_hash(
    password: String,
    hash: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, WorkerProcessState>,
) -> Result<BcryptVerifyResult, String> {
    generators::bcrypt::verify_hash_isolated(&app, password, hash, &state)
        .await
        .map_err(|e| e.to_string())
}

/// Get information about a `BCrypt` cost factor
#[tauri::command]
fn get_bcrypt_cost_info(cost: u32) -> BcryptCostInfo {
    generators::bcrypt::get_cost_info(cost)
}

// =============================================================================
// SSH Key Commands
// =============================================================================

/// Generate an SSH key pair (cancellable via process termination)
#[tauri::command]
async fn generate_ssh_keypair(
    options: SshKeyOptions,
    app: tauri::AppHandle,
    state: tauri::State<'_, WorkerProcessState>,
) -> Result<SshKeyResult, String> {
    generators::ssh::generate_key_isolated(&app, options, &state)
        .await
        .map_err(|e| e.to_string())
}

// =============================================================================
// GPG Key Commands
// =============================================================================

/// Generate a GPG key pair (cancellable via process termination)
#[tauri::command]
async fn generate_gpg_keypair(
    options: GpgKeyOptions,
    app: tauri::AppHandle,
    state: tauri::State<'_, WorkerProcessState>,
) -> Result<GpgKeyResult, String> {
    generators::gpg::generate_key_isolated(&app, options, &state)
        .await
        .map_err(|e| e.to_string())
}

// =============================================================================
// CLI Availability Commands
// =============================================================================

/// Check CLI tool availability
#[tauri::command]
fn check_cli_availability() -> CliAvailability {
    generators::cli::check_cli_availability()
}

// =============================================================================
// Network Scanner Commands
// =============================================================================

/// Start a network scan (async with progress events)
#[tauri::command]
async fn start_network_scan(
    request: ScanRequest,
    app: tauri::AppHandle,
    state: tauri::State<'_, NetworkScannerState>,
) -> Result<ScanResults, String> {
    network::start_scan(request, app, &state)
        .await
        .map(|(_, results)| results)
}

/// Cancel a running network scan
#[tauri::command]
fn cancel_network_scan(scan_id: String, state: tauri::State<'_, NetworkScannerState>) -> bool {
    state.cancel_scan(&scan_id)
}

/// Get local network interfaces
#[tauri::command]
fn get_local_network_interfaces() -> LocalNetworkInfo {
    network::get_local_interfaces()
}

/// Discover mDNS/Bonjour services on the local network
#[tauri::command]
async fn discover_mdns_services(
    request: MdnsDiscoveryRequest,
) -> Result<MdnsDiscoveryResults, String> {
    network::discover_mdns_services(request.service_types, request.duration_ms).await
}

// =============================================================================
// Host Discovery Commands
// =============================================================================

/// Discover hosts using specified methods (ICMP, ARP, TCP SYN, mDNS)
#[tauri::command]
async fn discover_hosts(
    targets: Vec<String>,
    options: DiscoveryOptions,
) -> Result<Vec<DiscoveryResult>, String> {
    use std::net::IpAddr;

    // Parse target strings to IpAddr
    let mut ip_targets = Vec::new();
    for target in &targets {
        if let Ok(ip) = target.parse::<IpAddr>() {
            ip_targets.push(ip);
        } else if target.contains('/') {
            // CIDR notation
            if let Ok(network) = target.parse::<ipnetwork::IpNetwork>() {
                ip_targets.extend(network.iter());
            }
        }
    }

    if ip_targets.is_empty() {
        return Err("No valid IP addresses provided".to_string());
    }

    Ok(network::discover_hosts(&ip_targets, &options).await)
}

/// Get available discovery methods and their privilege status
#[tauri::command]
async fn get_discovery_methods() -> Vec<(String, bool)> {
    network::get_available_methods()
        .await
        .into_iter()
        .map(|(method, available)| {
            let name = match method {
                DiscoveryMethod::IcmpPing => "icmp_ping",
                DiscoveryMethod::ArpScan => "arp_scan",
                DiscoveryMethod::TcpSyn => "tcp_syn",
                DiscoveryMethod::TcpConnect => "tcp_connect",
                DiscoveryMethod::Mdns => "mdns",
                DiscoveryMethod::None => "none",
            };
            (name.to_string(), available)
        })
        .collect()
}

/// Check if a specific discovery method is available
#[tauri::command]
async fn check_discovery_privilege(method: DiscoveryMethod) -> bool {
    network::check_privileges(method).await
}

/// Parse text to AST based on language
///
/// # Arguments
/// * `text` - The source text to parse
/// * `language` - The language identifier ("json", "yaml", "xml", "sql")
///
/// # Returns
/// `AstParseResult` containing the AST and any errors
#[tauri::command]
fn parse_to_ast(text: &str, language: &str) -> Result<AstParseResult, String> {
    let lang: AstLanguage = language.parse().map_err(|e: ast::AstError| e.to_string())?;

    Ok(ast::parse_to_ast(text, lang))
}

/// Runs the Tauri application.
///
/// This is the main entry point for the Kogu desktop application.
/// It initializes all plugins, sets up the window, and starts the event loop.
///
/// # Panics
///
/// This function will panic if:
/// - The main window cannot be found (configuration error)
/// - The overlay titlebar cannot be created
/// - The traffic lights inset cannot be set (macOS only)
/// - The Tauri application fails to start
///
/// These panics are appropriate for an application entry point since the app
/// cannot continue if initialization fails.
// Allow large_stack_frames: tauri::generate_context!() macro generates unavoidably large stack data
#[allow(clippy::large_stack_frames)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = {
        let base = tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_clipboard_manager::init())
            .plugin(tauri_plugin_os::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init())
            .plugin(tauri_plugin_decorum::init())
            .plugin(tauri_plugin_shell::init());

        // MCP bridge plugin for AI-assisted debugging (development only)
        #[cfg(debug_assertions)]
        let base = base.plugin(tauri_plugin_mcp_bridge::init());

        base
    };

    builder
        .manage(WorkerProcessState::new())
        .manage(NetworkScannerState::new())
        .setup(|app| {
            let main_window = app
                .get_webview_window("main")
                .ok_or("Failed to get main window")?;

            // Create overlay titlebar (handles Windows snap layout)
            main_window.create_overlay_titlebar()?;

            // macOS: position traffic lights centered in 32px (h-8) title bar
            #[cfg(target_os = "macos")]
            main_window.set_traffic_lights_inset(12.0, 10.0)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            parse_to_ast,
            cancel_worker_operation,
            generate_bcrypt_hash,
            verify_bcrypt_hash,
            get_bcrypt_cost_info,
            generate_ssh_keypair,
            generate_gpg_keypair,
            check_cli_availability,
            start_network_scan,
            cancel_network_scan,
            get_local_network_interfaces,
            discover_mdns_services,
            discover_hosts,
            get_discovery_methods,
            check_discovery_privilege,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            use std::io::Write;
            let _ = writeln!(
                std::io::stderr(),
                "Error while running tauri application: {e}"
            );
            std::process::exit(1);
        });
}
