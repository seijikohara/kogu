/**
 * Pure byte <-> string conversions for the compression tool.
 *
 * These have no Tauri dependency, so both the main thread and
 * `compression.worker.ts` can import them. `compression.ts` re-exports them
 * for existing callers.
 */

/** Encode bytes as standard base64 (with `=` padding). */
export const bytesToBase64 = (bytes: Uint8Array): string => {
	// Avoid String.fromCharCode.apply on large arrays — chunk to stay under
	// the call-stack limit on Safari/WKWebView.
	const CHUNK = 0x8000;
	const parts: string[] = [];
	for (let i = 0; i < bytes.byteLength; i += CHUNK) {
		const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.byteLength));
		parts.push(String.fromCharCode(...slice));
	}
	return btoa(parts.join(''));
};

/** Decode a standard or URL-safe base64 string to bytes. */
export const base64ToBytes = (b64: string): Uint8Array => {
	const trimmed = b64.trim();
	if (trimmed.length === 0) return new Uint8Array(0);

	// Accept URL-safe alphabet and tolerate missing padding.
	const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
	const padLength = (4 - (normalized.length % 4)) % 4;
	const padded = normalized + '='.repeat(padLength);

	const binary = atob(padded);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		out[i] = binary.charCodeAt(i);
	}
	return out;
};

/** Render bytes as a hex string with optional grouping and case. */
export const bytesToHex = (
	bytes: Uint8Array,
	opts?: { readonly upper?: boolean; readonly group?: number; readonly separator?: string }
): string => {
	const upper = opts?.upper ?? true;
	const group = opts?.group ?? 0;
	const separator = opts?.separator ?? ':';

	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
	const cased = upper ? hex.map((h) => h.toUpperCase()) : hex;

	if (group <= 0) return cased.join('');

	const groups: string[] = [];
	for (let i = 0; i < cased.length; i += group) {
		groups.push(cased.slice(i, i + group).join(''));
	}
	return groups.join(separator);
};

/** Parse a hex string back into bytes; tolerates whitespace and `:` / `-` separators. */
export const hexToBytes = (hex: string): Uint8Array => {
	const stripped = hex.replace(/[\s:_-]/g, '');
	if (stripped.length === 0) return new Uint8Array(0);
	if (stripped.length % 2 !== 0) {
		throw new Error('Hex string has an odd character count');
	}
	if (!/^[0-9a-fA-F]+$/.test(stripped)) {
		throw new Error('Hex string contains non-hex characters');
	}
	const out = new Uint8Array(stripped.length / 2);
	for (let i = 0; i < stripped.length; i += 2) {
		out[i / 2] = Number.parseInt(stripped.slice(i, i + 2), 16);
	}
	return out;
};

/** Render bytes as a `data:` URI with the supplied MIME type. */
export const bytesToDataUri = (bytes: Uint8Array, mime?: string): string =>
	`data:${mime ?? 'application/octet-stream'};base64,${bytesToBase64(bytes)}`;
