/**
 * Pure helpers for the Number Base Converter route.
 *
 * Everything operates on `bigint` so 64-bit unsigned values round-trip
 * without precision loss. Two's-complement signedness is expressed as a
 * pair of conversions (`toSigned` / `toUnsigned`) over a fixed bit width.
 */

export type BitWidth = 8 | 16 | 32 | 64;
export type Base = 2 | 8 | 10 | 16;
export type Signedness = 'signed' | 'unsigned';
export type FloatWidth = 32 | 64;

export const BIT_WIDTHS: readonly BitWidth[] = [8, 16, 32, 64];
export const BASES: readonly Base[] = [2, 8, 10, 16];

export const BASE_LABEL: Record<Base, string> = {
	2: 'Binary',
	8: 'Octal',
	10: 'Decimal',
	16: 'Hexadecimal',
};

export const BASE_PREFIX: Record<Base, string> = {
	2: '0b',
	8: '0o',
	10: '',
	16: '0x',
};

export const BASE_GROUP_SIZE: Record<Base, number> = {
	2: 4,
	8: 3,
	10: 3,
	16: 4,
};

const BIGINT_ONE = 1n;
const BIGINT_ZERO = 0n;

/** Mask for the lowest `width` bits — `(1 << width) - 1`. */
export const widthMask = (width: BitWidth): bigint => (BIGINT_ONE << BigInt(width)) - BIGINT_ONE;

/** The single high bit for the given width — `1 << (width - 1)`. */
export const signBit = (width: BitWidth): bigint => BIGINT_ONE << BigInt(width - 1);

/** Inclusive range of the signed two's-complement representation. */
export const signedMin = (width: BitWidth): bigint => -(BIGINT_ONE << BigInt(width - 1));
export const signedMax = (width: BitWidth): bigint =>
	(BIGINT_ONE << BigInt(width - 1)) - BIGINT_ONE;
export const unsignedMax = (width: BitWidth): bigint => (BIGINT_ONE << BigInt(width)) - BIGINT_ONE;

/**
 * Map an arbitrary integer into the unsigned interpretation of `width` bits.
 *
 * Negative inputs are wrapped via two's complement so `toUnsigned(-1n, 8)`
 * returns `255n` (0xFF). Always returns a value in `[0, 2^width)`.
 */
export const toUnsigned = (value: bigint, width: BitWidth): bigint => {
	const mod = BIGINT_ONE << BigInt(width);
	return ((value % mod) + mod) % mod;
};

/**
 * Map an unsigned bit pattern back to its signed two's-complement value.
 *
 * `toSigned(255n, 8)` returns `-1n`; `toSigned(127n, 8)` stays `127n`.
 */
export const toSigned = (value: bigint, width: BitWidth): bigint => {
	const unsigned = toUnsigned(value, width);
	return unsigned >= signBit(width) ? unsigned - (BIGINT_ONE << BigInt(width)) : unsigned;
};

/**
 * Strip whitespace plus the conventional `0b` / `0o` / `0x` prefixes and any
 * underscore / comma / space digit separators.
 */
const stripPrefixesAndSeparators = (text: string, base: Base): string => {
	const trimmed = text.trim().replaceAll(/[_,\s]/g, '');
	if (trimmed.length === 0) return '';
	const lower = trimmed.toLowerCase();

	// Allow a leading sign for decimal only; other bases interpret unsigned.
	const signRe = /^[+-]/;
	const sign = base === 10 && signRe.test(trimmed) ? trimmed[0] : '';
	const body = sign ? trimmed.slice(1) : trimmed;
	const bodyLower = sign ? lower.slice(1) : lower;

	if (base === 2 && bodyLower.startsWith('0b')) return `${sign}${body.slice(2)}`;
	if (base === 8 && bodyLower.startsWith('0o')) return `${sign}${body.slice(2)}`;
	if (base === 16 && bodyLower.startsWith('0x')) return `${sign}${body.slice(2)}`;
	return `${sign}${body}`;
};

const BASE_PATTERN: Record<Base, RegExp> = {
	2: /^[01]+$/,
	8: /^[0-7]+$/,
	10: /^-?[0-9]+$/,
	16: /^[0-9a-fA-F]+$/,
};

