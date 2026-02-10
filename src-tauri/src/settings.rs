//! Application settings persistence (TOML-based)
//!
//! Settings are stored as a TOML file in the platform-specific config directory:
//! - macOS: `~/Library/Application Support/io.github.seijikohara.kogu/settings.toml`
//! - Windows: `%APPDATA%/io.github.seijikohara.kogu/settings.toml`
//! - Linux: `~/.config/io.github.seijikohara.kogu/settings.toml`
//!
//! ## Adding a new settings category
//!
//! 1. Define a new sub-struct (e.g., `EditorSettings`) with `Default` impl
//! 2. Add a field to `AppSettings` with `#[serde(default)]`
//! 3. Existing TOML files will automatically use defaults for the new section

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

const SETTINGS_FILENAME: &str = "settings.toml";
const BACKUP_EXTENSION: &str = "bak";

// =============================================================================
// Settings Types (section-based, extensible)
// =============================================================================

/// Top-level application settings.
///
/// Each field corresponds to one TOML section. New categories are added
/// by defining a sub-struct and adding a `#[serde(default)]` field here.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    /// Font configuration
    #[serde(default)]
    pub font: FontSettings,
}

/// Font family and size preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontSettings {
    /// UI font family (empty string = system default)
    #[serde(default)]
    pub ui_family: String,
    /// Code/monospace font family (empty string = system default)
    #[serde(default)]
    pub code_family: String,
    /// UI font size in pixels (10-24)
    #[serde(default = "default_ui_size")]
    pub ui_size: u32,
    /// Code font size in pixels (10-24)
    #[serde(default = "default_code_size")]
    pub code_size: u32,
}

impl Default for FontSettings {
    fn default() -> Self {
        Self {
            ui_family: String::new(),
            code_family: String::new(),
            ui_size: default_ui_size(),
            code_size: default_code_size(),
        }
    }
}

const fn default_ui_size() -> u32 {
    13
}

const fn default_code_size() -> u32 {
    13
}

// =============================================================================
// Settings State (thread-safe, managed by Tauri)
// =============================================================================

/// Thread-safe settings state managed via Tauri's `.manage()`
pub struct SettingsState {
    settings: Mutex<AppSettings>,
    file_path: PathBuf,
}

impl SettingsState {
    /// Create a new `SettingsState` by loading from the config directory.
    ///
    /// If the file is missing, returns defaults.
    /// If the file is corrupt, backs it up as `.bak` and returns defaults.
    pub fn load(config_dir: &std::path::Path) -> Self {
        let file_path = config_dir.join(SETTINGS_FILENAME);
        let settings = load_from_file(&file_path);

        Self {
            settings: Mutex::new(settings),
            file_path,
        }
    }

    /// Get the current settings file path
    pub fn file_path(&self) -> &std::path::Path {
        &self.file_path
    }
}

/// Load settings from a TOML file, returning defaults on any error
fn load_from_file(path: &std::path::Path) -> AppSettings {
    let Ok(content) = std::fs::read_to_string(path) else {
        return AppSettings::default();
    };

    toml::from_str::<AppSettings>(&content).unwrap_or_else(|_| {
        // Back up the corrupt file
        let backup = path.with_extension(BACKUP_EXTENSION);
        let _ = std::fs::copy(path, backup);
        AppSettings::default()
    })
}

/// Save settings to a TOML file
fn save_to_file(path: &std::path::Path, settings: &AppSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }

    let content = toml::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;

    std::fs::write(path, content).map_err(|e| format!("Failed to write settings file: {e}"))
}

// =============================================================================
// Font Enumeration (cached)
// =============================================================================

/// Global cache for system font families (fonts don't change at runtime)
static SYSTEM_FONTS: OnceLock<Vec<String>> = OnceLock::new();

/// Enumerate all system font families, sorted alphabetically.
/// Results are cached after the first call.
fn enumerate_system_fonts() -> &'static [String] {
    SYSTEM_FONTS.get_or_init(|| {
        let source = font_kit::source::SystemSource::new();
        let mut families = source.all_families().unwrap_or_default();
        families.sort_unstable_by_key(|a| a.to_lowercase());
        families.dedup();
        families
    })
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Get the current application settings
#[tauri::command]
pub fn get_settings(state: tauri::State<'_, SettingsState>) -> Result<AppSettings, String> {
    let settings = state
        .settings
        .lock()
        .map_err(|e| format!("Settings lock poisoned: {e}"))?;
    Ok(settings.clone())
}

/// Update application settings (auto-saves to disk)
#[tauri::command]
pub fn update_settings(
    settings: AppSettings,
    state: tauri::State<'_, SettingsState>,
) -> Result<(), String> {
    save_to_file(&state.file_path, &settings)?;

    *state
        .settings
        .lock()
        .map_err(|e| format!("Settings lock poisoned: {e}"))? = settings;

    Ok(())
}

