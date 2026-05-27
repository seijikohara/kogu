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

mod archive_inspect;
mod ast;
mod dns_lookup;
mod drive_info;
mod duplicate_finder;
mod file_inspect;
mod file_watch;
mod folder_tree;
mod generators;
mod hash_batch;
mod hex_editor;
#[cfg(target_os = "macos")]
mod menu;
mod network;
mod rest_client;
mod settings;
mod tls_inspect;
mod webhook;
mod websocket;

use tauri::Manager;
#[cfg(any(target_os = "macos", target_os = "windows"))]
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
    DiscoveryEvent, DiscoveryEventSink, DiscoveryMethod, DiscoveryOptions, MdnsDiscoveryRequest,
    NetworkScannerState, ScanRequest,
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
// Network Scanner Commands (in-process, userspace only)
// =============================================================================

use std::net::IpAddr;
use std::sync::Arc;

use tauri::Emitter;
use tokio_util::sync::CancellationToken;

use network::scanner::ScanState;
use network::types::{ScanProgress, ScanProgressSink};

/// Bridge a [`CancellationToken`] to a [`ScanState`] so cancelling the token
/// flips the cooperative cancellation flag observed by scanner / discovery loops.
fn link_cancellation(token: Arc<CancellationToken>, scan_state: Arc<ScanState>) {
    tokio::spawn(async move {
        token.cancelled().await;
        scan_state.cancel();
    });
}

/// Progress sink that forwards [`ScanProgress`] events to the frontend via
/// the `network-scan-progress` Tauri event channel.
struct EmitterProgressSink {
    app: tauri::AppHandle,
}

impl ScanProgressSink for EmitterProgressSink {
    fn emit(&self, progress: ScanProgress) -> Result<(), String> {
        self.app
            .emit("network-scan-progress", progress)
            .map_err(|e| format!("Failed to emit scan progress: {e}"))
    }
}

/// Discovery event sink that forwards [`DiscoveryEvent`]s to the frontend via
/// a per-invocation Tauri IPC channel.
struct ChannelDiscoveryEventSink {
    channel: tauri::ipc::Channel<DiscoveryEvent>,
}

impl DiscoveryEventSink for ChannelDiscoveryEventSink {
    fn send(&self, event: DiscoveryEvent) -> Result<(), String> {
        self.channel
            .send(event)
            .map_err(|e| format!("Failed to send discovery event: {e}"))
    }
}

/// Parse user-supplied target strings into a list of IP addresses, expanding
/// any CIDR ranges (network and broadcast addresses are excluded for
/// IPv4 prefixes shorter than `/31`).
fn parse_targets_for_discovery(targets: &[String]) -> Vec<IpAddr> {
    targets
        .iter()
        .flat_map(|target| {
            if let Ok(ip) = target.parse::<IpAddr>() {
                return vec![ip];
            }
            target
                .parse::<ipnetwork::IpNetwork>()
                .map(|network| match network {
                    ipnetwork::IpNetwork::V4(v4net) if v4net.prefix() < 31 => {
                        let net_addr = IpAddr::V4(v4net.network());
                        let bcast_addr = IpAddr::V4(v4net.broadcast());
                        network
                            .iter()
                            .filter(|ip| *ip != net_addr && *ip != bcast_addr)
                            .collect()
                    }
                    _ => network.iter().collect(),
                })
                .unwrap_or_default()
        })
        .collect()
}

/// Start a network port scan in-process with streaming progress events.
#[tauri::command]
async fn start_network_scan(
    request: ScanRequest,
    scan_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, NetworkScannerState>,
) -> Result<network::types::ScanResults, String> {
    let (scan_state_raw, _cancel_rx) = ScanState::new();
    let scan_state = Arc::new(scan_state_raw);
    let token = Arc::new(CancellationToken::new());
    state.register(scan_id.clone(), Arc::clone(&token));
    link_cancellation(Arc::clone(&token), Arc::clone(&scan_state));

    let sink = EmitterProgressSink { app: app.clone() };
    let result = network::scanner::run_scan(request, &sink, Arc::clone(&scan_state)).await;

    state.remove(&scan_id);
    result
}

/// Cancel a running network scan by signalling its cancellation token.
#[tauri::command]
fn cancel_network_scan(scan_id: String, state: tauri::State<'_, NetworkScannerState>) -> bool {
    state.cancel(&scan_id)
}

/// Get comprehensive network interface information.
#[tauri::command]
fn get_detailed_network_interfaces() -> Vec<serde_json::Value> {
    network::interfaces::get_detailed_interfaces()
        .into_iter()
        .filter_map(|iface| serde_json::to_value(iface).ok())
        .collect()
}

/// Get local network interfaces (basic enumeration via `if-addrs`).
#[tauri::command]
fn get_local_network_interfaces() -> network::types::LocalNetworkInfo {
    network::interfaces::get_local_interfaces()
}

/// Discover mDNS/Bonjour services on the local network.
#[tauri::command]
async fn discover_mdns_services(
    request: MdnsDiscoveryRequest,
) -> Result<network::types::MdnsDiscoveryResults, String> {
    network::interfaces::discover_mdns_services(request.service_types, request.duration_ms).await
}

