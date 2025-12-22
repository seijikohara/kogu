import { describe, expect, it } from 'vitest';
import {
	areTextsIdentical,
	computeDiff,
	computeEnhancedDiff,
	computeInlineDiff,
	formatHunkHeader,
	getUnifiedDiff,
	SAMPLE_LEFT_TEXT,
	SAMPLE_RIGHT_TEXT,
} from './text-diff';

// ============================================================================
// computeDiff - Basic Line Diff
// ============================================================================

describe('computeDiff', () => {
	it('returns empty diff for identical texts', () => {
		const text = 'line1\nline2\nline3';
		const result = computeDiff(text, text);

		expect(result.stats.addedLines).toBe(0);
		expect(result.stats.removedLines).toBe(0);
		expect(result.stats.unchangedLines).toBe(3);
	});

	it('detects single line addition', () => {
		const left = 'line1\nline2';
		const right = 'line1\nline2\nline3';
		const result = computeDiff(left, right);

		expect(result.stats.addedLines).toBe(1);
		expect(result.stats.removedLines).toBe(0);
		expect(result.stats.unchangedLines).toBe(2);
	});

	it('detects single line deletion', () => {
		const left = 'line1\nline2\nline3';
		const right = 'line1\nline2';
		const result = computeDiff(left, right);

		expect(result.stats.addedLines).toBe(0);
		expect(result.stats.removedLines).toBe(1);
		expect(result.stats.unchangedLines).toBe(2);
	});

	it('detects line modification as delete + insert', () => {
		const left = 'line1\noriginal\nline3';
		const right = 'line1\nmodified\nline3';
		const result = computeDiff(left, right);

		expect(result.stats.addedLines).toBe(1);
		expect(result.stats.removedLines).toBe(1);
		expect(result.stats.unchangedLines).toBe(2);
	});

	it('handles empty texts', () => {
		const result = computeDiff('', '');

		expect(result.stats.addedLines).toBe(0);
		expect(result.stats.removedLines).toBe(0);
		expect(result.stats.unchangedLines).toBe(1); // Empty string splits to ['']
	});

	it('handles left empty, right has content', () => {
		const result = computeDiff('', 'line1\nline2');

		expect(result.stats.addedLines).toBe(2);
		expect(result.stats.removedLines).toBe(1); // Empty line removed
	});

	it('handles left has content, right empty', () => {
		const result = computeDiff('line1\nline2', '');

		expect(result.stats.addedLines).toBe(1); // Empty line added
		expect(result.stats.removedLines).toBe(2);
	});

	describe('with options', () => {
		it('ignores whitespace when option is set', () => {
			const left = 'line1\nline2';
			const right = 'line1\nline2  ';
			const result = computeDiff(left, right, { ignoreWhitespace: true });

			expect(result.stats.unchangedLines).toBe(2);
			expect(result.stats.addedLines).toBe(0);
			expect(result.stats.removedLines).toBe(0);
		});

		it('ignores case when option is set', () => {
			const left = 'Line1\nLINE2';
			const right = 'line1\nline2';
			const result = computeDiff(left, right, { ignoreCase: true });

			expect(result.stats.unchangedLines).toBe(2);
			expect(result.stats.addedLines).toBe(0);
			expect(result.stats.removedLines).toBe(0);
		});

		it('trims lines when option is set', () => {
			const left = '  line1\nline2  ';
			const right = 'line1\nline2';
			const result = computeDiff(left, right, { trimLines: true });

			expect(result.stats.unchangedLines).toBe(2);
		});
	});
});

// ============================================================================
// computeInlineDiff - Character-Level Diff
// ============================================================================

describe('computeInlineDiff', () => {
	it('returns empty for identical strings', () => {
		const result = computeInlineDiff('hello', 'hello');

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ type: 'equal', value: 'hello' });
	});

	it('detects character insertion', () => {
		const result = computeInlineDiff('helo', 'hello');

		// Should have segments for 'hel', insert 'l', 'o'
		const insertSegments = result.filter((s) => s.type === 'insert');
		expect(insertSegments.length).toBeGreaterThan(0);
	});

	it('detects character deletion', () => {
		const result = computeInlineDiff('hello', 'helo');

		const deleteSegments = result.filter((s) => s.type === 'delete');
		expect(deleteSegments.length).toBeGreaterThan(0);
	});

	it('detects character replacement', () => {
		const result = computeInlineDiff('cat', 'car');

		// 'ca' equal, 't' deleted, 'r' inserted
		const types = result.map((s) => s.type);
		expect(types).toContain('equal');
		expect(types).toContain('delete');
		expect(types).toContain('insert');
	});

	it('handles empty left string', () => {
		const result = computeInlineDiff('', 'hello');

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ type: 'insert', value: 'hello' });
	});

	it('handles empty right string', () => {
		const result = computeInlineDiff('hello', '');

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ type: 'delete', value: 'hello' });
	});

	it('handles both empty strings', () => {
		const result = computeInlineDiff('', '');

		expect(result).toHaveLength(0);
	});
});

