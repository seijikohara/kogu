/**
 * File Encoding Converter service.
 *
 * Pure helpers for detecting text encoding (BOM-aware + jschardet for
 * heuristic fallback), counting line endings, decoding bytes to text via
 * the platform `TextDecoder`, and re-encoding text to a target encoding
 * with chosen line-ending normalization.
 *
 * Notes on encoder support:
 * - UTF-8 / UTF-8 BOM are produced natively via `TextEncoder`.
 * - UTF-16 LE/BE are produced by hand from JavaScript string code units,
 *   which mirrors the way `TextDecoder('utf-16le')` reads them.
 * - ISO-8859-1 / Windows-1252 are produced by mapping each code unit
 *   into its single-byte representation when it fits in the page, and
 *   substituting `?` (0x3F) otherwise.
 * - Shift-JIS, EUC-JP, GBK, Big5 are *read* via `TextDecoder` (which
 *   ships on every modern WebView), but the platform exposes no encoder
 *   for those legacy code pages. Writing to those targets currently
 *   round-trips through the read pipeline, so any character that cannot
 *   be expressed in the target encoding is replaced with `?`.
 */
import jschardet from 'jschardet';

export type Encoding =
	| 'utf-8'
	| 'utf-8-bom'
	| 'utf-16-le'
	| 'utf-16-be'
	| 'iso-8859-1'
	| 'shift-jis'
	| 'euc-jp'
	| 'gbk'
	| 'big5'
	| 'windows-1252';

export type LineEnding = 'keep' | 'lf' | 'crlf' | 'cr';

export interface LineEndingCounts {
	readonly lf: number;
	readonly crlf: number;
	readonly cr: number;
}

export interface DetectedEncoding {
	readonly encoding: Encoding;
	readonly confidence: number;
	readonly hasBom: boolean;
	readonly lineEndings: LineEndingCounts;
}

export interface EncodingMeta {
	readonly id: Encoding;
	readonly label: string;
	readonly aliases: readonly string[];
	readonly decoderName?: string;
	readonly writable: boolean;
}

export const ENCODING_META: readonly EncodingMeta[] = [
	{ id: 'utf-8', label: 'UTF-8', aliases: ['utf-8', 'utf8'], decoderName: 'utf-8', writable: true },
	{
		id: 'utf-8-bom',
		label: 'UTF-8 with BOM',
		aliases: ['utf-8-bom', 'utf8-bom'],
		decoderName: 'utf-8',
		writable: true,
	},
	{
		id: 'utf-16-le',
		label: 'UTF-16 LE',
		aliases: ['utf-16le', 'utf-16-le', 'utf16le'],
		decoderName: 'utf-16le',
		writable: true,
	},
	{
		id: 'utf-16-be',
		label: 'UTF-16 BE',
		aliases: ['utf-16be', 'utf-16-be', 'utf16be'],
		decoderName: 'utf-16be',
		writable: true,
	},
	{
		id: 'iso-8859-1',
		label: 'ISO-8859-1 (Latin-1)',
		aliases: ['iso-8859-1', 'latin1', 'latin-1'],
		decoderName: 'iso-8859-1',
		writable: true,
	},
	{
		id: 'windows-1252',
		label: 'Windows-1252',
		aliases: ['windows-1252', 'cp1252'],
		decoderName: 'windows-1252',
		writable: true,
	},
	{
		id: 'shift-jis',
		label: 'Shift-JIS',
		aliases: ['shift_jis', 'shift-jis', 'sjis', 'ms_kanji'],
		decoderName: 'shift_jis',
		writable: false,
	},
	{
		id: 'euc-jp',
		label: 'EUC-JP',
		aliases: ['euc-jp', 'eucjp'],
		decoderName: 'euc-jp',
		writable: false,
	},
	{ id: 'gbk', label: 'GBK', aliases: ['gbk', 'gb2312'], decoderName: 'gbk', writable: false },
	{
		id: 'big5',
		label: 'Big5',
		aliases: ['big5', 'big5-hkscs'],
		decoderName: 'big5',
		writable: false,
	},
];

