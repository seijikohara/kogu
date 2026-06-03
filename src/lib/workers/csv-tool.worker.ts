/**
 * CSV / TSV parse and format worker.
 *
 * `parseTable` runs Papa.parse synchronously, and `formatTable` runs
 * `yaml.stringify` / `JSON.stringify` over every row. On the main thread a
 * large CSV (tens of MB) froze the UI for seconds — Papa.parse on load and the
 * YAML output path were the worst. This worker runs both off the event loop.
 *
 * Two request kinds:
 *   'parse'  — text + hint -> { table, columnTypes, columnStats }.
 *   'format' — table + output format -> { output }.
 *
 * Parse and format use separate id counters so a slow format cannot discard a
 * fresh parse result and vice versa.
 */
import {
	computeColumnStats,
	detectColumnTypes,
	formatTable,
	parseTable,
	type ColumnStats,
	type ColumnType,
	type FormatOptions,
	type OutputFormat,
	type ParseHint,
	type ParsedTable,
} from '@/lib/services/csv-tool';

export interface CsvParseRequest {
	readonly kind: 'parse';
	readonly id: number;
	readonly rawText: string;
	readonly hint: ParseHint;
}

export interface CsvFormatRequest {
	readonly kind: 'format';
	readonly id: number;
	readonly table: ParsedTable;
	readonly outputFormat: OutputFormat;
	readonly options: FormatOptions;
}

export type CsvWorkerRequest = CsvParseRequest | CsvFormatRequest;

export interface CsvParseResponse {
	readonly kind: 'parse';
	readonly id: number;
	readonly table: ParsedTable;
	readonly columnTypes: readonly ColumnType[];
	readonly columnStats: readonly ColumnStats[];
}

export interface CsvFormatResponse {
	readonly kind: 'format';
	readonly id: number;
	readonly output: string;
}

export type CsvWorkerResponse = CsvParseResponse | CsvFormatResponse;

self.addEventListener('message', (event: MessageEvent<CsvWorkerRequest>) => {
	const req = event.data;
	if (req.kind === 'parse') {
		const table = parseTable(req.rawText, req.hint);
		self.postMessage({
			kind: 'parse',
			id: req.id,
			table,
			columnTypes: detectColumnTypes(table),
			columnStats: computeColumnStats(table),
		} satisfies CsvParseResponse);
		return;
	}
	const output = formatTable(req.table, req.outputFormat, req.options);
	self.postMessage({ kind: 'format', id: req.id, output } satisfies CsvFormatResponse);
});
