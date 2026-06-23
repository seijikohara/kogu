import { invoke } from '@tauri-apps/api/core';

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

const HTTP_METHOD_SET: ReadonlySet<HttpMethod> = new Set(HTTP_METHODS);

export const isHttpMethod = (value: string): value is HttpMethod =>
	HTTP_METHOD_SET.has(value as HttpMethod);

/**
 * Single header row owned by the UI. `enabled=false` keeps the row visible
 * but excludes it from the request.
 */
export interface HeaderEntry {
	readonly id: string;
	readonly key: string;
	readonly value: string;
	readonly enabled: boolean;
}

/** Tuple form transmitted over IPC. */
export type HeaderTuple = readonly [string, string];

/**
 * Single query-parameter row derived from the URL. Rows are parsed from the
 * URL's query string on render and written back on edit, so the URL field stays
 * the single source of truth (no separate persisted parameter state).
 */
export interface QueryParam {
	readonly id: string;
	readonly key: string;
	readonly value: string;
	readonly enabled: boolean;
}

/** Split a URL into its base (scheme + path), query string, and `#fragment`. */
const splitUrl = (url: string): { base: string; query: string; fragment: string } => {
	const hashIndex = url.indexOf('#');
	const fragment = hashIndex === -1 ? '' : url.slice(hashIndex);
	const withoutFragment = hashIndex === -1 ? url : url.slice(0, hashIndex);
	const queryIndex = withoutFragment.indexOf('?');
	const base = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
	const query = queryIndex === -1 ? '' : withoutFragment.slice(queryIndex + 1);
	return { base, query, fragment };
};

const decodeComponent = (value: string): string => {
	try {
		return decodeURIComponent(value.replace(/\+/g, ' '));
	} catch {
		return value;
	}
};

/**
 * Parse the query string of `url` into editable rows. Disabled rows are never
 * represented in a URL, so every parsed row is enabled. Returns an empty array
 * when the URL carries no query string.
 */
export const parseQueryParams = (url: string): readonly QueryParam[] => {
	const { query } = splitUrl(url);
	if (query.length === 0) return [];
	return query.split('&').map((pair, index) => {
		const eq = pair.indexOf('=');
		const rawKey = eq === -1 ? pair : pair.slice(0, eq);
		const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
		return {
			id: `qp_${index}`,
			key: decodeComponent(rawKey),
			value: decodeComponent(rawValue),
			enabled: true,
		};
	});
};

/**
 * Rebuild a URL from its base and the supplied parameter rows. Enabled rows
 * with a non-empty key are encoded into the query string; the original
 * `#fragment` is preserved.
 */
