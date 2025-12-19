/**
 * Encoder/Decoder services for Base64, URL, JWT, and Hash operations.
 */
import CryptoJS from 'crypto-js';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes to human-readable size.
 */
export const formatBytes = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ============================================================================
// Base64 Encoder/Decoder
// ============================================================================

/** Base64 encoding variant */
export type Base64Variant = 'standard' | 'url-safe';

/** Line break options for Base64 output */
export type Base64LineBreak = 'none' | '64' | '76';

/** Base64 encoding options */
export interface Base64EncodeOptions {
	/** Encoding variant: standard (+/) or url-safe (-_) */
	variant: Base64Variant;
	/** Add padding (=) characters */
	padding: boolean;
	/** Line break interval */
	lineBreak: Base64LineBreak;
	/** Output as Data URL with MIME type */
	dataUrl: boolean;
	/** MIME type for Data URL */
	mimeType: string;
}

/** Base64 decoding options */
export interface Base64DecodeOptions {
	/** Ignore whitespace characters */
	ignoreWhitespace: boolean;
	/** Ignore invalid characters instead of throwing error */
	ignoreInvalidChars: boolean;
	/** Auto-detect URL-safe variant */
	autoDetectVariant: boolean;
}

/** Default Base64 encoding options */
export const defaultBase64EncodeOptions: Base64EncodeOptions = {
	variant: 'standard',
	padding: true,
	lineBreak: 'none',
	dataUrl: false,
	mimeType: 'text/plain',
};

/** Default Base64 decoding options */
export const defaultBase64DecodeOptions: Base64DecodeOptions = {
	ignoreWhitespace: true,
	ignoreInvalidChars: false,
	autoDetectVariant: true,
};

/** Common MIME types for Data URL */
export const BASE64_MIME_TYPES = [
	{ value: 'text/plain', label: 'Text (text/plain)' },
	{ value: 'text/html', label: 'HTML (text/html)' },
	{ value: 'text/css', label: 'CSS (text/css)' },
	{ value: 'text/javascript', label: 'JavaScript (text/javascript)' },
	{ value: 'application/json', label: 'JSON (application/json)' },
	{ value: 'application/xml', label: 'XML (application/xml)' },
	{ value: 'image/png', label: 'PNG Image (image/png)' },
	{ value: 'image/jpeg', label: 'JPEG Image (image/jpeg)' },
	{ value: 'image/gif', label: 'GIF Image (image/gif)' },
	{ value: 'image/svg+xml', label: 'SVG Image (image/svg+xml)' },
	{ value: 'application/pdf', label: 'PDF (application/pdf)' },
	{ value: 'application/octet-stream', label: 'Binary (application/octet-stream)' },
] as const;

/**
 * Encode text to Base64 with options.
 */
