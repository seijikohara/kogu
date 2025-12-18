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
#![allow(clippy::missing_errors_doc)] // Re-allow for now as many functions need updates

//! Kogu - A collection of useful developer tools
//!
//! This library provides the Rust backend for the Kogu desktop application,
//! including AST parsing functionality for JSON, YAML, XML, and SQL.

mod ast;
mod generators;

use tauri::Manager;
use tauri_plugin_decorum::WebviewWindowExt;

use ast::{AstLanguage, AstParseResult};
use generators::{
    bcrypt::{BcryptCostInfo, BcryptHashResult, BcryptVerifyResult},
    cli::CliAvailability,
    gpg::{GpgKeyOptions, GpgKeyResult},
    ssh::{SshKeyOptions, SshKeyResult},
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

// =============================================================================
// BCrypt Commands
// =============================================================================

/// Generate a `BCrypt` hash from a password
#[tauri::command]
fn generate_bcrypt_hash(password: &str, cost: u32) -> Result<BcryptHashResult, String> {
    generators::bcrypt::generate_hash(password, cost).map_err(|e| e.to_string())
}

/// Verify a password against a `BCrypt` hash
#[tauri::command]
fn verify_bcrypt_hash(password: &str, hash: &str) -> Result<BcryptVerifyResult, String> {
    generators::bcrypt::verify_hash(password, hash).map_err(|e| e.to_string())
}

/// Get information about a `BCrypt` cost factor
#[tauri::command]
fn get_bcrypt_cost_info(cost: u32) -> BcryptCostInfo {
    generators::bcrypt::get_cost_info(cost)
}

// =============================================================================
// SSH Key Commands
// =============================================================================

/// Generate an SSH key pair
#[tauri::command]
fn generate_ssh_keypair(options: SshKeyOptions) -> Result<SshKeyResult, String> {
    generators::ssh::generate_key(options).map_err(|e| e.to_string())
}

// =============================================================================
// GPG Key Commands
// =============================================================================

/// Generate a GPG key pair
#[tauri::command]
fn generate_gpg_keypair(options: GpgKeyOptions) -> Result<GpgKeyResult, String> {
    generators::gpg::generate_key(options).map_err(|e| e.to_string())
}

// =============================================================================
// CLI Availability Commands
// =============================================================================

/// Check CLI tool availability
#[tauri::command]
fn check_cli_availability() -> CliAvailability {
    generators::cli::check_cli_availability()
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
            .plugin(tauri_plugin_decorum::init());

        // MCP bridge plugin for AI-assisted debugging (development only)
        #[cfg(debug_assertions)]
        let base = base.plugin(tauri_plugin_mcp_bridge::init());

        base
    };

    builder
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
            generate_bcrypt_hash,
            verify_bcrypt_hash,
            get_bcrypt_cost_info,
            generate_ssh_keypair,
            generate_gpg_keypair,
            check_cli_availability,
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
