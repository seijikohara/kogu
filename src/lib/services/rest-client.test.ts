import { describe, expect, it } from 'vitest';

import {
	applyAuth,
	type AuthConfig,
	buildUrlWithParams,
	DEFAULT_AUTH,
	encodeFormBody,
	countMatches,
	formatJson,
	formatResponseBody,
	type HeaderEntry,
	type HeaderTuple,
	importCurl,
	responseFilename,
	splitHighlight,
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

describe('formatResponseBody', () => {
	it('returns the body unchanged without a content type', () => {
		expect(formatResponseBody('{"a":1}', undefined)).toBe('{"a":1}');
	});

	it('pretty-prints JSON for a JSON content type', () => {
		const result = formatResponseBody('{"a":1}', 'application/json; charset=utf-8');
		expect(result).toContain('\n');
		expect(result).toContain('"a"');
	});

	it('pretty-prints a JSON suffix content type', () => {
		const result = formatResponseBody('{"a":1}', 'application/vnd.api+json');
		expect(result).toContain('\n');
	});

	it('pretty-prints XML for an XML content type', () => {
		const result = formatResponseBody('<a><b>1</b></a>', 'application/xml');
		expect(result).toContain('\n');
		expect(result).toContain('<b>1</b>');
	});

	it('returns unparseable XML unchanged', () => {
		expect(formatResponseBody('plain text, not xml', 'text/xml')).toBe('plain text, not xml');
	});

	it('leaves a plain-text body unchanged', () => {
		expect(formatResponseBody('hello world', 'text/plain')).toBe('hello world');
	});
});

describe('splitHighlight', () => {
	it('returns the whole text as one non-match segment for an empty query', () => {
		expect(splitHighlight('hello world', '')).toEqual([{ text: 'hello world', match: false }]);
	});

	it('marks matched runs case-insensitively', () => {
		expect(splitHighlight('Hello hello', 'hello')).toEqual([
			{ text: 'Hello', match: true },
			{ text: ' ', match: false },
			{ text: 'hello', match: true },
		]);
	});

	it('treats regex metacharacters literally', () => {
		expect(splitHighlight('a.b.c', '.')).toEqual([
			{ text: 'a', match: false },
			{ text: '.', match: true },
			{ text: 'b', match: false },
			{ text: '.', match: true },
			{ text: 'c', match: false },
		]);
	});

	it('reassembles to the original text', () => {
		const text = 'the quick brown fox';
		const joined = splitHighlight(text, 'o')
			.map((s) => s.text)
			.join('');
		expect(joined).toBe(text);
	});
});

describe('countMatches', () => {
	it('counts case-insensitive occurrences', () => {
		expect(countMatches('aAaA', 'a')).toBe(4);
	});

	it('returns zero for an empty query', () => {
		expect(countMatches('anything', '')).toBe(0);
	});

	it('returns zero when there is no match', () => {
		expect(countMatches('abc', 'z')).toBe(0);
	});
});

describe('responseFilename', () => {
	it('defaults to a text extension without a content type', () => {
		expect(responseFilename(undefined)).toBe('response.txt');
	});

	it.each([
		['application/json; charset=utf-8', 'response.json'],
		['application/vnd.api+json', 'response.json'],
		['text/html', 'response.html'],
		['application/xml', 'response.xml'],
		['text/csv', 'response.csv'],
		['text/plain', 'response.txt'],
	])('maps %s to %s', (contentType, expected) => {
		expect(responseFilename(contentType)).toBe(expected);
	});
});

describe('importCurl', () => {
	it('rejects input that does not start with curl', () => {
		const result = importCurl('wget https://example.com');
		expect(result.ok).toBe(false);
	});

	it('maps method, url, and headers', () => {
		const result = importCurl(
			"curl -X PUT 'https://example.com/api' -H 'Accept: application/json'"
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.method).toBe('PUT');
		expect(result.value.url).toBe('https://example.com/api');
		expect(result.value.headers).toMatchObject([
			{ key: 'Accept', value: 'application/json', enabled: true },
		]);
	});

	it('infers POST and a raw body from a data flag', () => {
		const result = importCurl("curl https://example.com --data-raw 'hello'");
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.method).toBe('POST');
		expect(result.value.bodyMode).toBe('raw');
		expect(result.value.body).toBe('hello');
	});

	it('upgrades the body mode to json when a JSON content type is present', () => {
		const result = importCurl(
			`curl -X POST 'https://example.com' -H 'Content-Type: application/json' --data-raw '{"a":1}'`
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.bodyMode).toBe('json');
		expect(result.value.body).toBe('{"a":1}');
	});

	it('converts and clamps a max-time timeout to milliseconds', () => {
		const within = importCurl('curl https://example.com --max-time 30');
		expect(within.ok && within.value.timeoutMs).toBe(30_000);

		const clampedHigh = importCurl('curl https://example.com --max-time 600');
		expect(clampedHigh.ok && clampedHigh.value.timeoutMs).toBe(60_000);
	});

	it('leaves the timeout unset when no max-time is given', () => {
		const result = importCurl('curl https://example.com');
		expect(result.ok && result.value.timeoutMs).toBeNull();
	});

	it('captures the follow-redirects flag', () => {
		const result = importCurl('curl -L https://example.com');
		expect(result.ok && result.value.followRedirects).toBe(true);
	});
});
