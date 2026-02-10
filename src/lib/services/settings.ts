/**
 * Application settings service
 *
 * Provides types, invoke wrappers, and CSS custom property application
 * for the TOML-based settings system.
 *
 * ## Adding a new settings category
 *
 * 1. Define a new sub-interface (e.g., `EditorSettings`)
 * 2. Add it to `AppSettings` with a default value in `DEFAULT_SETTINGS`
 * 3. If the category affects the UI, add an `applyXxxSettings()` function
 *    and call it from `applyAllSettings()`
 */

import { invoke } from '@tauri-apps/api/core';
import { isGoogleFont, loadGoogleFont, unloadAllGoogleFonts } from './google-fonts.js';

// =============================================================================
// Types (mirrors Rust settings.rs)
// =============================================================================

export interface FontSettings {
	/** UI font family (empty = system default) */
	readonly ui_family: string;
	/** Code/monospace font family (empty = system default) */
	readonly code_family: string;
	/** UI font size in pixels (10-24) */
	readonly ui_size: number;
	/** Code font size in pixels (10-24) */
	readonly code_size: number;
	/** Whether Google Fonts loading is enabled (privacy-sensitive) */
	readonly google_fonts_enabled: boolean;
}

export interface AppSettings {
	/** Font configuration */
	readonly font: FontSettings;
}

export const DEFAULT_FONT_SETTINGS: FontSettings = {
	ui_family: '',
	code_family: '',
	ui_size: 13,
	code_size: 13,
	google_fonts_enabled: false,
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
	font: DEFAULT_FONT_SETTINGS,
} as const;

// =============================================================================
// Tauri Invoke Wrappers
// =============================================================================

/** Get the current application settings from the backend */
export const getSettings = (): Promise<AppSettings> => invoke<AppSettings>('get_settings');

/** Update application settings (auto-saves to disk) */
export const updateSettings = (settings: AppSettings): Promise<void> =>
	invoke<void>('update_settings', { settings });

/** Reset all settings to defaults, delete settings file, and resize window */
export const resetSettings = (): Promise<AppSettings> => invoke<AppSettings>('reset_settings');

/** Get all available system font families (sorted, cached) */
export const getSystemFonts = (): Promise<string[]> => invoke<string[]>('get_system_fonts');

/** Get monospace system font families only (sorted, cached) */
export const getMonospaceSystemFonts = (): Promise<string[]> =>
	invoke<string[]>('get_monospace_system_fonts');

/** Get the settings file path (for display in settings page) */
export const getSettingsFilePath = (): Promise<string> => invoke<string>('get_settings_file_path');

// =============================================================================
// CSS Custom Property Application
// =============================================================================

const SYSTEM_UI_FALLBACK =
	"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
const MONOSPACE_FALLBACK =
	"ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

/** Apply font settings to the document via CSS custom properties */
export const applyFontSettings = (font: FontSettings): void => {
	const root = document.documentElement.style;

	// Google Fonts: load or unload
	if (font.google_fonts_enabled) {
		if (font.ui_family && isGoogleFont(font.ui_family)) loadGoogleFont(font.ui_family);
		if (font.code_family && isGoogleFont(font.code_family)) loadGoogleFont(font.code_family);
	} else {
		unloadAllGoogleFonts();
	}

	// UI font family
	if (font.ui_family) {
		root.setProperty('--font-ui', `"${font.ui_family}", ${SYSTEM_UI_FALLBACK}`);
	} else {
		root.removeProperty('--font-ui');
	}

	// Code font family
	if (font.code_family) {
		root.setProperty('--font-code', `"${font.code_family}", ${MONOSPACE_FALLBACK}`);
	} else {
		root.removeProperty('--font-code');
	}

	// Font sizes
	if (font.ui_size && font.ui_size !== DEFAULT_FONT_SETTINGS.ui_size) {
		root.setProperty('--font-size-ui', `${font.ui_size}px`);
	} else {
		root.removeProperty('--font-size-ui');
	}

	if (font.code_size && font.code_size !== DEFAULT_FONT_SETTINGS.code_size) {
		root.setProperty('--font-size-code', `${font.code_size}px`);
	} else {
		root.removeProperty('--font-size-code');
	}
};

/**
 * Apply all visual settings at once.
 *
 * Single entry point for applying settings at startup, after reset,
 * or when settings change. New visual categories should add their
 * `applyXxxSettings()` call here.
 */
export const applyAllSettings = (settings: AppSettings): void => {
	applyFontSettings(settings.font);
};
