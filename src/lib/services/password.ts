/**
 * Password generation service.
 * Uses Web Crypto (`crypto.getRandomValues`) for entropy.
 * Pure functions for character pool construction and entropy estimation;
 * the random draw is the only impure boundary.
 */

const LOWERCASE_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBER_CHARS = '0123456789';
const SYMBOL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

// Visually similar characters that are easy to misread on common fonts.
const SIMILAR_CHARS = '0OoIl1|';
// Characters that are structurally ambiguous in shells, regex, or quoted contexts.
const AMBIGUOUS_CHARS = '{}[]()/\\\'"`~,;:.<>';

export interface PasswordOptions {
	readonly length: number;
	readonly lowercase: boolean;
	readonly uppercase: boolean;
	readonly numbers: boolean;
	readonly symbols: boolean;
	readonly excludeSimilar: boolean;
	readonly excludeAmbiguous: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
	length: 16,
	lowercase: true,
	uppercase: true,
	numbers: true,
	symbols: true,
	excludeSimilar: false,
	excludeAmbiguous: false,
};

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;
export const MIN_COUNT = 1;
export const MAX_COUNT = 20;
export const DEFAULT_COUNT = 1;

export const buildCharacterPool = (options: PasswordOptions): string => {
	const parts = [
		options.lowercase ? LOWERCASE_CHARS : '',
		options.uppercase ? UPPERCASE_CHARS : '',
		options.numbers ? NUMBER_CHARS : '',
		options.symbols ? SYMBOL_CHARS : '',
	];
	const base = parts.join('');
	return [...base]
		.filter((c) => !options.excludeSimilar || !SIMILAR_CHARS.includes(c))
		.filter((c) => !options.excludeAmbiguous || !AMBIGUOUS_CHARS.includes(c))
		.join('');
};

export const generatePassword = (options: PasswordOptions): string => {
	if (options.length < MIN_LENGTH || options.length > MAX_LENGTH) {
		throw new Error(`Length must be between ${MIN_LENGTH} and ${MAX_LENGTH}`);
	}
	const pool = buildCharacterPool(options);
	if (pool.length === 0) {
		throw new Error('At least one character class must be selected');
	}
	const buffer = new Uint32Array(options.length);
	crypto.getRandomValues(buffer);
	// Modulo bias is negligible for password pools (<128 chars) drawn from a
	// 2^32 range; cryptographic guidance accepts it for password generation.
	return Array.from(buffer, (value) => pool[value % pool.length] ?? '').join('');
};

export const generatePasswords = (options: PasswordOptions, count: number): readonly string[] => {
	if (count < MIN_COUNT || count > MAX_COUNT) {
		throw new Error(`Count must be between ${MIN_COUNT} and ${MAX_COUNT}`);
	}
	return Array.from({ length: count }, () => generatePassword(options));
};

export const calculateEntropy = (length: number, poolSize: number): number => {
	if (poolSize <= 1 || length <= 0) return 0;
	return Math.log2(poolSize) * length;
};

export type StrengthLabel = 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong';

export interface StrengthInfo {
	readonly id: StrengthLabel;
	readonly label: string;
	readonly tone: 'destructive' | 'warning' | 'info' | 'success';
}

interface StrengthBreakpoint {
	readonly threshold: number;
	readonly info: StrengthInfo;
}

// Thresholds align with NIST guidance: <28 trivial, ≥60 strong against offline attacks.
const STRENGTH_BREAKPOINTS: readonly StrengthBreakpoint[] = [
	{ threshold: 28, info: { id: 'very-weak', label: 'Very weak', tone: 'destructive' } },
	{ threshold: 36, info: { id: 'weak', label: 'Weak', tone: 'destructive' } },
	{ threshold: 60, info: { id: 'fair', label: 'Fair', tone: 'warning' } },
	{ threshold: 128, info: { id: 'strong', label: 'Strong', tone: 'success' } },
];

const VERY_STRONG: StrengthInfo = { id: 'very-strong', label: 'Very strong', tone: 'success' };

export const classifyEntropy = (entropy: number): StrengthInfo =>
	STRENGTH_BREAKPOINTS.find((bp) => entropy < bp.threshold)?.info ?? VERY_STRONG;