/**
 * Parse a text input in `base` to a bigint, returning the unsigned bit pattern
 * inside `width`. Returns `null` when the text cannot be parsed.
 *
 * - Whitespace, underscores, commas, and `0b`/`0o`/`0x` prefixes are stripped.
 * - Negative decimals are accepted when `signedness === 'signed'` and folded
 *   to two's-complement.
 * - Out-of-range inputs are rejected (no silent truncation): for example
 *   `'256'` in 8-bit unsigned returns `null`, and `'-1'` in unsigned mode
 *   returns `null`.
 */
export const parseInBase = (
	text: string,
	base: Base,
	width: BitWidth,
	signedness: Signedness
): bigint | null => {
	const cleaned = stripPrefixesAndSeparators(text, base);
	if (cleaned.length === 0) return null;
	if (!BASE_PATTERN[base].test(cleaned)) return null;
	if (base !== 10 && cleaned.startsWith('-')) return null;

	let value: bigint;
	try {
		value = base === 10 ? BigInt(cleaned) : BigInt(`0${baseRadixPrefix(base)}${cleaned}`);
	} catch {
		return null;
	}

	if (signedness === 'signed') {
		if (value < signedMin(width) || value > signedMax(width)) return null;
	} else {
		if (value < BIGINT_ZERO || value > unsignedMax(width)) return null;
	}

	return toUnsigned(value, width);
};

const baseRadixPrefix = (base: Base): string => {
	if (base === 2) return 'b';
	if (base === 8) return 'o';
	if (base === 16) return 'x';
	return '';
};

const padLengthForBase = (base: Base, width: BitWidth): number => {
	if (base === 2) return width;
	if (base === 8) return Math.ceil(width / 3);
	if (base === 16) return Math.ceil(width / 4);
	return 0;
};

const groupDigits = (digits: string, groupSize: number, separator: string): string => {
	if (groupSize <= 0 || digits.length <= groupSize) return digits;
	const groups: string[] = [];
	for (let i = digits.length; i > 0; i -= groupSize) {
		const start = Math.max(0, i - groupSize);
		groups.unshift(digits.slice(start, i));
	}
	return groups.join(separator);
};

interface FormatOptions {
	readonly group?: boolean;
	readonly uppercase?: boolean;
	readonly pad?: boolean;
}

/**
 * Format a bigint in the requested base with optional grouping / padding.
 *
 * Signed mode prepends `'-'` when the value's signed interpretation is
 * negative for base 10, and shows the unsigned bit pattern for non-10 bases
 * (two's complement is the meaningful view there).
 */
export const formatInBase = (
	value: bigint,
	base: Base,
	width: BitWidth,
	signedness: Signedness,
	opts: FormatOptions = {}
): string => {
	const { group = false, uppercase = false, pad = false } = opts;
	const unsigned = toUnsigned(value, width);

	if (base === 10) {
		const display = signedness === 'signed' ? toSigned(unsigned, width) : unsigned;
		const sign = display < BIGINT_ZERO ? '-' : '';
		const abs = display < BIGINT_ZERO ? -display : display;
		const digits = abs.toString(10);
		return `${sign}${group ? groupDigits(digits, BASE_GROUP_SIZE[10], ',') : digits}`;
	}

	let digits = unsigned.toString(base);
	if (pad) {
		const target = padLengthForBase(base, width);
		if (digits.length < target) digits = digits.padStart(target, '0');
	}
	if (uppercase) digits = digits.toUpperCase();
	if (group) digits = groupDigits(digits, BASE_GROUP_SIZE[base], ' ');
	return digits;
};

// -------------------------------------------------------------------------
// Bitwise operations — all consume / produce unsigned bigints within `width`.
// -------------------------------------------------------------------------

export const bitwiseAnd = (a: bigint, b: bigint, width: BitWidth): bigint =>
	a & b & widthMask(width);

export const bitwiseOr = (a: bigint, b: bigint, width: BitWidth): bigint =>
	(a | b) & widthMask(width);

export const bitwiseXor = (a: bigint, b: bigint, width: BitWidth): bigint =>
	(a ^ b) & widthMask(width);