export const encodeToBase64 = (
	text: string,
	options: Partial<Base64EncodeOptions> = {}
): string => {
	const opts = { ...defaultBase64EncodeOptions, ...options };

	// Encode to bytes
	const bytes = new TextEncoder().encode(text);
	const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

	// Standard Base64 encoding
	let result = globalThis.btoa(binary);

	// Convert to URL-safe variant if needed
	if (opts.variant === 'url-safe') {
		result = result.replace(/\+/g, '-').replace(/\//g, '_');
	}

	// Remove padding if not wanted
	if (!opts.padding) {
		result = result.replace(/=+$/, '');
	}

	// Add line breaks if specified
	if (opts.lineBreak !== 'none') {
		const lineLength = opts.lineBreak === '64' ? 64 : 76;
		result = result.match(new RegExp(`.{1,${lineLength}}`, 'g'))?.join('\n') ?? result;
	}

	// Wrap as Data URL if requested
	if (opts.dataUrl) {
		result = `data:${opts.mimeType};base64,${result.replace(/\n/g, '')}`;
	}

	return result;
};

/**
 * Decode Base64 to text with options.
 */
export const decodeFromBase64 = (
	base64: string,
	options: Partial<Base64DecodeOptions> = {}
): string => {
	const opts = { ...defaultBase64DecodeOptions, ...options };

	let input = base64;

	// Handle Data URL
	if (input.startsWith('data:')) {
		const commaIndex = input.indexOf(',');
		if (commaIndex !== -1) {
			input = input.slice(commaIndex + 1);
		}
	}

	// Remove whitespace if option is set
	if (opts.ignoreWhitespace) {
		input = input.replace(/\s/g, '');
	}

	// Auto-detect and convert URL-safe variant
	if (opts.autoDetectVariant) {
		if (input.includes('-') || input.includes('_')) {
			input = input.replace(/-/g, '+').replace(/_/g, '/');
		}
	}

	// Remove invalid characters if option is set
	if (opts.ignoreInvalidChars) {
		input = input.replace(/[^A-Za-z0-9+/=]/g, '');
	}

	// Add padding if missing
	const padding = input.length % 4;
	if (padding) {
		input += '='.repeat(4 - padding);
	}

	const binary = globalThis.atob(input);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
};

/**
 * Validate Base64 string with options.
 */
export const validateBase64 = (
	input: string,
	options: Partial<Base64DecodeOptions> = {}
): { valid: boolean; error?: string } => {
	if (!input.trim()) {
		return { valid: false, error: 'Empty input' };
	}

	const opts = { ...defaultBase64DecodeOptions, ...options };
	let cleanInput = input;

	// Handle Data URL
	if (cleanInput.startsWith('data:')) {
		const commaIndex = cleanInput.indexOf(',');
		if (commaIndex !== -1) {
			cleanInput = cleanInput.slice(commaIndex + 1);
		}
	}

	// Remove whitespace if option is set
	if (opts.ignoreWhitespace) {
		cleanInput = cleanInput.replace(/\s/g, '');
	}

	// Check for valid Base64 characters (including URL-safe)
	const base64Regex = opts.autoDetectVariant
		? /^[A-Za-z0-9+/\-_]*={0,2}$/
		: /^[A-Za-z0-9+/]*={0,2}$/;

	if (!base64Regex.test(cleanInput)) {
		return { valid: false, error: 'Invalid Base64 characters' };
	}

	try {
		decodeFromBase64(input, options);
		return { valid: true };
	} catch {
		return { valid: false, error: 'Invalid Base64 encoding' };
	}
};

/**
 * Detect Base64 variant from input.
 */
export const detectBase64Variant = (input: string): Base64Variant => {
	const cleanInput = input.replace(/\s/g, '');
	if (cleanInput.includes('-') || cleanInput.includes('_')) {
		return 'url-safe';
	}
	return 'standard';
};

/**
 * Check if input is a Data URL.
 */
export const isDataUrl = (input: string): boolean => {
	return input.trim().startsWith('data:');
};

/**
 * Extract MIME type from Data URL.
 */
export const extractMimeType = (dataUrl: string): string | null => {
	const match = dataUrl.match(/^data:([^;,]+)/);
	return match?.[1] ?? null;
};

export interface Base64Stats {
	inputChars: number;
	inputBytes: number;
	outputChars: number;
	outputBytes: number;
	ratio: string;
}

/**
 * Calculate Base64 encoding statistics.
 */
export const calculateBase64Stats = (input: string, output: string): Base64Stats => {
	const inputBytes = new TextEncoder().encode(input).length;
	const outputBytes = new TextEncoder().encode(output).length;
	const ratio = inputBytes > 0 ? ((outputBytes / inputBytes) * 100).toFixed(1) : '0';

	return {
		inputChars: input.length,
		inputBytes,
		outputChars: output.length,
		outputBytes,
		ratio: `${ratio}%`,
	};
};

/**
 * Convert file to Base64 data URL.
 */
export const fileToBase64 = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsDataURL(file);
	});
};

/**
 * Convert Base64 data URL to Blob for download.
 */
export const base64ToBlob = (dataUrl: string): Blob => {
	const parts = dataUrl.split(',');
	const header = parts[0] ?? '';
	const data = parts[1] ?? '';
	const mimeMatch = header.match(/data:([^;]+)/);
	const mime = mimeMatch?.[1] ?? 'application/octet-stream';
	const binary = globalThis.atob(data);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new Blob([bytes], { type: mime });
};

// ============================================================================
// URL Encoder/Decoder
// ============================================================================

export type UrlEncodeMode = 'component' | 'uri' | 'form' | 'path' | 'custom';

/** Space encoding method */
export type UrlSpaceEncoding = 'percent' | 'plus';

/** Case for percent-encoded hex digits */
export type UrlHexCase = 'upper' | 'lower';

/** How to handle newlines */
export type UrlNewlineHandling = 'encode' | 'crlf' | 'lf' | 'remove';

/** How to handle invalid sequences when decoding */
export type UrlInvalidHandling = 'error' | 'skip' | 'keep';

