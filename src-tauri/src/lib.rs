// =============================================================================
// Rust Lint Configuration - Strict Mode
// =============================================================================

// Clippy lint groups
#![warn(clippy::all)]
#![warn(clippy::pedantic)]
#![warn(clippy::nursery)]
// Safety lints - deny unsafe code (allow override in FFI modules)
#![deny(unsafe_code)]
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
/// Network scanning module (pub for sidecar binary access)
pub mod network;

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
    DiscoveryMethod, DiscoveryOptions, MdnsDiscoveryRequest, NetworkScannerState, ScanRequest,
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
// Network Scanner Commands (delegated to net-scanner sidecar)
// =============================================================================

/// Start a network scan via sidecar with streaming progress events
#[tauri::command]
async fn start_network_scan(
    request: ScanRequest,
    scan_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, NetworkScannerState>,
) -> Result<serde_json::Value, String> {
    use tauri::Emitter;
    use tauri_plugin_shell::process::CommandEvent;

    let sidecar_request = network::sidecar::Request::Scan { request };
    let (mut rx, child) = network::sidecar::spawn_with_request(&app, &sidecar_request)?;
    state.register(scan_id.clone(), child);

    let mut final_results: Option<serde_json::Value> = None;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                match serde_json::from_str::<network::sidecar::ResponseEnvelope>(trimmed) {
                    Ok(network::sidecar::ResponseEnvelope::ScanProgress { progress }) => {
                        let _ = app.emit("network-scan-progress", progress);
                    }
                    Ok(network::sidecar::ResponseEnvelope::ScanComplete { results }) => {
                        final_results = Some(results);
                    }
                    Ok(network::sidecar::ResponseEnvelope::Error { message }) => {
                        state.remove(&scan_id);
                        return Err(message);
                    }
                    _ => {}
                }
            }
            CommandEvent::Error(e) => {
                state.remove(&scan_id);
                return Err(format!("Net-scanner process error: {e}"));
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    state.remove(&scan_id);
    final_results.ok_or_else(|| "No results from net-scanner".to_string())
}

/// Cancel a running network scan by killing the sidecar process
#[tauri::command]
fn cancel_network_scan(scan_id: String, state: tauri::State<'_, NetworkScannerState>) -> bool {
    state.cancel(&scan_id)
}

/// Get comprehensive network interface information (direct, no sidecar needed)
#[tauri::command]
fn get_detailed_network_interfaces() -> Vec<serde_json::Value> {
    network::interfaces::get_detailed_interfaces()
        .into_iter()
        .filter_map(|iface| serde_json::to_value(iface).ok())
        .collect()
}

/// Get local network interfaces via sidecar
#[tauri::command]
async fn get_local_network_interfaces(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let request = network::sidecar::Request::GetLocalInterfaces;
    match network::sidecar::execute_oneshot(&app, &request).await? {
        network::sidecar::ResponseEnvelope::LocalInterfaces { info } => Ok(info),
        network::sidecar::ResponseEnvelope::Error { message } => Err(message),
        _ => Err("Unexpected response from net-scanner".to_string()),
    }
}

/// Discover mDNS/Bonjour services on the local network via sidecar
#[tauri::command]
async fn discover_mdns_services(
    request: MdnsDiscoveryRequest,
    app: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    let sidecar_request = network::sidecar::Request::DiscoverMdns {
        service_types: request.service_types,
        duration_ms: request.duration_ms,
    };
    match network::sidecar::execute_oneshot(&app, &sidecar_request).await? {
        network::sidecar::ResponseEnvelope::MdnsResults { results } => Ok(results),
        network::sidecar::ResponseEnvelope::Error { message } => Err(message),
        _ => Err("Unexpected response from net-scanner".to_string()),
    }
}

