/**
 * Bridges `file-inspector.tsx` to the file-inspect decoding / hashing worker.
 *
 * The worker decodes the full file bytes and computes every hash off the main
 * thread, so selecting a large file no longer freezes the webview. A monotonic
 * request id discards responses from a superseded file, and the decoded buffer
 * is handed back through an `onBuffer` callback so the route can build the
 * image / audio preview and drive hashing without decoding anything itself.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { HashAlgo } from '@/lib/services/file-inspect';
import type {
	FileInspectWorkerRequest,
	FileInspectWorkerResponse,
} from '@/lib/workers/file-inspect.worker';

export interface FileHashOutput {
	readonly hashes: Partial<Record<HashAlgo, string>>;
	readonly hashing: ReadonlySet<HashAlgo>;
}

export interface UseFileInspectWorker {
	readonly output: FileHashOutput;
	/** Decode a base64 payload off-thread; `onBuffer` receives the decoded bytes. */
	readonly decode: (base64: string, onBuffer: (buffer: ArrayBuffer) => void) => void;
	/** Hash a buffer (passed as a transferable copy) for the given algorithm set. */
	readonly hash: (buffer: ArrayBuffer, algorithms: readonly HashAlgo[]) => void;
	/** Discard any in-flight response and clear the hash state. */
	readonly reset: () => void;
}

const EMPTY_OUTPUT: FileHashOutput = { hashes: {}, hashing: new Set() };

export const useFileInspectWorker = (): UseFileInspectWorker => {
	const workerRef = useRef<Worker | null>(null);
	const latestIdRef = useRef(0);
	const onBufferRef = useRef<((buffer: ArrayBuffer) => void) | null>(null);
	// Mirror of the current hashes so `hash` can keep already-computed digests
	// visible (only genuinely new algorithms show the spinner).
	const hashesRef = useRef<Partial<Record<HashAlgo, string>>>({});
	const [output, setOutput] = useState<FileHashOutput>(EMPTY_OUTPUT);

	// Single worker instance for the lifetime of the route.
	useEffect(() => {
		const worker = new Worker(new URL('@/lib/workers/file-inspect.worker.ts', import.meta.url), {
			type: 'module',
		});
		workerRef.current = worker;
		const handleMessage = (event: MessageEvent<FileInspectWorkerResponse>) => {
			const response = event.data;
			// Discard stale responses; only the most recently requested id wins.
			if (response.id !== latestIdRef.current) return;
			if (response.buffer !== undefined) {
				// Decode response: hand the bytes to the route, leave hashes alone.
				if (onBufferRef.current) {
					onBufferRef.current(response.buffer);
					onBufferRef.current = null;
				}
				return;
			}
			// Hash response: merge results and clear the pending spinners.
			const merged = { ...hashesRef.current, ...response.hashes };
			hashesRef.current = merged;
			setOutput({ hashes: merged, hashing: new Set() });
		};
		worker.addEventListener('message', handleMessage);
		return () => {
			worker.removeEventListener('message', handleMessage);
			worker.terminate();
			workerRef.current = null;
		};
	}, []);

	const decode = useCallback((base64: string, onBuffer: (buffer: ArrayBuffer) => void) => {
		const worker = workerRef.current;
		if (!worker) return;
		const id = latestIdRef.current + 1;
		latestIdRef.current = id;
		onBufferRef.current = onBuffer;
		// A decode starts a new file: clear the previous file's hashes.
		hashesRef.current = {};
		setOutput(EMPTY_OUTPUT);
		const request: FileInspectWorkerRequest = { kind: 'decode', id, base64 };
		worker.postMessage(request);
	}, []);

	const hash = useCallback((buffer: ArrayBuffer, algorithms: readonly HashAlgo[]) => {
		const worker = workerRef.current;
		if (!worker) return;
		const id = latestIdRef.current + 1;
		latestIdRef.current = id;
		onBufferRef.current = null;
		// Keep already-computed digests visible; spin only on genuinely new ones.
		const pending = new Set(algorithms.filter((algo) => hashesRef.current[algo] === undefined));
		setOutput({ hashes: hashesRef.current, hashing: pending });
		const request: FileInspectWorkerRequest = { kind: 'hash', id, buffer, algorithms };
		// Transfer the buffer copy so the worker receives the bytes without a synchronous copy.
		worker.postMessage(request, [buffer]);
	}, []);

	const reset = useCallback(() => {
		// Bump the id so any in-flight response is ignored, then clear state.
		latestIdRef.current += 1;
		onBufferRef.current = null;
		hashesRef.current = {};
		setOutput(EMPTY_OUTPUT);
	}, []);

	return { output, decode, hash, reset };
};
