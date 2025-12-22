/**
 * Markdown AST parser for tree view synchronization.
 * Parses Markdown text into AstNode structure for tree view display.
 */

import type { AstNode, AstNodeType, AstParseResult, AstPosition, AstRange } from './types.js';

/** Markdown block types for parsing */
interface MarkdownBlock {
	readonly type: AstNodeType;
	readonly content: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly startOffset: number;
	readonly endOffset: number;
	readonly level?: number;
	readonly language?: string;
	readonly children?: readonly MarkdownBlock[];
}

/**
 * Convert line and column to AstPosition.
 */
const createPosition = (line: number, column: number, offset: number): AstPosition => ({
	line,
	column,
	offset,
});

/**
 * Create AstRange from start and end positions.
 */
const createRange = (
	startLine: number,
	startColumn: number,
	startOffset: number,
	endLine: number,
	endColumn: number,
	endOffset: number
): AstRange => ({
	start: createPosition(startLine, startColumn, startOffset),
	end: createPosition(endLine, endColumn, endOffset),
});

/**
 * Create AstNode with given properties.
 */
const createNode = (
	type: AstNodeType,
	path: string,
	label: string,
	range: AstRange,
	children?: readonly AstNode[]
): AstNode => ({
	type,
	path,
	label,
	range,
	children: children && children.length > 0 ? children : undefined,
});

/**
 * Calculate line offsets for the text.
 */
const calculateLineOffsets = (text: string): readonly number[] => [
	0,
	...text.split('').reduce<number[]>((offsets, char, i) => {
		if (char === '\n') {
			offsets.push(i + 1);
		}
		return offsets;
	}, []),
];

/**
 * Get offset for a given line number (1-indexed).
 */
const getLineOffset = (lineOffsets: readonly number[], line: number): number =>
	lineOffsets[line - 1] ?? 0;

/**
 * Format heading label with level indicator.
 */
const formatHeadingLabel = (level: number, text: string): string => {
	const prefix = `H${level}`;
	const truncated = text.length > 40 ? `${text.slice(0, 37)}...` : text;
	return `${prefix}: ${truncated}`;
};

/**
 * Format code block label with language.
 */
const formatCodeBlockLabel = (language: string | undefined): string =>
	language ? `Code (${language})` : 'Code';

/**
 * Format list label with item count.
 */
const formatListLabel = (ordered: boolean, itemCount: number): string => {
	const type = ordered ? 'Ordered List' : 'List';
	return `${type} (${itemCount} items)`;
};

/**
 * Parse Markdown text into blocks.
 */
