/**
 * Shared types for the text-diff family of utilities.
 *
 * Public types (DiffType / DiffSegment / DiffLine / DiffResult / DiffStats /
 * DiffOptions / UnifiedDiffLine / EnhancedDiffLine / DiffHunk /
 * EnhancedDiffResult / DiffLineType / DiffSide) are re-exported from the
 * package barrel (./index.ts) so callers only import from
 * `@/lib/services/text-diff`.
 */

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

export interface DiffStats {
	readonly totalLines: number;
	readonly addedLines: number;
	readonly removedLines: number;
	readonly unchangedLines: number;
	readonly addedChars: number;
	readonly removedChars: number;
}

export interface DiffResult {
	readonly leftLines: readonly DiffLine[];
	readonly rightLines: readonly DiffLine[];
	readonly stats: DiffStats;
}

export interface DiffOptions {
	readonly ignoreWhitespace: boolean;
	readonly ignoreCase: boolean;
	readonly trimLines: boolean;
}

export interface UnifiedDiffLine {
	readonly prefix: '+' | '-' | ' ';
	readonly content: string;
	readonly type: DiffType;
}

export interface EnhancedDiffLine {
	readonly leftLineNumber: number | null;
	readonly rightLineNumber: number | null;
	readonly leftContent: string;
	readonly rightContent: string;
	readonly type: 'equal' | 'modified' | 'delete' | 'insert';
	readonly leftSegments?: readonly DiffSegment[];
	readonly rightSegments?: readonly DiffSegment[];
}

export interface DiffHunk {
	readonly startLeft: number;
	readonly startRight: number;
	readonly countLeft: number;
	readonly countRight: number;
	readonly lines: readonly EnhancedDiffLine[];
}

export interface EnhancedDiffResult {
	readonly hunks: readonly DiffHunk[];
	readonly stats: DiffStats & {
		readonly hunkCount: number;
		readonly modifiedLines: number;
	};
}

export type DiffLineType = 'equal' | 'modified' | 'delete' | 'insert';
export type DiffSide = 'left' | 'right';