export const buildUrlWithParams = (url: string, params: readonly QueryParam[]): string => {
	const { base, fragment } = splitUrl(url);
	const query = params
		.filter((p) => p.enabled && p.key.trim().length > 0)
		.map((p) => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value)}`)
		.join('&');
	return `${base}${query.length > 0 ? `?${query}` : ''}${fragment}`;
};

/** Authentication scheme applied to the request at send time. */
export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

/** Where an API-key credential is attached. */
export type ApiKeyLocation = 'header' | 'query';

/**
 * Auth configuration owned by the UI. Credentials are folded into the effective
 * request headers / URL by {@link applyAuth} only at send time, so the stored
 * header rows stay clean and the chosen scheme can change without rewriting them.
 */
export interface AuthConfig {
	readonly type: AuthType;
	readonly token: string;
	readonly username: string;
	readonly password: string;
	readonly apiKeyName: string;
	readonly apiKeyValue: string;
	readonly apiKeyLocation: ApiKeyLocation;
}

export const DEFAULT_AUTH: AuthConfig = {
	type: 'none',
	token: '',
	username: '',
	password: '',
	apiKeyName: '',
	apiKeyValue: '',
	apiKeyLocation: 'header',
};

/** UTF-8-safe base64 for Basic credentials (btoa alone mangles non-Latin1). */
const utf8ToBase64 = (input: string): string => {
	const bytes = new TextEncoder().encode(input);
	const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
	return btoa(binary);
};

const appendQueryParam = (url: string, key: string, value: string): string =>
	buildUrlWithParams(url, [...parseQueryParams(url), { id: 'auth', key, value, enabled: true }]);

/**
 * Fold the auth scheme into the request. Returns the effective headers and URL;
 * an incomplete configuration (e.g. empty token) is a no-op so partial input
 * never sends a malformed credential.
 */
export const applyAuth = (
	headers: readonly HeaderTuple[],
	url: string,
	auth: AuthConfig
): { readonly headers: readonly HeaderTuple[]; readonly url: string } => {
	if (auth.type === 'bearer') {
		const token = auth.token.trim();
		return token.length > 0
			? { headers: [...headers, ['Authorization', `Bearer ${token}`]], url }
			: { headers, url };
	}
	if (auth.type === 'basic') {
		if (auth.username.length === 0 && auth.password.length === 0) return { headers, url };
		const encoded = utf8ToBase64(`${auth.username}:${auth.password}`);
		return { headers: [...headers, ['Authorization', `Basic ${encoded}`]], url };
	}
	if (auth.type === 'apikey') {
		const name = auth.apiKeyName.trim();
		if (name.length === 0) return { headers, url };
		return auth.apiKeyLocation === 'query'
			? { headers, url: appendQueryParam(url, name, auth.apiKeyValue) }
			: { headers: [...headers, [name, auth.apiKeyValue]], url };
	}
	return { headers, url };
};

export interface RestRequest {
	readonly method: HttpMethod | string;
	readonly url: string;
	readonly headers: readonly HeaderTuple[];
	readonly body?: string;
	readonly followRedirects: boolean;
	readonly timeoutMs: number;
}

export interface RestResponse {
	readonly status: number;
	readonly statusText: string;
	readonly headers: readonly HeaderTuple[];
	readonly body: string;
	readonly bytesReceived: number;
	readonly elapsedMs: number;
	readonly finalUrl: string;
}

/** Bounds on the timeout slider (milliseconds). */
export const TIMEOUT_MIN_MS = 1_000;
export const TIMEOUT_MAX_MS = 60_000;
export const TIMEOUT_STEP_MS = 1_000;
export const TIMEOUT_DEFAULT_MS = 10_000;

/** Sample endpoints — public httpbin echo service. */
export const SAMPLE_GET_URL = 'https://httpbin.org/json';
export const SAMPLE_POST_URL = 'https://httpbin.org/post';
export const SAMPLE_POST_BODY = `{
  "hello": "world",
  "count": 1
}`;

/** Send an HTTP request via the Tauri backend. */
export const sendRequest = (req: RestRequest): Promise<RestResponse> =>
	invoke<RestResponse>('rest_client_send', { req });

/** Convert UI header rows to the tuple form expected by the backend. */
export const headersToTuples = (entries: readonly HeaderEntry[]): readonly HeaderTuple[] =>
	entries
		.filter((h) => h.enabled && h.key.trim().length > 0)
		.map((h) => [h.key.trim(), h.value] as const);

/** Case-insensitive lookup for a header value. */
export const headerValue = (headers: readonly HeaderTuple[], name: string): string | undefined => {
	const lower = name.toLowerCase();
	return headers.find(([k]) => k.toLowerCase() === lower)?.[1];
};

/**
 * Pretty-print a response body when the Content-Type indicates JSON.
 * Returns the original body unchanged for non-JSON or invalid JSON payloads.
 */
export const formatResponseBody = (body: string, contentType: string | undefined): string => {
	if (!contentType) return body;
	const lower = contentType.toLowerCase();
	if (!lower.includes('application/json') && !lower.includes('+json')) return body;
	try {
		const parsed = JSON.parse(body) as unknown;
		return JSON.stringify(parsed, null, 2);
	} catch {
		return body;
	}
};

/** Tone classification used by the response status badge. */
export type StatusTone = 'success' | 'info' | 'warning' | 'destructive';

export const statusTone = (status: number): StatusTone => {
	if (status >= 200 && status < 300) return 'success';
	if (status >= 300 && status < 400) return 'info';
	if (status >= 500 && status < 600) return 'destructive';
	// Treat unknown / 1xx / 4xx all as warning tone for the response badge.
	return 'warning';
};

/** Format a byte count for compact display in the status bar. */
export const formatBytes = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const shellEscape = (input: string): string => `'${input.replace(/'/g, `'\\''`)}'`;

/**
 * Build a single-line cURL command equivalent to the supplied request.
 * Useful for sharing or pasting into a terminal.
 */
export const exportAsCurl = (req: RestRequest): string => {
	const parts: string[] = ['curl'];
	const method = req.method.toUpperCase();
	if (method !== 'GET') {
		parts.push('-X', method);
	}
	for (const [key, value] of req.headers) {
		parts.push('-H', shellEscape(`${key}: ${value}`));
	}
	if (req.body && req.body.length > 0) {
		parts.push('--data', shellEscape(req.body));
	}
	if (req.followRedirects) {
		parts.push('-L');
	}
	parts.push(shellEscape(req.url));
	return parts.join(' ');
};

/** Generate a stable id for a new header row (used as a React key). */
export const createHeaderId = (): string =>
	`hdr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Empty header row factory. */
export const createEmptyHeader = (): HeaderEntry => ({
	id: createHeaderId(),
	key: '',
	value: '',
	enabled: true,
});
