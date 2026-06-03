/**
 * Base64 encode / decode worker.
 *
 * `encodeToBase64` / `decodeFromBase64` walk the whole payload (atob/btoa plus
 * per-character loops). Decoding an 8 MB Data URL (image / PDF / octet-stream —
 * an intended use case) blocked the main thread for ~300 ms. This worker runs
 * the transform off the event loop.
 *
 * Message protocol:
 *
 * ```
 * main -> worker: Base64Request { id, mode, input, encodeOptions, decodeOptions }
 * worker -> main: Base64Response { id, output, error }
 * ```
 *
 * `id` is monotonic; the bridging hook keeps the latest id and discards stale
 * responses so a superseded input cannot tear the UI.
 */
import {
	decodeFromBase64,
	encodeToBase64,
	type Base64DecodeOptions,
	type Base64EncodeOptions,
} from '@/lib/services/encoders/base64';

export type Base64Mode = 'encode' | 'decode';

export interface Base64Request {
	readonly id: number;
	readonly mode: Base64Mode;
	readonly input: string;
	readonly encodeOptions: Partial<Base64EncodeOptions>;
	readonly decodeOptions: Partial<Base64DecodeOptions>;
}

export interface Base64Response {
	readonly id: number;
	readonly output: string;
	readonly error: string;
}

self.addEventListener('message', (event: MessageEvent<Base64Request>) => {
	const { id, mode, input, encodeOptions, decodeOptions } = event.data;
	if (!input.trim()) {
		self.postMessage({ id, output: '', error: '' } satisfies Base64Response);
		return;
	}
	try {
		const output =
			mode === 'encode'
				? encodeToBase64(input, encodeOptions)
				: decodeFromBase64(input, decodeOptions);
		self.postMessage({ id, output, error: '' } satisfies Base64Response);
	} catch (e) {
		const error = e instanceof Error ? e.message : 'Invalid input';
		self.postMessage({ id, output: '', error } satisfies Base64Response);
	}
});
