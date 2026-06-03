/**
 * Bridges `base64-encoder.tsx` to the Base64 encode / decode worker.
 *
 * Runs the transform off the main thread and keeps the previous output visible
 * while a new one computes. A monotonic request id discards stale responses.
 * The caller is expected to pass an already-debounced input.
 */
import { useEffect, useRef, useState } from 'react';

import type { Base64DecodeOptions, Base64EncodeOptions } from '@/lib/services/encoders/base64';
import type { Base64Mode, Base64Request, Base64Response } from '@/lib/workers/base64.worker';

export interface UseBase64WorkerInput {
	readonly mode: Base64Mode;
	readonly input: string;
	/** Pass stable (memoized) references so the effect only fires on real changes. */
	readonly encodeOptions: Partial<Base64EncodeOptions>;
	readonly decodeOptions: Partial<Base64DecodeOptions>;
}

export interface UseBase64WorkerOutput {
	readonly output: string;
	readonly error: string;
	readonly isPending: boolean;
}

const EMPTY_OUTPUT: UseBase64WorkerOutput = { output: '', error: '', isPending: false };

export const useBase64Worker = (input: UseBase64WorkerInput): UseBase64WorkerOutput => {
	const workerRef = useRef<Worker | null>(null);
	const latestIdRef = useRef(0);
	const [output, setOutput] = useState<UseBase64WorkerOutput>(EMPTY_OUTPUT);

	useEffect(() => {
		const worker = new Worker(new URL('@/lib/workers/base64.worker.ts', import.meta.url), {
			type: 'module',
		});
		workerRef.current = worker;
		const handleMessage = (event: MessageEvent<Base64Response>) => {
			if (event.data.id !== latestIdRef.current) return;
			setOutput({ output: event.data.output, error: event.data.error, isPending: false });
		};
		worker.addEventListener('message', handleMessage);
		return () => {
			worker.removeEventListener('message', handleMessage);
			worker.terminate();
			workerRef.current = null;
		};
	}, []);

	const { mode, input: text, encodeOptions, decodeOptions } = input;

	useEffect(() => {
		const worker = workerRef.current;
		if (!worker) return;
		const id = latestIdRef.current + 1;
		latestIdRef.current = id;
		setOutput((prev) => ({ ...prev, isPending: true }));
		const request: Base64Request = { id, mode, input: text, encodeOptions, decodeOptions };
		worker.postMessage(request);
	}, [mode, text, encodeOptions, decodeOptions]);

	return output;
};
