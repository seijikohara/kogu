mod ast;

use tauri::Manager;
use tauri_plugin_decorum::WebviewWindowExt;

use ast::{AstLanguage, AstParseResult};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Parse text to AST based on language
///
/// # Arguments
/// * `text` - The source text to parse
/// * `language` - The language identifier ("json", "yaml", "xml", "sql")
///
/// # Returns
/// AstParseResult containing the AST and any errors
#[tauri::command]
fn parse_to_ast(text: &str, language: &str) -> Result<AstParseResult, String> {
    let lang: AstLanguage = language
        .parse()
        .map_err(|e: ast::AstError| e.to_string())?;

    Ok(ast::parse_to_ast(text, lang))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_decorum::init());

    // MCP bridge plugin for AI-assisted debugging (development only)
    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();

            // Create overlay titlebar (handles Windows snap layout)
            main_window.create_overlay_titlebar().unwrap();

            // macOS: position traffic lights centered in 32px (h-8) title bar
            #[cfg(target_os = "macos")]
            main_window.set_traffic_lights_inset(12.0, 10.0).unwrap();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, parse_to_ast])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