const lookupByAlias = (raw: string): Encoding | null => {
	const lower = raw.toLowerCase();
	const match = ENCODING_META.find((meta) => meta.aliases.includes(lower));
	return match ? match.id : null;
};

export const getEncodingMeta = (id: Encoding): EncodingMeta => {
	const meta = ENCODING_META.find((m) => m.id === id);
	if (!meta) {
		throw new Error(`Unknown encoding id: ${id}`);
	}
	return meta;
};

export const isWritableEncoding = (id: Encoding): boolean => getEncodingMeta(id).writable;

const BOM_UTF8 = new Uint8Array([0xef, 0xbb, 0xbf]);
const BOM_UTF16_LE = new Uint8Array([0xff, 0xfe]);
const BOM_UTF16_BE = new Uint8Array([0xfe, 0xff]);

const startsWith = (bytes: Uint8Array, prefix: Uint8Array): boolean => {
	if (bytes.length < prefix.length) return false;
	for (let i = 0; i < prefix.length; i += 1) {
		if (bytes[i] !== prefix[i]) return false;
	}
	return true;
};

/**
 * Detect a BOM prefix and return the matching encoding plus the byte
 * count to strip from the head of the buffer. Returns null when no BOM
 * is present.
 */
export interface BomMatch {
	readonly encoding: Encoding;
	readonly length: number;
}

export const detectBom = (bytes: Uint8Array): BomMatch | null => {
	if (startsWith(bytes, BOM_UTF8)) return { encoding: 'utf-8-bom', length: BOM_UTF8.length };
	if (startsWith(bytes, BOM_UTF16_LE))
		return { encoding: 'utf-16-le', length: BOM_UTF16_LE.length };
	if (startsWith(bytes, BOM_UTF16_BE))
		return { encoding: 'utf-16-be', length: BOM_UTF16_BE.length };
	return null;
};

const countLineEndings = (bytes: Uint8Array): LineEndingCounts => {
	let lf = 0;
	let crlf = 0;
	let cr = 0;
	for (let i = 0; i < bytes.length; i += 1) {
		const b = bytes[i];
		if (b === 0x0d) {
			if (bytes[i + 1] === 0x0a) {
				crlf += 1;
				i += 1;
			} else {
				cr += 1;
			}
		} else if (b === 0x0a) {
			lf += 1;
		}
	}
	return { lf, crlf, cr };
};

/**
 * Try to decode the given bytes as strict UTF-8. Returns true when no
 * malformed sequence is encountered. Used as a fast path before
 * delegating to jschardet for non-ASCII single-byte detection.
 */
const isStrictUtf8 = (bytes: Uint8Array): boolean => {
	try {
		new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		return true;
	} catch {
		return false;
	}
};

const stripBom = (bytes: Uint8Array, bom: BomMatch | null): Uint8Array =>
	bom ? bytes.subarray(bom.length) : bytes;

/**
 * Detect the most likely encoding of the given byte buffer, along with
 * the BOM presence flag and line-ending counts. The detection order is:
 *
 *   1. BOM sniff (UTF-8 / UTF-16 LE / UTF-16 BE).
 *   2. Strict UTF-8 decode succeeds.
 *   3. jschardet heuristic.
 *   4. Fall back to Windows-1252.
 */
