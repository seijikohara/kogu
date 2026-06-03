/**
 * Text compression service backed by the Rust `string_compress` /
 * `string_decompress` Tauri commands (see
 * `src-tauri/src/string_compress.rs`).
 *
 * The Rust backend exposes a single uniform contract for gzip and
 * brotli at any level; the previous renderer-side mix of
 * `CompressionStream` + `brotli-wasm` is gone. CPU work runs on a
 * `spawn_blocking` worker on the Rust side so the renderer thread
 * stays free even on multi-megabyte input.
 */
import { invoke } from '@tauri-apps/api/core';

import { base64ToBytes, bytesToBase64 } from './compression-bytes';

/** Compression algorithm identifier. */
export type CompressionAlgorithm = 'gzip' | 'brotli';

/** Algorithm choice on decompress; `auto` sniffs gzip magic bytes. */
export type DecompressAlgorithm = CompressionAlgorithm | 'auto';

/** Output representation for compressed bytes. */
export type OutputFormat = 'base64' | 'hex' | 'data-uri';

/** Options for compressing raw text. */
export interface CompressOptions {
	readonly algorithm: CompressionAlgorithm;
	/** 1-9 for gzip (informational, see module note); 0-11 for brotli. */
	readonly level: number;
}

/** Successful compression result. */
export interface CompressResult {
	readonly ok: true;
	readonly inputBytes: number;
	readonly outputBytes: number;
	/** outputBytes / inputBytes — clamped to a finite number when input is empty. */
	readonly ratio: number;
	readonly bytesSaved: number;
	readonly bytes: Uint8Array;
}

/** Successful decompression result. */
export interface DecompressResult {
	readonly ok: true;
	readonly text: string;
	readonly algorithm: CompressionAlgorithm;
	readonly inputBytes: number;
	readonly outputBytes: number;
}

/** Failure case shared by compress / decompress. */
export interface CompressionError {
	readonly ok: false;
	readonly error: string;
}

/** Default level per algorithm. */
export const DEFAULT_LEVEL: Readonly<Record<CompressionAlgorithm, number>> = {
	gzip: 6,
	brotli: 6,
};

/** Inclusive level range per algorithm. */
export const LEVEL_RANGE: Readonly<
	Record<CompressionAlgorithm, { readonly min: number; readonly max: number }>
> = {
	gzip: { min: 1, max: 9 },
	brotli: { min: 0, max: 11 },
};

const errorMessage = (e: unknown, fallback: string): string => {
	if (e instanceof Error) return e.message;
	if (typeof e === 'string') return e;
	return fallback;
};

interface CompressBackendResponse {
	readonly bytesBase64: string;
	readonly algorithm: CompressionAlgorithm;
	readonly inputBytes: number;
	readonly outputBytes: number;
}

interface DecompressBackendResponse {
	readonly text: string;
	readonly algorithm: CompressionAlgorithm;
	readonly inputBytes: number;
	readonly outputBytes: number;
}

/** Compress UTF-8-encoded text under the requested algorithm and level. */
export const compressText = async (
	text: string,
	opts: CompressOptions
): Promise<CompressResult | CompressionError> => {
	if (text.length === 0) return { ok: false, error: 'Input is empty' };

	try {
		const response = await invoke<CompressBackendResponse>('string_compress', {
			text,
			algorithm: opts.algorithm,
			level: clampLevel(opts.level, opts.algorithm),
		});
		const bytes = base64ToBytes(response.bytesBase64);
		return {
			ok: true,
			inputBytes: response.inputBytes,
			outputBytes: response.outputBytes,
			ratio: response.inputBytes === 0 ? 0 : response.outputBytes / response.inputBytes,
			bytesSaved: response.inputBytes - response.outputBytes,
			bytes,
		};
	} catch (e) {
		return { ok: false, error: errorMessage(e, 'Compression failed') };
	}
};

