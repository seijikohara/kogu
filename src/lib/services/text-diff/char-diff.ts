/**
 * Character-level diff for inline highlighting within a single line pair.
 *
 * Used by `enhanced-diff` to produce the per-character segment lists that
 * power the side-by-side viewer's intra-line color tinting, and exposed
 * directly via `computeInlineDiff` for any caller that needs a one-line
 * vs one-line comparison.
 */

import { defaultDiffOptions } from './options';
import type { DiffOptions, DiffSegment } from './types';

const getChar = (chars: readonly string[], index: number): string => chars[index] ?? '';

const normalizeChar = (char: string, ignoreCase: boolean): string =>
	ignoreCase ? char.toLowerCase() : char;

const buildCharLcsTable = (
	leftChars: readonly string[],
	rightChars: readonly string[],
	ignoreCase: boolean
): readonly (readonly number[])[] => {
	const m = leftChars.length;
	const n = rightChars.length;
	const table: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

	const rowIndices = Array.from({ length: m }, (_, k) => k + 1);
	const colIndices = Array.from({ length: n }, (_, k) => k + 1);
	rowIndices.forEach((i) => {
		colIndices.forEach((j) => {
			const leftChar = normalizeChar(getChar(leftChars, i - 1), ignoreCase);
			const rightChar = normalizeChar(getChar(rightChars, j - 1), ignoreCase);

			const tableRow = table[i];
			const prevRow = table[i - 1];
			if (!tableRow || !prevRow) return;

			tableRow[j] =
				leftChar === rightChar
					? (prevRow[j - 1] ?? 0) + 1
					: Math.max(prevRow[j] ?? 0, tableRow[j - 1] ?? 0);
		});
	});
	return table;
};

const getTableValue = (table: readonly (readonly number[])[], i: number, j: number): number =>
	table[i]?.[j] ?? 0;

const backtrackCharDiff = (
	leftChars: readonly string[],
	rightChars: readonly string[],
	table: readonly (readonly number[])[],
	ignoreCase: boolean
): DiffSegment[] => {
	const segments: DiffSegment[] = [];
	const cursor: { i: number; j: number } = { i: leftChars.length, j: rightChars.length };

	while (cursor.i > 0 || cursor.j > 0) {
		const { i, j } = cursor;
		const lc = getChar(leftChars, i - 1);
		const rc = getChar(rightChars, j - 1);

		if (i > 0 && j > 0 && normalizeChar(lc, ignoreCase) === normalizeChar(rc, ignoreCase)) {
			segments.unshift({ type: 'equal', value: rc });
			Object.assign(cursor, { i: i - 1, j: j - 1 });
		} else if (
			i > 0 &&
			(j === 0 || getTableValue(table, i - 1, j) >= getTableValue(table, i, j - 1))
		) {
			segments.unshift({ type: 'delete', value: lc });
			cursor.i = i - 1;
		} else if (j > 0) {
			segments.unshift({ type: 'insert', value: rc });
			cursor.j = j - 1;
		}
	}
	return segments;
};

const mergeSegments = (segments: readonly DiffSegment[]): DiffSegment[] =>
	segments.reduce<DiffSegment[]>((acc, segment) => {
		const last = acc[acc.length - 1];
		if (last && last.type === segment.type) {
			acc[acc.length - 1] = { type: segment.type, value: last.value + segment.value };
		} else {
			acc.push(segment);
		}
		return acc;
	}, []);

/**
 * Internal helper used by enhanced-diff to compute per-line segments.
 * Accepts the resolved `DiffOptions` (not the partial form).
 */
export const computeCharDiff = (
	left: string,
	right: string,
	options: DiffOptions
): readonly DiffSegment[] => {
	if (left.length === 0) return right ? [{ type: 'insert', value: right }] : [];
	if (right.length === 0) return left ? [{ type: 'delete', value: left }] : [];

	const leftChars = left.split('');
	const rightChars = right.split('');
	const table = buildCharLcsTable(leftChars, rightChars, options.ignoreCase);
	const segments = backtrackCharDiff(leftChars, rightChars, table, options.ignoreCase);
	return mergeSegments(segments);
};

/** Compute inline (character-level) diff between two lines. */
export const computeInlineDiff = (
	leftLine: string,
	rightLine: string,
	options: Partial<DiffOptions> = {}
): readonly DiffSegment[] => {
	const opts: DiffOptions = { ...defaultDiffOptions, ...options };
	return computeCharDiff(leftLine, rightLine, opts);
};
