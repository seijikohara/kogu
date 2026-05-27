/**
 * Lightweight cross-platform path helpers.
 *
 * Tauri dialogs return native paths — backslash-separated on Windows,
 * forward-slash on macOS / Linux. UI code that wants just the file
 * name (`split('/').pop()`) breaks silently on Windows because the
 * separator never appears.
 *
 * For richer parsing / style conversion see
 * `@/lib/services/path-tool`; prefer the helpers here for the common
 * "show the filename" case so consumers don't drag in the heavier
 * `path-tool` module.
 */

const SEP_PATTERN = /[\\/]/;

/**
 * Returns the last non-empty segment of `path` after splitting on
 * either Unix (`/`) or Windows (`\`) separators. Falls back to the
 * original path when no segment exists (empty input or trailing
 * separator only).
 *
 * Examples:
 *   basename('C:\\Users\\Alice\\file.zip') -> 'file.zip'
 *   basename('/Users/alice/file.zip')      -> 'file.zip'
 *   basename('/Users/alice/')              -> 'alice'
 *   basename('')                           -> ''
 */
export const basename = (path: string): string => {
	if (!path) return path;
	const segments = path.split(SEP_PATTERN).filter((segment) => segment.length > 0);
	return segments[segments.length - 1] ?? path;
};
