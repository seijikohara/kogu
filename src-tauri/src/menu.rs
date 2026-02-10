//! Native macOS application menu
//!
//! Creates a standard macOS menu bar with an app menu containing "Reset All Settings..."
//! and standard Edit/View/Window submenus.
//!
//! On Windows and Linux, no native menu is created because the overlay titlebar
//! conflicts with the native menu bar. Reset is available via the settings page
//! and command palette on those platforms.

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Manager;

/// Custom menu item ID for the "Reset All Settings" action
pub const RESET_ALL_SETTINGS_ID: &str = "reset_all_settings";

/// Build the native macOS application menu
pub fn build(
    app: &tauri::App,
) -> Result<tauri::menu::Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    // Custom "Reset All Settings..." menu item
    let reset_item =
        MenuItemBuilder::with_id(RESET_ALL_SETTINGS_ID, "Reset All Settings...").build(app)?;

    // App menu (Kogu) — first submenu becomes the app menu on macOS
    let app_menu = SubmenuBuilder::new(app, "Kogu")
        .about(None)
        .separator()
        .item(&reset_item)
        .separator()
        .services()
        .separator()
        .hide()
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .quit()
        .build()?;

    // Edit menu
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // View menu
    let view_menu = SubmenuBuilder::new(app, "View").fullscreen().build()?;

    // Window menu
    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .close_window()
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()?;

    Ok(menu)
}

/// Set up menu event handler for custom menu items
pub fn setup_event_handler(app: &tauri::App) {
    app.on_menu_event(move |app_handle, event| {
        if event.id().0 == RESET_ALL_SETTINGS_ID {
            if let Some(window) = app_handle.get_webview_window("main") {
                use tauri::Emitter;
                let _ = window.emit("menu-reset-settings", ());
            }
        }
    });
}