export const bitwiseNot = (a: bigint, width: BitWidth): bigint => ~a & widthMask(width);

export const shiftLeft = (a: bigint, n: number, width: BitWidth): bigint => {
	if (n <= 0) return a & widthMask(width);
	if (n >= width) return BIGINT_ZERO;
	return (a << BigInt(n)) & widthMask(width);
};

/**
 * Logical / arithmetic right shift on the unsigned bit pattern.
 *
 * - `'unsigned'` performs a logical shift (fills with zeros).
 * - `'signed'` performs an arithmetic shift (replicates the sign bit).
 */
export const shiftRight = (
	a: bigint,
	n: number,
	width: BitWidth,
	signedness: Signedness
): bigint => {
	const masked = a & widthMask(width);
	if (n <= 0) return masked;
	if (signedness === 'unsigned') {
		if (n >= width) return BIGINT_ZERO;
		return masked >> BigInt(n);
	}
	const signed = toSigned(masked, width);
	const shifted = signed >> BigInt(Math.min(n, width));
	return toUnsigned(shifted, width);
};

/** Toggle the bit at `index` (0 = least significant) on the unsigned pattern. */
export const toggleBit = (value: bigint, index: number, width: BitWidth): bigint => {
	if (index < 0 || index >= width) return value;
	return (value ^ (BIGINT_ONE << BigInt(index))) & widthMask(width);
};

/** Population count (Hamming weight) for the lowest `width` bits. */
export const popcount = (value: bigint, width: BitWidth): number => {
	const masked = value & widthMask(width);
	let count = 0;
	let remaining = masked;
	while (remaining > BIGINT_ZERO) {
		if ((remaining & BIGINT_ONE) === BIGINT_ONE) count += 1;
		remaining >>= BIGINT_ONE;
	}
	return count;
};

// -------------------------------------------------------------------------
// IEEE 754 breakdown
// -------------------------------------------------------------------------

export type FloatClassification = 'zero' | 'subnormal' | 'normal' | 'infinity' | 'nan';

export interface IeeeBreakdown {
	readonly width: FloatWidth;
	readonly sign: 0 | 1;
	readonly biasedExponent: number;
	readonly unbiasedExponent: number;
	readonly mantissa: bigint;
	readonly mantissaBits: number;
	readonly exponentBits: number;
	readonly bias: number;
	readonly numericValue: number;
	readonly classification: FloatClassification;
	readonly hexValue: string;
}

const ieeeLayout = (
	width: FloatWidth
): { exponentBits: number; mantissaBits: number; bias: number } => {
	if (width === 32) return { exponentBits: 8, mantissaBits: 23, bias: 127 };
	return { exponentBits: 11, mantissaBits: 52, bias: 1023 };
};

const bitsToFloat = (bits: bigint, width: FloatWidth): number => {
	const buffer = new ArrayBuffer(width / 8);
	const view = new DataView(buffer);
	if (width === 32) {
		view.setUint32(0, Number(bits & 0xffffffffn), false);
		return view.getFloat32(0, false);
	}
	view.setBigUint64(0, bits & 0xffffffffffffffffn, false);
	return view.getFloat64(0, false);
};

/**
 * Convert a numeric float back to its raw IEEE 754 bit pattern. Useful when
 * the user types a decimal float and wants to see the encoded bits.
 */
export const floatToBits = (value: number, width: FloatWidth): bigint => {
	const buffer = new ArrayBuffer(width / 8);
	const view = new DataView(buffer);
	if (width === 32) {
		view.setFloat32(0, value, false);
		return BigInt(view.getUint32(0, false));
	}
	view.setFloat64(0, value, false);
	return view.getBigUint64(0, false);
};

/**
 * Decompose an unsigned bit pattern into IEEE 754 components for the given
 * float width. The bits are interpreted big-endian inside the `width / 8` byte
 * buffer — matching how every common platform stores floats.
 */
