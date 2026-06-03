/**
 * File Inspector service.
 *
 * Wraps the `file_inspect` Tauri command and provides browser-side
 * helpers for the inspector tool: byte conversion, the hash-algorithm
 * catalog, human-readable size formatting, hex previews, and magic-byte
 * MIME detection against the existing MIME Type Explorer catalog.
 *
 * Hashing itself runs in `file-inspect.worker.ts` (off the main thread)
 * so decoding and digesting a large file never freezes the webview. This
 * module only describes the supported algorithms via [`HashAlgo`].
 */
import { invoke } from '@tauri-apps/api/core';

import { MIME_ENTRIES, type MimeEntry } from './mime';

export interface FileInspectResult {
	readonly path: string;
	readonly filename: string;
	readonly extension: string;
	readonly sizeBytes: number;
	readonly createdMs: number | null;
	readonly modifiedMs: number | null;
	readonly accessedMs: number | null;
	readonly permissionsOctal: string | null;
	readonly permissionsString: string | null;
	readonly readonly: boolean;
	readonly headBytesB64: string;
	readonly fullBytesB64: string | null;
}

/**
 * Maximum file size for which the backend returns the full content as base64.
 * Files larger than this return only the head bytes, so hashing the whole file
 * is unavailable. Mirrors `MAX_FULL_BYTES` in `src-tauri/src/file_inspect.rs`.
 */
export const MAX_FULL_BYTES = 500 * 1024 * 1024;

/**
 * Invoke the Tauri command that reads a file from disk and returns its
 * metadata, head bytes, and (when small enough) full content.
 */
export const inspectFile = (opId: string, path: string): Promise<FileInspectResult> =>
	invoke<FileInspectResult>('file_inspect', { opId, path });

/** Cancel an in-flight file_inspect run by its op id. */
export const cancelFileInspect = (opId: string): Promise<boolean> =>
	invoke<boolean>('cancel_op', { opId });

export type HashAlgo = 'md5' | 'sha1' | 'sha256' | 'sha512';

export const HASH_ALGO_LABELS: Readonly<Record<HashAlgo, string>> = {
	md5: 'MD5',
	sha1: 'SHA-1',
	sha256: 'SHA-256',
	sha512: 'SHA-512',
};

export const HASH_ALGO_SECURE: Readonly<Record<HashAlgo, boolean>> = {
	md5: false,
	sha1: false,
	sha256: true,
	sha512: true,
};

/**
 * Decode a standard-encoded base64 string into a [`Uint8Array`]. Uses
 * `atob` because the buffers always originate from the Rust backend and
 * therefore never contain URL-safe characters.
 */
export const base64ToBytes = (b64: string): Uint8Array => {
	if (b64.length === 0) return new Uint8Array(0);
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
};

/**
 * Format a byte count as a IEC-style human-readable string
 * (e.g. `1.4 MB`). Mirrors the helper in `image-convert.ts` so the
 * status bar stays visually consistent with the Image Converter tool.
 */
export const humanSize = (bytes: number): string => {
	if (!Number.isFinite(bytes) || bytes < 0) return '—';
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unit = units[0] ?? 'KB';
	for (let i = 0; i < units.length - 1 && value >= 1024; i += 1) {
		value /= 1024;
		unit = units[i + 1] ?? unit;
	}
	const formatted = value >= 100 ? value.toFixed(0) : value.toFixed(1);
	return `${formatted} ${unit}`;
};

export interface HexPreviewRow {
	readonly offset: number;
	readonly hex: string;
	readonly ascii: string;
}

const HEX_BYTES_PER_ROW = 16;
const PRINTABLE_MIN = 0x20;
const PRINTABLE_MAX = 0x7e;

const renderHexRow = (bytes: Uint8Array, offset: number): HexPreviewRow => {
	const slice = bytes.slice(offset, offset + HEX_BYTES_PER_ROW);
	const hex = Array.from(slice)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join(' ');
	const ascii = Array.from(slice)
		.map((b) => (b >= PRINTABLE_MIN && b <= PRINTABLE_MAX ? String.fromCharCode(b) : '.'))
		.join('');
	return { offset, hex, ascii };
};

/**
 * Format the first `maxRows` × 16 bytes of `bytes` as a list of rows
 * with offset, hex columns, and ASCII gutter.
 */
