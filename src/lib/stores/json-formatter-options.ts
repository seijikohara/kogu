import type { JsonInputFormat, JsonOutputFormat } from '@/lib/services/formatters';

import { createToolOptionsStore } from './tool-options';

/**
 * Persisted user preferences for the JSON Formatter page.
 *
 * The two formats survive page reloads and propagate to every JSON tab so
 * that switching between `jsonc` / `json5` (which accept comments and
 * trailing commas) or `ndjson` is consistent across Format / Query /
 * Compare / Convert / Schema / Generate.
 */
export interface JsonFormatterOptions {
	readonly inputFormat: JsonInputFormat;
	readonly outputFormat: JsonOutputFormat;
}

const DEFAULT_JSON_FORMATTER_OPTIONS: JsonFormatterOptions = {
	inputFormat: 'json',
	outputFormat: 'json',
};

/**
 * Persisted JSON Formatter options bag, stored under
 * `kogu:tool:json-formatter:options` in localStorage.
 */
export const useJsonFormatterOptions = createToolOptionsStore<JsonFormatterOptions>(
	'json-formatter',
	DEFAULT_JSON_FORMATTER_OPTIONS
);