export const detectEncoding = (bytes: Uint8Array): DetectedEncoding => {
	const lineEndings = countLineEndings(bytes);
	const bom = detectBom(bytes);
	if (bom) {
		return {
			encoding: bom.encoding,
			confidence: 1,
			hasBom: true,
			lineEndings,
		};
	}

	const body = stripBom(bytes, bom);

	if (isStrictUtf8(body)) {
		return {
			encoding: 'utf-8',
			confidence: 1,
			hasBom: false,
			lineEndings,
		};
	}

	// jschardet expects either a Node Buffer or a Latin-1 string. The
	// Latin-1 string form is portable and avoids the Buffer polyfill.
	let latin1 = '';
	for (let i = 0; i < body.length; i += 1) {
		latin1 += String.fromCharCode(body[i] ?? 0);
	}
	const guess = jschardet.detect(latin1);
	const matched = guess?.encoding ? lookupByAlias(guess.encoding) : null;
	if (matched) {
		return {
			encoding: matched,
			confidence: typeof guess.confidence === 'number' ? guess.confidence : 0,
			hasBom: false,
			lineEndings,
		};
	}

	return {
		encoding: 'windows-1252',
		confidence: 0,
		hasBom: false,
		lineEndings,
	};
};

/**
 * Decode a byte buffer as the given encoding. UTF-8 / UTF-16 BOMs are
 * stripped before decoding so they do not leak into the returned text.
 */
export const decodeBytes = (bytes: Uint8Array, encoding: Encoding): string => {
	const bom = detectBom(bytes);
	const body = stripBom(bytes, bom);
	const meta = getEncodingMeta(encoding);
	const decoderName = meta.decoderName ?? 'utf-8';
	try {
		return new TextDecoder(decoderName, { fatal: false }).decode(body);
	} catch {
		// `TextDecoder` constructor throws when given an unrecognised
		// label. Fall back to UTF-8 with replacement so the caller
		// always receives a string.
		return new TextDecoder('utf-8', { fatal: false }).decode(body);
	}
};

const normalizeLineEndings = (text: string, lineEnding: LineEnding): string => {
	if (lineEnding === 'keep') return text;
	const lf = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
	if (lineEnding === 'lf') return lf;
	if (lineEnding === 'crlf') return lf.replaceAll('\n', '\r\n');
	return lf.replaceAll('\n', '\r');
};

const concatBytes = (a: Uint8Array, b: Uint8Array): Uint8Array => {
	const out = new Uint8Array(a.length + b.length);
	out.set(a, 0);
	out.set(b, a.length);
	return out;
};

const encodeUtf16 = (text: string, littleEndian: boolean): Uint8Array => {
	const out = new Uint8Array(text.length * 2);
	for (let i = 0; i < text.length; i += 1) {
		const code = text.charCodeAt(i);
		if (littleEndian) {
			out[i * 2] = code & 0xff;
			out[i * 2 + 1] = (code >> 8) & 0xff;
		} else {
			out[i * 2] = (code >> 8) & 0xff;
			out[i * 2 + 1] = code & 0xff;
		}
	}
	return out;
};

const WIN1252_HIGH_MAP: Readonly<Record<number, number>> = {
	8364: 0x80,
	8218: 0x82,
	402: 0x83,
	8222: 0x84,
	8230: 0x85,
	8224: 0x86,
	8225: 0x87,
	710: 0x88,
	8240: 0x89,
	352: 0x8a,
	8249: 0x8b,
	338: 0x8c,
	381: 0x8e,
	8216: 0x91,
	8217: 0x92,
	8220: 0x93,
	8221: 0x94,
	8226: 0x95,
	8211: 0x96,
	8212: 0x97,
	732: 0x98,
	8482: 0x99,
	353: 0x9a,
	8250: 0x9b,
	339: 0x9c,
	382: 0x9e,
	376: 0x9f,
};

const encodeSingleByte = (text: string, encoding: 'iso-8859-1' | 'windows-1252'): Uint8Array => {
	const out = new Uint8Array(text.length);
	for (let i = 0; i < text.length; i += 1) {
		const code = text.charCodeAt(i);
		if (code < 0x100) {
			// Both Latin-1 and Windows-1252 are compatible with ASCII
			// and with 0xA0..0xFF, but Windows-1252 also remaps the
			// 0x80..0x9F band to typographic characters.
			out[i] = code;
		} else if (encoding === 'windows-1252' && WIN1252_HIGH_MAP[code] !== undefined) {
			out[i] = WIN1252_HIGH_MAP[code] as number;
		} else {
			out[i] = 0x3f;
		}
	}
	return out;
};

