/**
 * JSON Parser - Detection and Parsing Functions
 */

import JSON5 from 'json5';
import * as jsonc from 'jsonc-parser';

import type {
	JsonInputFormat,
	JsonOutputFormat,
	JsonStringifyOptions,
	ParseAttempt,
} from '../types.js';
import { sortKeysDeep } from '../utils.js';
import { trailingCommaTransform } from './formatter.js';

// ============================================================================
// Format Detection
// ============================================================================

const isValidNdjsonLine = (line: string): boolean => {
	const trimmed = line.trim();
	return trimmed.startsWith('{') || trimmed.startsWith('[');
};

const tryParseNdjson = (lines: string[]): boolean =>
	lines.every((line) => {
		try {
			JSON.parse(line);
			return true;
		} catch {
			return false;
		}
	});

/** Detect JSON format from input string */
export const detectJsonFormat = (input: string): JsonInputFormat => {
	const trimmed = input.trim();
	const lines = trimmed.split('\n').filter((line) => line.trim());

	// Early return: Check for NDJSON
	if (lines.length > 1) {
		const allLinesValid = lines.every(isValidNdjsonLine);
		if (allLinesValid && tryParseNdjson(lines)) return 'ndjson';
	}

	// Feature detection patterns
	const hasComments = /\/\/|\/\*/.test(trimmed);
	const hasUnquotedKeys = /^\s*\{[\s\S]*?[{,]\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/m.test(trimmed);
	const hasTrailingCommas = /,\s*[}\]]/m.test(trimmed);
	const hasSingleQuotes = /'[^']*'/m.test(trimmed);
	const hasHexNumbers = /:\s*0x[0-9a-fA-F]+/m.test(trimmed);
	const hasInfinity = /:\s*[+-]?Infinity/m.test(trimmed);
	const hasNaN = /:\s*NaN/m.test(trimmed);

	// Early return: JSON5 specific features
	if (hasUnquotedKeys || hasSingleQuotes || hasHexNumbers || hasInfinity || hasNaN) {
		return 'json5';
	}

	// Early return: JSONC (comments only, no JSON5 features)
	if (hasComments && !hasUnquotedKeys && !hasSingleQuotes) return 'jsonc';

	// Early return: Trailing commas
	if (hasTrailingCommas) return hasComments ? 'jsonc' : 'json5';

	return 'json';
};

// ============================================================================
// Parsing
// ============================================================================

/** Parse JSON with specific format */
export const parseJson = (input: string, format?: JsonInputFormat): unknown => {
	const detectedFormat = format ?? detectJsonFormat(input);
	const trimmed = input.trim();

	if (detectedFormat === 'ndjson') {
		return trimmed
			.split('\n')
			.filter((line) => line.trim())
			.map((line) => JSON.parse(line.trim()));
	}

	if (detectedFormat === 'json5') return JSON5.parse(trimmed);

	if (detectedFormat === 'jsonc') {
		const errors: jsonc.ParseError[] = [];
		const result = jsonc.parse(trimmed, errors, { allowTrailingComma: true });
		const firstError = errors[0];
		if (firstError) {
			throw new Error(
				`JSONC parse error at offset ${firstError.offset}: ${jsonc.printParseErrorCode(firstError.error)}`
			);
		}
		return result;
	}

	return JSON.parse(trimmed);
};

const tryParse = (fn: () => unknown, format: JsonInputFormat): ParseAttempt => {
	try {
		return { success: true, data: fn(), format };
	} catch (e) {
		return { success: false, error: e as Error };
	}
};

/** Parse JSON with automatic format detection */
export const parseJsonAuto = (input: string): { data: unknown; format: JsonInputFormat } => {
	const trimmed = input.trim();

	// Try parsers in order of strictness
	const attempts: ParseAttempt[] = [
		tryParse(() => JSON.parse(trimmed), 'json'),
		tryParse(() => {
			const errors: jsonc.ParseError[] = [];
			const result = jsonc.parse(trimmed, errors, { allowTrailingComma: true });
			if (errors.length > 0) throw new Error('JSONC parse failed');
			return result;
		}, 'jsonc'),
		tryParse(() => JSON5.parse(trimmed), 'json5'),
	];

	// Check for successful parse
	const successfulAttempt = attempts.find(
		(a): a is Extract<ParseAttempt, { success: true }> => a.success
	);
	if (successfulAttempt) {
		return { data: successfulAttempt.data, format: successfulAttempt.format };
	}

	// Try NDJSON for multi-line input
	const lines = trimmed.split('\n').filter((line) => line.trim());
	if (lines.length > 1) {
		const ndjsonAttempt = tryParse(() => lines.map((line) => JSON.parse(line.trim())), 'ndjson');
		if (ndjsonAttempt.success) {
			return { data: ndjsonAttempt.data, format: 'ndjson' };
		}
	}

	// All formats failed
	const firstError = attempts.find(
		(a): a is Extract<ParseAttempt, { success: false }> => !a.success
	);
	throw firstError?.error ?? new Error('Failed to parse JSON');
};

// ============================================================================
// Stringify and Validation
// ============================================================================

/** Stringify data to JSON format */
export const stringifyJson = (
	data: unknown,
	format: JsonOutputFormat,
	options: JsonStringifyOptions = {}
): string => {
	const { indent = 2, sortKeys = false, trailingComma = false, quote = 'double' } = options;
	const processedData = sortKeys ? sortKeysDeep(data) : data;

	if (format === 'ndjson') {
		return Array.isArray(processedData)
			? processedData.map((item) => JSON.stringify(item)).join('\n')
			: JSON.stringify(processedData);
	}

	if (format === 'json5') {
		const result = JSON5.stringify(processedData, null, indent);
		const quoted =
			quote === 'single'
				? result.replace(/"([^"\\]*)"/g, (match, content: string) =>
						content.includes("'") ? match : `'${content}'`
					)
				: result;
		return trailingComma ? trailingCommaTransform(quoted) : quoted;
	}

	if (format === 'jsonc') {
		const result = JSON.stringify(processedData, null, indent);
		return trailingComma ? trailingCommaTransform(result) : result;
	}

	return JSON.stringify(processedData, null, indent);
};

/** Validate JSON input */
export const validateJson = (
	input: string,
	format?: JsonInputFormat
): { valid: boolean; error?: string; detectedFormat: JsonInputFormat } => {
	const detectedFormat = format ?? detectJsonFormat(input);

	try {
		parseJson(input, detectedFormat);
		return { valid: true, detectedFormat };
	} catch (e) {
		return {
			valid: false,
			error: e instanceof Error ? e.message : 'Invalid JSON',
			detectedFormat,
		};
	}
};

/** Convert JSON between formats */
export const convertJsonFormat = (
	input: string,
	targetFormat: JsonOutputFormat,
	options: JsonStringifyOptions = {},
	format?: JsonInputFormat
): string =>
	stringifyJson(
		format ? parseJson(input, format) : parseJsonAuto(input).data,
		targetFormat,
		options
	);