const parseBlocks = (
	text: string,
	lineOffsets: readonly number[]
): { blocks: readonly MarkdownBlock[]; listCounters: Map<number, number> } => {
	const lines = text.split('\n');
	const blocks: MarkdownBlock[] = [];
	const listCounters = new Map<number, number>();
	let i = 0;

	while (i < lines.length) {
		const line = lines[i] ?? '';
		const lineNum = i + 1;
		const lineStart = getLineOffset(lineOffsets, lineNum);

		// Heading
		const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
		if (headingMatch) {
			const hashes = headingMatch[1];
			const content = headingMatch[2];
			if (hashes && content) {
				blocks.push({
					type: 'heading',
					content: content.trim(),
					startLine: lineNum,
					endLine: lineNum,
					startOffset: lineStart,
					endOffset: lineStart + line.length,
					level: hashes.length,
				});
				i++;
				continue;
			}
		}

		// Code block (fenced)
		const codeBlockMatch = /^```(\w*)/.exec(line);
		if (codeBlockMatch) {
			const language = codeBlockMatch[1] ?? '';
			const startLineNum = lineNum;
			const startLineOffset = lineStart;
			let endLineNum = lineNum;
			let endOffset = lineStart + line.length;
			const codeLines: string[] = [];
			i++;

			while (i < lines.length) {
				const codeLine = lines[i] ?? '';
				if (codeLine.startsWith('```')) {
					endLineNum = i + 1;
					endOffset = getLineOffset(lineOffsets, endLineNum) + codeLine.length;
					i++;
					break;
				}
				codeLines.push(codeLine);
				endLineNum = i + 1;
				endOffset = getLineOffset(lineOffsets, endLineNum) + codeLine.length;
				i++;
			}

			blocks.push({
				type: 'code_block',
				content: codeLines.join('\n'),
				startLine: startLineNum,
				endLine: endLineNum,
				startOffset: startLineOffset,
				endOffset,
				language: language || undefined,
			});
			continue;
		}

		// Horizontal rule
		if (/^(---+|\*\*\*+|___+)$/.test(line.trim())) {
			blocks.push({
				type: 'horizontal_rule',
				content: '',
				startLine: lineNum,
				endLine: lineNum,
				startOffset: lineStart,
				endOffset: lineStart + line.length,
			});
			i++;
			continue;
		}

		// Blockquote
		if (line.startsWith('>')) {
			const startLineNum = lineNum;
			const startLineOffset = lineStart;
			const quoteLines: string[] = [];
			let endLineNum = lineNum;
			let endOffset = lineStart + line.length;

			while (i < lines.length) {
				const quoteLine = lines[i] ?? '';
				if (quoteLine.startsWith('>')) {
					quoteLines.push(quoteLine.replace(/^>\s?/, ''));
					endLineNum = i + 1;
					endOffset = getLineOffset(lineOffsets, endLineNum) + quoteLine.length;
					i++;
				} else if (quoteLine.trim() === '' && quoteLines.length > 0) {
					break;
				} else {
					break;
				}
			}

			blocks.push({
				type: 'blockquote',
				content: quoteLines.join('\n'),
				startLine: startLineNum,
				endLine: endLineNum,
				startOffset: startLineOffset,
				endOffset,
			});
			continue;
		}

		// Task list item
		const taskMatch = /^(\s*)- \[([ xX])\] (.+)$/.exec(line);
		if (taskMatch) {
			const content = taskMatch[3];
			if (content) {
				blocks.push({
					type: 'task_item',
					content: content.trim(),
					startLine: lineNum,
					endLine: lineNum,
					startOffset: lineStart,
					endOffset: lineStart + line.length,
				});
				i++;
				continue;
			}
		}

		// Unordered list item
		const ulMatch = /^(\s*)[-*+]\s+(.+)$/.exec(line);
		if (ulMatch) {
			const content = ulMatch[2];
			if (content) {
				blocks.push({
					type: 'list_item',
					content: content.trim(),
					startLine: lineNum,
					endLine: lineNum,
					startOffset: lineStart,
					endOffset: lineStart + line.length,
				});
				i++;
				continue;
			}
		}

		// Ordered list item
		const olMatch = /^(\s*)\d+\.\s+(.+)$/.exec(line);
		if (olMatch) {
			const content = olMatch[2];
			if (content) {
				blocks.push({
					type: 'list_item',
					content: content.trim(),
					startLine: lineNum,
					endLine: lineNum,
					startOffset: lineStart,
					endOffset: lineStart + line.length,
					level: 1, // Mark as ordered
				});
				i++;
				continue;
			}
		}

		// Table
		const tableMatch = /^\|(.+)\|$/.exec(line);
		if (tableMatch) {
			const startLineNum = lineNum;
			const startLineOffset = lineStart;
			const tableRows: MarkdownBlock[] = [];
			let endLineNum = lineNum;
			let endOffset = lineStart + line.length;

			while (i < lines.length) {
				const tableLine = lines[i] ?? '';
				const rowMatch = /^\|(.+)\|$/.exec(tableLine);
				if (rowMatch) {
					// Skip separator row
					if (!/^\|[-:\s|]+\|$/.test(tableLine)) {
						tableRows.push({
							type: 'table_row',
							content: tableLine,
							startLine: i + 1,
							endLine: i + 1,
							startOffset: getLineOffset(lineOffsets, i + 1),
							endOffset: getLineOffset(lineOffsets, i + 1) + tableLine.length,
						});
					}
					endLineNum = i + 1;
					endOffset = getLineOffset(lineOffsets, endLineNum) + tableLine.length;
					i++;
				} else {
					break;
				}
			}

			if (tableRows.length > 0) {
				blocks.push({
					type: 'table',
					content: '',
					startLine: startLineNum,
					endLine: endLineNum,
					startOffset: startLineOffset,
					endOffset,
					children: tableRows,
				});
			}
			continue;
		}

		// Paragraph (non-empty line that doesn't match other patterns)
		if (line.trim()) {
			const startLineNum = lineNum;
			const startLineOffset = lineStart;
			const paraLines: string[] = [line];
			let endLineNum = lineNum;
			let endOffset = lineStart + line.length;
			i++;

			while (i < lines.length) {
				const paraLine = lines[i] ?? '';
				// Stop at empty lines or block-level elements
				if (
					paraLine.trim() === '' ||
					/^#{1,6}\s/.test(paraLine) ||
					/^```/.test(paraLine) ||
					/^>/.test(paraLine) ||
					/^[-*+]\s/.test(paraLine) ||
					/^\d+\.\s/.test(paraLine) ||
					/^\|/.test(paraLine) ||
					/^(---+|\*\*\*+|___+)$/.test(paraLine.trim())
				) {
					break;
				}
				paraLines.push(paraLine);
				endLineNum = i + 1;
				endOffset = getLineOffset(lineOffsets, endLineNum) + paraLine.length;
				i++;
			}

			const content = paraLines.join(' ').trim();
			if (content) {
				blocks.push({
					type: 'paragraph',
					content,
					startLine: startLineNum,
					endLine: endLineNum,
					startOffset: startLineOffset,
					endOffset,
				});
			}
			continue;
		}

		// Empty line - skip
		i++;
	}

	return { blocks, listCounters };
};

/**
 * Create a list block from accumulated items.
 */
const createListBlock = (
	items: readonly MarkdownBlock[],
	listType: 'ordered' | 'unordered' | 'task'
): MarkdownBlock | null => {
	const first = items[0];
	const last = items[items.length - 1];
	if (!first || !last) return null;

	return {
		type: 'list',
		content: '',
		startLine: first.startLine,
		endLine: last.endLine,
		startOffset: first.startOffset,
		endOffset: last.endOffset,
		level: listType === 'ordered' ? 1 : 0,
		children: items,
	};
};

/**
 * Group consecutive list items into list blocks.
 */
const groupListItems = (blocks: readonly MarkdownBlock[]): readonly MarkdownBlock[] => {
	interface AccState {
		result: MarkdownBlock[];
		currentList: MarkdownBlock[];
		currentListType: 'ordered' | 'unordered' | 'task' | null;
	}

	const flushList = (state: AccState): void => {
		if (state.currentList.length > 0 && state.currentListType) {
			const listBlock = createListBlock(state.currentList, state.currentListType);
			if (listBlock) {
				state.result.push(listBlock);
			}
			state.currentList = [];
			state.currentListType = null;
		}
	};

	const finalState = blocks.reduce<AccState>(
		(state, block) => {
			if (block.type === 'list_item') {
				const type = block.level === 1 ? 'ordered' : 'unordered';
				if (state.currentListType && state.currentListType !== type) {
					flushList(state);
				}
				state.currentListType = type;
				state.currentList.push(block);
			} else if (block.type === 'task_item') {
				if (state.currentListType && state.currentListType !== 'task') {
					flushList(state);
				}
				state.currentListType = 'task';
				state.currentList.push(block);
			} else {
				flushList(state);
				state.result.push(block);
			}
			return state;
		},
		{ result: [], currentList: [], currentListType: null }
	);

	// Flush any remaining list items
	flushList(finalState);
	return finalState.result;
};

/**
 * Convert MarkdownBlock to AstNode.
 */
const blockToNode = (block: MarkdownBlock, path: string, index: number): AstNode => {
	const range = createRange(
		block.startLine,
		1,
		block.startOffset,
		block.endLine,
		1,
		block.endOffset
	);

	let label: string;
	let children: AstNode[] | undefined;

	switch (block.type) {
		case 'heading':
			label = formatHeadingLabel(block.level ?? 1, block.content);
			break;
		case 'code_block':
			label = formatCodeBlockLabel(block.language);
			break;
		case 'blockquote':
			label = `Quote: ${block.content.slice(0, 30)}${block.content.length > 30 ? '...' : ''}`;
			break;
		case 'paragraph': {
			const preview = block.content.slice(0, 40);
			label = `Paragraph: ${preview}${block.content.length > 40 ? '...' : ''}`;
			break;
		}
		case 'list': {
			const isOrdered = block.level === 1;
			const itemCount = block.children?.length ?? 0;
			label = formatListLabel(isOrdered, itemCount);
			children = block.children?.map((child, i) => blockToNode(child, `${path}[${i}]`, i));
			break;
		}
		case 'list_item': {
			const preview = block.content.slice(0, 35);
			label = `• ${preview}${block.content.length > 35 ? '...' : ''}`;
			break;
		}
		case 'task_item': {
			const preview = block.content.slice(0, 30);
			label = `☐ ${preview}${block.content.length > 30 ? '...' : ''}`;
			break;
		}
		case 'table': {
			const rowCount = block.children?.length ?? 0;
			label = `Table (${rowCount} rows)`;
			children = block.children?.map((child, i) => blockToNode(child, `${path}.row[${i}]`, i));
			break;
		}
		case 'table_row': {
			const cells = block.content.split('|').filter((c) => c.trim());
			label = `Row: ${cells.slice(0, 3).join(' | ')}${cells.length > 3 ? '...' : ''}`;
			break;
		}
		case 'horizontal_rule':
			label = '───────────';
			break;
		default:
			label = block.content.slice(0, 40);
	}

	const nodePath =
		block.type === 'heading'
			? `$.heading[${index}]`
			: block.type === 'list'
				? `$.list[${index}]`
				: block.type === 'table'
					? `$.table[${index}]`
					: block.type === 'code_block'
						? `$.code[${index}]`
						: path;

	return createNode(block.type, nodePath, label, range, children);
};

/**
 * Parse Markdown text to AST structure.
 */
export const parseMarkdownToAst = (text: string): AstParseResult => {
	if (!text.trim()) {
		return {
			ast: null,
			errors: [],
		};
	}

	try {
		const lineOffsets = calculateLineOffsets(text);
		const { blocks } = parseBlocks(text, lineOffsets);
		const groupedBlocks = groupListItems(blocks);

		const children = groupedBlocks.map((block, index) => blockToNode(block, `$[${index}]`, index));

		const lastLine = text.split('\n').length;
		const rootRange = createRange(1, 1, 0, lastLine, 1, text.length);

		const ast = createNode('document', '$', 'Document', rootRange, children);

		return {
			ast,
			errors: [],
		};
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