/** URL encoding options */
export interface UrlEncodeOptions {
	/** Encoding mode */
	mode: UrlEncodeMode;
	/** How to encode spaces */
	spaceEncoding: UrlSpaceEncoding;
	/** Case for hex digits (%2F vs %2f) */
	hexCase: UrlHexCase;
	/** How to handle newlines */
	newlineHandling: UrlNewlineHandling;
	/** Characters to preserve (not encode) - only for custom mode */
	preserveChars: string;
	/** Encode non-ASCII characters */
	encodeNonAscii: boolean;
}

/** URL decoding options */
export interface UrlDecodeOptions {
	/** Treat + as space */
	plusAsSpace: boolean;
	/** How to handle invalid percent sequences */
	invalidHandling: UrlInvalidHandling;
	/** Decode multiple times if double-encoded */
	decodeMultiple: boolean;
	/** Maximum decode iterations (for decodeMultiple) */
	maxIterations: number;
}

/** Default URL encoding options */
export const defaultUrlEncodeOptions: UrlEncodeOptions = {
	mode: 'component',
	spaceEncoding: 'percent',
	hexCase: 'upper',
	newlineHandling: 'encode',
	preserveChars: '',
	encodeNonAscii: true,
};

/** Default URL decoding options */
export const defaultUrlDecodeOptions: UrlDecodeOptions = {
	plusAsSpace: false,
	invalidHandling: 'error',
	decodeMultiple: false,
	maxIterations: 5,
};

/** Characters preserved by each encoding mode */
export const URL_MODE_PRESERVED_CHARS: Record<UrlEncodeMode, string> = {
	component: '', // encodeURIComponent preserves: A-Za-z0-9-_.!~*'()
	uri: ';,/?:@&=+$#', // encodeURI also preserves these
	form: '', // application/x-www-form-urlencoded (+ for space)
	path: '/', // Path segment encoding
	custom: '', // User-defined
};

/** RFC 3986 unreserved characters (always safe) */
export const RFC3986_UNRESERVED =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * Encode string for URL with options.
 */
export const encodeUrlWithOptions = (
	text: string,
	options: Partial<UrlEncodeOptions> = {}
): string => {
	const opts = { ...defaultUrlEncodeOptions, ...options };
	let input = text;

	// Handle newlines first
	switch (opts.newlineHandling) {
		case 'crlf':
			input = input.replace(/\r?\n/g, '\r\n');
			break;
		case 'lf':
			input = input.replace(/\r\n/g, '\n');
			break;
		case 'remove':
			input = input.replace(/\r?\n/g, '');
			break;
		// 'encode' - leave as-is, will be percent-encoded
	}

	let result: string;

	switch (opts.mode) {
		case 'component':
			result = encodeURIComponent(input);
			break;
		case 'uri':
			result = encodeURI(input);
			break;
		case 'form':
			// application/x-www-form-urlencoded
			result = encodeURIComponent(input).replace(/%20/g, '+');
			break;
		case 'path':
			// Encode but preserve /
			result = input
				.split('/')
				.map((segment) => encodeURIComponent(segment))
				.join('/');
			break;
		case 'custom':
			// Custom encoding with preserved characters
			result = customUrlEncode(input, opts.preserveChars, opts.encodeNonAscii);
			break;
		default:
			result = encodeURIComponent(input);
	}

	// Apply space encoding preference (only if not form mode which already uses +)
	if (opts.mode !== 'form') {
		if (opts.spaceEncoding === 'plus') {
			result = result.replace(/%20/g, '+');
		}
	}

	// Apply hex case preference
	if (opts.hexCase === 'lower') {
		result = result.replace(/%[0-9A-F]{2}/g, (match) => match.toLowerCase());
	} else {
		result = result.replace(/%[0-9a-f]{2}/g, (match) => match.toUpperCase());
	}

	return result;
};

/**
 * Custom URL encoding with specified preserved characters.
 */
const customUrlEncode = (text: string, preserveChars: string, encodeNonAscii: boolean): string => {
	const safeChars = new Set([...RFC3986_UNRESERVED, ...preserveChars]);
	let result = '';

	for (const char of text) {
		const code = char.charCodeAt(0);

		if (safeChars.has(char)) {
			result += char;
		} else if (code > 127 && !encodeNonAscii) {
			result += char;
		} else {
			// Encode the character
			const bytes = new TextEncoder().encode(char);
			for (const byte of bytes) {
				result += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
			}
		}
	}

	return result;
};

/**
 * Decode URL-encoded string with options.
 */
