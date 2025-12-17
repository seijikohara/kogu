import { describe, expect, it } from 'vitest';
import {
	base64UrlDecode,
	buildUrl,
	calculateBase64Stats,
	compareHashes,
	decodeFromBase64,
	decodeJwt,
	decodeUrlComponent,
	encodeToBase64,
	encodeUrl,
	encodeUrlComponent,
	formatBytes,
	generateAllHashes,
	generateHash,
	parseUrl,
	SAMPLE_JWT,
	validateBase64,
	validateJwt,
} from './encoders';

// ============================================================================
// formatBytes
// ============================================================================

describe('formatBytes', () => {
	it.each([
		[0, '0 B'],
		[100, '100 B'],
		[1023, '1023 B'],
		[1024, '1.0 KB'],
		[1536, '1.5 KB'],
		[1048576, '1.0 MB'],
		[2621440, '2.5 MB'],
	])('formats %d bytes as "%s"', (bytes, expected) => {
		expect(formatBytes(bytes)).toBe(expected);
	});
});

// ============================================================================
// Base64 Encoding/Decoding
// ============================================================================

describe('Base64', () => {
	describe('encodeToBase64', () => {
		it('encodes simple ASCII text', () => {
			expect(encodeToBase64('Hello')).toBe('SGVsbG8=');
		});

		it('encodes empty string', () => {
			expect(encodeToBase64('')).toBe('');
		});

		it('encodes UTF-8 text (Japanese)', () => {
			const result = encodeToBase64('こんにちは');
			expect(result).toBe('44GT44KT44Gr44Gh44Gv');
		});

		it('encodes special characters', () => {
			const result = encodeToBase64('!@#$%^&*()');
			expect(result).toBeDefined();
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe('decodeFromBase64', () => {
		it('decodes simple ASCII text', () => {
			expect(decodeFromBase64('SGVsbG8=')).toBe('Hello');
		});

		it('decodes empty string', () => {
			expect(decodeFromBase64('')).toBe('');
		});

		it('decodes UTF-8 text (Japanese)', () => {
			expect(decodeFromBase64('44GT44KT44Gr44Gh44Gv')).toBe('こんにちは');
		});

		it('throws error for invalid Base64', () => {
			expect(() => decodeFromBase64('invalid!!!')).toThrow();
		});
	});

	describe('encodeToBase64 and decodeFromBase64 roundtrip', () => {
		it.each(['Hello, World!', '日本語テスト', '!@#$%^&*()', 'Line1\nLine2\nLine3', ''])(
			'encodes and decodes "%s" correctly',
			(input) => {
				const encoded = encodeToBase64(input);
				const decoded = decodeFromBase64(encoded);
				expect(decoded).toBe(input);
			}
		);
	});

	describe('validateBase64', () => {
		it('returns valid for correct Base64', () => {
			expect(validateBase64('SGVsbG8=')).toEqual({ valid: true });
		});

		it('returns invalid for empty input', () => {
			const result = validateBase64('');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Empty input');
		});

		it('returns invalid for whitespace only', () => {
			const result = validateBase64('   ');
			expect(result.valid).toBe(false);
		});

		it('returns invalid for non-Base64 characters', () => {
			const result = validateBase64('Hello!!!');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid');
		});
	});

	describe('calculateBase64Stats', () => {
		it('calculates statistics correctly', () => {
			const input = 'Hello';
			const output = encodeToBase64(input);
			const stats = calculateBase64Stats(input, output);

			expect(stats.inputChars).toBe(5);
			expect(stats.inputBytes).toBe(5);
			expect(stats.outputChars).toBe(8);
			expect(stats.ratio).toMatch(/^\d+\.\d+%$/);
		});

		it('handles empty input', () => {
			const stats = calculateBase64Stats('', '');

			expect(stats.inputChars).toBe(0);
			expect(stats.inputBytes).toBe(0);
			expect(stats.ratio).toBe('0%');
		});
	});
});

// ============================================================================
// URL Encoding/Decoding
// ============================================================================

describe('URL Encoding', () => {
	describe('encodeUrlComponent', () => {
		it('encodes spaces as %20', () => {
			expect(encodeUrlComponent('hello world')).toBe('hello%20world');
		});

		it('encodes special characters', () => {
			expect(encodeUrlComponent('name=value&other')).toBe('name%3Dvalue%26other');
		});

		it('encodes Japanese characters', () => {
			const result = encodeUrlComponent('テスト');
			expect(result).toContain('%');
		});
	});

	describe('decodeUrlComponent', () => {
		it('decodes %20 to space', () => {
			expect(decodeUrlComponent('hello%20world')).toBe('hello world');
		});

		it('decodes special characters', () => {
			expect(decodeUrlComponent('name%3Dvalue%26other')).toBe('name=value&other');
		});
	});

	describe('encodeUrl and decodeUrl', () => {
		it('preserves URL structure characters', () => {
			const url = 'https://example.com/path?query=value';
			expect(encodeUrl(url)).toBe(url);
		});

		it('encodes spaces in URL', () => {
			const url = 'https://example.com/path with spaces';
			expect(encodeUrl(url)).toContain('%20');
		});
	});

	describe('parseUrl', () => {
		it('parses valid URL correctly', () => {
			const result = parseUrl('https://example.com:8080/path?name=value#section');

			expect(result).not.toBeNull();
			expect(result?.components.protocol).toBe('https:');
			expect(result?.components.hostname).toBe('example.com');
			expect(result?.components.port).toBe('8080');
			expect(result?.components.pathname).toBe('/path');
			expect(result?.components.hash).toBe('#section');
			expect(result?.params).toHaveLength(1);
			expect(result?.params[0]).toEqual({ key: 'name', value: 'value' });
		});

		it('parses URL with multiple query parameters', () => {
			const result = parseUrl('https://example.com?a=1&b=2&c=3');

			expect(result).not.toBeNull();
			expect(result?.params).toHaveLength(3);
		});

		it('returns null for invalid URL', () => {
			expect(parseUrl('not a url')).toBeNull();
		});
	});

	describe('buildUrl', () => {
		it('builds URL with parameters', () => {
			const result = buildUrl('https://example.com', [
				{ key: 'name', value: 'John' },
				{ key: 'age', value: '30' },
			]);

			expect(result).toBe('https://example.com/?name=John&age=30');
		});

		it('skips empty keys', () => {
			const result = buildUrl('https://example.com', [
				{ key: '', value: 'value' },
				{ key: 'name', value: 'John' },
			]);

			expect(result).toBe('https://example.com/?name=John');
		});

		it('returns original URL for invalid base URL', () => {
			expect(buildUrl('invalid', [{ key: 'a', value: 'b' }])).toBe('invalid');
		});
	});
});

// ============================================================================
// JWT Decoding
// ============================================================================

describe('JWT', () => {
	describe('base64UrlDecode', () => {
		it('decodes Base64URL string', () => {
			const result = base64UrlDecode('SGVsbG8');
			expect(result).toBe('Hello');
		});

		it('handles URL-safe characters', () => {
			// Base64URL uses - instead of + and _ instead of /
			const result = base64UrlDecode('SGVsbG8-V29ybGQ_');
			expect(result).toBeDefined();
		});
	});

	describe('decodeJwt', () => {
		it('decodes valid JWT', () => {
			const result = decodeJwt(SAMPLE_JWT);

			expect(result).not.toBeNull();
			expect(result?.header.alg).toBe('HS256');
			expect(result?.header.typ).toBe('JWT');
			expect(result?.payload.sub).toBe('1234567890');
			expect(result?.payload['name']).toBe('John Doe');
			expect(result?.signature).toBeDefined();
		});

		it('calculates expiration status', () => {
			const result = decodeJwt(SAMPLE_JWT);

			expect(result).not.toBeNull();
			expect(typeof result?.isExpired).toBe('boolean');
			expect(result?.expiresAt).toBeInstanceOf(Date);
		});

		it('returns null for invalid JWT (wrong number of parts)', () => {
			expect(decodeJwt('invalid')).toBeNull();
			expect(decodeJwt('part1.part2')).toBeNull();
			expect(decodeJwt('part1.part2.part3.part4')).toBeNull();
		});

		it('returns null for invalid Base64 in JWT', () => {
			expect(decodeJwt('!!!.!!!.!!!')).toBeNull();
		});
	});

	describe('validateJwt', () => {
		it('returns valid for correct JWT', () => {
			expect(validateJwt(SAMPLE_JWT)).toEqual({ valid: true });
		});

		it('returns invalid for empty input', () => {
			const result = validateJwt('');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Empty input');
		});

		it('returns invalid for wrong number of parts', () => {
			const result = validateJwt('only.two');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('3 parts');
		});
	});
});

// ============================================================================
// Hash Generation
// ============================================================================

describe('Hash', () => {
	describe('generateHash', () => {
		const TEST_INPUT = 'Hello, World!';

		it('generates MD5 hash', () => {
			const hash = generateHash(TEST_INPUT, 'MD5');
			expect(hash).toBe('65a8e27d8879283831b664bd8b7f0ad4');
		});

		it('generates SHA1 hash', () => {
			const hash = generateHash(TEST_INPUT, 'SHA1');
			expect(hash).toBe('0a0a9f2a6772942557ab5355d76af442f8f65e01');
		});

		it('generates SHA256 hash', () => {
			const hash = generateHash(TEST_INPUT, 'SHA256');
			expect(hash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
		});

		it('generates consistent hashes for same input', () => {
			const hash1 = generateHash(TEST_INPUT, 'SHA256');
			const hash2 = generateHash(TEST_INPUT, 'SHA256');
			expect(hash1).toBe(hash2);
		});

		it('generates different hashes for different inputs', () => {
			const hash1 = generateHash('input1', 'SHA256');
			const hash2 = generateHash('input2', 'SHA256');
			expect(hash1).not.toBe(hash2);
		});

		it('throws error for unknown algorithm', () => {
			// @ts-expect-error Testing invalid algorithm
			expect(() => generateHash(TEST_INPUT, 'UNKNOWN')).toThrow('Unknown algorithm');
		});
	});

	describe('generateAllHashes', () => {
		it('generates hashes for all algorithms', () => {
			const results = generateAllHashes('test');

			expect(results).toHaveLength(6);
			expect(results.map((r) => r.algorithm)).toEqual([
				'MD5',
				'SHA1',
				'SHA224',
				'SHA256',
				'SHA384',
				'SHA512',
			]);
		});

		it('includes bit length for each algorithm', () => {
			const results = generateAllHashes('test');

			expect(results.find((r) => r.algorithm === 'MD5')?.bits).toBe(128);
			expect(results.find((r) => r.algorithm === 'SHA256')?.bits).toBe(256);
			expect(results.find((r) => r.algorithm === 'SHA512')?.bits).toBe(512);
		});
	});

	describe('compareHashes', () => {
		it('returns true for identical hashes', () => {
			expect(compareHashes('abc123', 'abc123')).toBe(true);
		});

		it('returns true for case-insensitive comparison', () => {
			expect(compareHashes('ABC123', 'abc123')).toBe(true);
		});

		it('returns true ignoring whitespace', () => {
			expect(compareHashes('  abc123  ', 'abc123')).toBe(true);
		});

		it('returns false for different hashes', () => {
			expect(compareHashes('abc123', 'def456')).toBe(false);
		});
	});
});
