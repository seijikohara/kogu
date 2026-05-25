/**
 * URL encoder/decoder service.
 */

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

	// 1. Apply the newline-handling normalization.
	const normalized = ((): string => {
		switch (opts.newlineHandling) {
			case 'crlf':
				return text.replace(/\r?\n/g, '\r\n');
			case 'lf':
				return text.replace(/\r\n/g, '\n');
			case 'remove':
				return text.replace(/\r?\n/g, '');
			default:
				// 'encode' - leave as-is, will be percent-encoded
				return text;
		}
	})();

	// 2. Encode per the selected mode.
	const encoded = ((): string => {
		switch (opts.mode) {
			case 'component':
				return encodeURIComponent(normalized);
			case 'uri':
				return encodeURI(normalized);
			case 'form':
				// application/x-www-form-urlencoded
				return encodeURIComponent(normalized).replace(/%20/g, '+');
			case 'path':
				// Encode but preserve /
				return normalized
					.split('/')
					.map((segment) => encodeURIComponent(segment))
					.join('/');
			case 'custom':
				// Custom encoding with preserved characters
				return customUrlEncode(normalized, opts.preserveChars, opts.encodeNonAscii);
			default:
				return encodeURIComponent(normalized);
		}
	})();

	// 3. Apply space encoding preference (form mode already uses '+').
	const spaceAdjusted =
		opts.mode !== 'form' && opts.spaceEncoding === 'plus' ? encoded.replace(/%20/g, '+') : encoded;

	// 4. Apply hex case preference.
	return opts.hexCase === 'lower'
		? spaceAdjusted.replace(/%[0-9A-F]{2}/g, (match) => match.toLowerCase())
		: spaceAdjusted.replace(/%[0-9a-f]{2}/g, (match) => match.toUpperCase());
};

/**
 * Custom URL encoding with specified preserved characters.
 */
const customUrlEncode = (text: string, preserveChars: string, encodeNonAscii: boolean): string => {
	const safeChars = new Set([...RFC3986_UNRESERVED, ...preserveChars]);

	// Encode each Unicode code point and join the resulting fragments. Array
	// spread iterates by code point (not UTF-16 code unit), matching the
	// original for..of behavior.
	return [...text]
		.map((char) => {
			const code = char.charCodeAt(0);
			if (safeChars.has(char)) return char;
			if (code > 127 && !encodeNonAscii) return char;
			// Encode the character byte-by-byte as %HH.
			const bytes = new TextEncoder().encode(char);
			return Array.from(
				bytes,
				(byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
			).join('');
		})
		.join('');
};

/**
 * Decode URL-encoded string with options.
 */
export const decodeUrlWithOptions = (
	text: string,
	options: Partial<UrlDecodeOptions> = {}
): string => {
	const opts = { ...defaultUrlDecodeOptions, ...options };

	// 1. Optional + -> space.
	const plusReplaced = opts.plusAsSpace ? text.replace(/\+/g, ' ') : text;
	// 2. Optional sanitization of invalid percent escapes.
	const sanitized =
		opts.invalidHandling !== 'error'
			? sanitizePercentEncoding(plusReplaced, opts.invalidHandling)
			: plusReplaced;

	// 3. First decode pass; on failure, either throw (error mode) or fall back to the sanitized input.
	const firstPass = ((): string => {
		try {
			return decodeURIComponent(sanitized);
		} catch {
			if (opts.invalidHandling === 'error') {
				throw new Error('Invalid percent-encoded sequence');
			}
			return sanitized;
		}
	})();

	if (!opts.decodeMultiple) return firstPass;

	// 4. Multi-pass decoding: repeatedly decode while there's still escaped
	// content. The cursor object holds the rolling result plus the previous
	// value (used to detect a fixed point) and the iteration counter.
	const cursor = { result: firstPass, prev: firstPass, iterations: 0 };
	while (cursor.iterations < opts.maxIterations) {
		if (!/%[0-9A-Fa-f]{2}/.test(cursor.result)) break;
		try {
			const candidate = opts.plusAsSpace ? cursor.result.replace(/\+/g, ' ') : cursor.result;
			cursor.result = decodeURIComponent(candidate);
		} catch {
			break;
		}
		if (cursor.result === cursor.prev) break;
		cursor.prev = cursor.result;
		cursor.iterations += 1;
	}
	return cursor.result;
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
	// Peel one percent-decoding layer at a time, tracking depth in a const
	// cursor so we can stop at 10 iterations or when the value stabilizes.
	const cursor = { depth: 0, current: text };
	while (/%[0-9A-Fa-f]{2}/.test(cursor.current) && cursor.depth < 10) {
		try {
			const decoded = decodeURIComponent(cursor.current);
			if (decoded === cursor.current) break;
			cursor.current = decoded;
			cursor.depth += 1;
		} catch {
			break;
		}
	}
	return cursor.depth;
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

export const SAMPLE_URL = 'https://example.com/path/to/page?query=hello world&name=テスト#section';
