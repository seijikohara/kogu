/**
 * Text diff utilities using Longest Common Subsequence (LCS) algorithm.
 * Provides pure functions for comparing and highlighting text differences.
 */

// Types
export type DiffType = 'equal' | 'insert' | 'delete';

export interface DiffSegment {
	readonly type: DiffType;
	readonly value: string;
}

export interface DiffLine {
	readonly lineNumber: number | null;
	readonly content: string;
	readonly type: DiffType;
	readonly segments?: readonly DiffSegment[];
}

export interface DiffResult {
	readonly leftLines: readonly DiffLine[];
	readonly rightLines: readonly DiffLine[];
	readonly stats: DiffStats;
}

export interface DiffStats {
	readonly totalLines: number;
	readonly addedLines: number;
	readonly removedLines: number;
	readonly unchangedLines: number;
	readonly addedChars: number;
	readonly removedChars: number;
}

export interface DiffOptions {
	readonly ignoreWhitespace: boolean;
	readonly ignoreCase: boolean;
	readonly trimLines: boolean;
}

export const defaultDiffOptions: DiffOptions = {
	ignoreWhitespace: false,
	ignoreCase: false,
	trimLines: false,
};

// Sample texts for demonstration
// Includes: equal lines, deleted lines, added lines, modified lines, multiple hunks
export const SAMPLE_LEFT_TEXT = `// User Management Module
// Version: 1.0.0

import { Logger } from './logger';
import { Database } from './database';

interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  private db: Database;
  private logger: Logger;

  constructor(db: Database) {
    this.db = db;
    this.logger = new Logger();
  }

  async getUser(id: number): Promise<User | null> {
    this.logger.info("Fetching user: " + id);
    return this.db.findById(id);
  }

  async deleteUser(id: number): Promise<boolean> {
    this.logger.warn("Deleting user: " + id);
    return this.db.delete(id);
  }
}

export { UserService };`;

export const SAMPLE_RIGHT_TEXT = `// User Management Module
// Version: 2.0.0
// Author: Development Team

import { Logger } from './logger';
import { Database } from './database';
import { Cache } from './cache';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

class UserService {
  private db: Database;
  private logger: Logger;
  private cache: Cache;

  constructor(db: Database, cache: Cache) {
    this.db = db;
    this.logger = new Logger('UserService');
    this.cache = cache;
  }

  async getUser(id: number): Promise<User | null> {
    const cached = await this.cache.get(\`user:\${id}\`);
    if (cached) return cached;

    this.logger.info(\`Fetching user: \${id}\`);
    const user = await this.db.findById(id);
    if (user) await this.cache.set(\`user:\${id}\`, user);
    return user;
  }

  async createUser(data: Omit<User, 'id'>): Promise<User> {
    this.logger.info('Creating new user');
    return this.db.create(data);
  }
}

export { UserService };
export type { User };`;

// Pure helper functions

/**
 * Normalize text based on options for comparison.
 */
const normalizeForComparison = (text: string, options: DiffOptions): string => {
	const trimmed = options.trimLines ? text.trim() : text;
	const collapsed = options.ignoreWhitespace ? trimmed.replace(/\s+/g, ' ').trim() : trimmed;
	return options.ignoreCase ? collapsed.toLowerCase() : collapsed;
};

/**
 * Split text into lines.
 */
const splitLines = (text: string): readonly string[] => text.split('\n');

/**
 * Compute LCS (Longest Common Subsequence) table.
 */
