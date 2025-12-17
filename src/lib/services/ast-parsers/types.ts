/**
 * AST Parser Types
 *
 * Unified AST node structure for tree view synchronization with Monaco Editor.
 */

/** Supported languages for AST parsing */
export type AstLanguage = 'json' | 'yaml' | 'xml' | 'sql';

/** AST node type */
export type AstNodeType =
	| 'root'
	| 'object'
	| 'array'
	| 'property'
	| 'string'
	| 'number'
	| 'boolean'
	| 'null'
	| 'element'
	| 'attribute'
	| 'text'
	| 'statement'
	| 'clause'
	| 'expression'
	| 'identifier'
	| 'literal'
	| 'operator'
	| 'unknown';

/** Position in the source text */
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

/** AST parser function signature */
export type AstParser = (text: string) => AstParseResult;

/** Helper to create position from offset and text */
export const offsetToPosition = (text: string, offset: number): AstPosition => {
	const lines = text.slice(0, offset).split('\n');
	const line = lines.length;
	const column = (lines.at(-1)?.length ?? 0) + 1;
	return { line, column, offset };
};

/** Helper to find node by path */
export const findNodeByPath = (root: AstNode | null, targetPath: string): AstNode | null => {
	if (!root) return null;
	if (root.path === targetPath) return root;
	if (!root.children) return null;

	for (const child of root.children) {
		const found = findNodeByPath(child, targetPath);
		if (found) return found;
	}
	return null;
};

/** Helper to find node containing a line number */
export const findNodeByLine = (root: AstNode | null, line: number): AstNode | null => {
	if (!root) return null;

	let bestMatch: AstNode | null = null;

	const visit = (node: AstNode) => {
		if (node.range.start.line <= line && node.range.end.line >= line) {
			// This node contains the line, check if it's a better match
			if (
				!bestMatch ||
				(node.range.start.line >= bestMatch.range.start.line &&
					node.range.end.line <= bestMatch.range.end.line)
			) {
				bestMatch = node;
			}
		}
		node.children?.forEach(visit);
	};

	visit(root);
	return bestMatch;
};

/** Build a map of paths to line numbers */
export const buildPathToLineMap = (root: AstNode | null): Map<string, number> => {
	const map = new Map<string, number>();
	if (!root) return map;

	const visit = (node: AstNode) => {
		map.set(node.path, node.range.start.line);
		node.children?.forEach(visit);
	};

	visit(root);
	return map;
};
