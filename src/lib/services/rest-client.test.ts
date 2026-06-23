import { describe, expect, it } from 'vitest';

import {
	applyAuth,
	type AuthConfig,
	buildUrlWithParams,
	DEFAULT_AUTH,
	parseQueryParams,
	type QueryParam,
} from './rest-client';

const auth = (overrides: Partial<AuthConfig>): AuthConfig => ({ ...DEFAULT_AUTH, ...overrides });

const param = (key: string, value: string, enabled = true): QueryParam => ({
	id: `${key}-${value}`,
	key,
	value,
	enabled,
});

describe('parseQueryParams', () => {
	it('returns an empty array when the URL has no query string', () => {
		expect(parseQueryParams('https://example.com/api')).toEqual([]);
		expect(parseQueryParams('')).toEqual([]);
	});

	it('parses key/value pairs', () => {
		const params = parseQueryParams('https://example.com?a=1&b=2');
		expect(params.map((p) => [p.key, p.value])).toEqual([
			['a', '1'],
			['b', '2'],
		]);
		expect(params.every((p) => p.enabled)).toBe(true);
	});

	it('decodes percent-encoding and `+` as space', () => {
		const params = parseQueryParams('https://example.com?q=hello+world&tag=a%26b');
		expect(params).toMatchObject([
			{ key: 'q', value: 'hello world' },
			{ key: 'tag', value: 'a&b' },
		]);
	});

	it('handles keys without a value', () => {
		expect(parseQueryParams('https://example.com?flag&x=1')).toMatchObject([
			{ key: 'flag', value: '' },
			{ key: 'x', value: '1' },
		]);
	});

	it('ignores the fragment', () => {
		expect(parseQueryParams('https://example.com?a=1#section')).toMatchObject([
			{ key: 'a', value: '1' },
		]);
	});
});

describe('buildUrlWithParams', () => {
	it('appends an encoded query string', () => {
		expect(buildUrlWithParams('https://example.com/api', [param('q', 'hello world')])).toBe(
			'https://example.com/api?q=hello%20world'
		);
	});

	it('drops disabled and empty-key rows', () => {
		const url = buildUrlWithParams('https://example.com', [
			param('a', '1'),
			param('b', '2', false),
			param('', 'orphan'),
		]);
		expect(url).toBe('https://example.com?a=1');
	});

	it('removes the query string entirely when no rows remain', () => {
		expect(buildUrlWithParams('https://example.com?a=1', [])).toBe('https://example.com');
	});

	it('preserves the fragment', () => {
		expect(buildUrlWithParams('https://example.com#top', [param('a', '1')])).toBe(
			'https://example.com?a=1#top'
		);
	});

	it('round-trips parsed params', () => {
		const url = 'https://example.com/api?a=1&b=two';
		expect(buildUrlWithParams(url, [...parseQueryParams(url)])).toBe(url);
	});
});

describe('applyAuth', () => {
	const base: readonly (readonly [string, string])[] = [['Accept', '*/*']];
	const url = 'https://example.com/api';

	it('is a no-op for type none', () => {
		expect(applyAuth(base, url, DEFAULT_AUTH)).toEqual({ headers: base, url });
	});

	it('adds a Bearer Authorization header', () => {
		const result = applyAuth(base, url, auth({ type: 'bearer', token: ' abc ' }));
		expect(result.headers).toContainEqual(['Authorization', 'Bearer abc']);
	});

	it('skips Bearer when the token is empty', () => {
		expect(applyAuth(base, url, auth({ type: 'bearer' }))).toEqual({ headers: base, url });
	});

	it('encodes Basic credentials as base64', () => {
		const result = applyAuth(
			base,
			url,
			auth({ type: 'basic', username: 'user', password: 'pass' })
		);
		expect(result.headers).toContainEqual(['Authorization', `Basic ${btoa('user:pass')}`]);
	});

	it('encodes UTF-8 Basic credentials safely', () => {
		const result = applyAuth(base, url, auth({ type: 'basic', username: 'résumé', password: '✓' }));
		const header = result.headers.find(([k]) => k === 'Authorization')?.[1] ?? '';
		expect(header.startsWith('Basic ')).toBe(true);
		expect(atob(header.slice('Basic '.length))).not.toBe('résumé:✓'); // base64 of UTF-8 bytes, not Latin1
	});

	it('adds an API key as a header', () => {
		const result = applyAuth(
			base,
			url,
			auth({ type: 'apikey', apiKeyName: 'X-Api-Key', apiKeyValue: 'k1' })
		);
		expect(result.headers).toContainEqual(['X-Api-Key', 'k1']);
		expect(result.url).toBe(url);
	});

	it('adds an API key as a query parameter', () => {
		const result = applyAuth(
			base,
			url,
			auth({
				type: 'apikey',
				apiKeyName: 'api_key',
				apiKeyValue: 'k1',
				apiKeyLocation: 'query',
			})
		);
		expect(result.headers).toEqual(base);
		expect(result.url).toBe('https://example.com/api?api_key=k1');
	});

	it('skips API key when the name is empty', () => {
		expect(applyAuth(base, url, auth({ type: 'apikey', apiKeyValue: 'k1' }))).toEqual({
			headers: base,
			url,
		});
	});
});
