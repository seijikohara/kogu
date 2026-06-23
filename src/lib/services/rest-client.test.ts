import { describe, expect, it } from 'vitest';

import {
	applyAuth,
	type AuthConfig,
	buildUrlWithParams,
	DEFAULT_AUTH,
	encodeFormBody,
	formatJson,
	type HeaderEntry,
	type HeaderTuple,
	parseQueryParams,
	parseSetCookie,
	type QueryParam,
	resolveBody,
	validateJson,
	withContentType,
} from './rest-client';

const field = (key: string, value: string, enabled = true): HeaderEntry => ({
	id: `${key}-${value}`,
	key,
	value,
	enabled,
});

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

describe('encodeFormBody', () => {
	it('url-encodes enabled rows', () => {
		expect(encodeFormBody([field('a', '1'), field('q', 'hello world')])).toBe(
			'a=1&q=hello%20world'
		);
	});

	it('drops disabled and empty-key rows', () => {
		expect(encodeFormBody([field('a', '1'), field('b', '2', false), field('', 'x')])).toBe('a=1');
	});
});

describe('resolveBody', () => {
	const fields = [field('a', '1')];

	it('sends nothing for none', () => {
		expect(resolveBody('none', 'ignored', fields)).toEqual({ body: '', contentType: null });
	});

	it('keeps the raw body with no implied type', () => {
		expect(resolveBody('raw', 'plain', fields)).toEqual({ body: 'plain', contentType: null });
	});

	it('applies the JSON content type', () => {
		expect(resolveBody('json', '{"a":1}', fields)).toEqual({
			body: '{"a":1}',
			contentType: 'application/json',
		});
	});

	it('encodes form fields with the urlencoded type', () => {
		expect(resolveBody('form', 'ignored', fields)).toEqual({
			body: 'a=1',
			contentType: 'application/x-www-form-urlencoded',
		});
	});
});

describe('withContentType', () => {
	it('appends the type when none is present', () => {
		expect(withContentType([['Accept', '*/*']], 'application/json')).toContainEqual([
			'Content-Type',
			'application/json',
		]);
	});

	it('respects an existing Content-Type (case-insensitive)', () => {
		const headers = [['content-type', 'text/plain']] as const;
		expect(withContentType(headers, 'application/json')).toEqual(headers);
	});

	it('is a no-op when the type is null', () => {
		const headers = [['Accept', '*/*']] as const;
		expect(withContentType(headers, null)).toBe(headers);
	});
});

describe('validateJson', () => {
	it('returns null for empty input', () => {
		expect(validateJson('   ')).toBeNull();
	});

	it('returns true for valid JSON', () => {
		expect(validateJson('{"a":1}')).toBe(true);
	});

	it('returns false for invalid JSON', () => {
		expect(validateJson('{a:1}')).toBe(false);
	});
});

describe('formatJson', () => {
	it('pretty-prints valid JSON', () => {
		expect(formatJson('{"a":1}')).toBe('{\n\t"a": 1\n}'.replace(/\t/g, '  '));
	});

	it('returns invalid JSON unchanged', () => {
		expect(formatJson('{a:1}')).toBe('{a:1}');
	});
});

describe('parseSetCookie', () => {
	const cookie = (key: string, value: string): HeaderTuple => [key, value];

	it('ignores responses without Set-Cookie headers', () => {
		expect(parseSetCookie([cookie('Content-Type', 'text/html')])).toEqual([]);
	});

	it('matches the Set-Cookie header case-insensitively', () => {
		const cookies = parseSetCookie([cookie('set-cookie', 'sid=abc')]);
		expect(cookies).toMatchObject([{ name: 'sid', value: 'abc', attributes: [] }]);
	});

	it('parses attributes and boolean flags in order', () => {
		const cookies = parseSetCookie([
			cookie('Set-Cookie', 'sid=abc; Path=/; HttpOnly; Secure; SameSite=Lax'),
		]);
		expect(cookies[0]).toMatchObject({
			name: 'sid',
			value: 'abc',
			attributes: [
				['Path', '/'],
				['HttpOnly', ''],
				['Secure', ''],
				['SameSite', 'Lax'],
			],
		});
	});

	it('keeps a value that contains an equals sign', () => {
		const cookies = parseSetCookie([cookie('Set-Cookie', 'token=a=b=c; Path=/')]);
		expect(cookies[0]).toMatchObject({ name: 'token', value: 'a=b=c' });
	});

	it('collects every Set-Cookie header', () => {
		const cookies = parseSetCookie([
			cookie('Set-Cookie', 'a=1'),
			cookie('Content-Type', 'text/html'),
			cookie('Set-Cookie', 'b=2'),
		]);
		expect(cookies.map((c) => c.name)).toEqual(['a', 'b']);
	});

	it('drops segments without a valid name', () => {
		expect(parseSetCookie([cookie('Set-Cookie', 'noequalssign')])).toEqual([]);
		expect(parseSetCookie([cookie('Set-Cookie', '=novalue')])).toEqual([]);
	});
});