/// Discover hosts via sidecar with streaming results via Channel API
///
/// Each method's result is streamed to the frontend as it completes.
/// Cancellation kills the sidecar process.
#[tauri::command]
async fn discover_hosts(
    targets: Vec<String>,
    options: DiscoveryOptions,
    on_event: tauri::ipc::Channel<serde_json::Value>,
    discovery_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, NetworkScannerState>,
) -> Result<serde_json::Value, String> {
    use tauri_plugin_shell::process::CommandEvent;

    let sidecar_request = network::sidecar::Request::Discover { targets, options };
    let (mut rx, child) = network::sidecar::spawn_with_request(&app, &sidecar_request)?;
    state.register(discovery_id.clone(), child);

    let mut final_results: Option<serde_json::Value> = None;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                match serde_json::from_str::<network::sidecar::ResponseEnvelope>(trimmed) {
                    Ok(network::sidecar::ResponseEnvelope::DiscoveryEvent { event }) => {
                        let _ = on_event.send(event);
                    }
                    Ok(network::sidecar::ResponseEnvelope::DiscoveryComplete { results }) => {
                        final_results = Some(results);
                    }
                    Ok(network::sidecar::ResponseEnvelope::Error { message }) => {
                        state.remove(&discovery_id);
                        return Err(message);
                    }
                    _ => {}
                }
            }
            CommandEvent::Error(e) => {
                state.remove(&discovery_id);
                return Err(format!("Net-scanner process error: {e}"));
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    state.remove(&discovery_id);
    final_results.ok_or_else(|| "No results from net-scanner".to_string())
}

/// Cancel a running host discovery by killing the sidecar process
#[tauri::command]
fn cancel_discovery(discovery_id: String, state: tauri::State<'_, NetworkScannerState>) -> bool {
    state.cancel(&discovery_id)
}

/// Get available discovery methods and their privilege status via sidecar
///
/// Converts from sidecar format `[{method, available}]` to frontend
/// tuple format `[[name, available]]`.
#[tauri::command]
async fn get_discovery_methods(app: tauri::AppHandle) -> Result<Vec<(String, bool)>, String> {
    let request = network::sidecar::Request::GetDiscoveryMethods;
    match network::sidecar::execute_oneshot(&app, &request).await? {
        network::sidecar::ResponseEnvelope::DiscoveryMethods { methods } => {
            let arr = methods
                .as_array()
                .ok_or("Invalid methods response from net-scanner")?;
            Ok(arr
                .iter()
                .filter_map(|v| {
                    let method = v.get("method")?.as_str()?;
                    let available = v.get("available")?.as_bool()?;
                    Some((method.to_string(), available))
                })
                .collect())
        }
        network::sidecar::ResponseEnvelope::Error { message } => Err(message),
        _ => Err("Unexpected response from net-scanner".to_string()),
    }
}

/// Check if a specific discovery method has required privileges via sidecar
#[tauri::command]
async fn check_discovery_privilege(
    method: DiscoveryMethod,
    app: tauri::AppHandle,
) -> Result<bool, String> {
    let request = network::sidecar::Request::CheckDiscoveryPrivilege { method };
    match network::sidecar::execute_oneshot(&app, &request).await? {
        network::sidecar::ResponseEnvelope::DiscoveryPrivilege { available } => Ok(available),
        network::sidecar::ResponseEnvelope::Error { message } => Err(message),
        _ => Err("Unexpected response from net-scanner".to_string()),
    }
}

/// Check privilege status of the net-scanner sidecar
#[tauri::command]
async fn check_net_scanner_privileges(
    app: tauri::AppHandle,
) -> network::privileges::PrivilegeStatus {
    network::privileges::check_status(&app).await
}

/// Set up persistent privileges for the net-scanner sidecar
#[tauri::command]
async fn setup_net_scanner_privileges(
    app: tauri::AppHandle,
) -> Result<network::privileges::PrivilegeStatus, String> {
    network::privileges::setup(&app).await
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
            get_detailed_network_interfaces,
            get_local_network_interfaces,
            discover_mdns_services,
            discover_hosts,
            cancel_discovery,
            get_discovery_methods,
            check_discovery_privilege,
            check_net_scanner_privileges,
            setup_net_scanner_privileges,
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
