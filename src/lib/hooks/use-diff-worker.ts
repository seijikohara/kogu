/**
 * Bridges `diff-viewer.tsx` to the text-diff computation worker.
 *
 * The typed inputs are debounced before dispatch so a fast typist does not
 * queue a worker request per keystroke, and a monotonic request id discards
 * stale responses so an out-of-order return cannot tear the UI. The previous
 * result stays visible while a new one computes.
 */
import { useEffect, useRef, useState } from 'react';

import type { DiffOptions, EnhancedDiffResult } from '@/lib/services/text-diff';
import type { DiffRequest, DiffResponse } from '@/lib/workers/diff.worker';

import { useDebouncedValue } from './use-debounced-value';

export interface UseDiffWorkerInput {
	readonly leftText: string;
	readonly rightText: string;
	/** Pass a stable (memoized) reference so the effect only fires on real changes. */
	readonly options: Partial<DiffOptions>;
	readonly contextLines: number;
}

export interface UseDiffWorkerOutput {
	readonly enhancedDiff: EnhancedDiffResult | null;
	readonly isIdentical: boolean | null;
	readonly isPending: boolean;
}

const EMPTY_OUTPUT: UseDiffWorkerOutput = {
	enhancedDiff: null,
	isIdentical: null,
	isPending: false,
};

export const useDiffWorker = (input: UseDiffWorkerInput): UseDiffWorkerOutput => {
	const workerRef = useRef<Worker | null>(null);
	const latestIdRef = useRef(0);
	const [output, setOutput] = useState<UseDiffWorkerOutput>(EMPTY_OUTPUT);

	const debouncedLeft = useDebouncedValue(input.leftText, 180);
	const debouncedRight = useDebouncedValue(input.rightText, 180);

	// Lazy single worker instance for the lifetime of the route.
	useEffect(() => {
		const worker = new Worker(new URL('@/lib/workers/diff.worker.ts', import.meta.url), {
			type: 'module',
		});
		workerRef.current = worker;
		const handleMessage = (event: MessageEvent<DiffResponse>) => {
			// Discard stale responses; only the most recently requested id wins.
			if (event.data.id !== latestIdRef.current) return;
			setOutput({
				enhancedDiff: event.data.enhancedDiff,
				isIdentical: event.data.isIdentical,
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
		const id = latestIdRef.current + 1;
		latestIdRef.current = id;
		setOutput((prev) => ({ ...prev, isPending: true }));
		const request: DiffRequest = {
			id,
			leftText: debouncedLeft,
			rightText: debouncedRight,
			options: input.options,
			contextLines: input.contextLines,
		};
		worker.postMessage(request);
	}, [debouncedLeft, debouncedRight, input.options, input.contextLines]);

	return output;
};
