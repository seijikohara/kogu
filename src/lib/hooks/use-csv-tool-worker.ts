/**
 * Bridges `csv-tool.tsx` to the CSV parse / format worker.
 *
 * `parse` and `format` are imperative because the parsed table is editable on
 * the main thread (inline cell edits mutate it, then re-format). Separate
 * monotonic id counters discard stale parse / format responses independently.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
	ColumnStats,
	ColumnType,
	FormatOptions,
	OutputFormat,
	ParseHint,
	ParsedTable,
} from '@/lib/services/csv-tool';
import type { CsvWorkerRequest, CsvWorkerResponse } from '@/lib/workers/csv-tool.worker';

export interface CsvParseResult {
	readonly table: ParsedTable;
	readonly columnTypes: readonly ColumnType[];
	readonly columnStats: readonly ColumnStats[];
}

export interface UseCsvToolWorker {
	readonly parse: (rawText: string, hint: ParseHint) => void;
	readonly format: (table: ParsedTable, outputFormat: OutputFormat, options: FormatOptions) => void;
	readonly parseResult: CsvParseResult | null;
	readonly output: string;
}

export const useCsvToolWorker = (): UseCsvToolWorker => {
	const workerRef = useRef<Worker | null>(null);
	const parseIdRef = useRef(0);
	const formatIdRef = useRef(0);
	const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
	const [output, setOutput] = useState('');

	useEffect(() => {
		const worker = new Worker(new URL('@/lib/workers/csv-tool.worker.ts', import.meta.url), {
			type: 'module',
		});
		workerRef.current = worker;
		const handleMessage = (event: MessageEvent<CsvWorkerResponse>) => {
			const response = event.data;
			if (response.kind === 'parse') {
				if (response.id !== parseIdRef.current) return;
				setParseResult({
					table: response.table,
					columnTypes: response.columnTypes,
					columnStats: response.columnStats,
				});
			} else {
				if (response.id !== formatIdRef.current) return;
				setOutput(response.output);
			}
		};
		worker.addEventListener('message', handleMessage);
		return () => {
			worker.removeEventListener('message', handleMessage);
			worker.terminate();
			workerRef.current = null;
		};
	}, []);

	const parse = useCallback((rawText: string, hint: ParseHint) => {
		const worker = workerRef.current;
		if (!worker) return;
		const id = parseIdRef.current + 1;
		parseIdRef.current = id;
		worker.postMessage({ kind: 'parse', id, rawText, hint } satisfies CsvWorkerRequest);
	}, []);

	const format = useCallback(
		(table: ParsedTable, outputFormat: OutputFormat, options: FormatOptions) => {
			const worker = workerRef.current;
			if (!worker) return;
			const id = formatIdRef.current + 1;
			formatIdRef.current = id;
			worker.postMessage({
				kind: 'format',
				id,
				table,
				outputFormat,
				options,
			} satisfies CsvWorkerRequest);
		},
		[]
	);

	return { parse, format, parseResult, output };
};