export const decodeUrlWithOptions = (
	text: string,
	options: Partial<UrlDecodeOptions> = {}
): string => {
	const opts = { ...defaultUrlDecodeOptions, ...options };
	let input = text;

	// Replace + with space if option is set
	if (opts.plusAsSpace) {
		input = input.replace(/\+/g, ' ');
	}

	// Handle invalid sequences based on option
	if (opts.invalidHandling !== 'error') {
		input = sanitizePercentEncoding(input, opts.invalidHandling);
	}

	let result: string;
	try {
		result = decodeURIComponent(input);
	} catch {
		if (opts.invalidHandling === 'error') {
			throw new Error('Invalid percent-encoded sequence');
		}
		// If sanitization didn't help, return as-is
		result = input;
	}

	// Decode multiple times if option is set
	if (opts.decodeMultiple) {
		let iterations = 0;
		let prev = result;
		while (iterations < opts.maxIterations) {
			// Check if there are still percent-encoded sequences
			if (!/%[0-9A-Fa-f]{2}/.test(result)) {
				break;
			}

			try {
				let decoded = result;
				if (opts.plusAsSpace) {
					decoded = decoded.replace(/\+/g, ' ');
				}
				result = decodeURIComponent(decoded);
			} catch {
				break;
			}

			if (result === prev) {
				break;
			}
			prev = result;
			iterations++;
		}
	}

	return result;
};

/**
 * Sanitize invalid percent-encoded sequences.
 */
const sanitizePercentEncoding = (text: string, handling: 'skip' | 'keep'): string => {
	// Match valid percent-encoded sequences or standalone %
	return text.replace(/%([0-9A-Fa-f]{2})?/g, (match, hex) => {
		if (hex) {
			return match; // Valid sequence, keep it
		}
		// Invalid % not followed by two hex digits
		return handling === 'skip' ? '' : '%25'; // Convert to %25 (encoded %)
	});
};

/**
 * Check if text appears to be double-encoded.
 */
export const isDoubleEncoded = (text: string): boolean => {
	// Look for patterns like %25XX (encoded %)
	return /%25[0-9A-Fa-f]{2}/.test(text);
};

/**
 * Count encoding depth (how many times text has been encoded).
 */
export const getEncodingDepth = (text: string): number => {
	let depth = 0;
	let current = text;

	while (/%[0-9A-Fa-f]{2}/.test(current) && depth < 10) {
		try {
			const decoded = decodeURIComponent(current);
			if (decoded === current) break;
			current = decoded;
			depth++;
		} catch {
			break;
		}
	}

	return depth;
};

// Legacy functions for backward compatibility
/**
 * Encode string for URL (encodeURIComponent mode).
 */
export const encodeUrlComponent = (text: string): string => encodeURIComponent(text);

/**
 * Decode URL-encoded string (decodeURIComponent mode).
 */
export const decodeUrlComponent = (text: string): string => decodeURIComponent(text);

/**
 * Encode string for URL (encodeURI mode - preserves URL structure).
 */
export const encodeUrl = (text: string): string => encodeURI(text);

/**
 * Decode URL-encoded string (decodeURI mode).
 */
export const decodeUrl = (text: string): string => decodeURI(text);

export interface UrlComponents {
	protocol: string;
	hostname: string;
	port: string;
	pathname: string;
	search: string;
	hash: string;
	origin: string;
	username: string;
	password: string;
}

export interface QueryParameter {
	key: string;
	value: string;
}

/**
 * Parse URL into components.
 */
export const parseUrl = (
	urlString: string
): { components: UrlComponents; params: QueryParameter[] } | null => {
	try {
		const url = new URL(urlString);
		const params: QueryParameter[] = [];
		url.searchParams.forEach((value, key) => {
			params.push({ key, value });
		});

		return {
			components: {
				protocol: url.protocol,
				hostname: url.hostname,
				port: url.port,
				pathname: url.pathname,
				search: url.search,
				hash: url.hash,
				origin: url.origin,
				username: url.username,
				password: url.password,
			},
			params,
		};
	} catch {
		return null;
	}
};

/**
 * Build URL from base URL and parameters.
 */
export const buildUrl = (baseUrl: string, params: QueryParameter[]): string => {
	try {
		const url = new URL(baseUrl);
		url.search = '';
		params
			.filter(({ key }) => key.trim())
			.forEach(({ key, value }) => url.searchParams.append(key, value));
		return url.toString();
	} catch {
		return baseUrl;
	}
};

