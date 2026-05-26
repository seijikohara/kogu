import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/** Successful start payload returned by the Rust backend. */
export interface WebhookStartResult {
	readonly address: string;
	readonly port: number;
}

/** Current server state reported by the backend. */
export interface WebhookStatus {
	readonly running: boolean;
	readonly address: string | null;
	readonly port: number | null;
}

/** A captured incoming HTTP request as emitted on the `webhook_request` event. */
export interface WebhookRequest {
	readonly id: string;
	readonly timestampMs: number;
	readonly method: string;
	readonly path: string;
	readonly query: string;
	readonly headers: readonly (readonly [string, string])[];
	readonly body: string;
	readonly bodyBytes: number;
	readonly remoteAddr: string;
}

/** Parameters for starting the listener. `port` omitted = ephemeral port. */
export interface WebhookStartParams {
	readonly port?: number;
	readonly status: number;
	readonly responseBody: string;
	readonly responseContentType: string;
}

/** Start the local listener. Returns the actual bound address. */
export const webhookStart = (params: WebhookStartParams): Promise<WebhookStartResult> =>
	invoke<WebhookStartResult>('webhook_start', {
		port: params.port,
		status: params.status,
		responseBody: params.responseBody,
		responseContentType: params.responseContentType,
	});

/** Stop the local listener. Safe to call when already stopped. */
export const webhookStop = (): Promise<void> => invoke<void>('webhook_stop');

/** Query the current server state. */
export const webhookStatus = (): Promise<WebhookStatus> => invoke<WebhookStatus>('webhook_status');

/**
 * Subscribe to incoming requests. The returned promise resolves to an
 * unlisten function — call it inside the `useEffect` cleanup.
 */
export const onWebhookRequest = (handler: (req: WebhookRequest) => void): Promise<UnlistenFn> =>
	listen<WebhookRequest>('webhook_request', (event) => handler(event.payload));

/** Per-method tone mapping for the request log badge. */
export const METHOD_TONES: Readonly<
	Record<string, 'success' | 'info' | 'warning' | 'destructive'>
> = {
	GET: 'success',
	POST: 'info',
	PUT: 'warning',
	PATCH: 'warning',
	DELETE: 'destructive',
	OPTIONS: 'info',
	HEAD: 'info',
};

/** Default fallback tone for unknown methods. */
export const DEFAULT_METHOD_TONE = 'info' as const;

/** Resolve a tone for a method label, falling back to `DEFAULT_METHOD_TONE`. */
export const methodTone = (method: string): 'success' | 'info' | 'warning' | 'destructive' =>
	METHOD_TONES[method.toUpperCase()] ?? DEFAULT_METHOD_TONE;

/** Find a header value case-insensitively. */
export const headerValue = (
	headers: readonly (readonly [string, string])[],
	name: string
): string | undefined => {
	const lower = name.toLowerCase();
	return headers.find(([k]) => k.toLowerCase() === lower)?.[1];
};

/** Format a byte count for compact display. */
export const formatBytes = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/** Format an epoch ms timestamp as `HH:MM:SS.mmm`. */
export const formatTimestamp = (ms: number): string => {
	const date = new Date(ms);
	const pad = (n: number, width = 2): string => n.toString().padStart(width, '0');
	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(
		date.getMilliseconds(),
		3
	)}`;
};

/**
 * Pretty-print a body when the Content-Type indicates JSON. Returns the
 * original text and `isJson=false` when parsing fails or the content type
 * is not JSON.
 */
export const tryPrettifyJson = (
	body: string,
	contentType: string | undefined
): { readonly text: string; readonly isJson: boolean } => {
	if (!contentType) return { text: body, isJson: false };
	const lower = contentType.toLowerCase();
	if (!lower.includes('application/json') && !lower.includes('+json')) {
		return { text: body, isJson: false };
	}
	try {
		const parsed = JSON.parse(body) as unknown;
		return { text: JSON.stringify(parsed, null, 2), isJson: true };
	} catch {
		return { text: body, isJson: false };
	}
};

/** Parse a URL query string into an ordered list of pairs. */
export const parseQueryPairs = (query: string): readonly (readonly [string, string])[] => {
	if (!query) return [];
	const trimmed = query.startsWith('?') ? query.slice(1) : query;
	return trimmed
		.split('&')
		.filter((part) => part.length > 0)
		.map((part) => {
			const eq = part.indexOf('=');
			if (eq < 0) return [decodeURIComponentSafe(part), ''] as const;
			return [
				decodeURIComponentSafe(part.slice(0, eq)),
				decodeURIComponentSafe(part.slice(eq + 1)),
			] as const;
		});
};

const decodeURIComponentSafe = (input: string): string => {
	try {
		return decodeURIComponent(input.replace(/\+/g, ' '));
	} catch {
		return input;
	}
};

const shellEscape = (input: string): string => `'${input.replace(/'/g, `'\\''`)}'`;

/**
 * Render a cURL command that reproduces the captured request against the
 * supplied replay URL (the running server's origin + path + query).
 */
export const exportAsCurl = (req: WebhookRequest, replayUrl: string): string => {
	const parts: string[] = ['curl'];
	const method = req.method.toUpperCase();
	if (method !== 'GET') {
		parts.push('-X', method);
	}
	req.headers.forEach(([key, value]) => {
		const lower = key.toLowerCase();
		// Skip transport-level headers cURL will set itself based on body.
		if (lower === 'content-length' || lower === 'host') return;
		parts.push('-H', shellEscape(`${key}: ${value}`));
	});
	if (req.body.length > 0) {
		parts.push('--data', shellEscape(req.body));
	}
	parts.push(shellEscape(replayUrl));
	return parts.join(' ');
};
