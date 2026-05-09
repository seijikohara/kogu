/**
 * cURL request service.
 * Pure helpers for building a `curl` command from a structured request,
 * and a tokenizer-based parser that recognizes the most common flags.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export const HTTP_METHODS: readonly HttpMethod[] = [
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'HEAD',
	'OPTIONS',
];

export type Result<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: string };

export interface KeyValue {
	readonly key: string;
	readonly value: string;
}

export interface CurlRequest {
	readonly method: HttpMethod;
	readonly url: string;
	readonly headers: readonly KeyValue[];
	readonly body: string;
}

export const DEFAULT_REQUEST: CurlRequest = {
	method: 'GET',
	url: 'https://api.example.com/users',
	headers: [],
	body: '',
};

export const isHttpMethod = (value: string): value is HttpMethod =>
	HTTP_METHODS.includes(value as HttpMethod);

const SAFE_PATTERN = /^[a-zA-Z0-9_./:?=&%@~+-]+$/;

const shellEscape = (value: string): string => {
	if (value === '') return "''";
	if (SAFE_PATTERN.test(value)) return value;
	// Single-quote, escape internal single quotes via the standard '\'' trick.
	return `'${value.replaceAll("'", String.raw`'\''`)}'`;
};

const isMethodChangingFlag = (method: HttpMethod, hasBody: boolean): boolean =>
	hasBody && method === 'GET';

export interface BuildOptions {
	readonly multiline: boolean;
}

export const DEFAULT_BUILD_OPTIONS: BuildOptions = { multiline: true };

export const buildCurl = (request: CurlRequest, options: BuildOptions): string => {
	const hasBody = request.body.length > 0;
	const effectiveMethod = isMethodChangingFlag(request.method, hasBody) ? 'POST' : request.method;
	const args: string[] = [];
	if (effectiveMethod !== 'GET') args.push('-X', effectiveMethod);
	args.push(shellEscape(request.url));
	const headerArgs = request.headers
		.filter((h) => h.key.length > 0)
		.flatMap((h) => ['-H', shellEscape(`${h.key}: ${h.value}`)]);
	args.push(...headerArgs);
	if (hasBody) args.push('--data-raw', shellEscape(request.body));
	const separator = options.multiline ? ' \\\n  ' : ' ';
	return `curl ${args.join(separator)}`;
};

export const parseHeaderLines = (text: string): readonly KeyValue[] =>
	text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const idx = line.indexOf(':');
			if (idx <= 0) return { key: line, value: '' };
			return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
		});

export const formatHeaderLines = (headers: readonly KeyValue[]): string =>
	headers
		.filter((h) => h.key.length > 0)
		.map((h) => `${h.key}: ${h.value}`)
		.join('\n');

// Match a single-quoted string, a double-quoted string, or an unquoted token.
const TOKEN_PATTERN = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|(\S+)/g;

const tokenize = (input: string): readonly string[] => {
	const cleaned = input.replaceAll(/\\\n/g, ' ').trim();
	return Array.from(cleaned.matchAll(TOKEN_PATTERN), (m) => m[1] ?? m[2] ?? m[3] ?? '');
};

const stripLeading = (value: string): string => value.replace(/^['"]|['"]$/g, '');

export const parseCurl = (input: string): Result<CurlRequest> => {
	const tokens = tokenize(input);
	if (tokens.length === 0 || tokens[0] !== 'curl') {
		return { ok: false, error: 'Input must start with `curl`' };
	}
	let method: HttpMethod = 'GET';
	let url = '';
	let body = '';
	const headers: KeyValue[] = [];
	let methodExplicit = false;
	let i = 1;
	while (i < tokens.length) {
		const token = tokens[i] ?? '';
		const next = tokens[i + 1] ?? '';
		if (token === '-X' || token === '--request') {
			const candidate = next.toUpperCase();
			if (isHttpMethod(candidate)) {
				method = candidate;
				methodExplicit = true;
			}
			i += 2;
			continue;
		}
		if (token === '-H' || token === '--header') {
			const headerText = stripLeading(next);
			const idx = headerText.indexOf(':');
			if (idx > 0) {
				headers.push({
					key: headerText.slice(0, idx).trim(),
					value: headerText.slice(idx + 1).trim(),
				});
			}
			i += 2;
			continue;
		}
		if (
			token === '-d' ||
			token === '--data' ||
			token === '--data-raw' ||
			token === '--data-binary'
		) {
			body = next;
			if (!methodExplicit) method = 'POST';
			i += 2;
			continue;
		}
		if (token === '-G' || token === '--get') {
			method = 'GET';
			methodExplicit = true;
			i += 1;
			continue;
		}
		if (token.startsWith('-')) {
			// Unsupported flag — skip it and its value if it looks like one takes a value.
			i += token.startsWith('--') || token.length === 2 ? 2 : 1;
			continue;
		}
		// Bare token: treat as URL (last one wins so `--data` followed by URL still parses).
		if (url === '') url = token;
		i += 1;
	}
	if (url === '') return { ok: false, error: 'No URL found in command' };
	return { ok: true, value: { method, url, headers, body } };
};
