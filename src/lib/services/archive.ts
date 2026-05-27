/**
 * Archive Inspector / Extractor service.
 *
 * Wraps the `archive_open` / `archive_read_entry` / `archive_extract` /
 * `archive_extract_entry` Tauri commands and exposes pure helpers the
 * archive viewer renders against (glob matching, ratio formatting, tree
 * grouping).
 *
 * All helpers are pure functions so the frontend can call them inside
 * `useMemo` without owning any extra state.
 */
import { invoke } from '@tauri-apps/api/core';

export type ArchiveFormat = 'zip' | 'tar' | 'tar.gz' | 'tar.bz2' | 'tar.xz' | '7z';

export interface ArchiveEntry {
	readonly path: string;
	readonly isDir: boolean;
	readonly sizeBytes: number;
	readonly compressedSize: number;
	readonly modifiedMs: number | null;
	readonly crc32: number | null;
}

export interface ArchiveInfo {
	readonly path: string;
	readonly format: ArchiveFormat | string;
	readonly entries: readonly ArchiveEntry[];
	readonly totalEntries: number;
	readonly totalUncompressed: number;
	readonly totalCompressed: number;
}

export type ConflictPolicy = 'skip' | 'overwrite' | 'rename';

export interface ExtractParams {
	readonly archivePath: string;
	readonly entries: readonly string[];
	readonly destinationDir: string;
	readonly conflict: ConflictPolicy;
}

export const archiveOpen = (path: string): Promise<ArchiveInfo> => invoke('archive_open', { path });

export const archiveReadEntry = (
	archivePath: string,
	entryPath: string,
	maxBytes: number
): Promise<Uint8Array> =>
	invoke<number[]>('archive_read_entry', { archivePath, entryPath, maxBytes }).then(
		(arr) => new Uint8Array(arr)
	);

export const archiveExtract = (params: ExtractParams): Promise<number> =>
	invoke('archive_extract', { req: params });

export const archiveExtractEntry = (
	archivePath: string,
	entryPath: string,
	destinationPath: string
): Promise<number> => invoke('archive_extract_entry', { archivePath, entryPath, destinationPath });

/**
 * Human-readable size, matches the formatter used in the file inspector
 * and hex editor so the three tools render byte counts consistently.
 */
export const humanSize = (bytes: number): string => {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const exponent = Math.min(units.length - 1, Math.floor(Math.log10(Math.abs(bytes)) / 3));
	const value = bytes / 10 ** (exponent * 3);
	return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
};

/**
 * Compression ratio rendered as "NN%" savings vs original size, or `—`
 * when the original size is zero. Negative ratios (when compressed
 * actually grew) are shown as `0%` to keep the table tidy.
 */
export const formatRatio = (uncompressed: number, compressed: number): string => {
	if (uncompressed === 0) return '—';
	const saved = 1 - compressed / uncompressed;
	if (saved <= 0) return '0%';
	return `${Math.round(saved * 100)}%`;
};

/**
 * Compile a simple glob pattern to a regular expression. Supports:
 *
 * - `*`  - zero or more characters except `/`
 * - `**` - zero or more characters including `/`
 * - `?`  - exactly one character
 * - `[abc]` / `[a-z]` - character classes
 *
 * Anything else is escaped and matched literally so paths with `.` /
 * parens / `+` do not produce surprising matches.
 */
interface GlobToken {
	readonly regex: string;
	readonly consumed: number;
}

const REGEX_META = /[.+^${}()|\\]/;

const tokenizeStar = (pattern: string, i: number): GlobToken => {
	if (pattern[i + 1] === '*') {
		// `**` matches across slashes; absorb the following `/` if present.
		const next = pattern[i + 2] === '/' ? 3 : 2;
		return { regex: '.*', consumed: next };
	}
	return { regex: '[^/]*', consumed: 1 };
};

const tokenizeBracket = (pattern: string, i: number): GlobToken => {
	const close = pattern.indexOf(']', i + 1);
	if (close === -1) return { regex: '\\[', consumed: 1 };
	return { regex: pattern.slice(i, close + 1), consumed: close + 1 - i };
};

const tokenizeLiteral = (c: string): GlobToken => {
	if (REGEX_META.test(c)) return { regex: `\\${c}`, consumed: 1 };
	return { regex: c, consumed: 1 };
};

const tokenizeGlob = (pattern: string, i: number): GlobToken => {
	const c = pattern[i];
	if (c === undefined) return { regex: '', consumed: 1 };
	if (c === '*') return tokenizeStar(pattern, i);
	if (c === '?') return { regex: '[^/]', consumed: 1 };
	if (c === '[') return tokenizeBracket(pattern, i);
	return tokenizeLiteral(c);
};

const globToRegex = (pattern: string): RegExp => {
	let out = '^';
	let i = 0;
	while (i < pattern.length) {
		const token = tokenizeGlob(pattern, i);
		out += token.regex;
		i += token.consumed;
	}
	out += '$';
	return new RegExp(out);
};

/**
 * Match `path` against a glob `pattern`. Empty patterns match anything
 * so the filter input behaves like a passthrough when blank.
 */
export const matchGlob = (path: string, pattern: string): boolean => {
	const trimmed = pattern.trim();
	if (trimmed.length === 0) return true;
	try {
		return globToRegex(trimmed).test(path);
	} catch {
		return false;
	}
};