/// Discover hosts in-process with streaming results via the Tauri Channel API.
///
/// Each method's result is streamed to the frontend as it completes.
/// Cancellation signals the per-discovery token, which the discovery loop
/// observes between method completions.
#[tauri::command]
async fn discover_hosts(
    targets: Vec<String>,
    options: DiscoveryOptions,
    on_event: tauri::ipc::Channel<DiscoveryEvent>,
    discovery_id: String,
    state: tauri::State<'_, NetworkScannerState>,
) -> Result<Vec<network::discovery::DiscoveryResult>, String> {
    let ip_targets = parse_targets_for_discovery(&targets);
    if ip_targets.is_empty() {
        return Err("No valid IP addresses provided".to_string());
    }

    let (scan_state_raw, _cancel_rx) = ScanState::new();
    let scan_state = Arc::new(scan_state_raw);
    let token = Arc::new(CancellationToken::new());
    state.register(discovery_id.clone(), Arc::clone(&token));
    link_cancellation(Arc::clone(&token), Arc::clone(&scan_state));

    let sink = ChannelDiscoveryEventSink { channel: on_event };
    let results = network::discover_hosts(&ip_targets, &options, &sink, &scan_state).await;

    state.remove(&discovery_id);
    Ok(results)
}

/// Cancel a running host discovery by signalling its cancellation token.
#[tauri::command]
fn cancel_discovery(discovery_id: String, state: tauri::State<'_, NetworkScannerState>) -> bool {
    state.cancel(&discovery_id)
}

/// Get available discovery methods. All remaining methods are userspace and
/// therefore unconditionally available.
#[tauri::command]
fn get_discovery_methods() -> Vec<(String, bool)> {
    network::discovery::get_available_methods()
        .into_iter()
        .map(|(method, available)| (method.to_string(), available))
        .collect()
}

/// Check whether a specific discovery method is available on the current host.
#[tauri::command]
fn check_discovery_privilege(method: DiscoveryMethod) -> bool {
    network::discovery::check_privileges(method)
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

/// Bootstrap routine executed inside the Tauri builder's `setup`
/// callback. Extracted from [`run`] so the entry function stays under
/// the clippy line-count threshold.
fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Windows: enable Snap Layout support via the decorum overlay titlebar.
    // The same call on macOS injects transparent <div data-tauri-drag-region>
    // overlays at the top of the document body, which sit above any in-flow
    // titlebar UI (e.g. the Command search input) and intercept clicks for
    // window drag, leaving controls unfocusable. macOS gets a fully native
    // overlay titlebar via tauri.conf.json's `titleBarStyle: "Overlay"`, so
    // the decorum overlay is unnecessary and actively harmful there. Linux
    // needs neither call, so the `main_window` handle is only bound on
    // platforms that consume it.
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        let main_window = app
            .get_webview_window("main")
            .ok_or("Failed to get main window")?;
        #[cfg(target_os = "windows")]
        main_window.create_overlay_titlebar()?;
        // macOS: position traffic lights centered in 32px (h-8) title bar.
        #[cfg(target_os = "macos")]
        main_window.set_traffic_lights_inset(12.0, 10.0)?;
    }

    // Initialize settings from config directory.
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config directory: {e}"))?;
    app.manage(settings::SettingsState::load(&config_dir));

    // Warm the system font caches from a background task so the
    // first Settings open returns instantly. font-kit's `all_families`
    // + per-family `is_monospace` walk would otherwise block the UI
    // thread for several seconds on macOS at the cold path.
    settings::prewarm_font_cache();

    // macOS: set up native app menu with "Reset All Settings..."
    #[cfg(target_os = "macos")]
    {
        let native_menu = menu::build(app)?;
        app.set_menu(native_menu)?;
        menu::setup_event_handler(app);
    }

    Ok(())
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
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_window_state::Builder::default().build());

        // MCP bridge plugin for AI-assisted debugging (development only)
        #[cfg(debug_assertions)]
        let base = base.plugin(tauri_plugin_mcp_bridge::init());

        base
    };

    builder
        .manage(WorkerProcessState::new())
        .manage(NetworkScannerState::new())
        .manage(websocket::WebSocketState::new())
        .manage(webhook::WebhookState::new())
        .manage(file_watch::FileWatchState::new())
        .setup(setup_app)
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
            network::oui::lookup_oui_vendor,
            network::oui::get_oui_database_info,
            rest_client::rest_client_send,
            websocket::ws_connect,
            websocket::ws_send,
            websocket::ws_close,
            dns_lookup::dns_lookup,
            duplicate_finder::duplicate_scan,
            duplicate_finder::duplicate_delete,
            duplicate_finder::duplicate_replace_with_symlink,
            drive_info::drives_list,
            drive_info::folder_size_scan,
            file_inspect::file_inspect,
            hash_batch::hash_file_batch,
            file_watch::file_watch_start,
            file_watch::file_watch_stop,
            folder_tree::folder_walk,
            folder_tree::folder_largest_files,
            hex_editor::hex_open,
            hex_editor::hex_read,
            hex_editor::hex_save,
            archive_inspect::archive_open,
            archive_inspect::archive_read_entry,
            archive_inspect::archive_extract,
            archive_inspect::archive_extract_entry,
            tls_inspect::tls_inspect,
            webhook::webhook_start,
            webhook::webhook_stop,
            webhook::webhook_status,
            settings::get_settings,
            settings::update_settings,
            settings::reset_settings,
            settings::get_system_fonts,
            settings::get_monospace_system_fonts,
            settings::get_settings_file_path,
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
