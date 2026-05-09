/**
 * cURL request service.
 * Pure helpers for building a `curl` command from a structured request,
 * a tokenizer-based parser that recognizes common flags, and a small
 * code generator that emits equivalent fetch / Python / Go snippets.
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

export type AuthScheme = 'none' | 'basic' | 'bearer' | 'apikey';

export interface AuthInfo {
	readonly id: AuthScheme;
	readonly label: string;
	readonly description: string;
}

export const AUTH_SCHEMES: readonly AuthInfo[] = [
	{ id: 'none', label: 'None', description: 'No authentication header' },
	{ id: 'basic', label: 'Basic', description: 'Username + password (base64)' },
	{ id: 'bearer', label: 'Bearer', description: 'Token in Authorization header' },
	{ id: 'apikey', label: 'API Key', description: 'Custom header name + value' },
];

export type Auth =
	| { readonly scheme: 'none' }
	| { readonly scheme: 'basic'; readonly username: string; readonly password: string }
	| { readonly scheme: 'bearer'; readonly token: string }
	| { readonly scheme: 'apikey'; readonly headerName: string; readonly value: string };

export type BodyMode = 'none' | 'raw' | 'json' | 'form';

export interface BodyModeInfo {
	readonly id: BodyMode;
	readonly label: string;
	readonly description: string;
}

export const BODY_MODES: readonly BodyModeInfo[] = [
	{ id: 'none', label: 'None', description: 'No request body' },
	{ id: 'raw', label: 'Raw', description: 'Plain text or any payload' },
	{ id: 'json', label: 'JSON', description: 'application/json with prettified preview' },
	{ id: 'form', label: 'Form', description: 'application/x-www-form-urlencoded key/value pairs' },
];

export type RequestBody =
	| { readonly mode: 'none' }
	| { readonly mode: 'raw'; readonly content: string }
	| { readonly mode: 'json'; readonly content: string }
	| { readonly mode: 'form'; readonly fields: readonly KeyValue[] };

export interface CurlRequest {
	readonly method: HttpMethod;
	readonly url: string;
	readonly headers: readonly KeyValue[];
	readonly auth: Auth;
	readonly body: RequestBody;
	readonly followRedirects: boolean;
	readonly insecure: boolean;
	readonly includeHeaders: boolean;
	readonly timeoutSeconds: number;
}

export const DEFAULT_REQUEST: CurlRequest = {
	method: 'GET',
	url: 'https://api.example.com/users',
	headers: [],
	auth: { scheme: 'none' },
	body: { mode: 'none' },
	followRedirects: false,
	insecure: false,
	includeHeaders: false,
	timeoutSeconds: 0,
};

export const isHttpMethod = (value: string): value is HttpMethod =>
	HTTP_METHODS.includes(value as HttpMethod);

export const isAuthScheme = (value: string): value is AuthScheme =>
	AUTH_SCHEMES.some((info) => info.id === value);

export const isBodyMode = (value: string): value is BodyMode =>
	BODY_MODES.some((info) => info.id === value);

const SAFE_PATTERN = /^[a-zA-Z0-9_./:?=&%@~+-]+$/;

const shellEscape = (value: string): string => {
	if (value === '') return "''";
	if (SAFE_PATTERN.test(value)) return value;
	return `'${value.replaceAll("'", String.raw`'\''`)}'`;
};

const formEncode = (fields: readonly KeyValue[]): string =>
	fields
		.filter((f) => f.key.length > 0)
		.map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
		.join('&');

const authHeader = (auth: Auth): KeyValue | null => {
	if (auth.scheme === 'none') return null;
	if (auth.scheme === 'basic') {
		const token = btoa(`${auth.username}:${auth.password}`);
		return { key: 'Authorization', value: `Basic ${token}` };
	}
	if (auth.scheme === 'bearer') {
		return { key: 'Authorization', value: `Bearer ${auth.token}` };
	}
	return { key: auth.headerName || 'X-API-Key', value: auth.value };
};

const bodyHeaders = (body: RequestBody): readonly KeyValue[] => {
	if (body.mode === 'json') return [{ key: 'Content-Type', value: 'application/json' }];
	if (body.mode === 'form')
		return [{ key: 'Content-Type', value: 'application/x-www-form-urlencoded' }];
	return [];
};

const bodyText = (body: RequestBody): string => {
	if (body.mode === 'none') return '';
	if (body.mode === 'raw' || body.mode === 'json') return body.content;
	return formEncode(body.fields);
};

export interface BuildOptions {
	readonly multiline: boolean;
}

export const DEFAULT_BUILD_OPTIONS: BuildOptions = { multiline: true };

const collectHeaders = (request: CurlRequest): readonly KeyValue[] => {
	const auth = authHeader(request.auth);
	const explicit = request.headers.filter((h) => h.key.length > 0);
	const inferred = bodyHeaders(request.body);
	// Drop inferred Content-Type when the user has already supplied one.
	const hasContentType = explicit.some((h) => h.key.toLowerCase() === 'content-type');
	const filteredInferred = hasContentType
		? inferred.filter((h) => h.key.toLowerCase() !== 'content-type')
		: inferred;
	return [...(auth ? [auth] : []), ...explicit, ...filteredInferred];
};

const effectiveMethod = (request: CurlRequest): HttpMethod => {
	if (request.body.mode !== 'none' && request.method === 'GET') return 'POST';
	return request.method;
};

export const buildCurl = (request: CurlRequest, options: BuildOptions): string => {
	const method = effectiveMethod(request);
	const args: string[] = [];
	if (method !== 'GET') args.push('-X', method);
	args.push(shellEscape(request.url));
	const allHeaders = collectHeaders(request);
	const headerArgs = allHeaders.flatMap((h) => ['-H', shellEscape(`${h.key}: ${h.value}`)]);
	args.push(...headerArgs);
	if (request.body.mode !== 'none') {
		args.push('--data-raw', shellEscape(bodyText(request.body)));
	}
	if (request.followRedirects) args.push('-L');
	if (request.insecure) args.push('-k');
	if (request.includeHeaders) args.push('-i');
	if (request.timeoutSeconds > 0) args.push('--max-time', String(request.timeoutSeconds));
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

const TOKEN_PATTERN = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|(\S+)/g;

const tokenize = (input: string): readonly string[] => {
	const cleaned = input.replaceAll(/\\\n/g, ' ').trim();
	return Array.from(cleaned.matchAll(TOKEN_PATTERN), (m) => m[1] ?? m[2] ?? m[3] ?? '');
};

const stripLeading = (value: string): string => value.replace(/^['"]|['"]$/g, '');

interface ParseAccumulator {
	method: HttpMethod;
	url: string;
	body: string;
	bodyMode: BodyMode;
	headers: KeyValue[];
	methodExplicit: boolean;
	followRedirects: boolean;
	insecure: boolean;
	includeHeaders: boolean;
	timeoutSeconds: number;
}

const handleFlag = (acc: ParseAccumulator, token: string, next: string): number => {
	if (token === '-X' || token === '--request') {
		const candidate = next.toUpperCase();
		if (isHttpMethod(candidate)) {
			acc.method = candidate;
			acc.methodExplicit = true;
		}
		return 2;
	}
	if (token === '-H' || token === '--header') {
		const headerText = stripLeading(next);
		const idx = headerText.indexOf(':');
		if (idx > 0) {
			acc.headers.push({
				key: headerText.slice(0, idx).trim(),
				value: headerText.slice(idx + 1).trim(),
			});
		}
		return 2;
	}
	if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
		acc.body = next;
		acc.bodyMode = 'raw';
		if (!acc.methodExplicit) acc.method = 'POST';
		return 2;
	}
	if (token === '-G' || token === '--get') {
		acc.method = 'GET';
		acc.methodExplicit = true;
		return 1;
	}
	if (token === '-L' || token === '--location') {
		acc.followRedirects = true;
		return 1;
	}
	if (token === '-k' || token === '--insecure') {
		acc.insecure = true;
		return 1;
	}
	if (token === '-i' || token === '--include') {
		acc.includeHeaders = true;
		return 1;
	}
	if (token === '--max-time') {
		const seconds = Number.parseFloat(next);
		if (Number.isFinite(seconds)) acc.timeoutSeconds = seconds;
		return 2;
	}
	if (token.startsWith('-')) {
		return token.startsWith('--') || token.length === 2 ? 2 : 1;
	}
	if (acc.url === '') acc.url = token;
	return 1;
};

export interface ParsedCurl {
	readonly method: HttpMethod;
	readonly url: string;
	readonly headers: readonly KeyValue[];
	readonly body: string;
	readonly bodyMode: BodyMode;
	readonly followRedirects: boolean;
	readonly insecure: boolean;
	readonly includeHeaders: boolean;
	readonly timeoutSeconds: number;
}

export const parseCurl = (input: string): Result<ParsedCurl> => {
	const tokens = tokenize(input);
	if (tokens.length === 0 || tokens[0] !== 'curl') {
		return { ok: false, error: 'Input must start with `curl`' };
	}
	const acc: ParseAccumulator = {
		method: 'GET',
		url: '',
		body: '',
		bodyMode: 'none',
		headers: [],
		methodExplicit: false,
		followRedirects: false,
		insecure: false,
		includeHeaders: false,
		timeoutSeconds: 0,
	};
	let i = 1;
	while (i < tokens.length) {
		const token = tokens[i] ?? '';
		const next = tokens[i + 1] ?? '';
		i += handleFlag(acc, token, next);
	}
	if (acc.url === '') return { ok: false, error: 'No URL found in command' };
	return {
		ok: true,
		value: {
			method: acc.method,
			url: acc.url,
			headers: acc.headers,
			body: acc.body,
			bodyMode: acc.bodyMode,
			followRedirects: acc.followRedirects,
			insecure: acc.insecure,
			includeHeaders: acc.includeHeaders,
			timeoutSeconds: acc.timeoutSeconds,
		},
	};
};

const escapeForBacktick = (value: string): string => value.replaceAll('`', '\\`');
const jsString = (value: string): string => JSON.stringify(value);

export const generateFetchCode = (request: CurlRequest): string => {
	const method = effectiveMethod(request);
	const headers = collectHeaders(request);
	const body = bodyText(request.body);
	const lines: string[] = [`const response = await fetch(${jsString(request.url)}, {`];
	if (method !== 'GET') lines.push(`  method: ${jsString(method)},`);
	if (headers.length > 0) {
		const headerEntries = headers
			.map((h) => `    ${jsString(h.key)}: ${jsString(h.value)},`)
			.join('\n');
		lines.push('  headers: {');
		lines.push(headerEntries);
		lines.push('  },');
	}
	if (request.body.mode !== 'none') {
		lines.push(`  body: \`${escapeForBacktick(body)}\`,`);
	}
	if (request.followRedirects) lines.push(`  redirect: 'follow',`);
	lines.push('});');
	lines.push('const data = await response.json();');
	return lines.join('\n');
};

export const generatePythonCode = (request: CurlRequest): string => {
	const method = effectiveMethod(request);
	const headers = collectHeaders(request);
	const lines: string[] = ['import requests', ''];
	const headerLines = headers.map((h) => `    ${jsString(h.key)}: ${jsString(h.value)},`);
	lines.push(`url = ${jsString(request.url)}`);
	if (headers.length > 0) {
		lines.push('headers = {');
		lines.push(...headerLines);
		lines.push('}');
	} else {
		lines.push('headers = {}');
	}
	if (request.body.mode === 'json') {
		lines.push(`data = ${request.body.content || '{}'}`);
		lines.push(
			`response = requests.request(${jsString(method.toLowerCase())}, url, headers=headers, json=data)`
		);
	} else if (request.body.mode === 'raw' || request.body.mode === 'form') {
		const body = bodyText(request.body);
		lines.push(`data = ${jsString(body)}`);
		lines.push(
			`response = requests.request(${jsString(method.toLowerCase())}, url, headers=headers, data=data)`
		);
	} else {
		lines.push(
			`response = requests.request(${jsString(method.toLowerCase())}, url, headers=headers)`
		);
	}
	lines.push('print(response.json())');
	return lines.join('\n');
};

export const generateGoCode = (request: CurlRequest): string => {
	const method = effectiveMethod(request);
	const headers = collectHeaders(request);
	const body = bodyText(request.body);
	const lines: string[] = ['package main', '', 'import (', '\t"fmt"', '\t"io"', '\t"net/http"'];
	if (body) lines.push('\t"strings"');
	lines.push(')', '');
	lines.push('func main() {');
	if (body) {
		lines.push(`\tbody := strings.NewReader(${jsString(body)})`);
		lines.push(
			`\treq, err := http.NewRequest(${jsString(method)}, ${jsString(request.url)}, body)`
		);
	} else {
		lines.push(`\treq, err := http.NewRequest(${jsString(method)}, ${jsString(request.url)}, nil)`);
	}
	lines.push('\tif err != nil {', '\t\tpanic(err)', '\t}');
	const headerLines = headers.map(
		(h) => `\treq.Header.Set(${jsString(h.key)}, ${jsString(h.value)})`
	);
	if (headerLines.length > 0) {
		lines.push(...headerLines);
	}
	lines.push('\tres, err := http.DefaultClient.Do(req)');
	lines.push('\tif err != nil {', '\t\tpanic(err)', '\t}');
	lines.push('\tdefer res.Body.Close()');
	lines.push('\tdata, _ := io.ReadAll(res.Body)');
	lines.push('\tfmt.Println(string(data))');
	lines.push('}');
	return lines.join('\n');
};
