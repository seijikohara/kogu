/**
 * Enhanced diff that groups changes into hunks with surrounding context
 * and decorates each line pair with character-level segments.
 *
 * This is the format consumed by the diff viewer's "with context" mode,
 * mirroring git's `--unified` output but with intra-line highlights.
 */

import { computeCharDiff } from './char-diff';
import { computeDiff } from './line-diff';
import { defaultDiffOptions } from './options';
import type {
	DiffHunk,
	DiffLine,
	DiffOptions,
	DiffSegment,
	EnhancedDiffLine,
	EnhancedDiffResult,
} from './types';

interface RawChange {
	type: 'equal' | 'delete' | 'insert';
	leftLineNumber: number | null;
	rightLineNumber: number | null;
	leftContent: string;
	rightContent: string;
}

const groupIntoHunks = (lines: readonly EnhancedDiffLine[], contextLines: number): DiffHunk[] => {
	if (lines.length === 0) return [];

	const changeIndices = lines
		.map((line, idx) => (line.type !== 'equal' ? idx : -1))
		.filter((idx) => idx !== -1);

	if (changeIndices.length === 0) {
		return [
			{
				startLeft: 1,
				startRight: 1,
				countLeft: lines.filter((l) => l.leftLineNumber !== null).length,
				countRight: lines.filter((l) => l.rightLineNumber !== null).length,
				lines,
			},
		];
	}

	const firstIdx = changeIndices[0] ?? 0;
	const initialRange = {
		start: Math.max(0, firstIdx - contextLines),
		end: Math.min(lines.length - 1, firstIdx + contextLines),
	};

	const hunkRanges = changeIndices.slice(1).reduce<Array<{ start: number; end: number }>>(
		(ranges, changeIdx) => {
			const lastRange = ranges.at(-1);
			if (!lastRange) return ranges;
			const newStart = Math.max(0, changeIdx - contextLines);

			if (newStart <= lastRange.end + 1) {
				lastRange.end = Math.min(lines.length - 1, changeIdx + contextLines);
			} else {
				ranges.push({
					start: newStart,
					end: Math.min(lines.length - 1, changeIdx + contextLines),
				});
			}
			return ranges;
		},
		[initialRange]
	);

	return hunkRanges.map((range) => {
		const hunkLines = lines.slice(range.start, range.end + 1);
		const firstLine = hunkLines[0];
		return {
			startLeft: firstLine?.leftLineNumber ?? 1,
			startRight: firstLine?.rightLineNumber ?? 1,
			countLeft: hunkLines.filter((l) => l.leftLineNumber !== null).length,
			countRight: hunkLines.filter((l) => l.rightLineNumber !== null).length,
			lines: hunkLines,
		};
	});
};