/// Reset all settings to defaults, delete the settings file, and resize window
#[tauri::command]
pub fn reset_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, SettingsState>,
) -> Result<AppSettings, String> {
    use tauri::Manager;

    // Delete the settings file
    if state.file_path.exists() {
        let _ = std::fs::remove_file(&state.file_path);
    }

    // Reset in-memory settings
    let defaults = AppSettings::default();
    {
        let mut current = state
            .settings
            .lock()
            .map_err(|e| format!("Settings lock poisoned: {e}"))?;
        *current = defaults.clone();
    }

    // Reset window to default size and center
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_size(tauri::LogicalSize::new(1200.0, 800.0));
        let _ = window.center();
    }

    Ok(defaults)
}

/// Get all available system font families (sorted, cached)
#[tauri::command]
pub fn get_system_fonts() -> Vec<String> {
    enumerate_system_fonts().to_vec()
}

/// Get the settings file path (for display in the settings page)
#[tauri::command]
pub fn get_settings_file_path(state: tauri::State<'_, SettingsState>) -> String {
    state.file_path().display().to_string()
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_default_settings() {
        let settings = AppSettings::default();
        assert!(settings.font.ui_family.is_empty());
        assert!(settings.font.code_family.is_empty());
        assert_eq!(settings.font.ui_size, 13);
        assert_eq!(settings.font.code_size, 13);
    }

    #[test]
    fn test_serialize_deserialize_roundtrip() {
        let settings = AppSettings {
            font: FontSettings {
                ui_family: "Inter".to_string(),
                code_family: "JetBrains Mono".to_string(),
                ui_size: 14,
                code_size: 12,
            },
        };

        let toml_str = toml::to_string_pretty(&settings).unwrap();
        let deserialized: AppSettings = toml::from_str(&toml_str).unwrap();

        assert_eq!(deserialized.font.ui_family, "Inter");
        assert_eq!(deserialized.font.code_family, "JetBrains Mono");
        assert_eq!(deserialized.font.ui_size, 14);
        assert_eq!(deserialized.font.code_size, 12);
    }

    #[test]
    fn test_deserialize_empty_toml() {
        let settings: AppSettings = toml::from_str("").unwrap();
        assert!(settings.font.ui_family.is_empty());
        assert_eq!(settings.font.ui_size, 13);
    }

    #[test]
    fn test_deserialize_partial_toml() {
        let toml_str = r#"
[font]
ui_family = "Helvetica"
"#;
        let settings: AppSettings = toml::from_str(toml_str).unwrap();
        assert_eq!(settings.font.ui_family, "Helvetica");
        assert!(settings.font.code_family.is_empty());
        assert_eq!(settings.font.ui_size, 13);
    }

    #[test]
    fn test_deserialize_unknown_section() {
        // Future sections in TOML should not break deserialization
        let toml_str = r#"
[font]
ui_family = "Inter"

[unknown_section]
key = "value"
"#;
        let settings: AppSettings = toml::from_str(toml_str).unwrap();
        assert_eq!(settings.font.ui_family, "Inter");
    }

    #[test]
    fn test_load_missing_file() {
        let settings = load_from_file(Path::new("/nonexistent/path/settings.toml"));
        assert!(settings.font.ui_family.is_empty());
        assert_eq!(settings.font.ui_size, 13);
    }

    #[test]
    fn test_save_and_load() {
        let dir = std::env::temp_dir().join("kogu-test-settings");
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("test-settings.toml");

        let settings = AppSettings {
            font: FontSettings {
                ui_family: "Arial".to_string(),
                code_family: "Consolas".to_string(),
                ui_size: 15,
                code_size: 11,
            },
        };

        save_to_file(&path, &settings).unwrap();
        let loaded = load_from_file(&path);

        assert_eq!(loaded.font.ui_family, "Arial");
        assert_eq!(loaded.font.code_family, "Consolas");
        assert_eq!(loaded.font.ui_size, 15);
        assert_eq!(loaded.font.code_size, 11);

        // Cleanup
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir(&dir);
    }

    #[test]
    fn test_corrupt_file_creates_backup() {
        let dir = std::env::temp_dir().join("kogu-test-corrupt");
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("corrupt.toml");
        let backup = dir.join("corrupt.bak");

        std::fs::write(&path, "this is not valid toml [[[").unwrap();

        let settings = load_from_file(&path);
        assert!(settings.font.ui_family.is_empty()); // defaults
        assert!(backup.exists()); // backup created

        // Cleanup
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(&backup);
        let _ = std::fs::remove_dir(&dir);
    }

    #[test]
    fn test_system_fonts_enumeration() {
        let fonts = enumerate_system_fonts();
        // System should have at least some fonts
        assert!(!fonts.is_empty());
        // Should be sorted (case-insensitive)
        for window in fonts.windows(2) {
            assert!(
                window[0].to_lowercase() <= window[1].to_lowercase(),
                "Fonts not sorted: {} > {}",
                window[0],
                window[1]
            );
        }
    }
}
