/**
 * Platform-aware keyboard shortcut utilities.
 */

/** Whether the current platform is macOS (synchronous detection for event handlers). */
export const isMac: boolean =
	typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

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

/** Format a shortcut for display (e.g., "⌘K" on macOS, "Ctrl+K" on others). */
export const formatShortcut = (key: string, mod = false): string => {
	if (!mod) return key;
	return isMac ? `⌘${key}` : `Ctrl+${key}`;
};

/** Platform-specific modifier label for display. */
export const modLabel: string = isMac ? '⌘' : 'Ctrl';