/** Decompress raw bytes; `auto` sniffs gzip magic and falls back to brotli. */
export const decompressBytes = async (
	bytes: Uint8Array,
	algorithm: DecompressAlgorithm
): Promise<DecompressResult | CompressionError> => {
	if (bytes.byteLength === 0) return { ok: false, error: 'Input is empty' };

	try {
		const response = await invoke<DecompressBackendResponse>('string_decompress', {
			bytesBase64: bytesToBase64(bytes),
			algorithm,
		});
		return {
			ok: true,
			text: response.text,
			algorithm: response.algorithm,
			inputBytes: response.inputBytes,
			outputBytes: response.outputBytes,
		};
	} catch (e) {
		return { ok: false, error: errorMessage(e, 'Decompression failed') };
	}
};

/** Clamp a level into the algorithm's supported range. */
export const clampLevel = (level: number, algorithm: CompressionAlgorithm): number => {
	const { min, max } = LEVEL_RANGE[algorithm];
	if (Number.isNaN(level)) return DEFAULT_LEVEL[algorithm];
	return Math.min(max, Math.max(min, Math.round(level)));
};

// Pure byte conversions live in compression-bytes.ts (Tauri-free) so the
// compression worker can import them; re-exported here for existing callers.
export {
	base64ToBytes,
	bytesToBase64,
	bytesToDataUri,
	bytesToHex,
	hexToBytes,
} from './compression-bytes';

/** Parse a `data:` URI; returns raw bytes when the payload is base64. */
export const dataUriToBytes = (uri: string): Uint8Array => {
	const trimmed = uri.trim();
	if (!trimmed.toLowerCase().startsWith('data:')) {
		throw new Error('Not a data: URI');
	}
	const commaIndex = trimmed.indexOf(',');
	if (commaIndex === -1) throw new Error('Malformed data: URI (missing comma)');
	const header = trimmed.slice(5, commaIndex);
	const body = trimmed.slice(commaIndex + 1);
	if (header.includes(';base64')) return base64ToBytes(body);
	// URL-encoded payload: re-use the decoded text path.
	return new TextEncoder().encode(decodeURIComponent(body));
};

const CURL_DATA_FLAGS: readonly string[] = [
	'--data-raw',
	'--data-binary',
	'--data-urlencode',
	'--data',
	'-d',
];

const escapeRegex = (flag: string): string => flag.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

const unescapeShellEscapes = (value: string): string => value.replace(/\\(['"`$\\])/g, '$1');

const matchCurlFlag = (input: string, flag: string): string | null => {
	// Match either `<flag><space><value>` or `<flag>=<value>`. Value may be
	// wrapped in single or double quotes, optionally prefixed with `$` (as
	// emitted by browser "copy as curl" exports that use ANSI-C quoting).
	const sep = '(?:\\s+|=)';
	const quoted = '(?:\'((?:\\\\.|[^\'\\\\])*)\'|"((?:\\\\.|[^"\\\\])*)")';
	const bare = '(\\S+)';
	const pattern = new RegExp(`(?:^|\\s)\\$?${escapeRegex(flag)}${sep}(?:${quoted}|${bare})`, 's');
	const match = input.match(pattern);
	if (!match) return null;
	const raw = match[1] ?? match[2] ?? match[3] ?? null;
	if (raw === null) return null;
	return unescapeShellEscapes(raw);
};

/** Best-effort extractor for a `--data-raw` / `-d` / `--data` payload in a curl command. */
export const extractCurlDataRaw = (curl: string): string | null => {
	const trimmed = curl.trim();
	if (trimmed.length === 0) return null;
	return CURL_DATA_FLAGS.reduce<string | null>(
		(acc, flag) => acc ?? matchCurlFlag(trimmed, flag),
		null
	);
};

/** Multi-line sample input that compresses well and demonstrates the ratio bar. */
export const SAMPLE_TEXT = `Compression algorithms exploit redundancy in data: repeating words, common
phrases, and predictable byte patterns. The Lempel-Ziv family (used by gzip)
substitutes repeated sequences with back-references; Brotli adds a static
dictionary of common web tokens and a smarter context-mixing model, often
producing 15-25% smaller payloads on natural language at the cost of higher CPU.

The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the
lazy dog. The quick brown fox jumps over the lazy dog. The quick brown fox jumps
over the lazy dog. The quick brown fox jumps over the lazy dog.

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`;