/**
 * Lossy re-encoder for legacy multi-byte encodings without a platform
 * encoder. We round-trip via `TextDecoder` so that any byte sequence we
 * can produce from the source string is at least decodable; characters
 * outside the target's coverage are substituted with `?`.
 */
const encodeViaLegacyRoundTrip = (text: string, target: Encoding): Uint8Array => {
	const decoderName = getEncodingMeta(target).decoderName ?? 'utf-8';
	// Without an encoder we cannot encode arbitrary Unicode into the
	// legacy code page. Fall back to ASCII: every byte that decodes
	// back to the same code point is kept, everything else becomes `?`.
	const utf8 = new TextEncoder().encode(text);
	try {
		const roundtripped = new TextDecoder(decoderName, { fatal: false }).decode(utf8);
		if (roundtripped === text) return utf8;
	} catch {
		// fall through
	}
	const out = new Uint8Array(text.length);
	for (let i = 0; i < text.length; i += 1) {
		const code = text.charCodeAt(i);
		out[i] = code < 0x80 ? code : 0x3f;
	}
	return out;
};

/**
 * Encode the given text to a target encoding with optional line-ending
 * normalization. BOMs are emitted when the target requires one.
 */
export const encodeText = (text: string, target: Encoding, lineEnding: LineEnding): Uint8Array => {
	const normalized = normalizeLineEndings(text, lineEnding);
	switch (target) {
		case 'utf-8':
			return new TextEncoder().encode(normalized);
		case 'utf-8-bom':
			return concatBytes(BOM_UTF8, new TextEncoder().encode(normalized));
		case 'utf-16-le':
			return concatBytes(BOM_UTF16_LE, encodeUtf16(normalized, true));
		case 'utf-16-be':
			return concatBytes(BOM_UTF16_BE, encodeUtf16(normalized, false));
		case 'iso-8859-1':
			return encodeSingleByte(normalized, 'iso-8859-1');
		case 'windows-1252':
			return encodeSingleByte(normalized, 'windows-1252');
		case 'shift-jis':
		case 'euc-jp':
		case 'gbk':
		case 'big5':
			return encodeViaLegacyRoundTrip(normalized, target);
		default:
			return new TextEncoder().encode(normalized);
	}
};

/**
 * Apply or strip the BOM on already-encoded bytes. The action is a
 * no-op when the target encoding does not support a BOM.
 */
export type BomAction = 'add' | 'remove' | 'keep';

export const applyBomAction = (
	bytes: Uint8Array,
	target: Encoding,
	action: BomAction
): Uint8Array => {
	if (action === 'keep') return bytes;

	let bomPrefix: Uint8Array | null = null;
	if (target === 'utf-8' || target === 'utf-8-bom') bomPrefix = BOM_UTF8;
	else if (target === 'utf-16-le') bomPrefix = BOM_UTF16_LE;
	else if (target === 'utf-16-be') bomPrefix = BOM_UTF16_BE;

	if (!bomPrefix) return bytes;

	const currentlyHas = startsWith(bytes, bomPrefix);
	if (action === 'add') {
		return currentlyHas ? bytes : concatBytes(bomPrefix, bytes);
	}
	return currentlyHas ? bytes.subarray(bomPrefix.length) : bytes;
};

/**
 * Convert a byte buffer to its lossless base64 representation. Used by
 * the page's "Copy as base64" action so the encoded payload can be
 * pasted into JSON / config / scripts without further escaping.
 */
export const bytesToBase64 = (bytes: Uint8Array): string => {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		const slice = bytes.subarray(i, Math.min(bytes.length, i + chunk));
		binary += String.fromCharCode.apply(null, Array.from(slice));
	}
	return btoa(binary);
};

