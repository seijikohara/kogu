/**
 * Platform-aware keyboard shortcut utilities.
 *
 * Detection is synchronous so it can be used inside reactive expressions and
 * event handlers without awaiting `@tauri-apps/plugin-os`. The Tauri webview
 * exposes `navigator.platform` / `navigator.userAgent`, both of which reveal
 * the host OS reliably enough for picking modifier glyphs vs. words.
 */

const detectMac = (): boolean => {
	if (typeof navigator === 'undefined') return false;
	// `navigator.platform` is the most stable signal in webviews; fall back to
	// `userAgent` (which still contains "Mac" / "iPhone" / "iPad" on Apple
	// platforms) when `platform` is empty or unrecognised.
	const platform = navigator.platform || '';
	const ua = navigator.userAgent || '';
	return /Mac|iPod|iPhone|iPad/i.test(platform) || /Mac|iPhone|iPad/i.test(ua);
};

/** Whether the current platform is macOS (synchronous detection for event handlers). */
export const isMac: boolean = detectMac();

/** Check if the platform modifier key is pressed (Cmd on macOS, Ctrl on others). */
export const isModKey = (e: KeyboardEvent): boolean => (isMac ? e.metaKey : e.ctrlKey);

/** Check if the event target is an editable element (input, textarea, contenteditable, CodeMirror). */
export const isEditableTarget = (e: KeyboardEvent): boolean => {
	const el = e.target as HTMLElement;
	if (!el) return false;
	const tag = el.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
	if (el.isContentEditable) return true;
	if (el.closest('.cm-editor')) return true;
	return false;
};

/** Platform-specific modifier label for display (⌘ on macOS, Ctrl on others). */
export const modLabel: string = isMac ? '⌘' : 'Ctrl';

/** Platform-specific shift label for display (⇧ on macOS, Shift on others). */
export const shiftLabel: string = isMac ? '⇧' : 'Shift';

/** Platform-specific alt/option label for display (⌥ on macOS, Alt on others). */
export const altLabel: string = isMac ? '⌥' : 'Alt';

/** Platform-specific control label for display (⌃ on macOS, Ctrl on others). */
export const ctrlLabel: string = isMac ? '⌃' : 'Ctrl';

/**
 * Format a shortcut for display.
 *
 * On macOS the modifier glyph is concatenated directly to the key (`⌘K`),
 * matching the convention seen in native macOS menus. On other platforms the
 * modifier word is joined with `+` (`Ctrl+K`).
 */
export const formatShortcut = (key: string, mod = false): string => {
	if (!mod) return key;
	return isMac ? `${modLabel}${key}` : `${modLabel}+${key}`;
};
