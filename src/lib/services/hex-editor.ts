/**
 * Hex Editor service.
 *
 * Wraps the `hex_open` / `hex_read` / `hex_save` Tauri commands and
 * exposes pure helpers the hex viewer/editor renders against:
 * offset / byte formatting, ASCII decoding, hex-pattern parsing, naive
 * byte-pattern matching, and selection-range interpretation as
 * little-/big-endian integers and text encodings.
 *
 * All helpers are pure functions so the frontend can call them inside
 * `useMemo` without owning any extra state.
 */
import { invoke } from '@tauri-apps/api/core';

export interface HexFileInfo {
	readonly path: string;
	readonly sizeBytes: number;
	readonly modifiedMs: number | null;
}

export type HexEditKind = 'patch' | 'insert' | 'delete';

export interface HexEditOp {
	readonly offset: number;
	readonly original: Uint8Array;
	readonly replacement: Uint8Array;
	readonly kind: HexEditKind;
}

interface HexEditOpWire {
	readonly offset: number;
	readonly original: readonly number[];
	readonly replacement: readonly number[];
	readonly kind: HexEditKind;
}

const toWire = (op: HexEditOp): HexEditOpWire => ({
	offset: op.offset,
	original: Array.from(op.original),
	replacement: Array.from(op.replacement),
	kind: op.kind,
});

export const hexOpen = (path: string): Promise<HexFileInfo> => invoke('hex_open', { path });

export const hexRead = (path: string, offset: number, length: number): Promise<Uint8Array> =>
	invoke<number[]>('hex_read', { path, offset, length }).then((arr) => Uint8Array.from(arr));

export const hexSave = (
	path: string,
	ops: readonly HexEditOp[],
	backup: boolean
): Promise<string> => invoke('hex_save', { path, ops: ops.map(toWire), backup });

/**
 * Format a byte offset as an 8-digit uppercase hex string.
 */
export const formatOffset = (n: number): string => n.toString(16).padStart(8, '0').toUpperCase();

/**
 * Format a single byte as a two-character hex string.
 */
export const formatHexByte = (b: number, uppercase = true): string => {
	const s = b.toString(16).padStart(2, '0');
	return uppercase ? s.toUpperCase() : s;
};

/**
 * Render a byte buffer as its ASCII gutter, substituting `.` for any
 * non-printable byte (outside the 0x20..0x7E inclusive range).
 */
export const bytesToAscii = (bytes: Uint8Array): string => {
	let out = '';
	for (let i = 0; i < bytes.length; i += 1) {
		const b = bytes[i];
		out += b !== undefined && b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
	}
	return out;
};

/**
 * Parse a hex search pattern. Accepts any combination of whitespace
 * and `0x` prefixes between byte pairs. Returns `null` when the input
 * is empty or any token is not a valid two-digit hex byte.
 */
