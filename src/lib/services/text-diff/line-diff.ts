/**
 * Line-level diff via Longest Common Subsequence.
 *
 * Produces:
 *  - `computeDiff` for the side-by-side viewer (DiffResult with aligned
 *    leftLines / rightLines + aggregate DiffStats)
 *  - `getUnifiedDiff` for git-style single-column output
 *  - `areTextsIdentical` for a fast "are they the same modulo options" check
 */

import { defaultDiffOptions, normalizeForComparison } from './options';
import type { DiffLine, DiffOptions, DiffResult, DiffType, UnifiedDiffLine } from './types';

const splitLines = (text: string): readonly string[] => text.split('\n');

const computeLcsTable = (
	left: readonly string[],
	right: readonly string[],
	options: DiffOptions
): readonly (readonly number[])[] => {
	const m = left.length;
	const n = right.length;

	const table: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

	const rowIndices = Array.from({ length: m }, (_, k) => k + 1);
	const colIndices = Array.from({ length: n }, (_, k) => k + 1);
	rowIndices.forEach((i) => {
		colIndices.forEach((j) => {
			const leftItem = left[i - 1] ?? '';
			const rightItem = right[j - 1] ?? '';
			const leftNorm = normalizeForComparison(leftItem, options);
			const rightNorm = normalizeForComparison(rightItem, options);

			const tableRow = table[i];
			const prevRow = table[i - 1];
			if (!tableRow || !prevRow) return;

			tableRow[j] =
				leftNorm === rightNorm
					? (prevRow[j - 1] ?? 0) + 1
					: Math.max(prevRow[j] ?? 0, tableRow[j - 1] ?? 0);
		});
	});

	return table;
};

interface DiffItem {
	readonly type: DiffType;
	readonly leftIndex: number | null;
	readonly rightIndex: number | null;
	readonly value: string;
}

const getTableValue = (table: readonly (readonly number[])[], i: number, j: number): number =>
	table[i]?.[j] ?? 0;

const backtrackDiff = (
	left: readonly string[],
	right: readonly string[],
	table: readonly (readonly number[])[],
	options: DiffOptions
): readonly DiffItem[] => {
	const result: DiffItem[] = [];
	const cursor: { i: number; j: number } = { i: left.length, j: right.length };

	while (cursor.i > 0 || cursor.j > 0) {
		const { i, j } = cursor;
		if (i > 0 && j > 0) {
			const leftItem = left[i - 1] ?? '';
			const rightItem = right[j - 1] ?? '';
			const leftNorm = normalizeForComparison(leftItem, options);
			const rightNorm = normalizeForComparison(rightItem, options);

			if (leftNorm === rightNorm) {
				result.unshift({ type: 'equal', leftIndex: i - 1, rightIndex: j - 1, value: rightItem });
				Object.assign(cursor, { i: i - 1, j: j - 1 });
			} else if (getTableValue(table, i - 1, j) >= getTableValue(table, i, j - 1)) {
				result.unshift({ type: 'delete', leftIndex: i - 1, rightIndex: null, value: leftItem });
				cursor.i = i - 1;
			} else {
				result.unshift({ type: 'insert', leftIndex: null, rightIndex: j - 1, value: rightItem });
				cursor.j = j - 1;
			}
		} else if (i > 0) {
			result.unshift({
				type: 'delete',
				leftIndex: i - 1,
				rightIndex: null,
				value: left[i - 1] ?? '',
			});
			cursor.i = i - 1;
		} else {
			result.unshift({
				type: 'insert',
				leftIndex: null,
				rightIndex: j - 1,
				value: right[j - 1] ?? '',
			});
			cursor.j = j - 1;
		}
	}

	return result;
};

