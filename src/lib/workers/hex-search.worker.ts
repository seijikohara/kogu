/**
 * Hex Editor byte-search worker.
 *
 * `findAllMatches` is a naive O(n×m) scan over the whole buffer. On the main
 * thread it ran on every search keystroke with no debounce, freezing the UI
 * for up to a couple of seconds on a large binary. This worker runs the scan
 * off the event loop.
 *
 * Message protocol:
 *
 * ```
 * main -> worker: HexSearchRequest { id, buffer, pattern }
 * worker -> main: HexSearchResponse { id, matches }
 * ```
 *
 * `id` is monotonic; the bridging hook keeps the latest id and discards stale
 * responses so a superseded buffer or pattern cannot tear the UI.
 */
import { findAllMatches } from '@/lib/services/hex-editor';

export interface HexSearchRequest {
	readonly id: number;
	readonly buffer: Uint8Array;
	readonly pattern: Uint8Array;
}

export interface HexSearchResponse {
	readonly id: number;
	readonly matches: readonly number[];
}

self.addEventListener('message', (event: MessageEvent<HexSearchRequest>) => {
	const { id, buffer, pattern } = event.data;
	const matches = pattern.length === 0 ? [] : findAllMatches(buffer, pattern);
	self.postMessage({ id, matches } satisfies HexSearchResponse);
});