// ============================================================================
// computeEnhancedDiff - Enhanced Diff with Hunks and Inline Highlighting
// ============================================================================

describe('computeEnhancedDiff', () => {
	describe('basic functionality', () => {
		it('returns empty hunks for empty texts', () => {
			const result = computeEnhancedDiff('', '');

			// Empty text results in one "equal" line (empty string)
			expect(result.hunks.length).toBeGreaterThanOrEqual(0);
		});

		it('returns single hunk for identical texts', () => {
			const text = 'line1\nline2\nline3';
			const result = computeEnhancedDiff(text, text);

			expect(result.hunks.length).toBeGreaterThanOrEqual(1);
			// All lines should be type 'equal'
			const allLines = result.hunks.flatMap((h) => h.lines);
			allLines.forEach((line) => {
				expect(line.type).toBe('equal');
			});
		});
	});

	describe('modification detection', () => {
		it('detects single line modification as "modified" type', () => {
			const left = 'line1\noriginal\nline3';
			const right = 'line1\nmodified\nline3';
			const result = computeEnhancedDiff(left, right);

			const allLines = result.hunks.flatMap((h) => h.lines);
			const modifiedLines = allLines.filter((l) => l.type === 'modified');

			expect(modifiedLines.length).toBe(1);
			expect(modifiedLines[0]?.leftContent).toBe('original');
			expect(modifiedLines[0]?.rightContent).toBe('modified');
		});

		it('pairs consecutive deletes with consecutive inserts as modifications', () => {
			const left = 'equal\ndelete1\ndelete2\nequal2';
			const right = 'equal\ninsert1\ninsert2\nequal2';
			const result = computeEnhancedDiff(left, right);

			const allLines = result.hunks.flatMap((h) => h.lines);
			const modifiedLines = allLines.filter((l) => l.type === 'modified');

			expect(modifiedLines.length).toBe(2);
			expect(modifiedLines[0]?.leftContent).toBe('delete1');
			expect(modifiedLines[0]?.rightContent).toBe('insert1');
			expect(modifiedLines[1]?.leftContent).toBe('delete2');
			expect(modifiedLines[1]?.rightContent).toBe('insert2');
		});

		it('handles more deletes than inserts', () => {
			const left = 'equal\ndelete1\ndelete2\ndelete3\nequal2';
			const right = 'equal\ninsert1\nequal2';
			const result = computeEnhancedDiff(left, right);

			const allLines = result.hunks.flatMap((h) => h.lines);
			const modifiedLines = allLines.filter((l) => l.type === 'modified');
			const deleteLines = allLines.filter((l) => l.type === 'delete');

			expect(modifiedLines.length).toBe(1);
			expect(deleteLines.length).toBe(2);
		});

		it('handles more inserts than deletes', () => {
			const left = 'equal\ndelete1\nequal2';
			const right = 'equal\ninsert1\ninsert2\ninsert3\nequal2';
			const result = computeEnhancedDiff(left, right);

			const allLines = result.hunks.flatMap((h) => h.lines);
			const modifiedLines = allLines.filter((l) => l.type === 'modified');
			const insertLines = allLines.filter((l) => l.type === 'insert');

			expect(modifiedLines.length).toBe(1);
			expect(insertLines.length).toBe(2);
		});
	});

	describe('pure insertions and deletions', () => {
		it('detects pure insertions (no preceding deletes)', () => {
			const left = 'line1\nline2';
			const right = 'line1\nnew\nline2';
			const result = computeEnhancedDiff(left, right);

			const allLines = result.hunks.flatMap((h) => h.lines);
			const insertLines = allLines.filter((l) => l.type === 'insert');

			expect(insertLines.length).toBe(1);
			expect(insertLines[0]?.rightContent).toBe('new');
			expect(insertLines[0]?.leftLineNumber).toBeNull();
		});

		it('detects pure deletions (no following inserts)', () => {
			const left = 'line1\nold\nline2';
			const right = 'line1\nline2';
			const result = computeEnhancedDiff(left, right);

			const allLines = result.hunks.flatMap((h) => h.lines);
			const deleteLines = allLines.filter((l) => l.type === 'delete');

			expect(deleteLines.length).toBe(1);
			expect(deleteLines[0]?.leftContent).toBe('old');
			expect(deleteLines[0]?.rightLineNumber).toBeNull();
		});
	});

	describe('inline character diff', () => {
		it('includes character-level segments for modified lines', () => {
			const left = 'function test()';
			const right = 'function test(arg)';
			const result = computeEnhancedDiff(left, right);

			const allLines = result.hunks.flatMap((h) => h.lines);
			const modifiedLines = allLines.filter((l) => l.type === 'modified');

			expect(modifiedLines.length).toBe(1);
			expect(modifiedLines[0]?.leftSegments).toBeDefined();
			expect(modifiedLines[0]?.rightSegments).toBeDefined();

			// Right segments should contain the inserted 'arg'
			const rightInserts = modifiedLines[0]?.rightSegments?.filter((s) => s.type === 'insert');
			expect(rightInserts?.some((s) => s.value.includes('arg'))).toBe(true);
		});
	});

	describe('hunk grouping', () => {
		it('groups nearby changes into single hunk', () => {
			const left = 'line1\nold1\nline3\nline4\nold2\nline6';
			const right = 'line1\nnew1\nline3\nline4\nnew2\nline6';
			const result = computeEnhancedDiff(left, right, {}, 3);

			// With context of 3, changes separated by 2 equal lines should be in same hunk
			expect(result.hunks.length).toBe(1);
		});

		it('separates distant changes into different hunks', () => {
			const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
			const left = lines.join('\n');
			const right = [...lines];
			right[0] = 'modified1';
			right[19] = 'modified20';

			const result = computeEnhancedDiff(left, right.join('\n'), {}, 2);

			// With context of 2 and 18 lines between changes, should be 2 hunks
			expect(result.hunks.length).toBe(2);
		});
	});

	describe('stats calculation', () => {
		it('correctly counts modified lines in stats', () => {
			const left = 'line1\noriginal\nline3';
			const right = 'line1\nmodified\nline3';
			const result = computeEnhancedDiff(left, right);

			expect(result.stats.modifiedLines).toBe(1);
		});

		it('correctly counts hunk count', () => {
			const left = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj';
			const right = 'A\nb\nc\nd\ne\nf\ng\nh\ni\nJ';
			const result = computeEnhancedDiff(left, right, {}, 2);

			expect(result.stats.hunkCount).toBe(result.hunks.length);
		});
	});

	describe('sample texts', () => {
		it('correctly processes sample left and right texts', () => {
			const result = computeEnhancedDiff(SAMPLE_LEFT_TEXT, SAMPLE_RIGHT_TEXT);

			expect(result.hunks.length).toBeGreaterThan(0);
			expect(result.stats.addedLines + result.stats.removedLines).toBeGreaterThan(0);
		});
	});
});