const buildDiffResult = (
	items: readonly DiffItem[],
	left: readonly string[],
	right: readonly string[]
): DiffResult => {
	interface BuildState {
		leftLines: DiffLine[];
		rightLines: DiffLine[];
		leftLineNum: number;
		rightLineNum: number;
		addedLines: number;
		removedLines: number;
		unchangedLines: number;
		addedChars: number;
		removedChars: number;
	}

	const initial: BuildState = {
		leftLines: [],
		rightLines: [],
		leftLineNum: 1,
		rightLineNum: 1,
		addedLines: 0,
		removedLines: 0,
		unchangedLines: 0,
		addedChars: 0,
		removedChars: 0,
	};

	const final = items.reduce<BuildState>((state, item) => {
		if (item.type === 'equal') {
			const leftContent = item.leftIndex !== null ? (left[item.leftIndex] ?? '') : '';
			state.leftLines.push({
				lineNumber: state.leftLineNum,
				content: leftContent,
				type: 'equal',
			});
			state.rightLines.push({
				lineNumber: state.rightLineNum,
				content: item.value,
				type: 'equal',
			});
			return {
				...state,
				leftLineNum: state.leftLineNum + 1,
				rightLineNum: state.rightLineNum + 1,
				unchangedLines: state.unchangedLines + 1,
			};
		}
		if (item.type === 'delete') {
			state.leftLines.push({
				lineNumber: state.leftLineNum,
				content: item.value,
				type: 'delete',
			});
			state.rightLines.push({ lineNumber: null, content: '', type: 'equal' });
			return {
				...state,
				leftLineNum: state.leftLineNum + 1,
				removedLines: state.removedLines + 1,
				removedChars: state.removedChars + item.value.length,
			};
		}
		state.leftLines.push({ lineNumber: null, content: '', type: 'equal' });
		state.rightLines.push({
			lineNumber: state.rightLineNum,
			content: item.value,
			type: 'insert',
		});
		return {
			...state,
			rightLineNum: state.rightLineNum + 1,
			addedLines: state.addedLines + 1,
			addedChars: state.addedChars + item.value.length,
		};
	}, initial);

	return {
		leftLines: final.leftLines,
		rightLines: final.rightLines,
		stats: {
			totalLines: Math.max(left.length, right.length),
			addedLines: final.addedLines,
			removedLines: final.removedLines,
			unchangedLines: final.unchangedLines,
			addedChars: final.addedChars,
			removedChars: final.removedChars,
		},
	};
};

/** Compute side-by-side diff between two texts. */
export const computeDiff = (
	leftText: string,
	rightText: string,
	options: Partial<DiffOptions> = {}
): DiffResult => {
	const opts: DiffOptions = { ...defaultDiffOptions, ...options };
	const leftLines = splitLines(leftText);
	const rightLines = splitLines(rightText);
	const table = computeLcsTable(leftLines, rightLines, opts);
	const items = backtrackDiff(leftLines, rightLines, table, opts);
	return buildDiffResult(items, leftLines, rightLines);
};

/** Get unified diff format (like git diff). */
export const getUnifiedDiff = (
	leftText: string,
	rightText: string,
	options: Partial<DiffOptions> = {}
): readonly UnifiedDiffLine[] => {
	const result = computeDiff(leftText, rightText, options);
	const maxLen = Math.max(result.leftLines.length, result.rightLines.length);

	return Array.from({ length: maxLen }).flatMap((_, i) => {
		const lines: UnifiedDiffLine[] = [];
		const leftLine = result.leftLines[i];
		const rightLine = result.rightLines[i];

		if (leftLine?.type === 'delete') {
			lines.push({ prefix: '-', content: leftLine.content, type: 'delete' });
		}
		if (rightLine?.type === 'insert') {
			lines.push({ prefix: '+', content: rightLine.content, type: 'insert' });
		}
		if (leftLine?.type === 'equal' && leftLine.lineNumber !== null) {
			lines.push({ prefix: ' ', content: leftLine.content, type: 'equal' });
		}

		return lines;
	});
};

/** Check if two texts are identical (considering options). */
export const areTextsIdentical = (
	leftText: string,
	rightText: string,
	options: Partial<DiffOptions> = {}
): boolean => {
	const opts: DiffOptions = { ...defaultDiffOptions, ...options };
	return normalizeForComparison(leftText, opts) === normalizeForComparison(rightText, opts);
};
