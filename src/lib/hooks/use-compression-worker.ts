/**
 * Bridges `string-compressor.tsx` to the output-formatting worker.
 *
 * Exposes a promise-based `formatBytes` so the route's compress flow can
 * `await` the off-thread hex / base64 / data-URI formatting in place of the
 * previous synchronous call. Each request carries a monotonic id matched to a
 * pending promise; the worker is torn down on unmount.
 */
import { useCallback, useEffect, useRef } from 'react';

import type {
	CompressionFormatRequest,
	CompressionFormatResponse,
	CompressionOutputFormat,
} from '@/lib/workers/compression.worker';

export interface UseCompressionWorker {
	readonly formatBytes: (
		bytes: Uint8Array,
		format: CompressionOutputFormat,
		hexGroup: number,
		hexSeparator: string
	) => Promise<string>;
}

export const useCompressionWorker = (): UseCompressionWorker => {
	const workerRef = useRef<Worker | null>(null);
	const idRef = useRef(0);
	const pendingRef = useRef(new Map<number, (output: string) => void>());

	useEffect(() => {
		const worker = new Worker(new URL('@/lib/workers/compression.worker.ts', import.meta.url), {
			type: 'module',
		});
		workerRef.current = worker;
		const pending = pendingRef.current;
		const handleMessage = (event: MessageEvent<CompressionFormatResponse>) => {
			const resolve = pending.get(event.data.id);
			if (!resolve) return;
			pending.delete(event.data.id);
			resolve(event.data.output);
		};
		worker.addEventListener('message', handleMessage);
		return () => {
			worker.removeEventListener('message', handleMessage);
			worker.terminate();
			workerRef.current = null;
			pending.clear();
		};
	}, []);

	const formatBytes = useCallback(
		(bytes: Uint8Array, format: CompressionOutputFormat, hexGroup: number, hexSeparator: string) =>
			new Promise<string>((resolve, reject) => {
				const worker = workerRef.current;
				if (!worker) {
					reject(new Error('Compression worker is not ready'));
					return;
				}
				const id = idRef.current + 1;
				idRef.current = id;
				pendingRef.current.set(id, resolve);
				worker.postMessage({
					id,
					bytes,
					format,
					hexGroup,
					hexSeparator,
				} satisfies CompressionFormatRequest);
			}),
		[]
	);

	return { formatBytes };
};
