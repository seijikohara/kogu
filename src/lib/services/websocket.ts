/**
 * WebSocket Tester service.
 *
 * Thin TypeScript wrapper around the Tauri `ws_connect` / `ws_send` /
 * `ws_close` commands and the `ws_message` / `ws_state` event channels.
 * The Rust backend keeps the active connection map; this module exposes
 * type-safe entry points and a small set of helpers used by the UI.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/** Lifecycle state reported on the `ws_state` channel. `idle` is a frontend-
 * only sentinel before the first connect attempt. */
export type WsConnectionState = 'idle' | 'connecting' | 'open' | 'closing' | 'closed';

/** Frame variant carried by a single bubble in the chat log. */
export type WsFrameKind = 'text' | 'binary' | 'ping' | 'pong' | 'close';

/** Bubble direction. `sent` is reflected back from the backend so both sides
 * appear in the same stream. */
export type WsDirection = 'sent' | 'received';

/** Single frame as rendered in the log. */
export interface WsFrame {
	readonly connId: string;
	readonly direction: WsDirection;
	readonly kind: WsFrameKind;
	/** Text payload, or hex-encoded bytes for `binary` / `ping` / `pong`. */
	readonly data: string;
	/** Original byte size before any preview truncation. */
	readonly sizeBytes: number;
	readonly timestampMs: number;
}

/** Connection-state transition. */
export interface WsStateChange {
	readonly connId: string;
	readonly state: WsConnectionState;
	readonly reason?: string;
}

/** Default sample URL exposed in the rail's "Samples" section. */
export const SAMPLE_URL = 'wss://echo.websocket.events';

/**
 * Open a WebSocket connection. State and frame events are streamed back via
 * [`onWsState`] and [`onWsMessage`]. Custom headers are accepted for API
 * stability but currently ignored by the backend (MVP).
 */
export const wsConnect = (
	connId: string,
	url: string,
	headers: readonly (readonly [string, string])[],
	subprotocols: readonly string[]
): Promise<void> =>
	invoke('ws_connect', {
		connId,
		url,
		headers: headers.map(([k, v]) => [k, v]),
		subprotocols: [...subprotocols],
	});

/** Send a single frame. `kind` is `'text'` for a UTF-8 string or `'binary'`
 * for a hex-encoded byte string. */
export const wsSend = (connId: string, kind: 'text' | 'binary', data: string): Promise<void> =>
	invoke('ws_send', { connId, kind, data });

/** Initiate a clean close. The matching `closed` state is emitted on
 * `ws_state` once the close handshake finishes. */
export const wsClose = (connId: string): Promise<void> => invoke('ws_close', { connId });

/** Subscribe to inbound frames. The returned function unsubscribes. */
export const onWsMessage = (handler: (frame: WsFrame) => void): Promise<UnlistenFn> =>
	listen<WsFrame>('ws_message', (event) => handler(event.payload));

/** Subscribe to connection-state transitions. */
export const onWsState = (handler: (change: WsStateChange) => void): Promise<UnlistenFn> =>
	listen<WsStateChange>('ws_state', (event) => handler(event.payload));

/**
 * Decode a hex string into bytes. Whitespace and the common ASCII
 * separators (`:`, `-`, `,`, `_`) are ignored so users can paste either
 * `48 65 6c 6c 6f` or `48:65:6c:6c:6f` without preprocessing.
 */
export const hexToBytes = (hex: string): Uint8Array => {
	const cleaned = hex.replace(/[\s:_,-]/g, '');
	if (cleaned.length % 2 !== 0) {
		throw new Error('Hex string must have an even number of digits');
	}
	const bytes = new Uint8Array(cleaned.length / 2);
	for (let i = 0; i < cleaned.length; i += 2) {
		const pair = cleaned.slice(i, i + 2);
		const value = Number.parseInt(pair, 16);
		if (Number.isNaN(value)) {
			throw new Error(`Invalid hex pair: ${pair}`);
		}
		bytes[i / 2] = value;
	}
	return bytes;
};

/** Encode bytes as a lowercase, separator-free hex string. */
export const bytesToHex = (bytes: Uint8Array): string =>
	[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Result of an attempted JSON pretty-print. `isJson` is `false` when the
 * input did not parse as JSON; in that case `text` is returned unchanged. */
export interface PrettyJsonResult {
	readonly text: string;
	readonly isJson: boolean;
}

/**
 * Attempt to parse `text` as JSON and pretty-print it with 2-space indent.
 * Returns the original text and `isJson: false` when parsing fails.
 */
export const tryPrettifyJson = (text: string): PrettyJsonResult => {
	const trimmed = text.trim();
	if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
		return { text, isJson: false };
	}
	try {
		const parsed: unknown = JSON.parse(trimmed);
		return { text: JSON.stringify(parsed, null, 2), isJson: true };
	} catch {
		return { text, isJson: false };
	}
};

/** Split a comma-separated subprotocol string into a clean readonly list. */
export const parseSubprotocols = (input: string): readonly string[] =>
	input
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

/** Hex-dump a hex string to a space-separated, ASCII-paired layout. The
 * first `maxBytes` bytes are rendered; longer payloads are truncated with
 * a trailing `...` marker. */
export const formatHexDump = (hex: string, maxBytes = 256): string => {
	const cleaned = hex.replace(/\s/g, '');
	const byteCount = Math.floor(cleaned.length / 2);
	const renderBytes = Math.min(byteCount, maxBytes);
	const groups: string[] = [];
	for (let i = 0; i < renderBytes; i += 1) {
		groups.push(cleaned.slice(i * 2, i * 2 + 2));
	}
	const grouped = groups.join(' ');
	return byteCount > maxBytes ? `${grouped} ... (${byteCount - maxBytes} more bytes)` : grouped;
};