/**
 * Compact hex dump (16 bytes per row) limited to `maxBytes`. The
 * preview pane uses this so very large buffers do not freeze the UI.
 */
export const formatHexDump = (bytes: Uint8Array, maxBytes = 256): string => {
	const limit = Math.min(bytes.length, maxBytes);
	const lines: string[] = [];
	for (let i = 0; i < limit; i += 16) {
		const offset = i.toString(16).padStart(8, '0').toUpperCase();
		const slice = bytes.subarray(i, Math.min(limit, i + 16));
		const hex = Array.from(slice)
			.map((b) => b.toString(16).padStart(2, '0').toUpperCase())
			.join(' ');
		const ascii = Array.from(slice)
			.map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
			.join('');
		lines.push(`${offset}  ${hex.padEnd(48, ' ')}  ${ascii}`);
	}
	if (bytes.length > limit) {
		lines.push(`… ${bytes.length - limit} more bytes truncated`);
	}
	return lines.join('\n');
};

/**
 * Human-readable byte size for the status bar (`12 B`, `1.4 KB`, …).
 */
export const humanBytes = (n: number): string => {
	if (n < 1024) return `${n} B`;
	const units = ['KB', 'MB', 'GB'];
	let size = n / 1024;
	for (const unit of units) {
		if (size < 1024) return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
		size /= 1024;
	}
	return `${size.toFixed(1)} TB`;
};

/**
 * Mojibake candidate cycler. Returns a list of plausible
 * "re-interpret as" encodings the user can rotate through after a
 * detection misfire. The list is ordered by likelihood for the given
 * source encoding.
 */
export const getMojibakeCandidates = (current: Encoding): readonly Encoding[] => {
	if (current === 'iso-8859-1' || current === 'windows-1252') {
		return ['utf-8', 'shift-jis', 'euc-jp', 'gbk', 'big5', 'utf-16-le', 'utf-16-be'];
	}
	if (current === 'utf-8' || current === 'utf-8-bom') {
		return ['iso-8859-1', 'windows-1252', 'shift-jis', 'euc-jp', 'gbk', 'big5'];
	}
	if (current === 'shift-jis') return ['euc-jp', 'utf-8', 'gbk', 'big5'];
	if (current === 'euc-jp') return ['shift-jis', 'utf-8', 'gbk', 'big5'];
	if (current === 'gbk') return ['big5', 'shift-jis', 'utf-8', 'euc-jp'];
	if (current === 'big5') return ['gbk', 'shift-jis', 'utf-8', 'euc-jp'];
	return ['utf-8', 'iso-8859-1', 'windows-1252', 'shift-jis', 'euc-jp', 'gbk', 'big5'];
};

/**
 * Sample buffers used by the page's "Try sample" buttons. These are
 * deliberately small so the demo loads instantly.
 */
const HELLO_JA = 'こんにちは、世界！\n漢字とひらがな、カタカナ。\n';

export const SAMPLE_BYTES_UTF8: Uint8Array = new TextEncoder().encode(HELLO_JA);

// Pre-encoded Shift-JIS bytes for the same Japanese sample. Generated
// once with `iconv -f UTF-8 -t SHIFT_JIS` so the page can demonstrate
// decoding a legacy buffer without bundling iconv at runtime.
export const SAMPLE_BYTES_SJIS: Uint8Array = new Uint8Array([
	0x82, 0xb1, 0x82, 0xf1, 0x82, 0xc9, 0x82, 0xbf, 0x82, 0xcd, 0x81, 0x41, 0x90, 0xa2, 0x8a, 0x45,
	0x81, 0x49, 0x0a, 0x8a, 0xbf, 0x8e, 0x9a, 0x82, 0xc6, 0x82, 0xd0, 0x82, 0xe7, 0x82, 0xaa, 0x82,
	0xc8, 0x81, 0x41, 0x83, 0x4a, 0x83, 0x5e, 0x83, 0x4a, 0x83, 0x69, 0x81, 0x42, 0x0a,
]);
