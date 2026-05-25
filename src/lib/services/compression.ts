/**
 * Text compression service backed by `CompressionStream` (gzip) and
 * `brotli-wasm` (brotli). All operations are async because the platform
 * compression API and the wasm module are both asynchronous.
 *
 * Note: `CompressionStream` does not expose a compression-level knob; gzip is
 * always emitted at the platform-default level. The level slider is therefore
 * only consulted for brotli, where it maps to the brotli quality parameter.
 */
import brotliPromise from 'brotli-wasm';

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

/** GZIP RFC 1952 magic bytes (`\x1F\x8B`). */
const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

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

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: false });

const errorMessage = (e: unknown, fallback: string): string => {
	if (e instanceof Error) return e.message;
	if (typeof e === 'string') return e;
	return fallback;
};

/** Pipe bytes through a Web Streams transformer and collect the result. */
const runStream = async (
	input: Uint8Array,
	transformer: GenericTransformStream
): Promise<Uint8Array> => {
	// `Blob` accepts `Uint8Array` at runtime but DOM lib's `BlobPart` only
	// allows the narrower `Uint8Array<ArrayBuffer>` variant. Reinterpret as
	// `ArrayBuffer` so the broader `Uint8Array<ArrayBufferLike>` upcasts.
	const part = new Uint8Array(input.buffer as ArrayBuffer, input.byteOffset, input.byteLength);
	const inputStream = new Blob([part]).stream();
	const responseStream = inputStream.pipeThrough(transformer);
	const buffer = await new Response(responseStream).arrayBuffer();
	return new Uint8Array(buffer);
};

const compressGzip = (bytes: Uint8Array): Promise<Uint8Array> =>
	runStream(bytes, new CompressionStream('gzip'));

const decompressGzip = (bytes: Uint8Array): Promise<Uint8Array> =>
	runStream(bytes, new DecompressionStream('gzip'));

const getBrotli = async () => brotliPromise;

const compressBrotli = async (bytes: Uint8Array, quality: number): Promise<Uint8Array> => {
	const brotli = await getBrotli();
	return brotli.compress(bytes, { quality });
};

const decompressBrotli = async (bytes: Uint8Array): Promise<Uint8Array> => {
	const brotli = await getBrotli();
	return brotli.decompress(bytes);
};

/** Compress UTF-8-encoded text under the requested algorithm and level. */
export const compressText = async (
	text: string,
	opts: CompressOptions
): Promise<CompressResult | CompressionError> => {
	if (text.length === 0) return { ok: false, error: 'Input is empty' };

	try {
		const inputBytes = textEncoder.encode(text);
		const compressed =
			opts.algorithm === 'gzip'
				? await compressGzip(inputBytes)
				: await compressBrotli(inputBytes, clampLevel(opts.level, 'brotli'));

		const inputLen = inputBytes.byteLength;
		const outputLen = compressed.byteLength;

		return {
			ok: true,
			inputBytes: inputLen,
			outputBytes: outputLen,
			ratio: inputLen === 0 ? 0 : outputLen / inputLen,
			bytesSaved: inputLen - outputLen,
			bytes: compressed,
		};
	} catch (e) {
		return { ok: false, error: errorMessage(e, 'Compression failed') };
	}
};

/** Sniff the algorithm from a byte prefix. */
const sniffAlgorithm = (bytes: Uint8Array): CompressionAlgorithm => {
	if (bytes.byteLength >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1) {
		return 'gzip';
	}
	// Brotli has no fixed magic prefix — fall through to it on negative gzip
	// match. If the bytes are neither gzip nor valid brotli the wasm call will
	// surface a parse error.
	return 'brotli';
};

/** Decompress raw bytes; `auto` sniffs gzip magic and falls back to brotli. */
export const decompressBytes = async (
	bytes: Uint8Array,
	algorithm: DecompressAlgorithm
): Promise<DecompressResult | CompressionError> => {
	if (bytes.byteLength === 0) return { ok: false, error: 'Input is empty' };

	const resolved: CompressionAlgorithm = algorithm === 'auto' ? sniffAlgorithm(bytes) : algorithm;

	try {
		const out = resolved === 'gzip' ? await decompressGzip(bytes) : await decompressBrotli(bytes);
		const text = textDecoder.decode(out);
		return {
			ok: true,
			text,
			algorithm: resolved,
			inputBytes: bytes.byteLength,
			outputBytes: out.byteLength,
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
	return textEncoder.encode(decodeURIComponent(body));
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