/** Compute enhanced diff with hunks and inline character-level highlighting. */
export const computeEnhancedDiff = (
	leftText: string,
	rightText: string,
	options: Partial<DiffOptions> = {},
	contextLines: number = 3
): EnhancedDiffResult => {
	const opts: DiffOptions = { ...defaultDiffOptions, ...options };
	const result = computeDiff(leftText, rightText, opts);

	const leftLines = result.leftLines;
	const rightLines = result.rightLines;

	const rawChanges: RawChange[] = leftLines
		.map((left, i) => ({ left, right: rightLines[i] }))
		.filter((pair): pair is { left: DiffLine; right: DiffLine } => !!pair.left && !!pair.right)
		.map(({ left, right }): RawChange | null => {
			if (left.type === 'delete' && left.lineNumber !== null) {
				return {
					type: 'delete',
					leftLineNumber: left.lineNumber,
					rightLineNumber: null,
					leftContent: left.content,
					rightContent: '',
				};
			}
			if (right.type === 'insert' && right.lineNumber !== null) {
				return {
					type: 'insert',
					leftLineNumber: null,
					rightLineNumber: right.lineNumber,
					leftContent: '',
					rightContent: right.content,
				};
			}
			if (left.type === 'equal' && left.lineNumber !== null) {
				return {
					type: 'equal',
					leftLineNumber: left.lineNumber,
					rightLineNumber: right.lineNumber,
					leftContent: left.content,
					rightContent: right.content,
				};
			}
			return null;
		})
		.filter((change): change is RawChange => change !== null);

	const { segments, currentSegment } = rawChanges.reduce<{
		segments: RawChange[][];
		currentSegment: RawChange[];
	}>(
		(acc, change) => {
			if (change.type === 'equal') {
				const flushed =
					acc.currentSegment.length > 0 ? [...acc.segments, acc.currentSegment] : acc.segments;
				return { segments: [...flushed, [change]], currentSegment: [] };
			}
			return { segments: acc.segments, currentSegment: [...acc.currentSegment, change] };
		},
		{ segments: [], currentSegment: [] }
	);
	const finalSegments = currentSegment.length > 0 ? [...segments, currentSegment] : segments;

	const enhancedLines: EnhancedDiffLine[] = [];

	finalSegments.forEach((segment) => {
		if (segment.length === 1 && segment[0]?.type === 'equal') {
			const change = segment[0];
			enhancedLines.push({
				leftLineNumber: change.leftLineNumber,
				rightLineNumber: change.rightLineNumber,
				leftContent: change.leftContent,
				rightContent: change.rightContent,
				type: 'equal',
			});
			return;
		}

		const deletes = segment.filter((c) => c.type === 'delete');
		const inserts = segment.filter((c) => c.type === 'insert');
		const maxPairs = Math.min(deletes.length, inserts.length);

		const pairedLines = deletes.slice(0, maxPairs).map((del, j) => {
			const ins = inserts[j];
			if (!ins) return null;
			const charSegments = computeCharDiff(del.leftContent, ins.rightContent, opts);

			const { leftSegments, rightSegments } = charSegments.reduce<{
				leftSegments: DiffSegment[];
				rightSegments: DiffSegment[];
			}>(
				(acc, seg) => {
					if (seg.type === 'equal') {
						acc.leftSegments.push(seg);
						acc.rightSegments.push(seg);
					} else if (seg.type === 'delete') {
						acc.leftSegments.push(seg);
					} else {
						acc.rightSegments.push(seg);
					}
					return acc;
				},
				{ leftSegments: [], rightSegments: [] }
			);

			return {
				leftLineNumber: del.leftLineNumber,
				rightLineNumber: ins.rightLineNumber,
				leftContent: del.leftContent,
				rightContent: ins.rightContent,
				type: 'modified' as const,
				leftSegments,
				rightSegments,
			};
		});

		const remainingDeletes = deletes.slice(maxPairs).map((del) => ({
			leftLineNumber: del.leftLineNumber,
			rightLineNumber: null,
			leftContent: del.leftContent,
			rightContent: '',
			type: 'delete' as const,
		}));

		const remainingInserts = inserts.slice(maxPairs).map((ins) => ({
			leftLineNumber: null,
			rightLineNumber: ins.rightLineNumber,
			leftContent: '',
			rightContent: ins.rightContent,
			type: 'insert' as const,
		}));

		const validPairedLines = pairedLines.filter(
			(line): line is NonNullable<typeof line> => line !== null
		);
		enhancedLines.push(...validPairedLines, ...remainingDeletes, ...remainingInserts);
	});

	const hunks = groupIntoHunks(enhancedLines, contextLines);
	const modifiedLines = enhancedLines.filter((line) => line.type === 'modified').length;

	return {
		hunks,
		stats: {
			...result.stats,
			hunkCount: hunks.length,
			modifiedLines,
		},
	};
};

/** Format hunk header like git diff (e.g., @@ -1,4 +1,5 @@). */
export const formatHunkHeader = (hunk: DiffHunk): string =>
	`@@ -${hunk.startLeft},${hunk.countLeft} +${hunk.startRight},${hunk.countRight} @@`;
