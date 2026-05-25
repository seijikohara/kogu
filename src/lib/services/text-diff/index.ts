/**
 * Text diff utilities using Longest Common Subsequence (LCS) algorithm.
 *
 * This package re-exports the public surface so callers continue to
 * import from `@/lib/services/text-diff` regardless of where each
 * function physically lives (line-diff / char-diff / enhanced-diff /
 * styles).
 */

export type {
	DiffHunk,
	DiffLine,
	DiffLineType,
	DiffOptions,
	DiffResult,
	DiffSegment,
	DiffSide,
	DiffStats,
	DiffType,
	EnhancedDiffLine,
	EnhancedDiffResult,
	UnifiedDiffLine,
} from './types';

export { defaultDiffOptions } from './options';
export { SAMPLE_LEFT_TEXT, SAMPLE_RIGHT_TEXT } from './samples';

export { computeDiff, getUnifiedDiff, areTextsIdentical } from './line-diff';
export { computeInlineDiff } from './char-diff';
export { computeEnhancedDiff, formatHunkHeader } from './enhanced-diff';

export {
	getDiffSegmentClass,
	getDiffLeftLineBgClass,
	getDiffRightLineBgClass,
	getDiffUnifiedLineClass,
	getDiffPrefixClass,
	getDiffUnifiedSegmentClass,
} from './styles';
