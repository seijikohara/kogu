/**
 * AST (Abstract Syntax Tree) types for tree view synchronization
 * These types mirror the Rust AST types in src-tauri/src/ast/mod.rs
 */

/** Supported languages for AST parsing */
export type AstLanguage = 'json' | 'yaml' | 'xml' | 'sql';

/** AST node type */
export type AstNodeType =
	// Common
	| 'root'
	| 'object'
	| 'array'
	| 'property'
	| 'string'
	| 'number'
	| 'boolean'
	| 'null'
	// XML specific
	| 'element'
	| 'attribute'
	| 'text'
	| 'comment'
	// SQL specific
	| 'statement'
	| 'clause'
	| 'expression'
	| 'identifier'
	| 'literal'
	| 'operator'
	| 'keyword'
	| 'function'
	// Fallback
	| 'unknown';

/** Position in the source text (1-indexed) */
export interface AstPosition {
	/** Line number (1-indexed) */
	readonly line: number;
	/** Column number (1-indexed) */
	readonly column: number;
	/** Character offset from start of text (0-indexed) */
	readonly offset: number;
}

/** Range in the source text */
export interface AstRange {
	readonly start: AstPosition;
	readonly end: AstPosition;
}

/** Unified AST node structure */
export interface AstNode {
	/** Node type */
	readonly type: AstNodeType;
	/** JSONPath-like path (e.g., "$", "$.name", "$.items[0]") */
	readonly path: string;
	/** Display label for tree view */
	readonly label: string;
	/** Node value (for leaf nodes) */
	readonly value?: unknown;
	/** Position range in source */
	readonly range: AstRange;
	/** Child nodes */
	readonly children?: readonly AstNode[];
}

/** Result of AST parsing */
export interface AstParseResult {
	/** Root AST node (null if parsing failed) */
	readonly ast: AstNode | null;
	/** Parse errors */
	readonly errors: readonly AstParseError[];
}

/** AST parse error */
export interface AstParseError {
	readonly message: string;
	readonly range?: AstRange;
}

/** Map of path to line number for tree↔editor synchronization */
export type PathToLineMap = Map<string, number>;

/** Map of line number to path for tree↔editor synchronization */
export type LineToPathMap = Map<number, string>;