export const parseHexPattern = (input: string): Uint8Array | null => {
	const cleaned = input
		.replace(/0x/gi, '')
		.replace(/[\s,]+/g, '')
		.toLowerCase();
	if (cleaned.length === 0) return null;
	if (cleaned.length % 2 !== 0) return null;
	if (!/^[0-9a-f]+$/.test(cleaned)) return null;
	const bytes = new Uint8Array(cleaned.length / 2);
	for (let i = 0; i < bytes.length; i += 1) {
		bytes[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
};

/**
 * Convert a UTF-8 string into the byte sequence the hex search uses to
 * locate it inside a buffer.
 */
export const textToBytes = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * Naive substring search. Returns every offset at which `needle`
 * occurs inside `haystack`. Adequate for the in-memory viewport
 * lengths the editor handles; for huge files we still only search
 * within the current viewport buffer.
 */
export const findAllMatches = (haystack: Uint8Array, needle: Uint8Array): readonly number[] => {
	if (needle.length === 0 || haystack.length < needle.length) return [];
	const matches: number[] = [];
	outer: for (let i = 0; i <= haystack.length - needle.length; i += 1) {
		for (let j = 0; j < needle.length; j += 1) {
			if (haystack[i + j] !== needle[j]) continue outer;
		}
		matches.push(i);
	}
	return matches;
};

/**
 * Parse the "Jump to offset" input. Accepts:
 *
 * - decimal (e.g. `1024`)
 * - hex with `0x` prefix (e.g. `0x400`)
 * - relative with leading `+` / `-` (e.g. `+256`, `-64`)
 *
 * Returns the new absolute offset clamped to `[0, size]`, or `null`
 * when the input cannot be parsed.
 */
export const parseJumpOffset = (input: string, current: number, size: number): number | null => {
	const trimmed = input.trim();
	if (trimmed.length === 0) return null;
	const relative = trimmed.startsWith('+') || trimmed.startsWith('-');
	const sign = trimmed.startsWith('-') ? -1 : 1;
	const body = relative ? trimmed.slice(1) : trimmed;
	const radix = body.toLowerCase().startsWith('0x') ? 16 : 10;
	const digits = radix === 16 ? body.slice(2) : body;
	if (digits.length === 0) return null;
	const validHex = /^[0-9a-fA-F]+$/;
	const validDec = /^[0-9]+$/;
	if (radix === 16 && !validHex.test(digits)) return null;
	if (radix === 10 && !validDec.test(digits)) return null;
	const value = Number.parseInt(digits, radix);
	if (!Number.isFinite(value)) return null;
	const next = relative ? current + sign * value : value;
	if (next < 0) return 0;
	if (next > size) return size;
	return next;
};

export interface ByteInterpretation {
	readonly u8?: number;
	readonly i8?: number;
	readonly u16le?: number;
	readonly u16be?: number;
	readonly i16le?: number;
	readonly i16be?: number;
	readonly u32le?: number;
	readonly u32be?: number;
	readonly i32le?: number;
	readonly i32be?: number;
	readonly u64le?: bigint;
	readonly u64be?: bigint;
	readonly f32le?: number;
	readonly f32be?: number;
	readonly f64le?: number;
	readonly f64be?: number;
	readonly ascii: string;
	readonly utf8?: string;
	readonly utf16le?: string;
}

const tryDecode = (bytes: Uint8Array, encoding: 'utf-8' | 'utf-16le'): string | undefined => {
	try {
		const decoder = new TextDecoder(encoding, { fatal: false });
		const decoded = decoder.decode(bytes);
		return decoded.length === 0 ? undefined : decoded;
	} catch {
		return undefined;
	}
};

/**
 * Decode a small selection into every reasonable scalar / text
 * interpretation. Unavailable conversions (e.g. u32 on a 3-byte
 * selection) are simply omitted.
 */
export const interpretBytes = (bytes: Uint8Array): ByteInterpretation => {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const len = bytes.length;
	const ascii = bytesToAscii(bytes);

	return {
		u8: len >= 1 ? view.getUint8(0) : undefined,
		i8: len >= 1 ? view.getInt8(0) : undefined,
		u16le: len >= 2 ? view.getUint16(0, true) : undefined,
		u16be: len >= 2 ? view.getUint16(0, false) : undefined,
		i16le: len >= 2 ? view.getInt16(0, true) : undefined,
		i16be: len >= 2 ? view.getInt16(0, false) : undefined,
		u32le: len >= 4 ? view.getUint32(0, true) : undefined,
		u32be: len >= 4 ? view.getUint32(0, false) : undefined,
		i32le: len >= 4 ? view.getInt32(0, true) : undefined,
		i32be: len >= 4 ? view.getInt32(0, false) : undefined,
		u64le: len >= 8 ? view.getBigUint64(0, true) : undefined,
		u64be: len >= 8 ? view.getBigUint64(0, false) : undefined,
		f32le: len >= 4 ? view.getFloat32(0, true) : undefined,
		f32be: len >= 4 ? view.getFloat32(0, false) : undefined,
		f64le: len >= 8 ? view.getFloat64(0, true) : undefined,
		f64be: len >= 8 ? view.getFloat64(0, false) : undefined,
		ascii,
		utf8: tryDecode(bytes, 'utf-8'),
		utf16le: len >= 2 ? tryDecode(bytes, 'utf-16le') : undefined,
	};
};

/**
 * Human-readable size, mirroring `file-inspect`'s helper so the file
 * banner reads consistently across the two tools.
 */
export const humanSize = (bytes: number): string => {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const exponent = Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3));
	const value = bytes / 10 ** (exponent * 3);
	return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
};
