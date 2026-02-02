/**
 * Formatters - Type Definitions
 */

import type { SqlLanguage } from 'sql-formatter';

// ============================================================================
// JSON Types
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

export interface JsonDiffOptions {
	ignoreCase?: boolean;
	ignoreWhitespace?: boolean;
	ignoreArrayOrder?: boolean;
	ignoreNumericType?: boolean;
	ignoreEmpty?: boolean;
	deepCompare?: boolean;
	ignoreKeys?: string[];
}

export interface DiffItem {
	path: string;
	type: 'added' | 'removed' | 'changed';
	oldValue?: string;
	newValue?: string;
}

// ============================================================================
// XML Types
// ============================================================================

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

// ============================================================================
// YAML Types
// ============================================================================

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

// ============================================================================
// SQL Types
// ============================================================================

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

export interface SqlStats {
	statements: number;
	size: string;
}

// ============================================================================
// Conversion Types
// ============================================================================

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

// ============================================================================
// Internal Types
// ============================================================================

export type ParseAttempt =
	| { success: true; data: unknown; format: JsonInputFormat }
	| { success: false; error: Error };

export type StatsAccumulator = { keys: number; values: number; maxDepth: number };

export type FormatOption = { value: JsonInputFormat & JsonOutputFormat; label: string };