export const formatHexPreview = (bytes: Uint8Array, maxRows: number): readonly HexPreviewRow[] => {
	const rows: HexPreviewRow[] = [];
	const limit = Math.min(bytes.length, maxRows * HEX_BYTES_PER_ROW);
	for (let offset = 0; offset < limit; offset += HEX_BYTES_PER_ROW) {
		rows.push(renderHexRow(bytes, offset));
	}
	return rows;
};

/**
 * Parse a space-separated uppercase hex string ("89 50 4E 47 ...") into
 * a [`Uint8Array`].
 */
const parseMagicHex = (hex: string): Uint8Array => {
	const cleaned = hex.replace(/\s+/g, '');
	if (cleaned.length % 2 !== 0) return new Uint8Array(0);
	const out = new Uint8Array(cleaned.length / 2);
	for (let i = 0; i < out.length; i += 1) {
		out[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
};

const bytesMatchAt = (haystack: Uint8Array, offset: number, needle: Uint8Array): boolean => {
	if (offset + needle.length > haystack.length) return false;
	for (let i = 0; i < needle.length; i += 1) {
		if (haystack[offset + i] !== needle[i]) return false;
	}
	return true;
};

const entryMatchesMagic = (
	entry: MimeEntry,
	bytes: Uint8Array
): { matched: boolean; hex: string | null } => {
	if (!entry.magic || entry.magic.length === 0) return { matched: false, hex: null };
	for (const candidate of entry.magic) {
		const needle = parseMagicHex(candidate.hex);
		if (needle.length === 0) continue;
		if (bytesMatchAt(bytes, candidate.offset ?? 0, needle)) {
			return { matched: true, hex: candidate.hex };
		}
	}
	return { matched: false, hex: null };
};

const findEntryByExtension = (filename: string): MimeEntry | null => {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot < 0) return null;
	const ext = filename.slice(lastDot).toLowerCase();
	return MIME_ENTRIES.find((e) => e.extensions.includes(ext)) ?? null;
};

export interface MagicDetectionResult {
	readonly mime: string | null;
	readonly matchedBytes: string | null;
	readonly expectedFromExtension: string | null;
}

/**
 * Walk the MIME Type Explorer catalog looking for the entry whose magic
 * bytes match the head of `bytes`. Returns the detected MIME (or
 * `null` when nothing matched), the hex pattern that matched, and the
 * MIME implied by the filename extension for mismatch comparison.
 */
export const detectMimeFromMagic = (bytes: Uint8Array, filename: string): MagicDetectionResult => {
	const matchedEntry = MIME_ENTRIES.map((entry) => ({
		entry,
		match: entryMatchesMagic(entry, bytes),
	})).find((row) => row.match.matched);

	const expectedEntry = findEntryByExtension(filename);

	return {
		mime: matchedEntry?.entry.type ?? null,
		matchedBytes: matchedEntry?.match.hex ?? null,
		expectedFromExtension: expectedEntry?.type ?? null,
	};
};

/**
 * Decide whether a MIME type should yield a text preview. Anything in
 * the `text/` family qualifies, plus a small list of structured
 * application types that are routinely human-readable.
 */
export const isTextLikeMime = (mime: string | null): boolean => {
	if (!mime) return false;
	if (mime.startsWith('text/')) return true;
	return [
		'application/json',
		'application/ld+json',
		'application/xml',
		'application/yaml',
		'application/x-yaml',
		'application/x-sh',
		'application/javascript',
		'application/xhtml+xml',
		'application/x-www-form-urlencoded',
	].includes(mime);
};

/** Decide whether a MIME type should yield an inline image preview. */
export const isImageMime = (mime: string | null): boolean =>
	typeof mime === 'string' && mime.startsWith('image/');

/** Decide whether a MIME type should yield an inline audio preview. */
export const isAudioMime = (mime: string | null): boolean =>
	typeof mime === 'string' && mime.startsWith('audio/');

/**
 * Decode the head bytes as UTF-8 and trim to `maxChars`. Used for the
 * text preview card.
 */
export const decodeTextPreview = (bytes: Uint8Array, maxChars: number): string => {
	const decoder = new TextDecoder('utf-8', { fatal: false });
	const text = decoder.decode(bytes);
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}…`;
};

/**
 * Format a Unix-millisecond timestamp as a locale string. Returns `'—'`
 * for nullish or non-finite inputs so the UI never shows
 * `Invalid Date`.
 */
export const formatTimestamp = (ms: number | null | undefined): string => {
	if (ms == null || !Number.isFinite(ms)) return '—';
	return new Date(ms).toLocaleString();
};
