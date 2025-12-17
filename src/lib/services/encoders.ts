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

/**
 * Encode text to Base64 (UTF-8 safe).
 */
export const encodeToBase64 = (text: string): string => {
	const bytes = new TextEncoder().encode(text);
	const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
	return globalThis.btoa(binary);
};

/**
 * Decode Base64 to text (UTF-8 safe).
 */
export const decodeFromBase64 = (base64: string): string => {
	const binary = globalThis.atob(base64);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
};

/**
 * Validate Base64 string.
 */
export const validateBase64 = (input: string): { valid: boolean; error?: string } => {
	if (!input.trim()) {
		return { valid: false, error: 'Empty input' };
	}

	// Check for valid Base64 characters
	const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
	if (!base64Regex.test(input.replace(/\s/g, ''))) {
		return { valid: false, error: 'Invalid Base64 characters' };
	}

	try {
		decodeFromBase64(input);
		return { valid: true };
	} catch {
		return { valid: false, error: 'Invalid Base64 encoding' };
	}
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
	const [header, data] = dataUrl.split(',');
	const mimeMatch = header.match(/data:([^;]+)/);
	const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
	const binary = globalThis.atob(data);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new Blob([bytes], { type: mime });
};

// ============================================================================
// URL Encoder/Decoder
// ============================================================================

export type UrlEncodeMode = 'component' | 'uri';

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
		params.forEach(({ key, value }) => {
			if (key.trim()) {
				url.searchParams.append(key, value);
			}
		});
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
			.map((c) => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
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

	try {
		const header = JSON.parse(base64UrlDecode(parts[0])) as JwtHeader;
		const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
		const signature = parts[2];

		const now = Date.now() / 1000;
		const isExpired = payload.exp ? payload.exp < now : false;

		return {
			header,
			payload,
			signature,
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
export const generateFileHash = async (file: File, algorithm: HashAlgorithm): Promise<string> => {
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
export const generateAllFileHashes = async (file: File): Promise<HashResult[]> => {
	const results: HashResult[] = [];

	for (const { algorithm, bits } of HASH_ALGORITHMS) {
		const hash = await generateFileHash(file, algorithm);
		results.push({ algorithm, hash, bits });
	}

	return results;
};

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
