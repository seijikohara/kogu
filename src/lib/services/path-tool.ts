/**
 * Pure helpers for the Path Tool route.
 *
 * Parses filesystem paths and converts between POSIX, Windows, and URL
 * representations. All functions are framework-agnostic so they can be
 * unit tested without DOM or Tauri dependencies.
 *
 * Style detection precedence:
 *   1. `file://` prefix              -> 'url'
 *   2. Backslash present              -> 'windows'
 *   3. Drive prefix (`C:`) present    -> 'windows'
 *   4. UNC prefix (`\\\\server`)      -> 'windows'
 *   5. Otherwise                      -> 'posix'
 */

export type PathStyle = 'posix' | 'windows' | 'url';

export interface ParsedPath {
	readonly root: string;
	readonly dir: string;
	readonly base: string;
	readonly name: string;
	readonly ext: string;
	readonly segments: readonly string[];
	readonly isAbsolute: boolean;
	readonly style: PathStyle;
}

const FILE_URL_PREFIX = 'file://';
const WINDOWS_DRIVE_RE = /^[A-Za-z]:/;
const WINDOWS_UNC_RE = /^\\\\[^\\]+/;

/**
 * Detect the style of the given path string by inspecting prefix and
 * separator hints. Falls back to POSIX for plain paths.
 */
export const detectStyle = (input: string): PathStyle => {
	if (input.startsWith(FILE_URL_PREFIX)) return 'url';
	if (WINDOWS_UNC_RE.test(input)) return 'windows';
	if (input.includes('\\')) return 'windows';
	if (WINDOWS_DRIVE_RE.test(input)) return 'windows';
	return 'posix';
};

/**
 * Return the POSIX representation of `input`. Converts backslashes to
 * forward slashes; for a `file://` URL, percent-decodes the path
 * portion. Drive letters (`C:`) are preserved as the leading segment.
 */
export const toPosix = (input: string): string => {
	if (input.startsWith(FILE_URL_PREFIX)) return fromFileUrl(input);
	return input.replaceAll('\\', '/');
};

/**
 * Return the Windows representation of `input`. Converts forward
 * slashes to backslashes; for a `file://` URL, percent-decodes first
 * and then converts.
 */
export const toWindows = (input: string): string => {
	const source = input.startsWith(FILE_URL_PREFIX) ? fromFileUrl(input) : input;
	return source.replaceAll('/', '\\');
};

/**
 * Build a `file://` URL from a path. Drive letters become the
 * authority-less form `file:///C:/...`. UNC paths become
 * `file://server/share/...`. Path segments are percent-encoded except
 * for forward slashes.
 */
