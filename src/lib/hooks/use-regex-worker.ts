/**
 * Bridges `regex-tester.tsx` to the regex computation worker.
 *
 * Maintains a monotonic request id so responses arriving out of order
 * (slow pattern followed by a quick one) cannot tear the UI. Only
 * responses whose id matches the latest request are applied.
 */
import { useEffect, useRef, useState } from 'react';

import type { RegexRequest, RegexResponse } from '@/lib/workers/regex.worker';

type Result<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: string };

export interface UseRegexWorkerInput {
	readonly pattern: string;
	readonly flagString: string;
	readonly testText: string;
	readonly replacement: string;
}

export interface UseRegexWorkerOutput {
	readonly viz: Result<import('@/lib/services/regex-viz').VizNode> | null;
	readonly matches: readonly import('@/lib/services/regex').RegexMatch[];
	readonly replaced: Result<string> | null;
	readonly features: readonly import('@/lib/services/regex').FeatureUsage[];
	readonly captureGroupCount: number;
	readonly isPending: boolean;
}

const EMPTY_OUTPUT: UseRegexWorkerOutput = {
	viz: null,
	matches: [],
	replaced: null,
	features: [],
	captureGroupCount: 0,
	isPending: false,
};

export const useRegexWorker = (input: UseRegexWorkerInput): UseRegexWorkerOutput => {
	const workerRef = useRef<Worker | null>(null);
	const latestIdRef = useRef(0);
	const [output, setOutput] = useState<UseRegexWorkerOutput>(EMPTY_OUTPUT);

	// Lazy single worker instance for the lifetime of the route.
	useEffect(() => {
		const worker = new Worker(new URL('@/lib/workers/regex.worker.ts', import.meta.url), {
			type: 'module',
		});
		workerRef.current = worker;
		const handleMessage = (event: MessageEvent<RegexResponse>) => {
			// Discard stale responses; only the most recently requested id wins.
			if (event.data.id !== latestIdRef.current) return;
			setOutput({
				viz: event.data.viz,
				matches: event.data.matches,
				replaced: event.data.replaced,
				features: event.data.features,
				captureGroupCount: event.data.captureGroupCount,
				isPending: false,
			});
		};
		worker.addEventListener('message', handleMessage);
		return () => {
			worker.removeEventListener('message', handleMessage);
			worker.terminate();
			workerRef.current = null;
		};
	}, []);

	useEffect(() => {
		const worker = workerRef.current;
		if (!worker) return;
		const nextId = latestIdRef.current + 1;
		latestIdRef.current = nextId;
		setOutput((prev) => ({ ...prev, isPending: true }));
		const request: RegexRequest = {
			id: nextId,
			pattern: input.pattern,
			flagString: input.flagString,
			testText: input.testText,
			replacement: input.replacement,
		};
		worker.postMessage(request);
	}, [input.pattern, input.flagString, input.testText, input.replacement]);

	return output;
};