const computeLcsTable = (
	left: readonly string[],
	right: readonly string[],
	options: DiffOptions
): readonly (readonly number[])[] => {
	const m = left.length;
	const n = right.length;

	// Create 2D array initialized with zeros
	const table: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

	// Fill the LCS table. The DP recurrence requires mutation of the table,
	// but loop counters are expressed via index ranges instead of `for (let)`.
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

/**
 * Backtrack through LCS table to produce diff.
 */
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
	// Walk backward through the LCS table. The traversal state (i, j) is
	// expressed as a const cursor object updated via Object.assign so neither
	// the binding nor the bound identifier needs `let`.
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
				result.unshift({
					type: 'equal',
					leftIndex: i - 1,
					rightIndex: j - 1,
					value: rightItem,
				});
				Object.assign(cursor, { i: i - 1, j: j - 1 });
			} else if (getTableValue(table, i - 1, j) >= getTableValue(table, i, j - 1)) {
				result.unshift({
					type: 'delete',
					leftIndex: i - 1,
					rightIndex: null,
					value: leftItem,
				});
				cursor.i = i - 1;
			} else {
				result.unshift({
					type: 'insert',
					leftIndex: null,
					rightIndex: j - 1,
					value: rightItem,
				});
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

/**
 * Get character from array safely.
 */
const getChar = (chars: readonly string[], index: number): string => chars[index] ?? '';

/**
 * Normalize character for comparison.
 */
const normalizeChar = (char: string, ignoreCase: boolean): string =>
	ignoreCase ? char.toLowerCase() : char;

/**
 * Build character LCS table.
 */
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

/**
 * Backtrack character LCS to produce segments.
 */
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

/**
 * Merge consecutive segments of same type.
 */
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
 * Compute character-level diff for inline highlighting.
 */
const computeCharDiff = (
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

/**
 * Build diff result from diff items.
 */
const buildDiffResult = (
	items: readonly DiffItem[],
	left: readonly string[],
	_right: readonly string[],
	_options: DiffOptions
): DiffResult => {
	// Fold the diff items into the final result. Counter state (line numbers
	// and aggregate stats) lives in a single const accumulator instead of
	// loose let bindings, keeping the fold purely const-based.
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
			state.rightLines.push({
				lineNumber: null,
				content: '',
				type: 'equal',
			});
			return {
				...state,
				leftLineNum: state.leftLineNum + 1,
				removedLines: state.removedLines + 1,
				removedChars: state.removedChars + item.value.length,
			};
		}
		state.leftLines.push({
			lineNumber: null,
			content: '',
			type: 'equal',
		});
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
			totalLines: Math.max(left.length, _right.length),
			addedLines: final.addedLines,
			removedLines: final.removedLines,
			unchangedLines: final.unchangedLines,
			addedChars: final.addedChars,
			removedChars: final.removedChars,
		},
	};
};

/**
 * Compute diff between two texts.
 */
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

	return buildDiffResult(items, leftLines, rightLines, opts);
};

/**
 * Compute inline (character-level) diff between two lines.
 */
export const computeInlineDiff = (
	leftLine: string,
	rightLine: string,
	options: Partial<DiffOptions> = {}
): readonly DiffSegment[] => {
	const opts: DiffOptions = { ...defaultDiffOptions, ...options };
	return computeCharDiff(leftLine, rightLine, opts);
};

/**
 * Get unified diff format (like git diff).
 */
export interface UnifiedDiffLine {
	readonly prefix: '+' | '-' | ' ';
	readonly content: string;
	readonly type: DiffType;
}

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
			lines.push({
				prefix: '-',
				content: leftLine.content,
				type: 'delete',
			});
		}

		if (rightLine?.type === 'insert') {
			lines.push({
				prefix: '+',
				content: rightLine.content,
				type: 'insert',
			});
		}

		if (leftLine?.type === 'equal' && leftLine.lineNumber !== null) {
			lines.push({
				prefix: ' ',
				content: leftLine.content,
				type: 'equal',
			});
		}

		return lines;
	});
};

/**
 * Check if two texts are identical (considering options).
 */
export const areTextsIdentical = (
	leftText: string,
	rightText: string,
	options: Partial<DiffOptions> = {}
): boolean => {
	const opts: DiffOptions = { ...defaultDiffOptions, ...options };
	const normalizedLeft = normalizeForComparison(leftText, opts);
	const normalizedRight = normalizeForComparison(rightText, opts);
	return normalizedLeft === normalizedRight;
};

