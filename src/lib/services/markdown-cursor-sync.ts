/**
 * Cursor synchronization utilities for Monaco ↔ Visual Editor (Tiptap/Vizel)
 *
 * Provides bidirectional mapping between Markdown line numbers and ProseMirror positions
 * using a block-based source map approach.
 */

import MarkdownIt from 'markdown-it';

// Minimal Editor interface to avoid importing @tiptap/core directly
// which causes plugin conflicts with Vizel's internal Tiptap instance
export interface TiptapEditor {
	readonly state: {
		readonly selection: { readonly from: number };
		readonly doc: {
			readonly content: { readonly size: number };
			descendants: (callback: (node: PMNode, pos: number) => boolean | undefined) => void;
		};
	};
	readonly commands: Record<string, (args?: unknown) => boolean>;
	chain: () => { focus: () => void };
}

// markdown-it Token type (simplified for our use)
interface MdToken {
	readonly type: string;
	readonly tag: string;
	readonly map: [number, number] | null;
	readonly content: string;
	readonly children: MdToken[] | null;
	readonly block: boolean;
	readonly nesting: -1 | 0 | 1;
}

// ProseMirror Node type (simplified interface for type checking)
interface PMNode {
	readonly type: { name: string };
	readonly attrs: Record<string, unknown>;
	readonly isBlock: boolean;
	readonly textContent: string;
	readonly nodeSize: number;
}

interface SourceMapEntry {
	readonly startLine: number; // 1-indexed
	readonly endLine: number; // 1-indexed
	readonly type: string; // Token type (heading_open, paragraph_open, etc.)
	readonly content: string; // Text content for matching
}

// Leaf block types in ProseMirror - these are the actual content blocks
// Container types (table, tableRow, bulletList, etc.) are NOT leaf blocks
const LEAF_BLOCK_TYPES = new Set(['heading', 'paragraph', 'codeBlock', 'horizontalRule']);

// Token types that represent leaf-level content (not containers)
// These correspond to ProseMirror's leaf block types
const LEAF_TOKEN_TYPES = new Set([
	'heading_open', // Corresponds to 'heading' in PM
	'paragraph_open', // Corresponds to 'paragraph' in PM
	'fence', // Corresponds to 'codeBlock' in PM
	'code_block', // Corresponds to 'codeBlock' in PM
	'hr', // Corresponds to 'horizontalRule' in PM
]);

// Table cell tokens (each cell contains a paragraph in ProseMirror)
const TABLE_CELL_TYPES = new Set(['th_open', 'td_open']);

// Create a markdown-it instance for source map parsing
const mdParser = new MarkdownIt();

// Accumulator state for source map building
interface SourceMapState {
	readonly entries: readonly SourceMapEntry[];
	readonly inTable: boolean;
}

// Process a single token and return updated state
const processToken = (
	state: SourceMapState,
	token: MdToken,
	nextToken: MdToken | undefined
): SourceMapState => {
	// Track table state
	if (token.type === 'table_open') {
		return { ...state, inTable: true };
	}
	if (token.type === 'table_close') {
		return { ...state, inTable: false };
	}

	// Skip tokens without source map
	if (!token.map) return state;

	// Handle table cells (each cell = one paragraph in ProseMirror)
	if (state.inTable && TABLE_CELL_TYPES.has(token.type)) {
		const content = nextToken?.type === 'inline' ? nextToken.content : '';
		return {
			...state,
			entries: [
				...state.entries,
				{
					startLine: token.map[0] + 1,
					endLine: token.map[1],
					type: token.type,
					content: content.slice(0, 100),
				},
			],
		};
	}

	// Skip paragraphs inside tables (they're handled by cell tokens)
	if (state.inTable && token.type === 'paragraph_open') {
		return state;
	}

	// Process leaf token types
	if (LEAF_TOKEN_TYPES.has(token.type)) {
		const content =
			token.type === 'fence' || token.type === 'code_block'
				? token.content
				: nextToken?.type === 'inline'
					? nextToken.content
					: '';

		return {
			...state,
			entries: [
				...state.entries,
				{
					startLine: token.map[0] + 1,
					endLine: token.map[1],
					type: token.type,
					content: content.slice(0, 100),
				},
			],
		};
	}

	return state;
};

