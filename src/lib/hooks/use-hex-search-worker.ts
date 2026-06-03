/**
 * Bridges `hex-editor.tsx` to the byte-search worker.
 *
 * Runs `findAllMatches` off the main thread and keeps the previous match list
 * visible while a new search runs. A monotonic request id discards stale
 * responses (a superseded buffer edit or pattern change). The caller is
 * expected to debounce the search input upstream.
 */
import { useEffect, useRef, useState } from 'react';

import type { HexSearchRequest, HexSearchResponse } from '@/lib/workers/hex-search.worker';

export interface UseHexSearchInput {
	readonly buffer: Uint8Array | null;
	readonly pattern: Uint8Array | null;
}

export interface UseHexSearchOutput {
	readonly matches: readonly number[];
	readonly isPending: boolean;
}

const EMPTY_OUTPUT: UseHexSearchOutput = { matches: [], isPending: false };

export const useHexSearchWorker = (input: UseHexSearchInput): UseHexSearchOutput => {
	const workerRef = useRef<Worker | null>(null);
	const latestIdRef = useRef(0);
	const [output, setOutput] = useState<UseHexSearchOutput>(EMPTY_OUTPUT);

	useEffect(() => {
		const worker = new Worker(new URL('@/lib/workers/hex-search.worker.ts', import.meta.url), {
			type: 'module',
		});
		workerRef.current = worker;
		const handleMessage = (event: MessageEvent<HexSearchResponse>) => {
			if (event.data.id !== latestIdRef.current) return;
			setOutput({ matches: event.data.matches, isPending: false });
		};
		worker.addEventListener('message', handleMessage);
		return () => {
			worker.removeEventListener('message', handleMessage);
			worker.terminate();
			workerRef.current = null;
		};
	}, []);

	const { buffer, pattern } = input;

	useEffect(() => {
		const worker = workerRef.current;
		if (!worker) return;
		if (!buffer || !pattern || pattern.length === 0) {
			latestIdRef.current += 1;
			setOutput(EMPTY_OUTPUT);
			return;
		}
		const id = latestIdRef.current + 1;
		latestIdRef.current = id;
		setOutput((prev) => ({ ...prev, isPending: true }));
		// Structure-clone the buffer to the worker; the route keeps its own copy
		// for rendering and editing.
		const request: HexSearchRequest = { id, buffer, pattern };
		worker.postMessage(request);
	}, [buffer, pattern]);

	return output;
};
