/**
 * Encoding-conversion worker.
 *
 * Encoding detection runs jschardet plus a Latin-1 build loop that is O(N²)
 * in V8 (rope-string pressure), and the single-byte / UTF-16 encoders walk
 * every code unit. On the main thread an 8–10 MB legacy-encoded file blocks
 * the webview for hundreds of milliseconds on load and on every option change.
 * This worker runs the whole detect → decode → encode → base64 pipeline off
 * the event loop.
 *
 * Message protocol:
 *
 * ```
 * main -> worker: EncodingConvertRequest { id, sourceBytes, overrideEncoding, target… }
 * worker -> main: EncodingConvertResponse { id, detected, decodedText, targetBytes, … }
 * ```
 *
 * `id` is monotonic; the bridging hook keeps the latest id and discards stale
 * responses so a superseded file or option toggle cannot tear the UI.
 */
import {
	applyBomAction,
	bytesToBase64,
	decodeBytes,
	detectEncoding,
	encodeText,
	type BomAction,
	type DetectedEncoding,
	type Encoding,
	type LineEnding,
} from '@/lib/services/encoding-converter';

export interface EncodingConvertRequest {
	readonly id: number;
	readonly sourceBytes: Uint8Array;
	readonly overrideEncoding: Encoding | null;
	readonly targetEncoding: Encoding;
	readonly lineEnding: LineEnding;
	readonly bomAction: BomAction;
}

export interface EncodingConvertResponse {
	readonly id: number;
	readonly detected: DetectedEncoding | null;
	readonly decodedText: string;
	readonly targetBytes: Uint8Array;
	readonly targetText: string;
	readonly base64: string;
	readonly error: string | null;
}

self.addEventListener('message', (event: MessageEvent<EncodingConvertRequest>) => {
	const req = event.data;
	try {
		const detected = detectEncoding(req.sourceBytes);
		const effectiveSource = req.overrideEncoding ?? detected.encoding;
		const decodedText = decodeBytes(req.sourceBytes, effectiveSource);
		const encoded = encodeText(decodedText, req.targetEncoding, req.lineEnding);
		const targetBytes = applyBomAction(encoded, req.targetEncoding, req.bomAction);
		const targetText = decodeBytes(targetBytes, req.targetEncoding);
		const base64 = bytesToBase64(targetBytes);
		self.postMessage(
			{
				id: req.id,
				detected,
				decodedText,
				targetBytes,
				targetText,
				base64,
				error: null,
			} satisfies EncodingConvertResponse,
			[targetBytes.buffer as ArrayBuffer]
		);
	} catch (err) {
		const error = err instanceof Error ? err.message : 'encoding worker failed';
		self.postMessage({
			id: req.id,
			detected: null,
			decodedText: '',
			targetBytes: new Uint8Array(0),
			targetText: '',
			base64: '',
			error,
		} satisfies EncodingConvertResponse);
	}
});