/**
 * Build source map from markdown using markdown-it tokens
 * Only captures leaf-level content tokens that correspond to ProseMirror leaf blocks
 */
const buildSourceMap = (markdown: string): readonly SourceMapEntry[] => {
	const tokens = mdParser.parse(markdown, {}) as MdToken[];
	const initialState: SourceMapState = { entries: [], inTable: false };

	const finalState = tokens.reduce(
		(state, token, index) => processToken(state, token, tokens[index + 1]),
		initialState
	);

	return finalState.entries;
};

// Check if a ProseMirror node is a leaf block (content-bearing, not a container)
const isLeafBlock = (node: PMNode): boolean => LEAF_BLOCK_TYPES.has(node.type.name);

/**
 * Get the leaf block index at cursor position in ProseMirror document
 */
const getBlockIndexAtCursor = (editor: TiptapEditor): number => {
	const { from } = editor.state.selection;
	let blockIndex = 0;
	let cursorBlockIndex = 0;

	editor.state.doc.descendants((node: PMNode, pos: number) => {
		if (!isLeafBlock(node)) return true;

		if (pos <= from && from <= pos + node.nodeSize) {
			cursorBlockIndex = blockIndex;
		}
		blockIndex++;
		return true;
	});

	return cursorBlockIndex;
};

/**
 * Get the ProseMirror position at a given leaf block index
 */
const getBlockPositionByIndex = (editor: TiptapEditor, targetIndex: number): number => {
	let blockIndex = 0;
	let targetPos = 1;

	editor.state.doc.descendants((node: PMNode, pos: number) => {
		if (targetPos > 1 && blockIndex > targetIndex) return false;
		if (!isLeafBlock(node)) return true;

		if (blockIndex === targetIndex) {
			targetPos = pos + 1;
			return false;
		}
		blockIndex++;
		return true;
	});

	return targetPos;
};

/**
 * Find the block index that contains or is closest to the target line
 */
const findBlockIndexForLine = (
	sourceMap: readonly SourceMapEntry[],
	targetLine: number
): number => {
	// Find exact match: block that contains the target line
	const exactMatchIndex = sourceMap.findIndex(
		(entry) => targetLine >= entry.startLine && targetLine < entry.endLine
	);
	if (exactMatchIndex !== -1) return exactMatchIndex;

	// Find the first block that starts after target line, then use previous block
	const nextBlockIndex = sourceMap.findIndex((entry) => entry.startLine > targetLine);
	if (nextBlockIndex > 0) return nextBlockIndex - 1;
	if (nextBlockIndex === 0) return 0;

	// Target line is after all blocks, use last block
	return sourceMap.length - 1;
};

/**
 * Map ProseMirror cursor position to Markdown line number using source map
 * @param editor - Tiptap Editor instance
 * @param markdown - Current markdown content
 * @returns Line number (1-indexed)
 */
export const getMarkdownLineFromCursor = (editor: TiptapEditor, markdown: string): number => {
	const { from } = editor.state.selection;

	// Edge case: empty or minimal document
	if (editor.state.doc.content.size <= 1 || from <= 1) return 1;

	// Build source map from markdown
	const sourceMap = buildSourceMap(markdown);
	if (sourceMap.length === 0) return 1;

	// Get block index at cursor
	const blockIndex = getBlockIndexAtCursor(editor);

	// Find the corresponding source map entry
	// Use min to handle edge cases where ProseMirror has more blocks
	const entryIndex = Math.min(blockIndex, sourceMap.length - 1);
	const entry = sourceMap[entryIndex];

	return entry?.startLine ?? 1;
};

/**
 * Map Markdown line number to ProseMirror position using source map
 * @param editor - Tiptap Editor instance
 * @param markdown - Current markdown content
 * @param targetLine - Target line number (1-indexed)
 * @returns ProseMirror position
 */
export const getProseMirrorPosFromLine = (
	editor: TiptapEditor,
	markdown: string,
	targetLine: number
): number => {
	// Edge case
	if (targetLine <= 1) return 1;

	// Build source map from markdown
	const sourceMap = buildSourceMap(markdown);
	if (sourceMap.length === 0) return 1;

	// Find which block contains this line
	const targetBlockIndex = findBlockIndexForLine(sourceMap, targetLine);

	// Get the ProseMirror position at that block index
	return getBlockPositionByIndex(editor, targetBlockIndex);
};
