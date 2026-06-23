import { describe, expect, it } from 'vitest';

import { buildUrlWithParams, parseQueryParams, type QueryParam } from './rest-client';

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
