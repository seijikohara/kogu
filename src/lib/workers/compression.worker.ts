/**
 * String Compressor output-formatting worker.
 *
 * The Tauri command does the actual (de)compression off-thread, but the route
 * still rendered the compressed bytes on the main thread — `bytesToHex` over a
 * multi-megabyte buffer for hex output blocked the UI for hundreds of
 * milliseconds. This worker runs that formatting off the event loop. The
 * conversion helpers are Tauri-free, so importing them here is safe.
 *
 * Decoding the (smaller, already-compressed) decompress input stays on the main
 * thread; only the larger output formatting is offloaded.
 *
 * Message protocol:
 *
 * ```
 * main -> worker: CompressionFormatRequest { id, bytes, format, hexGroup, hexSeparator }
 * worker -> main: CompressionFormatResponse { id, output }
 * ```
 */
import { bytesToBase64, bytesToDataUri, bytesToHex } from '@/lib/services/compression-bytes';

export type CompressionOutputFormat = 'hex' | 'base64' | 'data-uri';

export interface CompressionFormatRequest {
	readonly id: number;
	readonly bytes: Uint8Array;
	readonly format: CompressionOutputFormat;
	readonly hexGroup: number;
	readonly hexSeparator: string;
}

export interface CompressionFormatResponse {
	readonly id: number;
	readonly output: string;
}

self.addEventListener('message', (event: MessageEvent<CompressionFormatRequest>) => {
	const req = event.data;
	const output =
		req.format === 'hex'
			? bytesToHex(req.bytes, { upper: true, group: req.hexGroup, separator: req.hexSeparator })
			: req.format === 'data-uri'
				? bytesToDataUri(req.bytes, 'application/octet-stream')
				: bytesToBase64(req.bytes);
	self.postMessage({ id: req.id, output } satisfies CompressionFormatResponse);
});