// ============================================================================
// getUnifiedDiff - Unified Diff Format
// ============================================================================

describe('getUnifiedDiff', () => {
	it('returns empty array for identical texts', () => {
		const text = 'line1\nline2';
		const result = getUnifiedDiff(text, text);

		// All lines should have ' ' prefix (equal)
		result.forEach((line) => {
			expect(line.prefix).toBe(' ');
			expect(line.type).toBe('equal');
		});
	});

	it('marks added lines with + prefix', () => {
		const left = 'line1';
		const right = 'line1\nline2';
		const result = getUnifiedDiff(left, right);

		const addedLines = result.filter((l) => l.prefix === '+');
		expect(addedLines.length).toBe(1);
		expect(addedLines[0]?.content).toBe('line2');
	});

	it('marks removed lines with - prefix', () => {
		const left = 'line1\nline2';
		const right = 'line1';
		const result = getUnifiedDiff(left, right);

		const removedLines = result.filter((l) => l.prefix === '-');
		expect(removedLines.length).toBe(1);
		expect(removedLines[0]?.content).toBe('line2');
	});

	it('contains both removes and inserts for modifications', () => {
		const left = 'original';
		const right = 'modified';
		const result = getUnifiedDiff(left, right);

		const removeLines = result.filter((l) => l.prefix === '-');
		const insertLines = result.filter((l) => l.prefix === '+');

		expect(removeLines.length).toBe(1);
		expect(insertLines.length).toBe(1);
		expect(removeLines[0]?.content).toBe('original');
		expect(insertLines[0]?.content).toBe('modified');
	});
});

// ============================================================================
// areTextsIdentical - Identity Check
// ============================================================================

describe('areTextsIdentical', () => {
	it('returns true for identical texts', () => {
		expect(areTextsIdentical('hello', 'hello')).toBe(true);
	});

	it('returns false for different texts', () => {
		expect(areTextsIdentical('hello', 'world')).toBe(false);
	});

	it('respects ignoreCase option', () => {
		expect(areTextsIdentical('Hello', 'hello', { ignoreCase: true })).toBe(true);
		expect(areTextsIdentical('Hello', 'hello', { ignoreCase: false })).toBe(false);
	});

	it('respects ignoreWhitespace option', () => {
		expect(areTextsIdentical('hello world', 'hello  world', { ignoreWhitespace: true })).toBe(true);
		expect(areTextsIdentical('hello world', 'hello  world', { ignoreWhitespace: false })).toBe(
			false
		);
	});
});

// ============================================================================
// formatHunkHeader - Hunk Header Formatting
// ============================================================================

describe('formatHunkHeader', () => {
	it('formats hunk header in git style', () => {
		const hunk = {
			startLeft: 1,
			startRight: 1,
			countLeft: 4,
			countRight: 5,
			lines: [],
		};

		expect(formatHunkHeader(hunk)).toBe('@@ -1,4 +1,5 @@');
	});

	it('handles single line hunks', () => {
		const hunk = {
			startLeft: 10,
			startRight: 12,
			countLeft: 1,
			countRight: 1,
			lines: [],
		};

		expect(formatHunkHeader(hunk)).toBe('@@ -10,1 +12,1 @@');
	});
});