export const toFileUrl = (input: string): string => {
	if (input.startsWith(FILE_URL_PREFIX)) return input;
	const posix = toPosix(input).trimEnd();
	if (WINDOWS_UNC_RE.test(input)) {
		// UNC `\\server\share\path` becomes `file://server/share/path`.
		const stripped = posix.replace(/^\/\//, '');
		return `file://${encodePathPreservingSlashes(stripped)}`;
	}
	if (WINDOWS_DRIVE_RE.test(posix)) {
		return `file:///${encodePathPreservingSlashes(posix)}`;
	}
	const withSlash = posix.startsWith('/') ? posix : `/${posix}`;
	return `file://${encodePathPreservingSlashes(withSlash)}`;
};

/**
 * Decode a `file://` URL back to a plain filesystem path. The result
 * uses forward slashes regardless of platform.
 */
export const fromFileUrl = (input: string): string => {
	if (!input.startsWith(FILE_URL_PREFIX)) return input;
	const rest = input.slice(FILE_URL_PREFIX.length);
	// `file:///C:/path` -> strip the leading slash so the drive prefix
	// becomes the head; `file://server/share` keeps `server/share`.
	if (rest.startsWith('/') && WINDOWS_DRIVE_RE.test(rest.slice(1))) {
		return safeDecode(rest.slice(1));
	}
	return safeDecode(rest);
};

/**
 * Percent-encode the path, preserving forward slashes so segment
 * boundaries remain visible.
 */
export const urlEncodePath = (input: string): string => {
	const posix = toPosix(input);
	return encodePathPreservingSlashes(posix);
};

/**
 * Quote `input` for use as a single argument in a POSIX shell (bash,
 * zsh). Uses single-quote wrapping; an embedded single quote becomes
 * the safe sequence `'\''`. Empty input becomes `''`.
 */
export const shellEscapeBash = (input: string): string => {
	if (input.length === 0) return "''";
	if (/^[A-Za-z0-9_./-]+$/.test(input)) return input;
	return `'${input.replaceAll("'", "'\\''")}'`;
};

/**
 * Quote `input` for use as a single argument in PowerShell. Wraps in
 * single quotes; embedded single quotes are doubled (PowerShell's
 * single-quoted strings do not interpret backslashes).
 */
export const shellEscapePowershell = (input: string): string => {
	if (input.length === 0) return "''";
	return `'${input.replaceAll("'", "''")}'`;
};

/**
 * Parse a path into its components. Detects the style automatically
 * unless an explicit one would be useful; that overload is omitted to
 * keep the public surface minimal.
 */
export const parsePath = (input: string): ParsedPath => {
	const style = detectStyle(input);
	const source = style === 'url' ? fromFileUrl(input) : input;
	const sep = style === 'windows' ? '\\' : '/';
	const normalized = style === 'windows' ? source.replaceAll('/', '\\') : source;

	const root = extractRoot(normalized, style);
	const withoutRoot = normalized.slice(root.length);
	const segments = withoutRoot.split(sep).filter((s) => s.length > 0);
	const base = segments.length > 0 ? (segments[segments.length - 1] ?? '') : '';
	const dirSegments = segments.slice(0, -1);
	const dir = root + dirSegments.join(sep);
	const dotIdx = base.lastIndexOf('.');
	// A leading dot (`.gitignore`) is treated as part of the name, not
	// an extension. Multiple dots use the last one as the extension
	// boundary, matching Node.js `path.parse` behaviour.
	const hasExt = dotIdx > 0 && dotIdx < base.length - 1;
	const name = hasExt ? base.slice(0, dotIdx) : base;
	const ext = hasExt ? base.slice(dotIdx) : '';
	const isAbsolute = root.length > 0;

	return {
		root,
		dir: dir || (isAbsolute ? root : ''),
		base,
		name,
		ext,
		segments,
		isAbsolute,
		style,
	};
};

/**
 * Reduce raw segments by collapsing `.` and resolving `..` against the
 * accumulated stack. `..` only pops a real segment; against an absolute
 * root it is discarded, otherwise it accumulates so relative paths can
 * walk above their starting point.
 */
const collapseSegments = (segments: readonly string[], hasRoot: boolean): readonly string[] =>
	segments.reduce<string[]>((stack, seg) => {
		if (seg === '.') return stack;
		if (seg !== '..') {
			stack.push(seg);
			return stack;
		}
		const top = stack[stack.length - 1];
		if (top !== undefined && top !== '..') {
			stack.pop();
			return stack;
		}
		if (hasRoot) return stack;
		stack.push('..');
		return stack;
	}, []);

/**
 * Collapse `.` and `..` segments, deduplicate separators, and return
 * the canonical form in the requested style.
 */
export const normalize = (input: string, style: PathStyle): string => {
	const source = style === 'url' ? fromFileUrl(input) : input;
	const sep = style === 'windows' ? '\\' : '/';
	const unified = style === 'windows' ? source.replaceAll('/', '\\') : source.replaceAll('\\', '/');
	const root = extractRoot(unified, style === 'url' ? 'posix' : style);
	const body = unified.slice(root.length);
	const rawSegments = body.split(sep).filter((s) => s.length > 0);
	const stack = collapseSegments(rawSegments, root.length > 0);
	const joined = stack.join(sep);
	const result = root + joined;
	if (style === 'url') return toFileUrl(result || '/');
	if (result.length === 0) return root.length > 0 ? root : '.';
	return result;
};

/**
 * Resolve `input` against `base`. If `input` is already absolute it is
 * returned (normalized) unchanged. Otherwise the two are joined and
 * normalized.
 */
export const absolutize = (input: string, base: string, style: PathStyle): string => {
	if (input.length === 0) return normalize(base, style);
	const sep = style === 'windows' ? '\\' : '/';
	const inputStyle = detectStyle(input);
	const isInputAbsolute = parsePath(input).isAbsolute;
	if (isInputAbsolute) {
		const converted =
			style === 'posix' && inputStyle === 'windows'
				? toPosix(input)
				: style === 'windows' && inputStyle === 'posix'
					? toWindows(input)
					: input;
		return normalize(converted, style);
	}
	const baseNorm = normalize(base, style);
	const joiner = baseNorm.endsWith(sep) ? '' : sep;
	const inputUnified =
		style === 'windows' ? input.replaceAll('/', '\\') : input.replaceAll('\\', '/');
	return normalize(`${baseNorm}${joiner}${inputUnified}`, style);
};

/**
 * Express `target` as a path relative to `base`. Both arguments are
 * absolutised first so callers can pass either form.
 *
 * The result uses the requested `style`. When the two paths share no
 * common root (different drive letters, UNC vs local), the absolute
 * `target` is returned unchanged.
 */
export const relativize = (target: string, base: string, style: PathStyle): string => {
	const sep = style === 'windows' ? '\\' : '/';
	const absTarget = absolutize(target, base, style);
	const absBase = absolutize(base, base, style);
	const targetParsed = parsePath(absTarget);
	const baseParsed = parsePath(absBase);
	if (targetParsed.root.toLowerCase() !== baseParsed.root.toLowerCase()) {
		return absTarget;
	}
	const targetSegs = targetParsed.segments;
	const baseSegs = baseParsed.segments;
	let common = 0;
	const maxCommon = Math.min(targetSegs.length, baseSegs.length);
	while (common < maxCommon && segmentEquals(targetSegs[common], baseSegs[common], style)) {
		common += 1;
	}
	const up = baseSegs.length - common;
	const down = targetSegs.slice(common);
	const parts = [...Array.from({ length: up }, () => '..'), ...down];
	if (parts.length === 0) return '.';
	return parts.join(sep);
};

// --- internal helpers ---------------------------------------------------

const safeDecode = (input: string): string => {
	try {
		return decodeURIComponent(input);
	} catch {
		return input;
	}
};

const encodePathPreservingSlashes = (input: string): string =>
	input
		.split('/')
		.map((seg) =>
			encodeURIComponent(seg)
				// Restore characters that are safe inside a path segment
				// but get over-encoded by `encodeURIComponent`.
				.replaceAll('%3A', ':')
				.replaceAll('%40', '@')
				.replaceAll('%2C', ',')
				.replaceAll('%3B', ';')
				.replaceAll('%26', '&')
				.replaceAll('%3D', '=')
				.replaceAll('%2B', '+')
				.replaceAll('%24', '$')
				.replaceAll("'", '%27')
		)
		.join('/');

const extractRoot = (input: string, style: PathStyle): string => {
	if (style === 'windows') {
		const uncMatch = input.match(/^\\\\[^\\]+\\[^\\]+\\?/);
		if (uncMatch) return uncMatch[0];
		const driveMatch = input.match(/^([A-Za-z]):[\\]?/);
		if (driveMatch) return driveMatch[0];
		if (input.startsWith('\\')) return '\\';
		return '';
	}
	if (style === 'url') {
		return input.startsWith('/') ? '/' : '';
	}
	return input.startsWith('/') ? '/' : '';
};

const segmentEquals = (a: string | undefined, b: string | undefined, style: PathStyle): boolean => {
	if (a === undefined || b === undefined) return false;
	// Windows file systems are case-insensitive in practice; relativize
	// against differing-case segments should still find the common
	// prefix.
	return style === 'windows' ? a.toLowerCase() === b.toLowerCase() : a === b;
};

/**
 * Sample paths for the rail's "load sample" buttons. Each entry covers
 * a distinct style so the user can quickly experiment with conversion.
 */
export const SAMPLE_PATHS: Readonly<Record<'windows' | 'unix' | 'url' | 'unc', string>> = {
	windows: 'C:\\Users\\Alice\\Documents\\report final.txt',
	unix: '/home/alice/Documents/report final.txt',
	url: 'file:///home/alice/Documents/report%20final.txt',
	unc: '\\\\server\\share\\folder\\file.txt',
};
