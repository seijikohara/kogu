use tauri::Manager;
use tauri_plugin_decorum::WebviewWindowExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_decorum::init())
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();

            // Create overlay titlebar (handles Windows snap layout)
            main_window.create_overlay_titlebar().unwrap();

            // macOS: position traffic lights with inset
            #[cfg(target_os = "macos")]
            main_window.set_traffic_lights_inset(16.0, 16.0).unwrap();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