export const ieeeBreakdown = (value: bigint, width: FloatWidth): IeeeBreakdown => {
	const { exponentBits, mantissaBits, bias } = ieeeLayout(width);
	const totalBits = BigInt(width);
	const masked = value & (width === 32 ? 0xffffffffn : 0xffffffffffffffffn);

	const sign = (masked >> (totalBits - BIGINT_ONE)) & BIGINT_ONE;
	const exponentMask = (BIGINT_ONE << BigInt(exponentBits)) - BIGINT_ONE;
	const biasedExponent = Number((masked >> BigInt(mantissaBits)) & exponentMask);
	const mantissaMask = (BIGINT_ONE << BigInt(mantissaBits)) - BIGINT_ONE;
	const mantissa = masked & mantissaMask;

	const numericValue = bitsToFloat(masked, width);

	let classification: FloatClassification;
	if (biasedExponent === 0 && mantissa === BIGINT_ZERO) classification = 'zero';
	else if (biasedExponent === 0) classification = 'subnormal';
	else if (biasedExponent === (1 << exponentBits) - 1)
		classification = mantissa === BIGINT_ZERO ? 'infinity' : 'nan';
	else classification = 'normal';

	const hexValue = `0x${masked
		.toString(16)
		.padStart(width / 4, '0')
		.toUpperCase()}`;

	return {
		width,
		sign: sign === BIGINT_ONE ? 1 : 0,
		biasedExponent,
		unbiasedExponent: biasedExponent - bias,
		mantissa,
		mantissaBits,
		exponentBits,
		bias,
		numericValue,
		classification,
		hexValue,
	};
};

// -------------------------------------------------------------------------
// ASCII / Unicode helpers
// -------------------------------------------------------------------------

export interface AsciiInfo {
	readonly codePoint: number;
	readonly glyph: string | null;
	readonly category: 'control' | 'printable' | 'extended';
	readonly name: string;
	readonly printable: boolean;
	readonly controlAbbr?: string;
}

const CONTROL_NAMES: readonly string[] = [
	'NUL (Null)',
	'SOH (Start of Heading)',
	'STX (Start of Text)',
	'ETX (End of Text)',
	'EOT (End of Transmission)',
	'ENQ (Enquiry)',
	'ACK (Acknowledge)',
	'BEL (Bell)',
	'BS (Backspace)',
	'HT (Horizontal Tab)',
	'LF (Line Feed)',
	'VT (Vertical Tab)',
	'FF (Form Feed)',
	'CR (Carriage Return)',
	'SO (Shift Out)',
	'SI (Shift In)',
	'DLE (Data Link Escape)',
	'DC1 (Device Control 1, XON)',
	'DC2 (Device Control 2)',
	'DC3 (Device Control 3, XOFF)',
	'DC4 (Device Control 4)',
	'NAK (Negative Acknowledge)',
	'SYN (Synchronous Idle)',
	'ETB (End of Transmission Block)',
	'CAN (Cancel)',
	'EM (End of Medium)',
	'SUB (Substitute)',
	'ESC (Escape)',
	'FS (File Separator)',
	'GS (Group Separator)',
	'RS (Record Separator)',
	'US (Unit Separator)',
];

const CONTROL_ABBR: readonly string[] = [
	'NUL',
	'SOH',
	'STX',
	'ETX',
	'EOT',
	'ENQ',
	'ACK',
	'BEL',
	'BS',
	'HT',
	'LF',
	'VT',
	'FF',
	'CR',
	'SO',
	'SI',
	'DLE',
	'DC1',
	'DC2',
	'DC3',
	'DC4',
	'NAK',
	'SYN',
	'ETB',
	'CAN',
	'EM',
	'SUB',
	'ESC',
	'FS',
	'GS',
	'RS',
	'US',
];

/**
 * Describe an 8-bit byte value as an ASCII / Latin-1 character.
 *
 * Returns `null` when `width` is not 8 (the inspector only makes sense for
 * single-byte values).
 */