/**
 * Enhanced diff line with inline segments for character-level highlighting.
 */
export interface EnhancedDiffLine {
	readonly leftLineNumber: number | null;
	readonly rightLineNumber: number | null;
	readonly leftContent: string;
	readonly rightContent: string;
	readonly type: 'equal' | 'modified' | 'delete' | 'insert';
	readonly leftSegments?: readonly DiffSegment[];
	readonly rightSegments?: readonly DiffSegment[];
}

/**
 * Diff hunk (chunk of changes).
 */
export interface DiffHunk {
	readonly startLeft: number;
	readonly startRight: number;
	readonly countLeft: number;
	readonly countRight: number;
	readonly lines: readonly EnhancedDiffLine[];
}

/**
 * Enhanced diff result with hunks and inline highlighting.
 */
export interface EnhancedDiffResult {
	readonly hunks: readonly DiffHunk[];
	readonly stats: DiffStats & {
		readonly hunkCount: number;
		readonly modifiedLines: number;
	};
}

/**
 * Compute enhanced diff with hunks and inline character-level highlighting.
 */
export const computeEnhancedDiff = (
	leftText: string,
	rightText: string,
	options: Partial<DiffOptions> = {},
	contextLines: number = 3
): EnhancedDiffResult => {
	const opts: DiffOptions = { ...defaultDiffOptions, ...options };
	const result = computeDiff(leftText, rightText, opts);

	// Extract raw changes from computeDiff result
	// leftLines and rightLines have placeholders (null lineNumber) for alignment
	const leftLines = result.leftLines;
	const rightLines = result.rightLines;

	// First, extract the actual changes in order
	interface RawChange {
		type: 'equal' | 'delete' | 'insert';
		leftLineNumber: number | null;
		rightLineNumber: number | null;
		leftContent: string;
		rightContent: string;
	}

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

	// Split rawChanges into segments separated by 'equal' lines.
	// Each equal line becomes its own singleton segment; runs of inserts/deletes
	// between equal lines accumulate into shared segments for later pairing.
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

	// Process each segment
	const enhancedLines: EnhancedDiffLine[] = [];

	finalSegments.forEach((segment) => {
		// If segment is just an equal line, add it directly
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

		// Separate deletes and inserts within this segment
		const deletes = segment.filter((c) => c.type === 'delete');
		const inserts = segment.filter((c) => c.type === 'insert');
		const maxPairs = Math.min(deletes.length, inserts.length);

		// Pair deletes with inserts to create modifications
		const pairedLines = deletes.slice(0, maxPairs).map((del, j) => {
			const ins = inserts[j];
			if (!ins) return null; // Should not happen given maxPairs constraint
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

		// Remaining deletes (no matching inserts)
		const remainingDeletes = deletes.slice(maxPairs).map((del) => ({
			leftLineNumber: del.leftLineNumber,
			rightLineNumber: null,
			leftContent: del.leftContent,
			rightContent: '',
			type: 'delete' as const,
		}));

		// Remaining inserts (no matching deletes)
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

	// Group into hunks with context
	const hunks = groupIntoHunks(enhancedLines, contextLines);

	// Calculate stats
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

/**
 * Group enhanced lines into hunks with context.
 */
const groupIntoHunks = (lines: readonly EnhancedDiffLine[], contextLines: number): DiffHunk[] => {
	if (lines.length === 0) return [];

	// Find all change indices using filter and map
	const changeIndices = lines
		.map((line, idx) => (line.type !== 'equal' ? idx : -1))
		.filter((idx) => idx !== -1);

	if (changeIndices.length === 0) {
		// No changes, return single hunk with all lines
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

	// Group changes that are close together (within 2 * contextLines)
	const firstIdx = changeIndices[0] ?? 0;
	const initialRange = {
		start: Math.max(0, firstIdx - contextLines),
		end: Math.min(lines.length - 1, firstIdx + contextLines),
	};

	const hunkRanges = changeIndices.slice(1).reduce<Array<{ start: number; end: number }>>(
		(ranges, changeIdx) => {
			const lastRange = ranges.at(-1);
			if (!lastRange) return ranges; // Should not happen since initialRange is provided
			const newStart = Math.max(0, changeIdx - contextLines);

			if (newStart <= lastRange.end + 1) {
				// Merge with current range
				lastRange.end = Math.min(lines.length - 1, changeIdx + contextLines);
			} else {
				// Start new range
				ranges.push({
					start: newStart,
					end: Math.min(lines.length - 1, changeIdx + contextLines),
				});
			}
			return ranges;
		},
		[initialRange]
	);

	// Build hunks from ranges
	return hunkRanges.map((range) => {
		const hunkLines = lines.slice(range.start, range.end + 1);
		const firstLine = hunkLines[0];
		const startLeft = firstLine?.leftLineNumber ?? 1;
		const startRight = firstLine?.rightLineNumber ?? 1;

		return {
			startLeft,
			startRight,
			countLeft: hunkLines.filter((l) => l.leftLineNumber !== null).length,
			countRight: hunkLines.filter((l) => l.rightLineNumber !== null).length,
			lines: hunkLines,
		};
	});
};

/**
 * Format hunk header like git diff (e.g., @@ -1,4 +1,5 @@)
 */
export const formatHunkHeader = (hunk: DiffHunk): string =>
	`@@ -${hunk.startLeft},${hunk.countLeft} +${hunk.startRight},${hunk.countRight} @@`;

// CSS class helpers for diff visualization

export type DiffLineType = 'equal' | 'modified' | 'delete' | 'insert';
export type DiffSide = 'left' | 'right';

/**
 * Get CSS class for character-level segment highlighting.
 */
export const getDiffSegmentClass = (type: DiffType, side: DiffSide): string => {
	if (type === 'equal') return '';
	if (side === 'left' && type === 'delete') {
		return 'bg-destructive/40 text-destructive-foreground rounded-sm';
	}
	if (side === 'right' && type === 'insert') {
		return 'bg-success/40 text-success-foreground rounded-sm';
	}
	return '';
};

/**
 * Get background CSS class for left side line in split view.
 */
export const getDiffLeftLineBgClass = (type: DiffLineType): string => {
	switch (type) {
		case 'delete':
			return 'bg-destructive/15';
		case 'modified':
			return 'bg-warning/10';
		case 'insert':
			return 'bg-muted/30';
		default:
			return '';
	}
};

/**
 * Get background CSS class for right side line in split view.
 */
export const getDiffRightLineBgClass = (type: DiffLineType): string => {
	switch (type) {
		case 'insert':
			return 'bg-success/15';
		case 'modified':
			return 'bg-warning/10';
		case 'delete':
			return 'bg-muted/30';
		default:
			return '';
	}
};

/**
 * Get background CSS class for unified view line.
 */
export const getDiffUnifiedLineClass = (type: DiffType): string => {
	switch (type) {
		case 'insert':
			return 'bg-success/15';
		case 'delete':
			return 'bg-destructive/15';
		default:
			return '';
	}
};

/**
 * Get CSS class for unified view line prefix (+/-/space).
 */
export const getDiffPrefixClass = (type: DiffType): string => {
	switch (type) {
		case 'insert':
			return 'text-success font-bold';
		case 'delete':
			return 'text-destructive font-bold';
		default:
			return 'text-muted-foreground';
	}
};

/**
 * Get CSS class for unified view segment highlighting.
 */
export const getDiffUnifiedSegmentClass = (
	segType: DiffType,
	lineType: 'insert' | 'delete'
): string => {
	if (segType === 'equal') return '';
	if (lineType === 'delete' && segType === 'delete') {
		return 'bg-destructive/50 rounded-sm px-0.5';
	}
	if (lineType === 'insert' && segType === 'insert') {
		return 'bg-success/50 rounded-sm px-0.5';
	}
	return '';
};
