import JSON5 from 'json5';
import * as jsonc from 'jsonc-parser';
import { type SqlLanguage, format as sqlFormat } from 'sql-formatter';
import xmlFormatter from 'xml-formatter';
import * as yaml from 'yaml';

// ============================================================================
// Types
// ============================================================================

export type JsonInputFormat = 'json' | 'json5' | 'jsonc' | 'ndjson';
export type JsonOutputFormat = 'json' | 'json5' | 'jsonc' | 'ndjson';

export interface JsonFormatInfo {
	label: string;
	description: string;
	extension: string;
	mimeType: string;
}

export interface JsonFormatOptions {
	indentSize: number;
	indentType: 'spaces' | 'tabs';
	sortKeys: boolean;
	removeNulls: boolean;
	removeEmptyStrings: boolean;
	removeEmptyArrays: boolean;
	removeEmptyObjects: boolean;
	escapeUnicode: boolean;
	trailingComma: boolean;
	quoteStyle: 'double' | 'single';
	arrayBracketSpacing: boolean;
	objectBracketSpacing: boolean;
	colonSpacing: boolean;
	compactArrays: boolean;
	maxDepth: number;
}

export interface JsonStringifyOptions {
	indent?: number | string;
	sortKeys?: boolean;
	trailingComma?: boolean;
	quote?: 'double' | 'single';
}

export interface JsonStats {
	keys: number;
	values: number;
	depth: number;
	size: string;
}

export interface DiffItem {
	path: string;
	type: 'added' | 'removed' | 'changed';
	oldValue?: string;
	newValue?: string;
}

export interface XmlFormatOptions {
	indentSize: number;
	indentType: 'spaces' | 'tabs';
	collapseContent: boolean;
	whiteSpaceAtEndOfSelfclosingTag: boolean;
	excludeComments: boolean;
	preserveWhitespace: boolean;
	forceSelfClosingEmptyTag: boolean;
	sortAttributes: boolean;
}

export interface XmlStats {
	elements: number;
	attributes: number;
	depth: number;
	size: string;
}

export interface YamlFormatOptions {
	indentSize: number;
	sortKeys: boolean;
	lineWidth: number;
	singleQuote: boolean;
	forceQuotes: boolean;
}

export interface YamlStats {
	keys: number;
	values: number;
	depth: number;
	size: string;
}

export interface SqlFormatOptions {
	language: SqlLanguage;
	tabWidth: number;
	useTabs: boolean;
	keywordCase: 'upper' | 'lower' | 'preserve';
	indentStyle: 'standard' | 'tabularLeft' | 'tabularRight';
	logicalOperatorNewline: 'before' | 'after';
	expressionWidth: number;
	linesBetweenQueries: number;
	denseOperators: boolean;
	newlineBeforeSemicolon: boolean;
}

export interface JsonDiffOptions {
	ignoreCase?: boolean;
	ignoreWhitespace?: boolean;
	ignoreArrayOrder?: boolean;
	ignoreNumericType?: boolean;
	ignoreEmpty?: boolean;
	deepCompare?: boolean;
	ignoreKeys?: string[];
}

export interface JsonToYamlOptions {
	indent?: number;
	lineWidth?: number;
	minContentWidth?: number;
	defaultStringType?: 'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE' | 'BLOCK_LITERAL' | 'BLOCK_FOLDED';
	singleQuote?: boolean;
	forceQuotes?: boolean;
	doubleQuotedAsJSON?: boolean;
	doubleQuotedMinMultiLineLength?: number;
	collectionStyle?: 'any' | 'block' | 'flow';
	flowCollectionPadding?: boolean;
	indentSeq?: boolean;
	simpleKeys?: boolean;
	defaultKeyType?: 'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE';
	sortKeys?: boolean;
	noRefs?: boolean;
	anchorPrefix?: string;
	nullStr?: string;
	trueStr?: string;
	falseStr?: string;
}

export interface JsonToXmlOptions {
	rootName?: string;
	arrayItemName?: string;
	textNodeName?: string;
	attributePrefix?: string;
	indent?: number;
	indentType?: 'spaces' | 'tabs';
	lineSeparator?: '\n' | '\r\n';
	collapseContent?: boolean;
	declaration?: boolean;
	declarationVersion?: string;
	declarationEncoding?: string;
	declarationStandalone?: 'yes' | 'no';
	selfClosing?: boolean;
	whiteSpaceAtEndOfSelfclosingTag?: boolean;
	cdata?: boolean;
	cdataThreshold?: number;
	escapeText?: boolean;
	sortAttributes?: boolean;
	sortKeys?: boolean;
	includeComments?: boolean;
	headerComment?: string;
}

export interface XmlToJsonOptions {
	indent?: number;
	sortKeys?: boolean;
}

export interface XmlToYamlOptions extends JsonToYamlOptions {
	// Inherits all YAML formatting options from JsonToYamlOptions
}

export interface YamlToJsonOptions {
	indent?: number;
	sortKeys?: boolean;
}

export interface YamlToXmlOptions extends JsonToXmlOptions {
	// Inherits all XML formatting options from JsonToXmlOptions
}

type ParseAttempt =
	| { success: true; data: unknown; format: JsonInputFormat }
	| { success: false; error: Error };

// ============================================================================
// Constants
// ============================================================================

