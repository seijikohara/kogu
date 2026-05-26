/**
 * File Inspector service.
 *
 * Wraps the `file_inspect` Tauri command and provides browser-side
 * helpers for the inspector tool: byte conversion, hash computation
 * (MD5 / SHA-1 / SHA-256 / SHA-512), human-readable size formatting,
 * hex previews, and magic-byte MIME detection against the existing
 * MIME Type Explorer catalog.
 *
 * BLAKE3 is intentionally not implemented; the existing dependency
 * surface (`crypto-js`, `js-md5`, Web Crypto) already covers four
 * algorithms without adding a WASM payload, and a placeholder is left
 * in [`HashAlgo`] so it can land in a follow-up PR.
 */
import { invoke } from '@tauri-apps/api/core';
import CryptoJS from 'crypto-js';
import { md5 } from 'js-md5';

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
 * Invoke the Tauri command that reads a file from disk and returns its
 * metadata, head bytes, and (when small enough) full content.
 */
export const inspectFile = (path: string): Promise<FileInspectResult> =>
	invoke<FileInspectResult>('file_inspect', { path });

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
 * Convert a [`Uint8Array`] into a CryptoJS WordArray without copying
 * through an intermediate string (which would mis-handle non-UTF-8
 * bytes).
 */
const bytesToWordArray = (bytes: Uint8Array): CryptoJS.lib.WordArray =>
	CryptoJS.lib.WordArray.create(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
	);

const bytesToHex = (bytes: Uint8Array): string =>
	Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

/**
 * Hash an arbitrary byte buffer with one of the supported algorithms.
 *
 * SHA-1 / 256 / 512 go through `crypto.subtle` when available (native,
 * streaming-friendly) and fall back to CryptoJS otherwise. MD5 always
 * uses `js-md5` since `crypto.subtle` does not implement it.
 */
export const hashBytes = async (bytes: Uint8Array, algo: HashAlgo): Promise<string> => {
	if (algo === 'md5') return md5(bytes);

	const subtle = globalThis.crypto?.subtle;
	if (subtle) {
		const algoName: Readonly<Record<Exclude<HashAlgo, 'md5'>, string>> = {
			sha1: 'SHA-1',
			sha256: 'SHA-256',
			sha512: 'SHA-512',
		};
		const digest = await subtle.digest(algoName[algo], bytes as BufferSource);
		return bytesToHex(new Uint8Array(digest));
	}

	const wa = bytesToWordArray(bytes);
	if (algo === 'sha1') return CryptoJS.SHA1(wa).toString();
	if (algo === 'sha256') return CryptoJS.SHA256(wa).toString();
	return CryptoJS.SHA512(wa).toString();
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
