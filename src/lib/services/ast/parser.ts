/**
 * AST parser service using Tauri command
 */

import { browser } from '$app/environment';
import type {
	AstLanguage,
	AstNode,
	AstParseResult,
	LineToPathMap,
	PathToLineMap,
} from './types.js';

/**
 * Parse text to AST using Rust parser
 * Only works in browser environment with Tauri
 */
export const parseToAst = async (text: string, language: AstLanguage): Promise<AstParseResult> => {
	// Skip parsing on server-side
	if (!browser) {
		return { ast: null, errors: [] };
	}

	try {
		// Dynamic import to avoid SSR issues
		const { invoke } = await import('@tauri-apps/api/core');
		return await invoke<AstParseResult>('parse_to_ast', { text, language });
	} catch (error) {
		return {
			ast: null,
			errors: [
				{
					message: error instanceof Error ? error.message : String(error),
				},
			],
		};
	}
};

/**
 * Build path to line map from AST node
 * Used for tree → editor synchronization
 */
export const buildPathToLineMap = (ast: AstNode | null): PathToLineMap => {
	const map = new Map<string, number>();
	if (!ast) return map;

	const traverse = (node: AstNode): void => {
		map.set(node.path, node.range.start.line);
		node.children?.forEach(traverse);
	};

	traverse(ast);
	return map;
};

/**
 * Build line to path map from AST node
 * Used for editor → tree synchronization
 */
export const buildLineToPathMap = (ast: AstNode | null): LineToPathMap => {
	const map = new Map<number, string>();
	if (!ast) return map;

	const traverse = (node: AstNode): void => {
		const line = node.range.start.line;
		// Only set if not already set (prefer first occurrence on a line)
		if (!map.has(line)) {
			map.set(line, node.path);
		}
		node.children?.forEach(traverse);
	};

	traverse(ast);
	return map;
};

/**
 * Find the closest path for a given line number
 * Used for editor cursor → tree selection synchronization
 */
export const findPathByLine = (lineToPathMap: LineToPathMap, targetLine: number): string | null =>
	Array.from(lineToPathMap.entries())
		.filter(([line]) => line <= targetLine)
		.sort(([a], [b]) => b - a)
		.at(0)?.[1] ?? null;

/**
 * Find line number for a given path
 * Used for tree selection → editor cursor synchronization
 */
export const findLineByPath = (pathToLineMap: PathToLineMap, path: string): number | null =>
	pathToLineMap.get(path) ?? null;
