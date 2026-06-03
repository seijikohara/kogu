/**
 * Text-diff computation worker.
 *
 * The Longest Common Subsequence (LCS) line diff is O(m×n) in the two
 * documents and the inline character diff adds O(chars²) per modified line
 * pair. Run on the main thread for two large pastes this blocks the webview
 * for seconds on every keystroke. This worker moves both off the event loop.
 *
 * Message protocol:
 *
 * ```
 * main -> worker: DiffRequest { id, leftText, rightText, options, contextLines }
 * worker -> main: DiffResponse { id, enhancedDiff, isIdentical, error }
 * ```
 *
 * `id` is monotonically increasing per request; the bridging hook keeps the
 * latest id and discards any response carrying a smaller one, so a slow diff
 * followed by a quick one cannot tear the UI.
 */
import {
	areTextsIdentical,
	computeEnhancedDiff,
	type DiffOptions,
	type EnhancedDiffResult,
} from '@/lib/services/text-diff';

export interface DiffRequest {
	readonly id: number;
	readonly leftText: string;
	readonly rightText: string;
	readonly options: Partial<DiffOptions>;
	readonly contextLines: number;
}

export interface DiffResponse {
	readonly id: number;
	readonly enhancedDiff: EnhancedDiffResult | null;
	readonly isIdentical: boolean | null;
	readonly error: string | null;
}

self.addEventListener('message', (event: MessageEvent<DiffRequest>) => {
	const { id, leftText, rightText, options, contextLines } = event.data;
	// Empty on both sides mirrors the route's "nothing to diff" state.
	if (!leftText && !rightText) {
		self.postMessage({
			id,
			enhancedDiff: null,
			isIdentical: null,
			error: null,
		} satisfies DiffResponse);
		return;
	}
	try {
		const enhancedDiff = computeEnhancedDiff(leftText, rightText, options, contextLines);
		const isIdentical = areTextsIdentical(leftText, rightText, options);
		self.postMessage({ id, enhancedDiff, isIdentical, error: null } satisfies DiffResponse);
	} catch (err) {
		const error = err instanceof Error ? err.message : 'diff worker failed';
		self.postMessage({ id, enhancedDiff: null, isIdentical: null, error } satisfies DiffResponse);
	}
});