/**
 * Common URL encoding reference examples.
 */
export const URL_ENCODING_EXAMPLES: { char: string; encoded: string; description: string }[] = [
	{ char: ' ', encoded: '%20', description: 'Space' },
	{ char: '!', encoded: '%21', description: 'Exclamation mark' },
	{ char: '#', encoded: '%23', description: 'Hash' },
	{ char: '$', encoded: '%24', description: 'Dollar sign' },
	{ char: '%', encoded: '%25', description: 'Percent sign' },
	{ char: '&', encoded: '%26', description: 'Ampersand' },
	{ char: "'", encoded: '%27', description: 'Single quote' },
	{ char: '(', encoded: '%28', description: 'Opening parenthesis' },
	{ char: ')', encoded: '%29', description: 'Closing parenthesis' },
	{ char: '*', encoded: '%2A', description: 'Asterisk' },
	{ char: '+', encoded: '%2B', description: 'Plus sign' },
	{ char: ',', encoded: '%2C', description: 'Comma' },
	{ char: '/', encoded: '%2F', description: 'Forward slash' },
	{ char: ':', encoded: '%3A', description: 'Colon' },
	{ char: ';', encoded: '%3B', description: 'Semicolon' },
	{ char: '=', encoded: '%3D', description: 'Equals sign' },
	{ char: '?', encoded: '%3F', description: 'Question mark' },
	{ char: '@', encoded: '%40', description: 'At sign' },
	{ char: '[', encoded: '%5B', description: 'Opening bracket' },
	{ char: ']', encoded: '%5D', description: 'Closing bracket' },
];

// ============================================================================
// JWT Decoder
// ============================================================================

export interface JwtHeader {
	alg?: string;
	typ?: string;
	[key: string]: unknown;
}

export interface JwtPayload {
	iss?: string;
	sub?: string;
	aud?: string | string[];
	exp?: number;
	nbf?: number;
	iat?: number;
	jti?: string;
	[key: string]: unknown;
}

export interface JwtDecoded {
	header: JwtHeader;
	payload: JwtPayload;
	signature: string;
	isExpired: boolean;
	expiresAt?: Date;
	issuedAt?: Date;
	notBefore?: Date;
}

/**
 * Decode Base64URL to string.
 */
export const base64UrlDecode = (str: string): string => {
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const padding = base64.length % 4;
	const paddedBase64 = padding ? `${base64}${'='.repeat(4 - padding)}` : base64;

	return decodeURIComponent(
		globalThis
			.atob(paddedBase64)
			.split('')
			.map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
			.join('')
	);
};

/**
 * Decode JWT token.
 */
export const decodeJwt = (token: string): JwtDecoded | null => {
	const parts = token.trim().split('.');
	if (parts.length !== 3) {
		return null;
	}

	const headerPart = parts[0];
	const payloadPart = parts[1];
	const signaturePart = parts[2];

	if (!headerPart || !payloadPart || !signaturePart) {
		return null;
	}

	try {
		const header = JSON.parse(base64UrlDecode(headerPart)) as JwtHeader;
		const payload = JSON.parse(base64UrlDecode(payloadPart)) as JwtPayload;

		const now = Date.now() / 1000;
		const isExpired = payload.exp ? payload.exp < now : false;

		return {
			header,
			payload,
			signature: signaturePart,
			isExpired,
			expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
			issuedAt: payload.iat ? new Date(payload.iat * 1000) : undefined,
			notBefore: payload.nbf ? new Date(payload.nbf * 1000) : undefined,
		};
	} catch {
		return null;
	}
};

/**
 * Validate JWT format.
 */
export const validateJwt = (input: string): { valid: boolean; error?: string } => {
	if (!input.trim()) {
		return { valid: false, error: 'Empty input' };
	}

	const parts = input.trim().split('.');
	if (parts.length !== 3) {
		return { valid: false, error: 'JWT must have 3 parts separated by dots' };
	}

	const decoded = decodeJwt(input);
	if (!decoded) {
		return { valid: false, error: 'Invalid JWT encoding' };
	}

	return { valid: true };
};

/**
 * JWT standard claims descriptions.
 */
