/**
 * Bridges `encoding-converter.tsx` to the encoding-conversion worker.
 *
 * Runs the whole detect → decode → encode → base64 pipeline off the main
 * thread. A monotonic request id discards stale responses (a superseded file
 * or option toggle), and the previous result stays visible while a new one
 * computes. `sourceBytes` is structure-cloned to the worker, so the route
 * keeps its own copy for the hex-dump preview.
 */
import { useEffect, useRef, useState } from 'react';

import type {
	BomAction,
	DetectedEncoding,
	Encoding,
	LineEnding,
} from '@/lib/services/encoding-converter';
import type {
	EncodingConvertRequest,
	EncodingConvertResponse,
} from '@/lib/workers/encoding-converter.worker';

export interface UseEncodingConverterInput {
	readonly sourceBytes: Uint8Array | null;
	readonly overrideEncoding: Encoding | null;
	readonly targetEncoding: Encoding;
	readonly lineEnding: LineEnding;
	readonly bomAction: BomAction;
}

export interface EncodingConverterResult {
	readonly detected: DetectedEncoding | null;
	readonly decodedText: string | null;
	readonly targetBytes: Uint8Array | null;
	readonly targetText: string | null;
	readonly base64: string;
	readonly isPending: boolean;
}

const EMPTY_RESULT: EncodingConverterResult = {
	detected: null,
	decodedText: null,
	targetBytes: null,
	targetText: null,
	base64: '',
	isPending: false,
};

export const useEncodingConverterWorker = (
	input: UseEncodingConverterInput
): EncodingConverterResult => {
	const workerRef = useRef<Worker | null>(null);
	const latestIdRef = useRef(0);
	const [output, setOutput] = useState<EncodingConverterResult>(EMPTY_RESULT);

	useEffect(() => {
		const worker = new Worker(
			new URL('@/lib/workers/encoding-converter.worker.ts', import.meta.url),
			{ type: 'module' }
		);
		workerRef.current = worker;
		const handleMessage = (event: MessageEvent<EncodingConvertResponse>) => {
			const response = event.data;
			if (response.id !== latestIdRef.current) return;
			setOutput({
				detected: response.detected,
				decodedText: response.decodedText,
				targetBytes: response.targetBytes,
				targetText: response.targetText,
				base64: response.base64,
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

	const { sourceBytes, overrideEncoding, targetEncoding, lineEnding, bomAction } = input;

	useEffect(() => {
		const worker = workerRef.current;
		if (!worker) return;
		if (!sourceBytes) {
			latestIdRef.current += 1;
			setOutput(EMPTY_RESULT);
			return;
		}
		const id = latestIdRef.current + 1;
		latestIdRef.current = id;
		setOutput((prev) => ({ ...prev, isPending: true }));
		const request: EncodingConvertRequest = {
			id,
			sourceBytes,
			overrideEncoding,
			targetEncoding,
			lineEnding,
			bomAction,
		};
		// No transfer: the route keeps `sourceBytes` for its own hex-dump preview.
		worker.postMessage(request);
	}, [sourceBytes, overrideEncoding, targetEncoding, lineEnding, bomAction]);

	return output;
};
