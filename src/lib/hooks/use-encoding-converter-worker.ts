/**
 * Bridges `encoding-converter.tsx` to the encoding-conversion worker.
 *
 * Runs the whole detect → decode → encode → base64 pipeline off the main
 * thread. A monotonic request id discards stale responses (a superseded file
 * or option toggle), and the previous result stays visible while a new one
 * computes. `sourceBytes` is structure-cloned to the worker, so the route
 * keeps its own copy for the hex-dump preview.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

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

const FIRST_PENDING_RESULT: EncodingConverterResult = { ...EMPTY_RESULT, isPending: true };

interface ConvertedOutput {
	readonly request: EncodingConvertRequest;
	readonly result: Omit<EncodingConverterResult, 'isPending'>;
}

export const useEncodingConverterWorker = (
	input: UseEncodingConverterInput
): EncodingConverterResult => {
	const workerRef = useRef<Worker | null>(null);
	const latestIdRef = useRef(0);
	// The request tagged `latestIdRef`. Its response is stored together with its
	// inputs so `isPending` can be derived by comparing them with the current input.
	const latestRequestRef = useRef<EncodingConvertRequest | null>(null);
	const [converted, setConverted] = useState<ConvertedOutput | null>(null);

	useEffect(() => {
		const worker = new Worker(
			new URL('@/lib/workers/encoding-converter.worker.ts', import.meta.url),
			{ type: 'module' }
		);
		workerRef.current = worker;
		const handleMessage = (event: MessageEvent<EncodingConvertResponse>) => {
			const response = event.data;
			const request = latestRequestRef.current;
			if (!request || response.id !== latestIdRef.current) return;
			setConverted({
				request,
				result: {
					detected: response.detected,
					decodedText: response.decodedText,
					targetBytes: response.targetBytes,
					targetText: response.targetText,
					base64: response.base64,
				},
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

	// Drop the stored result during render once the source is cleared, so the next
	// file starts from an empty result instead of the result of an older file.
	if (!sourceBytes && converted !== null) {
		setConverted(null);
	}

	useEffect(() => {
		const worker = workerRef.current;
		if (!worker) return;
		if (!sourceBytes) {
			latestIdRef.current += 1;
			latestRequestRef.current = null;
			return;
		}
		const id = latestIdRef.current + 1;
		latestIdRef.current = id;
		const request: EncodingConvertRequest = {
			id,
			sourceBytes,
			overrideEncoding,
			targetEncoding,
			lineEnding,
			bomAction,
		};
		latestRequestRef.current = request;
		// No transfer: the route keeps `sourceBytes` for its own hex-dump preview.
		worker.postMessage(request);
	}, [sourceBytes, overrideEncoding, targetEncoding, lineEnding, bomAction]);

	return useMemo<EncodingConverterResult>(() => {
		if (!sourceBytes) return EMPTY_RESULT;
		if (!converted) return FIRST_PENDING_RESULT;
		// Keep the previous result visible while a newer conversion runs.
		const { request } = converted;
		const isPending =
			request.sourceBytes !== sourceBytes ||
			request.overrideEncoding !== overrideEncoding ||
			request.targetEncoding !== targetEncoding ||
			request.lineEnding !== lineEnding ||
			request.bomAction !== bomAction;
		return { ...converted.result, isPending };
	}, [converted, sourceBytes, overrideEncoding, targetEncoding, lineEnding, bomAction]);
};
