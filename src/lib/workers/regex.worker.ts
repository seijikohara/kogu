/**
 * Regex computation worker.
 *
 * Runs the expensive `regexp-tree` AST construction + railroad
 * visualization off the main thread so typing in
 * `/regex-tester` does not stall the UI. The cheap validity check
 * (`compileRegex`) stays on the main thread because the badge needs
 * to mirror every keystroke.
 *
 * Message protocol:
 *
 * ```
 * main -> worker: RegexRequest { id, pattern, flagString, testText, replacement }
 * worker -> main: RegexResponse { id, viz, matches, replaced, features, captureGroupCount }
 * ```
 *
 * `id` is monotonically increasing per request. The main-thread hook
 * keeps the latest id and discards any response carrying a smaller
 * id so out-of-order returns from a fast pattern followed by a slow
 * one don't tear the UI.
 */
import { findMatches, replaceText, type RegexMatch } from '@/lib/services/regex';
import { countCaptureGroups, findFeatures, type FeatureUsage } from '@/lib/services/regex';
import { visualizeRegex, type VizNode } from '@/lib/services/regex-viz';

type Result<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: string };

export interface RegexRequest {
	readonly id: number;
	readonly pattern: string;
	readonly flagString: string;
	readonly testText: string;
	readonly replacement: string;
}

export interface RegexResponse {
	readonly id: number;
	readonly viz: Result<VizNode>;
	readonly matches: readonly RegexMatch[];
	readonly replaced: Result<string>;
	readonly features: readonly FeatureUsage[];
	readonly captureGroupCount: number;
}

/**
 * Build the `RegexFlags` shape `findMatches` / `replaceText` expect
 * from a compiled `flagString`. The string was already produced by
 * `flagsToString` on the main thread so order and presence are
 * stable.
 */
const flagsFromString = (flagString: string) => ({
	global: flagString.includes('g'),
	ignoreCase: flagString.includes('i'),
	multiline: flagString.includes('m'),
	dotAll: flagString.includes('s'),
	unicode: flagString.includes('u'),
	sticky: flagString.includes('y'),
});

const handle = (request: RegexRequest): RegexResponse => {
	const flags = flagsFromString(request.flagString);
	const viz = visualizeRegex(request.pattern, request.flagString);
	const matchesResult = findMatches(request.pattern, flags, request.testText);
	const matches = matchesResult.ok ? matchesResult.value : [];
	const replaced = replaceText(request.pattern, flags, request.testText, request.replacement);
	const features = findFeatures(request.pattern);
	const captureGroupCount = countCaptureGroups(request.pattern);
	return { id: request.id, viz, matches, replaced, features, captureGroupCount };
};

self.addEventListener('message', (event: MessageEvent<RegexRequest>) => {
	try {
		const response = handle(event.data);
		self.postMessage(response satisfies RegexResponse);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'regex worker failed';
		self.postMessage({
			id: event.data.id,
			viz: { ok: false, error: message },
			matches: [],
			replaced: { ok: false, error: message },
			features: [],
			captureGroupCount: 0,
		} satisfies RegexResponse);
	}
});