export const asciiInfo = (value: bigint, width: BitWidth): AsciiInfo | null => {
	if (width !== 8) return null;
	const codePoint = Number(value & 0xffn);

	if (codePoint < 0x20) {
		return {
			codePoint,
			glyph: null,
			category: 'control',
			name: CONTROL_NAMES[codePoint] ?? 'Control',
			printable: false,
			controlAbbr: CONTROL_ABBR[codePoint],
		};
	}
	if (codePoint === 0x7f) {
		return {
			codePoint,
			glyph: null,
			category: 'control',
			name: 'DEL (Delete)',
			printable: false,
			controlAbbr: 'DEL',
		};
	}
	if (codePoint < 0x80) {
		return {
			codePoint,
			glyph: String.fromCharCode(codePoint),
			category: 'printable',
			name: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
			printable: true,
		};
	}
	return {
		codePoint,
		glyph: String.fromCharCode(codePoint),
		category: 'extended',
		name: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')} (Latin-1)`,
		printable: true,
	};
};

// -------------------------------------------------------------------------
// Presets
// -------------------------------------------------------------------------

export interface PresetDescriptor {
	readonly id: string;
	readonly label: string;
	readonly compute: (width: BitWidth, signedness: Signedness) => bigint;
	readonly availableFor?: (width: BitWidth, signedness: Signedness) => boolean;
}

const alternatingPattern = (width: BitWidth): bigint => {
	// 0xAA AA AA AA … — the canonical "10101010" pattern, masked to the
	// requested width.
	const byte = 0xaan;
	let result = BIGINT_ZERO;
	for (let i = 0; i < width / 8; i += 1) {
		result = (result << 8n) | byte;
	}
	return result & widthMask(width);
};

export const PRESETS: readonly PresetDescriptor[] = [
	{ id: 'zero', label: 'Zero', compute: () => BIGINT_ZERO },
	{ id: 'one', label: 'One', compute: () => BIGINT_ONE },
	{
		id: 'negative-one',
		label: '-1 (all 1s)',
		compute: (width) => widthMask(width),
		availableFor: (_w, s) => s === 'signed',
	},
	{
		id: 'max',
		label: 'MAX',
		compute: (width, signedness) =>
			signedness === 'signed' ? toUnsigned(signedMax(width), width) : unsignedMax(width),
	},
	{
		id: 'min',
		label: 'MIN',
		compute: (width, signedness) =>
			signedness === 'signed' ? toUnsigned(signedMin(width), width) : BIGINT_ZERO,
	},
	{
		id: 'sign-bit',
		label: 'Sign bit only',
		compute: (width) => signBit(width),
	},
	{
		id: 'all-ones',
		label: 'All 1s',
		compute: (width) => widthMask(width),
	},
	{
		id: 'alternating',
		label: 'Alternating (0xAA…)',
		compute: (width) => alternatingPattern(width),
	},
	{
		id: 'low-nibble',
		label: 'Low nibble (0x0F)',
		compute: () => 0x0fn,
	},
	{
		id: 'high-nibble',
		label: 'High nibble',
		compute: (width) => 0xfn << BigInt(width - 4),
	},
];

/**
 * Common IEEE 754 patterns made available as quick-fill operands. Returned as
 * unsigned bigints; pair them with `bitWidth >= floatWidth` before applying.
 */
export interface FloatPreset {
	readonly id: string;
	readonly label: string;
	readonly bits: bigint;
	readonly width: FloatWidth;
}

export const FLOAT_PRESETS: readonly FloatPreset[] = [
	{ id: 'f32-zero', label: '+0.0 (f32)', bits: 0x00000000n, width: 32 },
	{ id: 'f32-one', label: '1.0 (f32)', bits: 0x3f800000n, width: 32 },
	{ id: 'f32-neg-one', label: '-1.0 (f32)', bits: 0xbf800000n, width: 32 },
	{ id: 'f32-pi', label: 'π (f32)', bits: 0x40490fdbn, width: 32 },
	{ id: 'f32-inf', label: '+Infinity (f32)', bits: 0x7f800000n, width: 32 },
	{ id: 'f32-nan', label: 'NaN (f32)', bits: 0x7fc00000n, width: 32 },
	{ id: 'f64-zero', label: '+0.0 (f64)', bits: 0x0000000000000000n, width: 64 },
	{ id: 'f64-one', label: '1.0 (f64)', bits: 0x3ff0000000000000n, width: 64 },
	{ id: 'f64-pi', label: 'π (f64)', bits: 0x400921fb54442d18n, width: 64 },
	{ id: 'f64-e', label: 'e (f64)', bits: 0x4005bf0a8b145769n, width: 64 },
];