export const JSON_FORMAT_INFO = {
	json: {
		label: 'JSON',
		description: 'Standard JSON (RFC 8259)',
		extension: 'json',
		mimeType: 'application/json',
	},
	json5: {
		label: 'JSON5',
		description: 'JSON5 (comments, trailing commas, unquoted keys)',
		extension: 'json5',
		mimeType: 'application/json5',
	},
	jsonc: {
		label: 'JSONC',
		description: 'JSON with Comments (VS Code style)',
		extension: 'jsonc',
		mimeType: 'application/json',
	},
	ndjson: {
		label: 'NDJSON',
		description: 'Newline Delimited JSON (one object per line)',
		extension: 'ndjson',
		mimeType: 'application/x-ndjson',
	},
} as const satisfies Record<JsonInputFormat, JsonFormatInfo>;

export type FormatOption = { value: JsonInputFormat; label: string };

export const JSON_FORMAT_OPTIONS: FormatOption[] = [
	{ value: 'json', label: 'JSON' },
	{ value: 'json5', label: 'JSON5' },
	{ value: 'jsonc', label: 'JSONC' },
	{ value: 'ndjson', label: 'NDJSON' },
];

export const defaultJsonFormatOptions = {
	indentSize: 2,
	indentType: 'spaces',
	sortKeys: false,
	removeNulls: false,
	removeEmptyStrings: false,
	removeEmptyArrays: false,
	removeEmptyObjects: false,
	escapeUnicode: false,
	trailingComma: false,
	quoteStyle: 'double',
	arrayBracketSpacing: false,
	objectBracketSpacing: false,
	colonSpacing: true,
	compactArrays: false,
	maxDepth: 0,
} as const satisfies JsonFormatOptions;

export const defaultXmlFormatOptions = {
	indentSize: 2,
	indentType: 'spaces',
	collapseContent: false,
	whiteSpaceAtEndOfSelfclosingTag: false,
	excludeComments: false,
	preserveWhitespace: false,
	forceSelfClosingEmptyTag: false,
	sortAttributes: false,
} as const satisfies XmlFormatOptions;

export const defaultYamlFormatOptions = {
	indentSize: 2,
	sortKeys: false,
	lineWidth: 80,
	singleQuote: false,
	forceQuotes: false,
} as const satisfies YamlFormatOptions;

export const SQL_LANGUAGES = [
	'sql',
	'bigquery',
	'db2',
	'db2i',
	'duckdb',
	'hive',
	'mariadb',
	'mysql',
	'n1ql',
	'plsql',
	'postgresql',
	'redshift',
	'singlestoredb',
	'snowflake',
	'spark',
	'sqlite',
	'tidb',
	'transactsql',
	'trino',
] as const satisfies readonly SqlLanguage[];

export const defaultSqlFormatOptions = {
	language: 'sql',
	tabWidth: 2,
	useTabs: false,
	keywordCase: 'upper',
	indentStyle: 'standard',
	logicalOperatorNewline: 'before',
	expressionWidth: 50,
	linesBetweenQueries: 1,
	denseOperators: false,
	newlineBeforeSemicolon: false,
} as const satisfies SqlFormatOptions;

export const defaultJsonDiffOptions = {
	ignoreCase: false,
	ignoreWhitespace: false,
	ignoreArrayOrder: false,
	ignoreNumericType: false,
	ignoreEmpty: false,
	deepCompare: true,
	ignoreKeys: [],
} as const satisfies JsonDiffOptions;

export const defaultJsonToYamlOptions = {
	indent: 2,
	lineWidth: 80,
	minContentWidth: 20,
	defaultStringType: 'PLAIN',
	singleQuote: false,
	forceQuotes: false,
	doubleQuotedAsJSON: false,
	doubleQuotedMinMultiLineLength: 40,
	collectionStyle: 'block',
	flowCollectionPadding: false,
	indentSeq: true,
	simpleKeys: false,
	defaultKeyType: 'PLAIN',
	sortKeys: false,
	noRefs: true,
	anchorPrefix: 'a',
	nullStr: 'null',
	trueStr: 'true',
	falseStr: 'false',
} as const satisfies JsonToYamlOptions;

export const defaultJsonToXmlOptions = {
	rootName: 'root',
	arrayItemName: 'item',
	textNodeName: '#text',
	attributePrefix: '@',
	indent: 2,
	indentType: 'spaces',
	lineSeparator: '\n',
	collapseContent: false,
	declaration: true,
	declarationVersion: '1.0',
	declarationEncoding: 'UTF-8',
	declarationStandalone: undefined,
	selfClosing: true,
	whiteSpaceAtEndOfSelfclosingTag: false,
	cdata: false,
	cdataThreshold: 0,
	escapeText: true,
	sortAttributes: false,
	sortKeys: false,
	includeComments: true,
	headerComment: undefined,
} as const satisfies JsonToXmlOptions;

// ============================================================================
// Utility Functions
// ============================================================================