export const JWT_STANDARD_CLAIMS: { claim: string; name: string; description: string }[] = [
	{ claim: 'iss', name: 'Issuer', description: 'Principal that issued the JWT' },
	{ claim: 'sub', name: 'Subject', description: 'Subject of the JWT' },
	{ claim: 'aud', name: 'Audience', description: 'Recipients the JWT is intended for' },
	{ claim: 'exp', name: 'Expiration Time', description: 'Time after which the JWT expires' },
	{ claim: 'nbf', name: 'Not Before', description: 'Time before which the JWT is not valid' },
	{ claim: 'iat', name: 'Issued At', description: 'Time at which the JWT was issued' },
	{ claim: 'jti', name: 'JWT ID', description: 'Unique identifier for the JWT' },
];

// ============================================================================
// Hash Generator
// ============================================================================

export type HashAlgorithm = 'MD5' | 'SHA1' | 'SHA224' | 'SHA256' | 'SHA384' | 'SHA512';

export interface HashResult {
	algorithm: HashAlgorithm;
	hash: string;
	bits: number;
}

/**
 * Hash algorithms with their bit lengths.
 */
export const HASH_ALGORITHMS: { algorithm: HashAlgorithm; bits: number; secure: boolean }[] = [
	{ algorithm: 'MD5', bits: 128, secure: false },
	{ algorithm: 'SHA1', bits: 160, secure: false },
	{ algorithm: 'SHA224', bits: 224, secure: true },
	{ algorithm: 'SHA256', bits: 256, secure: true },
	{ algorithm: 'SHA384', bits: 384, secure: true },
	{ algorithm: 'SHA512', bits: 512, secure: true },
];

/**
 * Generate hash for text using specified algorithm.
 */
export const generateHash = (text: string, algorithm: HashAlgorithm): string => {
	switch (algorithm) {
		case 'MD5':
			return CryptoJS.MD5(text).toString();
		case 'SHA1':
			return CryptoJS.SHA1(text).toString();
		case 'SHA224':
			return CryptoJS.SHA224(text).toString();
		case 'SHA256':
			return CryptoJS.SHA256(text).toString();
		case 'SHA384':
			return CryptoJS.SHA384(text).toString();
		case 'SHA512':
			return CryptoJS.SHA512(text).toString();
		default:
			throw new Error(`Unknown algorithm: ${algorithm}`);
	}
};

/**
 * Generate all hashes for text.
 */
export const generateAllHashes = (text: string): HashResult[] => {
	return HASH_ALGORITHMS.map(({ algorithm, bits }) => ({
		algorithm,
		hash: generateHash(text, algorithm),
		bits,
	}));
};

/**
 * Generate hash for file using specified algorithm.
 */
export const generateFileHash = (file: File, algorithm: HashAlgorithm): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const wordArray = CryptoJS.lib.WordArray.create(reader.result as ArrayBuffer);
			let hash: string;

			switch (algorithm) {
				case 'MD5':
					hash = CryptoJS.MD5(wordArray).toString();
					break;
				case 'SHA1':
					hash = CryptoJS.SHA1(wordArray).toString();
					break;
				case 'SHA224':
					hash = CryptoJS.SHA224(wordArray).toString();
					break;
				case 'SHA256':
					hash = CryptoJS.SHA256(wordArray).toString();
					break;
				case 'SHA384':
					hash = CryptoJS.SHA384(wordArray).toString();
					break;
				case 'SHA512':
					hash = CryptoJS.SHA512(wordArray).toString();
					break;
				default:
					reject(new Error(`Unknown algorithm: ${algorithm}`));
					return;
			}

			resolve(hash);
		};
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsArrayBuffer(file);
	});
};

/**
 * Generate all hashes for file.
 */
export const generateAllFileHashes = async (file: File): Promise<HashResult[]> =>
	Promise.all(
		HASH_ALGORITHMS.map(async ({ algorithm, bits }) => ({
			algorithm,
			hash: await generateFileHash(file, algorithm),
			bits,
		}))
	);

/**
 * Compare two hash values (case-insensitive).
 */
export const compareHashes = (hash1: string, hash2: string): boolean => {
	return hash1.toLowerCase().trim() === hash2.toLowerCase().trim();
};

// ============================================================================
// Sample Data
// ============================================================================

export const SAMPLE_TEXT_FOR_BASE64 = `Hello, World!
This is a sample text for Base64 encoding.
日本語のテキストもサポートしています。
Special characters: !@#$%^&*()_+-=[]{}|;':",.<>?`;

export const SAMPLE_URL = 'https://example.com/path/to/page?query=hello world&name=テスト#section';

export const SAMPLE_JWT =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';

export const SAMPLE_TEXT_FOR_HASH = 'Hello, World!';
