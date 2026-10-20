/**
 * Bridges `hex-editor.tsx` to the byte-search worker.
 *
 * Runs `findAllMatches` off the main thread and keeps the previous match list
 * visible while a new search runs. A monotonic request id discards stale
 * responses (a superseded buffer edit or pattern change). The caller is
 * expected to debounce the search input upstream.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

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
const FIRST_PENDING_OUTPUT: UseHexSearchOutput = { ...EMPTY_OUTPUT, isPending: true };

interface SearchResult {
	readonly request: HexSearchRequest;
	readonly matches: readonly number[];
}

export const useHexSearchWorker = (input: UseHexSearchInput): UseHexSearchOutput => {
	const workerRef = useRef<Worker | null>(null);
	const latestIdRef = useRef(0);
	// The request tagged `latestIdRef`. Its response is stored together with its
	// inputs so `isPending` can be derived by comparing them with the current input.
	const latestRequestRef = useRef<HexSearchRequest | null>(null);
	const [result, setResult] = useState<SearchResult | null>(null);

	useEffect(() => {
		const worker = new Worker(new URL('@/lib/workers/hex-search.worker.ts', import.meta.url), {
			type: 'module',
		});
		workerRef.current = worker;
		const handleMessage = (event: MessageEvent<HexSearchResponse>) => {
			const request = latestRequestRef.current;
			if (!request || event.data.id !== latestIdRef.current) return;
			setResult({ request, matches: event.data.matches });
		};
		worker.addEventListener('message', handleMessage);
		return () => {
			worker.removeEventListener('message', handleMessage);
			worker.terminate();
			workerRef.current = null;
		};
	}, []);

	const { buffer, pattern } = input;
	const hasQuery = buffer !== null && pattern !== null && pattern.length > 0;

	// Drop the stored matches during render once the query is cleared, so the next
	// query starts from an empty list instead of the matches of an older query.
	if (!hasQuery && result !== null) {
		setResult(null);
	}

	useEffect(() => {
		const worker = workerRef.current;
		if (!worker) return;
		if (!buffer || !pattern || pattern.length === 0) {
			latestIdRef.current += 1;
			latestRequestRef.current = null;
			return;
		}
		const id = latestIdRef.current + 1;
		latestIdRef.current = id;
		// Structure-clone the buffer to the worker; the route keeps its own copy
		// for rendering and editing.
		const request: HexSearchRequest = { id, buffer, pattern };
		latestRequestRef.current = request;
		worker.postMessage(request);
	}, [buffer, pattern]);

	return useMemo<UseHexSearchOutput>(() => {
		if (!hasQuery) return EMPTY_OUTPUT;
		if (!result) return FIRST_PENDING_OUTPUT;
		// Keep the previous matches visible while a newer search runs.
		const isPending = result.request.buffer !== buffer || result.request.pattern !== pattern;
		return { matches: result.matches, isPending };
	}, [hasQuery, result, buffer, pattern]);
};
