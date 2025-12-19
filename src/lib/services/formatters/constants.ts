/**
 * Formatters - Constants and Default Options
 */

import type { SqlLanguage } from 'sql-formatter';
import type {
	FormatOption,
	JsonDiffOptions,
	JsonFormatInfo,
	JsonFormatOptions,
	JsonInputFormat,
	JsonToXmlOptions,
	JsonToYamlOptions,
	SqlFormatOptions,
	XmlFormatOptions,
	YamlFormatOptions,
} from './types.js';

// ============================================================================
// JSON Constants
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

export const defaultJsonDiffOptions = {
	ignoreCase: false,
	ignoreWhitespace: false,
	ignoreArrayOrder: false,
	ignoreNumericType: false,
	ignoreEmpty: false,
	deepCompare: true,
	ignoreKeys: [],
} as const satisfies JsonDiffOptions;

// ============================================================================
// XML Constants
// ============================================================================

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

// ============================================================================
// YAML Constants
// ============================================================================

export const defaultYamlFormatOptions = {
	indentSize: 2,
	sortKeys: false,
	lineWidth: 80,
	singleQuote: false,
	forceQuotes: false,
} as const satisfies YamlFormatOptions;

// ============================================================================
// SQL Constants
// ============================================================================

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

// ============================================================================
// Conversion Constants
// ============================================================================

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