const formatBytes = (bytes: number): string =>
	bytes < 1024
		? `${bytes} B`
		: bytes < 1024 * 1024
			? `${(bytes / 1024).toFixed(2)} KB`
			: `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const getIndentString = (options: JsonFormatOptions): string =>
	options.indentType === 'tabs' && options.indentSize > 0 ? '\t' : ' '.repeat(options.indentSize);

// Generic deep key sorter - used by both YAML and XML converters
export const sortKeysDeep = (obj: unknown): unknown => {
	if (Array.isArray(obj)) return obj.map(sortKeysDeep);
	if (obj === null || typeof obj !== 'object') return obj;

	return Object.fromEntries(
		Object.keys(obj)
			.sort()
			.map((key) => [key, sortKeysDeep((obj as Record<string, unknown>)[key])])
	);
};

// ============================================================================
// JSON Formatter - Transform Functions
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

const trailingCommaTransform = (s: string): string => s.replace(/([}\]])\n(\s*[}\]])/g, '$1,\n$2');

// ============================================================================
// JSON Formatter - Processing Functions
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

export const minifyJson = (input: string): string => JSON.stringify(JSON.parse(input));

// ============================================================================
// JSON Parser - Detection and Parsing
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

export const convertJsonFormat = (
	input: string,
	targetFormat: JsonOutputFormat,
	options: JsonStringifyOptions = {}
): string => stringifyJson(parseJsonAuto(input).data, targetFormat, options);

// ============================================================================
// JSON Stats
// ============================================================================

type StatsAccumulator = { keys: number; values: number; maxDepth: number };

const calculateStats = (obj: unknown): StatsAccumulator => {
	if (Array.isArray(obj)) {
		return obj.reduce<StatsAccumulator>(
			(acc, item) => {
				const childStats = calculateStats(item);
				return {
					keys: acc.keys + childStats.keys,
					values: acc.values + 1 + childStats.values,
					maxDepth: Math.max(acc.maxDepth, 1 + childStats.maxDepth),
				};
			},
			{ keys: 0, values: 0, maxDepth: 0 }
		);
	}

	if (obj !== null && typeof obj === 'object') {
		return Object.entries(obj).reduce<StatsAccumulator>(
			(acc, [, value]) => {
				const childStats = calculateStats(value);
				return {
					keys: acc.keys + 1 + childStats.keys,
					values: acc.values + childStats.values,
					maxDepth: Math.max(acc.maxDepth, 1 + childStats.maxDepth),
				};
			},
			{ keys: 0, values: 0, maxDepth: 0 }
		);
	}

	return { keys: 0, values: 1, maxDepth: 0 };
};

export const calculateJsonStats = (input: string): JsonStats => {
	const { data } = parseJsonAuto(input);
	const stats = calculateStats(data);
	return {
		keys: stats.keys,
		values: stats.values,
		depth: stats.maxDepth,
		size: formatBytes(new Blob([input]).size),
	};
};

// ============================================================================
// JSON Path Query
// ============================================================================

export const executeJsonPath = (input: string, path: string): unknown => {
	const { data: parsed } = parseJsonAuto(input);
	const parts = path
		.replace(/^\$\.?/, '')
		.split(/\.|\[|\]/)
		.filter(Boolean);

	return parts.reduce<unknown>((current, part) => {
		if (current === undefined || current === null) {
			throw new Error(`Path not found: ${path}`);
		}

		if (Array.isArray(current)) {
			const index = Number.parseInt(part, 10);
			if (Number.isNaN(index)) throw new Error(`Invalid array index: ${part}`);
			return current[index];
		}

		if (typeof current === 'object') {
			return (current as Record<string, unknown>)[part];
		}

		throw new Error(`Cannot access property of non-object: ${part}`);
	}, parsed);
};

// ============================================================================
// JSON Diff
// ============================================================================

const normalizeValue = (value: unknown, opts: JsonDiffOptions): unknown => {
	if (value === null || value === undefined) return value;

	if (typeof value === 'string') {
		let normalized = value;
		if (opts.ignoreCase) normalized = normalized.toLowerCase();
		if (opts.ignoreWhitespace) normalized = normalized.replace(/\s+/g, '');
		return normalized;
	}

	if (typeof value === 'number' && opts.ignoreNumericType) {
		return String(value);
	}

	return value;
};

const isEmpty = (value: unknown): boolean =>
	value === null ||
	value === undefined ||
	value === '' ||
	(Array.isArray(value) && value.length === 0) ||
	(typeof value === 'object' && value !== null && Object.keys(value).length === 0);

const sortArray = (arr: unknown[], opts: JsonDiffOptions): unknown[] =>
	[...arr].sort((a, b) => {
		const strA = JSON.stringify(normalizeValue(a, opts));
		const strB = JSON.stringify(normalizeValue(b, opts));
		return strA.localeCompare(strB);
	});

const createDiffItem = (
	path: string,
	type: DiffItem['type'],
	oldValue?: unknown,
	newValue?: unknown
): DiffItem => ({
	path,
	type,
	...(oldValue !== undefined && { oldValue: JSON.stringify(oldValue) }),
	...(newValue !== undefined && { newValue: JSON.stringify(newValue) }),
});

/** Check if types are equivalent considering numeric type option */
const areTypesEquivalent = (obj1: unknown, obj2: unknown, opts: JsonDiffOptions): boolean => {
	if (typeof obj1 === typeof obj2) return true;
	if (!opts.ignoreNumericType) return false;
	if (typeof obj1 === 'number' && typeof obj2 === 'string' && String(obj1) === obj2) return true;
	if (typeof obj1 === 'string' && typeof obj2 === 'number' && obj1 === String(obj2)) return true;
	return false;
};

/** Compare two arrays and return differences */
const compareArrays = (
	arr1: unknown[],
	arr2: unknown[],
	path: string,
	opts: JsonDiffOptions,
	findDiffsFn: (a: unknown, b: unknown, p: string, o: JsonDiffOptions) => DiffItem[]
): DiffItem[] => {
	const sorted1 = opts.ignoreArrayOrder ? sortArray(arr1, opts) : arr1;
	const sorted2 = opts.ignoreArrayOrder ? sortArray(arr2, opts) : arr2;
	const maxLen = Math.max(sorted1.length, sorted2.length);

	return Array.from({ length: maxLen }).flatMap((_, i) => {
		const itemPath = `${path}[${i}]`;
		if (i >= sorted1.length) return [createDiffItem(itemPath, 'added', undefined, sorted2[i])];
		if (i >= sorted2.length) return [createDiffItem(itemPath, 'removed', sorted1[i], undefined)];
		return findDiffsFn(sorted1[i], sorted2[i], itemPath, opts);
	});
};

/** Compare two objects and return differences */
const compareObjects = (
	o1: Record<string, unknown>,
	o2: Record<string, unknown>,
	path: string,
	opts: JsonDiffOptions,
	findDiffsFn: (a: unknown, b: unknown, p: string, o: JsonDiffOptions) => DiffItem[]
): DiffItem[] => {
	const ignoreKeysSet = new Set(opts.ignoreKeys ?? []);
	const keys1 = Object.keys(o1).filter((k) => !ignoreKeysSet.has(k));
	const keys2 = Object.keys(o2).filter((k) => !ignoreKeysSet.has(k));
	const allKeys = [...new Set([...keys1, ...keys2])];

	return allKeys.flatMap((key) => {
		const keyPath = `${path}.${key}`;
		const inO1 = key in o1;
		const inO2 = key in o2;

		if (opts.ignoreEmpty && !inO1 && isEmpty(o2[key])) return [];
		if (opts.ignoreEmpty && !inO2 && isEmpty(o1[key])) return [];
		if (!inO1) return [createDiffItem(keyPath, 'added', undefined, o2[key])];
		if (!inO2) return [createDiffItem(keyPath, 'removed', o1[key], undefined)];
		return findDiffsFn(o1[key], o2[key], keyPath, opts);
	});
};

const findDifferences = (
	obj1: unknown,
	obj2: unknown,
	path: string,
	opts: JsonDiffOptions
): DiffItem[] => {
	if (opts.ignoreEmpty && isEmpty(obj1) && isEmpty(obj2)) return [];

	if (!opts.deepCompare) {
		const norm1 = JSON.stringify(obj1);
		const norm2 = JSON.stringify(obj2);
		return norm1 !== norm2 ? [createDiffItem(path, 'changed', obj1, obj2)] : [];
	}

	if (!areTypesEquivalent(obj1, obj2, opts)) {
		return [createDiffItem(path, 'changed', obj1, obj2)];
	}

	if (Array.isArray(obj1) && Array.isArray(obj2)) {
		return compareArrays(obj1, obj2, path, opts, findDifferences);
	}

	if (obj1 !== null && obj2 !== null && typeof obj1 === 'object' && typeof obj2 === 'object') {
		return compareObjects(
			obj1 as Record<string, unknown>,
			obj2 as Record<string, unknown>,
			path,
			opts,
			findDifferences
		);
	}

	const norm1 = normalizeValue(obj1, opts);
	const norm2 = normalizeValue(obj2, opts);
	return norm1 !== norm2 ? [createDiffItem(path, 'changed', obj1, obj2)] : [];
};

export const findJsonDifferences = (
	json1: string,
	json2: string,
	options: JsonDiffOptions = {}
): DiffItem[] => {
	const opts = { ...defaultJsonDiffOptions, ...options };
	return findDifferences(parseJsonAuto(json1).data, parseJsonAuto(json2).data, '$', opts);
};

// ============================================================================
// JSON to YAML Conversion
// ============================================================================

export const jsonToYaml = (input: string, options: JsonToYamlOptions | number = {}): string => {
	const opts =
		typeof options === 'number'
			? { ...defaultJsonToYamlOptions, indent: options }
			: { ...defaultJsonToYamlOptions, ...options };

	const data = opts.sortKeys ? sortKeysDeep(parseJsonAuto(input).data) : parseJsonAuto(input).data;

	// Determine string type
	const stringType = opts.singleQuote
		? 'QUOTE_SINGLE'
		: opts.forceQuotes && opts.defaultStringType === 'PLAIN'
			? 'QUOTE_DOUBLE'
			: (opts.defaultStringType ?? 'PLAIN');

	return yaml.stringify(data, {
		indent: opts.indent,
		lineWidth: opts.lineWidth === 0 ? 0 : opts.lineWidth,
		minContentWidth: opts.minContentWidth,
		defaultStringType: stringType,
		doubleQuotedAsJSON: opts.doubleQuotedAsJSON,
		doubleQuotedMinMultiLineLength: opts.doubleQuotedMinMultiLineLength,
		collectionStyle: opts.collectionStyle,
		flowCollectionPadding: opts.flowCollectionPadding,
		indentSeq: opts.indentSeq,
		simpleKeys: opts.simpleKeys,
		defaultKeyType: opts.defaultKeyType,
		aliasDuplicateObjects: !opts.noRefs,
		anchorPrefix: opts.anchorPrefix,
		nullStr: opts.nullStr,
		trueStr: opts.trueStr,
		falseStr: opts.falseStr,
	});
};

// ============================================================================
// JSON to XML Conversion
// ============================================================================

const escapeXmlText = (text: string): string =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');

/** Create empty XML element */
const createEmptyXmlElement = (name: string, options: JsonToXmlOptions): string => {
	const selfCloseEnd = options.whiteSpaceAtEndOfSelfclosingTag ? ' />' : '/>';
	return options.selfClosing ? `<${name}${selfCloseEnd}` : `<${name}></${name}>`;
};

/** Convert object to XML element */
const convertObjectToXml = (
	data: Record<string, unknown>,
	name: string,
	options: JsonToXmlOptions,
	convertFn: (d: unknown, n: string, o: JsonToXmlOptions) => string
): string => {
	const attributePrefix = options.attributePrefix ?? '@';
	const textNodeName = options.textNodeName ?? '#text';
	const selfCloseEnd = options.whiteSpaceAtEndOfSelfclosingTag ? ' />' : '/>';

	const entries = options.sortKeys
		? Object.entries(data).sort(([a], [b]) => a.localeCompare(b))
		: Object.entries(data);

	const attributeEntries = entries.filter(([key]) => key.startsWith(attributePrefix));
	const sortedAttrEntries = options.sortAttributes
		? [...attributeEntries].sort(([a], [b]) => a.localeCompare(b))
		: attributeEntries;

	const attributes = sortedAttrEntries
		.map(([key, value]) => ` ${key.slice(attributePrefix.length)}="${value}"`)
		.join('');

	const textEntry = entries.find(([key]) => key === textNodeName);
	const textContent = textEntry ? String(textEntry[1]) : '';

	const children = entries
		.filter(([key]) => !key.startsWith(attributePrefix) && key !== textNodeName)
		.map(([key, value]) => convertFn(value, key, options))
		.join('');

	if (!children && !textContent) {
		return options.selfClosing
			? `<${name}${attributes}${selfCloseEnd}`
			: `<${name}${attributes}></${name}>`;
	}

	return `<${name}${attributes}>${textContent}${children}</${name}>`;
};

/** Convert primitive to XML element */
const convertPrimitiveToXml = (data: unknown, name: string, options: JsonToXmlOptions): string => {
	const rawContent = typeof data === 'string' ? data : JSON.stringify(data);
	const cdataThreshold = options.cdataThreshold ?? 0;
	const shouldUseCdata =
		options.cdata &&
		typeof data === 'string' &&
		(cdataThreshold === 0 || rawContent.length >= cdataThreshold);

	if (shouldUseCdata) {
		return `<${name}><![CDATA[${rawContent}]]></${name}>`;
	}

	const textContent =
		options.escapeText && typeof data === 'string' ? escapeXmlText(rawContent) : rawContent;
	return `<${name}>${textContent}</${name}>`;
};

const convertToXmlElement = (data: unknown, name: string, options: JsonToXmlOptions): string => {
	if (data === null || data === undefined) {
		return createEmptyXmlElement(name, options);
	}

	if (Array.isArray(data)) {
		const itemName = options.arrayItemName ?? 'item';
		const elementName = name === options.rootName ? itemName : name;
		return data.map((item) => convertToXmlElement(item, elementName, options)).join('');
	}

	if (typeof data === 'object') {
		return convertObjectToXml(data as Record<string, unknown>, name, options, convertToXmlElement);
	}

	return convertPrimitiveToXml(data, name, options);
};

/** Build XML declaration string */
const buildXmlDeclaration = (opts: JsonToXmlOptions, lineSep: string): string => {
	if (!opts.declaration) return '';
	const version = opts.declarationVersion ?? '1.0';
	const encoding = opts.declarationEncoding ?? 'UTF-8';
	const standalone = opts.declarationStandalone
		? ` standalone="${opts.declarationStandalone}"`
		: '';
	return `<?xml version="${version}" encoding="${encoding}"${standalone}?>${lineSep}`;
};

/** Determine XML content and root name */
const determineXmlContent = (
	parsed: unknown,
	opts: JsonToXmlOptions
): { content: string; rootName: string } => {
	const parsedObj =
		typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
	const parsedObjKeys = parsedObj !== null ? Object.keys(parsedObj) : [];
	const singleKey = parsedObjKeys.length === 1 ? parsedObjKeys[0] : undefined;
	const actualRootName = singleKey ?? opts.rootName ?? 'root';

	const content =
		singleKey && parsedObj
			? convertToXmlElement(parsedObj[singleKey], actualRootName, opts)
			: convertToXmlElement(parsed, opts.rootName ?? 'root', opts);

	return { content, rootName: actualRootName };
};

export const jsonToXml = (input: string, options: JsonToXmlOptions | string = {}): string => {
	const opts =
		typeof options === 'string'
			? { ...defaultJsonToXmlOptions, rootName: options }
			: { ...defaultJsonToXmlOptions, ...options };

	const parsed = opts.sortKeys
		? sortKeysDeep(parseJsonAuto(input).data)
		: parseJsonAuto(input).data;

	const { content } = determineXmlContent(parsed, opts);
	const lineSep = opts.lineSeparator ?? '\n';
	const indentation =
		opts.indent === 0 ? '' : opts.indentType === 'tabs' ? '\t' : ' '.repeat(opts.indent ?? 2);

	const declaration = buildXmlDeclaration(opts, lineSep);
	const headerComment = opts.headerComment ? `<!-- ${opts.headerComment} -->${lineSep}` : '';

	const formattedXml = xmlFormatter(content, {
		indentation,
		collapseContent: opts.collapseContent,
		whiteSpaceAtEndOfSelfclosingTag: opts.whiteSpaceAtEndOfSelfclosingTag,
		lineSeparator: lineSep,
	});

	return `${declaration}${headerComment}${formattedXml}`;
};

// ============================================================================
// JSON Schema Inference
// ============================================================================

const STRING_FORMAT_PATTERNS = [
	{ pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, format: 'email' },
	{ pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'date' },
	{ pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, format: 'date-time' },
	{ pattern: /^https?:\/\//, format: 'uri' },
] as const;

const inferStringFormat = (value: string): Record<string, string> => {
	const match = STRING_FORMAT_PATTERNS.find(({ pattern }) => pattern.test(value));
	return match ? { type: 'string', format: match.format } : { type: 'string' };
};

const inferSchema = (data: unknown): Record<string, unknown> => {
	if (data === null) return { type: 'null' };

	if (Array.isArray(data)) {
		return { type: 'array', items: data.length === 0 ? {} : inferSchema(data[0]) };
	}

	if (typeof data === 'object') {
		const entries = Object.entries(data);
		return {
			type: 'object',
			properties: Object.fromEntries(entries.map(([key, value]) => [key, inferSchema(value)])),
			required: entries.map(([key]) => key),
		};
	}

	if (typeof data === 'string') return inferStringFormat(data);
	if (typeof data === 'number')
		return Number.isInteger(data) ? { type: 'integer' } : { type: 'number' };
	if (typeof data === 'boolean') return { type: 'boolean' };

	return {};
};

export const inferJsonSchema = (input: string): Record<string, unknown> =>
	inferSchema(parseJsonAuto(input).data);

// ============================================================================
// XML Formatter
// ============================================================================

export const formatXml = (input: string, options: Partial<XmlFormatOptions> = {}): string => {
	const opts = { ...defaultXmlFormatOptions, ...options };
	return xmlFormatter(input, {
		indentation: opts.indentType === 'tabs' ? '\t' : ' '.repeat(opts.indentSize),
		collapseContent: opts.collapseContent,
		whiteSpaceAtEndOfSelfclosingTag: opts.whiteSpaceAtEndOfSelfclosingTag,
		filter: (node) => !opts.excludeComments || node.type !== 'Comment',
	});
};

export const minifyXml = (input: string): string =>
	xmlFormatter(input, { indentation: '', collapseContent: true });

type XmlNodeStats = { elements: number; attributes: number; maxDepth: number };

const calculateXmlNodeStats = (node: Node, depth: number): XmlNodeStats => {
	const isElement = node.nodeType === Node.ELEMENT_NODE;
	const elementStats: XmlNodeStats = isElement
		? { elements: 1, attributes: (node as Element).attributes.length, maxDepth: depth }
		: { elements: 0, attributes: 0, maxDepth: depth };

	const childStats = Array.from(node.childNodes).reduce<XmlNodeStats>(
		(acc, child) => {
			const stats = calculateXmlNodeStats(child, depth + 1);
			return {
				elements: acc.elements + stats.elements,
				attributes: acc.attributes + stats.attributes,
				maxDepth: Math.max(acc.maxDepth, stats.maxDepth),
			};
		},
		{ elements: 0, attributes: 0, maxDepth: depth }
	);

	return {
		elements: elementStats.elements + childStats.elements,
		attributes: elementStats.attributes + childStats.attributes,
		maxDepth: childStats.maxDepth,
	};
};

export const calculateXmlStats = (input: string): XmlStats => {
	const doc = new DOMParser().parseFromString(input, 'application/xml');
	const stats = calculateXmlNodeStats(doc.documentElement, 0);
	return {
		elements: stats.elements,
		attributes: stats.attributes,
		depth: stats.maxDepth,
		size: formatBytes(new Blob([input]).size),
	};
};

// ============================================================================
// XPath Query
// ============================================================================

const iterateXPathResult = function* (result: XPathResult): Generator<Node> {
	let node = result.iterateNext();
	while (node !== null) {
		yield node;
		node = result.iterateNext();
	}
};

const collectXPathResults = (result: XPathResult): string[] =>
	Array.from(iterateXPathResult(result))
		.map((node) =>
			node.nodeType === Node.ELEMENT_NODE
				? new XMLSerializer().serializeToString(node)
				: node.nodeType === Node.ATTRIBUTE_NODE
					? (node as Attr).value
					: node.nodeType === Node.TEXT_NODE
						? (node.textContent ?? '')
						: null
		)
		.filter((content): content is string => content !== null);

export const executeXPath = (input: string, xpath: string): string[] => {
	const doc = new DOMParser().parseFromString(input, 'application/xml');
	return collectXPathResults(
		new XPathEvaluator().evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null)
	);
};

// ============================================================================
// XML Conversion
// ============================================================================

const convertXmlElementToObject = (node: Element): unknown => {
	const children = Array.from(node.childNodes);
	const elementChildren = children.filter((c) => c.nodeType === Node.ELEMENT_NODE);
	const textContent = children
		.filter((c) => c.nodeType === Node.TEXT_NODE)
		.map((c) => c.textContent?.trim())
		.filter(Boolean)
		.join('');

	const attrs = Object.fromEntries(
		Array.from(node.attributes).map((attr) => [`@${attr.name}`, attr.value])
	);

	// Text-only element
	if (textContent && elementChildren.length === 0) {
		return Object.keys(attrs).length === 0 ? textContent : { ...attrs, '#text': textContent };
	}

	// Process element children
	const childrenObj = elementChildren.reduce<Record<string, unknown>>((acc, child) => {
		const childObj = convertXmlElementToObject(child as Element);
		const childName = child.nodeName;

		if (childName in acc) {
			acc[childName] = Array.isArray(acc[childName])
				? [...(acc[childName] as unknown[]), childObj]
				: [acc[childName], childObj];
		} else {
			acc[childName] = childObj;
		}

		return acc;
	}, {});

	return { ...attrs, ...childrenObj };
};

export const xmlToJson = (input: string, options: XmlToJsonOptions = {}): string => {
	const doc = new DOMParser().parseFromString(input, 'application/xml');
	const parserError = doc.querySelector('parsererror');
	if (parserError) {
		throw new Error(`Invalid XML: ${parserError.textContent}`);
	}
	const data = { [doc.documentElement.nodeName]: convertXmlElementToObject(doc.documentElement) };
	const sortedData = options.sortKeys ? sortKeysDeep(data) : data;
	return JSON.stringify(sortedData, null, options.indent ?? 2);
};

export const xmlToJsonObject = (input: string): unknown => {
	const doc = new DOMParser().parseFromString(input, 'application/xml');
	const parserError = doc.querySelector('parsererror');
	if (parserError) {
		throw new Error(`Invalid XML: ${parserError.textContent}`);
	}
	return { [doc.documentElement.nodeName]: convertXmlElementToObject(doc.documentElement) };
};

export const xmlToYaml = (input: string, options: XmlToYamlOptions | number = {}): string => {
	const opts =
		typeof options === 'number'
			? { ...defaultJsonToYamlOptions, indent: options }
			: { ...defaultJsonToYamlOptions, ...options };

	const doc = new DOMParser().parseFromString(input, 'application/xml');
	const parserError = doc.querySelector('parsererror');
	if (parserError) {
		throw new Error(`Invalid XML: ${parserError.textContent}`);
	}

	const data = { [doc.documentElement.nodeName]: convertXmlElementToObject(doc.documentElement) };
	const sortedData = opts.sortKeys ? sortKeysDeep(data) : data;

	// Determine string type
	const stringType = opts.singleQuote
		? 'QUOTE_SINGLE'
		: opts.forceQuotes && opts.defaultStringType === 'PLAIN'
			? 'QUOTE_DOUBLE'
			: (opts.defaultStringType ?? 'PLAIN');

	return yaml.stringify(sortedData, {
		indent: opts.indent,
		lineWidth: opts.lineWidth === 0 ? 0 : opts.lineWidth,
		minContentWidth: opts.minContentWidth,
		defaultStringType: stringType,
		doubleQuotedAsJSON: opts.doubleQuotedAsJSON,
		doubleQuotedMinMultiLineLength: opts.doubleQuotedMinMultiLineLength,
		collectionStyle: opts.collectionStyle,
		flowCollectionPadding: opts.flowCollectionPadding,
		indentSeq: opts.indentSeq,
		simpleKeys: opts.simpleKeys,
		defaultKeyType: opts.defaultKeyType,
		aliasDuplicateObjects: !opts.noRefs,
		anchorPrefix: opts.anchorPrefix,
		nullStr: opts.nullStr,
		trueStr: opts.trueStr,
		falseStr: opts.falseStr,
	});
};

// ============================================================================
// YAML Formatter
// ============================================================================

export const formatYaml = (input: string, options: Partial<YamlFormatOptions> = {}): string => {
	const opts = { ...defaultYamlFormatOptions, ...options };
	const parsed = yaml.parse(input);
	const data = opts.sortKeys ? sortKeysDeep(parsed) : parsed;

	return yaml.stringify(data, {
		indent: opts.indentSize,
		lineWidth: opts.lineWidth,
		singleQuote: opts.singleQuote,
	});
};

export const minifyYaml = (input: string): string =>
	yaml.stringify(yaml.parse(input), { indent: 0 });

export const calculateYamlStats = (input: string): YamlStats => {
	const stats = calculateStats(yaml.parse(input));
	return {
		keys: stats.keys,
		values: stats.values,
		depth: stats.maxDepth,
		size: formatBytes(new Blob([input]).size),
	};
};

// ============================================================================
// YAML Conversion
// ============================================================================

export const yamlToJson = (input: string, options: YamlToJsonOptions | number = {}): string => {
	const opts =
		typeof options === 'number' ? { indent: options, sortKeys: false } : { indent: 2, ...options };
	const data = yaml.parse(input);
	const sortedData = opts.sortKeys ? sortKeysDeep(data) : data;
	return JSON.stringify(sortedData, null, opts.indent);
};

export const yamlToXml = (input: string, options: YamlToXmlOptions | string = {}): string => {
	const opts =
		typeof options === 'string'
			? { ...defaultJsonToXmlOptions, rootName: options }
			: { ...defaultJsonToXmlOptions, ...options };

	const data = yaml.parse(input);
	const sortedData = opts.sortKeys ? sortKeysDeep(data) : data;
	const jsonStr = JSON.stringify(sortedData);
	return jsonToXml(jsonStr, opts);
};

// ============================================================================
// SQL Formatter
// ============================================================================

export const formatSql = (input: string, options: Partial<SqlFormatOptions> = {}): string => {
	const opts = { ...defaultSqlFormatOptions, ...options };
	return sqlFormat(input, {
		language: opts.language,
		tabWidth: opts.tabWidth,
		useTabs: opts.useTabs,
		keywordCase: opts.keywordCase,
		indentStyle: opts.indentStyle,
		logicalOperatorNewline: opts.logicalOperatorNewline,
		expressionWidth: opts.expressionWidth,
		linesBetweenQueries: opts.linesBetweenQueries,
		denseOperators: opts.denseOperators,
		newlineBeforeSemicolon: opts.newlineBeforeSemicolon,
	});
};

export const minifySql = (input: string): string => input.replace(/\s+/g, ' ').trim();

export interface SqlStats {
	statements: number;
	size: string;
}

export const calculateSqlStats = (input: string): SqlStats => {
	// Count statements by semicolons (excluding those in strings/comments)
	const statements = input.split(';').filter((s) => s.trim().length > 0).length;

	return {
		statements,
		size: formatBytes(new Blob([input]).size),
	};
};

export const SQL_LANGUAGE_OPTIONS = [
	{ value: 'sql', label: 'Standard SQL' },
	{ value: 'bigquery', label: 'BigQuery' },
	{ value: 'db2', label: 'IBM DB2' },
	{ value: 'db2i', label: 'IBM DB2i' },
	{ value: 'duckdb', label: 'DuckDB' },
	{ value: 'hive', label: 'Apache Hive' },
	{ value: 'mariadb', label: 'MariaDB' },
	{ value: 'mysql', label: 'MySQL' },
	{ value: 'n1ql', label: 'Couchbase N1QL' },
	{ value: 'plsql', label: 'Oracle PL/SQL' },
	{ value: 'postgresql', label: 'PostgreSQL' },
	{ value: 'redshift', label: 'Amazon Redshift' },
	{ value: 'singlestoredb', label: 'SingleStoreDB' },
	{ value: 'snowflake', label: 'Snowflake' },
	{ value: 'spark', label: 'Apache Spark' },
	{ value: 'sqlite', label: 'SQLite' },
	{ value: 'tidb', label: 'TiDB' },
	{ value: 'transactsql', label: 'SQL Server (T-SQL)' },
	{ value: 'trino', label: 'Trino/Presto' },
] as const;

export const SQL_KEYWORD_CASE_OPTIONS = [
	{ value: 'upper', label: 'UPPER' },
	{ value: 'lower', label: 'lower' },
	{ value: 'preserve', label: 'Preserve' },
] as const;

export const SQL_INDENT_STYLE_OPTIONS = [
	{ value: 'standard', label: 'Standard' },
	{ value: 'tabularLeft', label: 'Tabular Left' },
	{ value: 'tabularRight', label: 'Tabular Right' },
] as const;

export const SQL_LOGICAL_OPERATOR_OPTIONS = [
	{ value: 'before', label: 'Before' },
	{ value: 'after', label: 'After' },
] as const;

export const validateSql = (input: string): { valid: boolean; error?: string } => {
	if (!input.trim()) {
		return { valid: false, error: 'Empty input' };
	}

	try {
		// Try to format as a basic validation
		sqlFormat(input, { language: 'sql' });
		return { valid: true };
	} catch (e) {
		return {
			valid: false,
			error: e instanceof Error ? e.message : 'Invalid SQL',
		};
	}
};

// ============================================================================
// YAML Validation
// ============================================================================

/**
 * Check if input is JSON format (not pure YAML).
 * JSON is a valid subset of YAML, but we want to reject it in YAML formatter.
 */
const isJsonFormat = (input: string): boolean => {
	const trimmed = input.trim();

	// Check if it looks like JSON (starts with { or [)
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		try {
			JSON.parse(trimmed);
			return true;
		} catch {
			// Not valid JSON, might be YAML flow style
			return false;
		}
	}

	return false;
};

export const validateYaml = (input: string): { valid: boolean; error?: string } => {
	// Reject JSON input - YAML formatter should only accept pure YAML
	if (isJsonFormat(input)) {
		return {
			valid: false,
			error: 'JSON format detected. Please use JSON Formatter for JSON input.',
		};
	}

	try {
		yaml.parse(input);
		return { valid: true };
	} catch (e) {
		return {
			valid: false,
			error: e instanceof Error ? e.message : 'Invalid YAML',
		};
	}
};

// ============================================================================
// Sample Data
// ============================================================================

export const SAMPLE_JSON = `{
  "name": "John Doe",
  "age": 30,
  "email": "john.doe@example.com",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "country": "USA"
  },
  "hobbies": ["reading", "gaming", "hiking"],
  "active": true,
  "balance": 1234.56
}`;

export const SAMPLE_YAML = `name: John Doe
age: 30
email: john.doe@example.com
address:
  street: 123 Main St
  city: New York
  country: USA
hobbies:
  - reading
  - gaming
  - hiking
active: true
balance: 1234.56`;

export const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<person>
  <name>John Doe</name>
  <age>30</age>
  <email>john.doe@example.com</email>
  <address>
    <street>123 Main St</street>
    <city>New York</city>
    <country>USA</country>
  </address>
  <hobbies>
    <hobby>reading</hobby>
    <hobby>gaming</hobby>
    <hobby>hiking</hobby>
  </hobbies>
  <active>true</active>
  <balance>1234.56</balance>
</person>`;

export const SAMPLE_SQL = `SELECT u.id, u.name, u.email, o.order_id, o.total
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.active = true AND o.created_at >= '2024-01-01'
ORDER BY o.total DESC
LIMIT 100;`;
