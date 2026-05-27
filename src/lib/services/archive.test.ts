import { describe, expect, it } from 'vitest';

import {
	ancestorPaths,
	type ArchiveEntry,
	entryDepth,
	entryDisplayName,
	formatHexPreview,
	formatRatio,
	matchGlob,
	previewKindFor,
	topLargestEntries,
} from './archive';

const entry = (overrides: Partial<ArchiveEntry> = {}): ArchiveEntry => ({
	path: 'file.txt',
	isDir: false,
	sizeBytes: 100,
	compressedSize: 60,
	modifiedMs: null,
	crc32: null,
	...overrides,
});

describe('formatRatio', () => {
	it('returns em dash for zero uncompressed size', () => {
		expect(formatRatio(0, 0)).toBe('—');
	});

	it('renders a positive saving as integer percent', () => {
		expect(formatRatio(100, 60)).toBe('40%');
	});

	it('clamps negative ratios to 0%', () => {
		expect(formatRatio(100, 110)).toBe('0%');
	});
});

describe('matchGlob', () => {
	it('passes everything when the pattern is blank', () => {
		expect(matchGlob('src/index.ts', '')).toBe(true);
	});

	it('respects a single star wildcard within a segment', () => {
		expect(matchGlob('foo.png', '*.png')).toBe(true);
		expect(matchGlob('foo/bar.png', '*.png')).toBe(false);
	});

	it('matches across slashes when ** is used', () => {
		expect(matchGlob('src/lib/a.ts', 'src/**/*.ts')).toBe(true);
		expect(matchGlob('src/a.ts', 'src/**/*.ts')).toBe(true);
	});

	it('uses ? for exactly one character', () => {
		expect(matchGlob('a.txt', '?.txt')).toBe(true);
		expect(matchGlob('ab.txt', '?.txt')).toBe(false);
	});

	it('escapes regex metacharacters', () => {
		expect(matchGlob('a+b.txt', 'a+b.txt')).toBe(true);
	});
});

describe('previewKindFor', () => {
	it('reports directories as unsupported', () => {
		expect(previewKindFor(entry({ isDir: true, path: 'dir/' }))).toBe('unsupported');
	});

	it('reports oversize files as too-large', () => {
		expect(previewKindFor(entry({ sizeBytes: 60 * 1024 * 1024 }))).toBe('too-large');
	});

	it('identifies image extensions', () => {
		expect(previewKindFor(entry({ path: 'a/b/c.PNG' }))).toBe('image');
	});

	it('identifies text extensions', () => {
		expect(previewKindFor(entry({ path: 'src/index.ts' }))).toBe('text');
	});

	it('falls back to hex for unknown extensions', () => {
		expect(previewKindFor(entry({ path: 'data.bin' }))).toBe('hex');
	});
});

describe('formatHexPreview', () => {
	it('formats bytes as uppercase hex pairs with ascii gutter', () => {
		const bytes = new Uint8Array([0x48, 0x69, 0x21]);
		const rows = formatHexPreview(bytes, 4);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.hex).toBe('48 69 21');
		expect(rows[0]?.ascii).toBe('Hi!');
		expect(rows[0]?.offset).toBe('000000');
	});

	it('caps the number of rows', () => {
		const bytes = new Uint8Array(64);
		const rows = formatHexPreview(bytes, 2);
		expect(rows).toHaveLength(2);
	});
});

describe('ancestorPaths', () => {
	it('returns nothing for top-level files', () => {
		expect(ancestorPaths('readme.md')).toEqual([]);
	});

	it('returns each ancestor chain element', () => {
		expect(ancestorPaths('src/lib/a.ts')).toEqual(['src', 'src/lib']);
	});

	it('trims trailing slashes for directories', () => {
		expect(ancestorPaths('src/lib/')).toEqual(['src']);
	});
});

describe('entryDepth', () => {
	it('returns 0 for top-level entries', () => {
		expect(entryDepth('foo.txt')).toBe(0);
	});

	it('counts directory segments', () => {
		expect(entryDepth('a/b/c.txt')).toBe(2);
	});
});

describe('entryDisplayName', () => {
	it('returns the trailing path component', () => {
		expect(entryDisplayName('src/lib/a.ts')).toBe('a.ts');
	});

	it('strips a trailing slash from directory names', () => {
		expect(entryDisplayName('src/lib/')).toBe('lib');
	});
});

describe('topLargestEntries', () => {
	it('skips directories and returns entries sorted by size', () => {
		const entries: ArchiveEntry[] = [
			entry({ path: 'a', sizeBytes: 1 }),
			entry({ path: 'b/', isDir: true, sizeBytes: 9999 }),
			entry({ path: 'c', sizeBytes: 100 }),
			entry({ path: 'd', sizeBytes: 10 }),
		];
		const result = topLargestEntries(entries, 2);
		expect(result.map((e) => e.path)).toEqual(['c', 'd']);
	});
});