/**
 * Decide whether an archive entry should yield an inline text preview
 * given its extension. Mirrors the catalog used by File Inspector but
 * works off the entry path alone (no magic bytes available yet).
 */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
	'txt',
	'md',
	'rst',
	'log',
	'json',
	'yaml',
	'yml',
	'toml',
	'ini',
	'cfg',
	'conf',
	'env',
	'xml',
	'html',
	'htm',
	'css',
	'scss',
	'less',
	'js',
	'mjs',
	'cjs',
	'jsx',
	'ts',
	'tsx',
	'py',
	'rb',
	'rs',
	'go',
	'java',
	'kt',
	'swift',
	'c',
	'h',
	'cc',
	'cpp',
	'hpp',
	'cs',
	'php',
	'pl',
	'sh',
	'bash',
	'zsh',
	'fish',
	'sql',
	'csv',
	'tsv',
	'gitignore',
	'gitattributes',
	'editorconfig',
	'lock',
	'license',
	'readme',
]);

const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
	'png',
	'jpg',
	'jpeg',
	'gif',
	'webp',
	'bmp',
	'svg',
	'ico',
	'avif',
]);

export type PreviewKind = 'text' | 'image' | 'hex' | 'too-large' | 'unsupported';

/**
 * Decide which preview renderer to use for a given entry. Files above
 * `tooLargeThreshold` (default 50 MB) skip the preview entirely.
 */
export const previewKindFor = (
	entry: ArchiveEntry,
	tooLargeThreshold = 50 * 1024 * 1024
): PreviewKind => {
	if (entry.isDir) return 'unsupported';
	if (entry.sizeBytes > tooLargeThreshold) return 'too-large';
	const lower = entry.path.toLowerCase();
	const dot = lower.lastIndexOf('.');
	const ext = dot >= 0 ? lower.slice(dot + 1) : '';
	if (IMAGE_EXTENSIONS.has(ext)) return 'image';
	if (TEXT_EXTENSIONS.has(ext)) return 'text';
	const base = lower.split('/').pop() ?? '';
	if (TEXT_EXTENSIONS.has(base)) return 'text';
	return 'hex';
};

/**
 * Decode head bytes as UTF-8 for inline text preview. Mirrors File
 * Inspector's helper so the two tools render the same surface.
 */
export const decodeTextPreview = (bytes: Uint8Array, maxChars: number): string => {
	const decoder = new TextDecoder('utf-8', { fatal: false });
	const text = decoder.decode(bytes);
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}…`;
};

/**
 * Format a contiguous hex preview row. Each row contains up to
 * `bytesPerRow` bytes and is rendered as `OFFSET  HEX HEX HEX  ascii`.
 */
export interface HexPreviewRow {
	readonly offset: string;
	readonly hex: string;
	readonly ascii: string;
}

const PRINTABLE_LO = 0x20;
const PRINTABLE_HI = 0x7e;

const printableChar = (b: number): string =>
	b >= PRINTABLE_LO && b <= PRINTABLE_HI ? String.fromCharCode(b) : '.';

export const formatHexPreview = (
	bytes: Uint8Array,
	maxRows: number,
	bytesPerRow = 16
): readonly HexPreviewRow[] => {
	const rows: HexPreviewRow[] = [];
	for (let i = 0; i < bytes.length && rows.length < maxRows; i += bytesPerRow) {
		const slice = bytes.subarray(i, Math.min(bytes.length, i + bytesPerRow));
		const hex = Array.from(slice)
			.map((b) => b.toString(16).padStart(2, '0').toUpperCase())
			.join(' ');
		const ascii = Array.from(slice).map(printableChar).join('');
		rows.push({
			offset: i.toString(16).padStart(6, '0').toUpperCase(),
			hex,
			ascii,
		});
	}
	return rows;
};

/**
 * Format a Unix-millisecond timestamp as a locale string. Returns
 * `'—'` for nullish inputs so the UI never shows `Invalid Date`.
 */
export const formatTimestamp = (ms: number | null | undefined): string => {
	if (ms == null || !Number.isFinite(ms)) return '—';
	return new Date(ms).toLocaleString();
};

/**
 * Pull the trailing path component from an entry path so the tree row
 * can render a short label while keeping the full path elsewhere.
 */
export const entryDisplayName = (path: string): string => {
	const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
	const slash = trimmed.lastIndexOf('/');
	return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
};

/**
 * Split an entry path into its directory chain (e.g. `src/lib/index.ts`
 * yields `['src', 'src/lib']`). Used to drive the folder expansion
 * model in the entry table.
 */
export const ancestorPaths = (path: string): readonly string[] => {
	const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
	const parts = trimmed.split('/');
	if (parts.length <= 1) return [];
	const out: string[] = [];
	for (let i = 1; i < parts.length; i += 1) {
		out.push(parts.slice(0, i).join('/'));
	}
	return out;
};

/**
 * Compute the depth of an entry path. Top-level files / folders have
 * depth `0`. Used to drive the indent of tree rows.
 */
export const entryDepth = (path: string): number => {
	const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
	const segments = trimmed.split('/').filter((s) => s.length > 0);
	return Math.max(0, segments.length - 1);
};

/**
 * Top-N largest files in the archive, used by the stats panel. Skips
 * directory entries and clamps to the requested count.
 */
export const topLargestEntries = (
	entries: readonly ArchiveEntry[],
	n: number
): readonly ArchiveEntry[] =>
	entries
		.filter((e) => !e.isDir)
		.toSorted((a, b) => b.sizeBytes - a.sizeBytes)
		.slice(0, n);
