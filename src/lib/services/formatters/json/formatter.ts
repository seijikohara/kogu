/**
 * JSON Formatter - Format and Minify Functions
 */

import { defaultJsonFormatOptions } from '../constants.js';
import type { JsonFormatOptions } from '../types.js';
import { getIndentString } from '../utils.js';

// ============================================================================
// Transform Functions
// ============================================================================

const escapeUnicodeTransform = (s: string): string =>
	s.replace(/[\u0080-\uFFFF]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);

const singleQuoteTransform = (s: string): string =>
	s.replace(/"([^"\\]*)"/g, (match, content: string) =>
		content.includes("'") ? match : `'${content}'`
	);

const arrayBracketSpacingTransform = (s: string): string =>
	s.replace(/\[(?!\s*\n)/g, '[ ').replace(/(?<!\n\s*)\]/g, ' ]');

const objectBracketSpacingTransform = (s: string): string =>
	s.replace(/\{(?!\s*\n)/g, '{ ').replace(/(?<!\n\s*)\}/g, ' }');

const removeColonSpacingTransform = (s: string): string => s.replace(/:\s+/g, ':');

const compactArraysTransform = (s: string): string =>
	s.replace(
		/\[\s*\n(\s*)((?:"[^"]*"|'[^']*'|[\d.eE+-]+|true|false|null)(?:,\s*\n\s*(?:"[^"]*"|'[^']*'|[\d.eE+-]+|true|false|null))*)\s*\n\s*\]/g,
		(_, _indent, content: string) => `[${content.split(/,\s*\n\s*/).join(', ')}]`
	);

export const trailingCommaTransform = (s: string): string =>
	s.replace(/([}\]])\n(\s*[}\]])/g, '$1,\n$2');

// ============================================================================
// Processing Functions
// ============================================================================

/** Process array with options */
const processArray = (
	arr: unknown[],
	opts: JsonFormatOptions,
	depth: number,
	processFn: (obj: unknown, opts: JsonFormatOptions, depth: number) => unknown
): unknown => {
	const processed = arr
		.map((item) => processFn(item, opts, depth + 1))
		.filter((item) => item !== undefined);
	return opts.removeEmptyArrays && processed.length === 0 ? undefined : processed;
};

/** Process object with options */
const processObject = (
	obj: Record<string, unknown>,
	opts: JsonFormatOptions,
	depth: number,
	processFn: (obj: unknown, opts: JsonFormatOptions, depth: number) => unknown
): unknown => {
	const entries = Object.entries(obj);
	const sortedEntries = opts.sortKeys
		? [...entries].sort(([a], [b]) => a.localeCompare(b))
		: entries;

	const processed = Object.fromEntries(
		sortedEntries
			.map(([key, value]) => [key, processFn(value, opts, depth + 1)] as const)
			.filter(([, value]) => value !== undefined)
	);

	return opts.removeEmptyObjects && Object.keys(processed).length === 0 ? undefined : processed;
};

/** Handle max depth truncation */
const handleMaxDepth = (obj: unknown): unknown => {
	if (obj === null || typeof obj !== 'object') return obj;
	return Array.isArray(obj) ? '[...]' : '{...}';
};

/** Process JSON with format options */
export const processJsonWithOptions = (
	obj: unknown,
	options: Partial<JsonFormatOptions>,
	depth = 0
): unknown => {
	const opts = { ...defaultJsonFormatOptions, ...options };

	if (opts.maxDepth > 0 && depth >= opts.maxDepth) return handleMaxDepth(obj);
	if (obj === null) return opts.removeNulls ? undefined : null;
	if (Array.isArray(obj)) return processArray(obj, opts, depth, processJsonWithOptions);
	if (typeof obj === 'object')
		return processObject(obj as Record<string, unknown>, opts, depth, processJsonWithOptions);
	if (typeof obj === 'string') return opts.removeEmptyStrings && obj === '' ? undefined : obj;

	return obj;
};

/** Format JSON with options */
export const formatJson = (input: string, options: Partial<JsonFormatOptions> = {}): string => {
	const opts = { ...defaultJsonFormatOptions, ...options };
	const indentString = getIndentString(opts);

	const transforms = [
		opts.escapeUnicode ? escapeUnicodeTransform : null,
		opts.quoteStyle === 'single' ? singleQuoteTransform : null,
		opts.arrayBracketSpacing ? arrayBracketSpacingTransform : null,
		opts.objectBracketSpacing ? objectBracketSpacingTransform : null,
		!opts.colonSpacing ? removeColonSpacingTransform : null,
		opts.compactArrays && indentString ? compactArraysTransform : null,
		opts.trailingComma && indentString ? trailingCommaTransform : null,
	].filter((fn): fn is (s: string) => string => fn !== null);

	const baseJson = JSON.stringify(
		processJsonWithOptions(JSON.parse(input), opts),
		null,
		indentString
	);

	return transforms.reduce((result, transform) => transform(result), baseJson);
};

/** Minify JSON */
export const minifyJson = (input: string): string => JSON.stringify(JSON.parse(input));
