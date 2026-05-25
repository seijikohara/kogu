/**
 * Pure set-comparison primitives for two newline-separated lists.
 *
 * The service splits raw text into lines, normalises each line according to
 * the supplied options (trimming, case folding, empty handling), and then
 * runs set operations on the normalised forms while remembering the original
 * casing of the first occurrence for display.
 *
 * Display strings preserve the original casing / whitespace of the first
 * occurrence so users always see what they typed; comparisons stay
 * predictable because they happen on the normalised form.
 */

export type SortMode = 'original' | 'asc' | 'desc';

export type OperationKind =
	| 'intersection'
	| 'union'
	| 'difference-a'
	| 'difference-b'
	| 'symmetric';

export type Region = 'a-only' | 'b-only' | 'common';

export interface CompareOptions {
	readonly caseSensitive: boolean;
	readonly trimWhitespace: boolean;
	readonly ignoreEmpty: boolean;
	readonly sortMode: SortMode;
}

export const DEFAULT_OPTIONS: CompareOptions = {
	caseSensitive: false,
	trimWhitespace: true,
	ignoreEmpty: true,
	sortMode: 'original',
};

export interface NormalisedList {
	readonly originalLines: readonly string[];
	readonly normalisedSet: ReadonlySet<string>;
	readonly normalisedToOriginal: ReadonlyMap<string, string>;
}

export interface CompareResult {
	readonly options: CompareOptions;
	readonly a: NormalisedList;
	readonly b: NormalisedList;
	readonly intersection: readonly string[];
	readonly union: readonly string[];
	readonly differenceA: readonly string[];
	readonly differenceB: readonly string[];
	readonly symmetric: readonly string[];
}

const splitLines = (raw: string): readonly string[] => raw.split(/\r?\n/);

const normaliseLine = (line: string, options: CompareOptions): string => {
	const trimmed = options.trimWhitespace ? line.trim() : line;
	return options.caseSensitive ? trimmed : trimmed.toLowerCase();
};

const isKept = (normalised: string, options: CompareOptions): boolean =>
	!options.ignoreEmpty || normalised.length > 0;

/**
 * Normalise a raw newline-separated string into a list paired with a Set of
 * normalised values and a map back to the first-seen original line.
 */
export const normaliseList = (raw: string, options: CompareOptions): NormalisedList => {
	const originalLines = splitLines(raw);
	const normalisedSet = new Set<string>();
	const normalisedToOriginal = new Map<string, string>();
	originalLines.forEach((line) => {
		const normalised = normaliseLine(line, options);
		if (!isKept(normalised, options)) return;
		if (!normalisedToOriginal.has(normalised)) {
			normalisedToOriginal.set(normalised, line);
		}
		normalisedSet.add(normalised);
	});
	return { originalLines, normalisedSet, normalisedToOriginal };
};

/**
 * Count the number of lines in `raw` that would survive the current
 * normalisation pipeline. Duplicates are counted only once because the UI
 * surfaces the set-shaped count alongside each list.
 */
export const lineCount = (raw: string, options: CompareOptions): number =>
	normaliseList(raw, options).normalisedSet.size;

const localeCompare = (left: string, right: string): number =>
	left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });

const insertionOrder = (
	keys: ReadonlySet<string>,
	a: NormalisedList,
	b: NormalisedList
): readonly string[] => {
	const seen = new Set<string>();
	const order: string[] = [];
	const collect = (source: NormalisedList) => {
		source.normalisedToOriginal.forEach((_, key) => {
			if (keys.has(key) && !seen.has(key)) {
				seen.add(key);
				order.push(key);
			}
		});
	};
	collect(a);
	collect(b);
	return order;
};

const sortKeys = (
	keys: readonly string[],
	a: NormalisedList,
	b: NormalisedList,
	options: CompareOptions
): readonly string[] => {
	if (options.sortMode === 'original') return insertionOrder(new Set(keys), a, b);
	const display = (key: string): string =>
		a.normalisedToOriginal.get(key) ?? b.normalisedToOriginal.get(key) ?? key;
	const direction = options.sortMode === 'asc' ? 1 : -1;
	return [...keys].sort((left, right) => direction * localeCompare(display(left), display(right)));
};

const toDisplay = (
	keys: readonly string[],
	a: NormalisedList,
	b: NormalisedList
): readonly string[] =>
	keys.map((key) => a.normalisedToOriginal.get(key) ?? b.normalisedToOriginal.get(key) ?? key);

/**
 * Run all five set operations on `a` and `b` in one pass and return the
 * results pre-sorted according to `options.sortMode` with display strings
 * resolved to first-seen originals.
 */
export const compare = (a: string, b: string, options: CompareOptions): CompareResult => {
	const left = normaliseList(a, options);
	const right = normaliseList(b, options);

	const intersectionKeys = [...left.normalisedSet].filter((key) => right.normalisedSet.has(key));
	const differenceAKeys = [...left.normalisedSet].filter((key) => !right.normalisedSet.has(key));
	const differenceBKeys = [...right.normalisedSet].filter((key) => !left.normalisedSet.has(key));
	const symmetricKeys = [...differenceAKeys, ...differenceBKeys];
	const unionKeys = [...new Set([...left.normalisedSet, ...right.normalisedSet])];

	const sorted = {
		intersection: sortKeys(intersectionKeys, left, right, options),
		union: sortKeys(unionKeys, left, right, options),
		differenceA: sortKeys(differenceAKeys, left, right, options),
		differenceB: sortKeys(differenceBKeys, left, right, options),
		symmetric: sortKeys(symmetricKeys, left, right, options),
	};

	return {
		options,
		a: left,
		b: right,
		intersection: toDisplay(sorted.intersection, left, right),
		union: toDisplay(sorted.union, left, right),
		differenceA: toDisplay(sorted.differenceA, left, right),
		differenceB: toDisplay(sorted.differenceB, left, right),
		symmetric: toDisplay(sorted.symmetric, left, right),
	};
};

/**
 * Region resolution for tinting result rows and Venn diagram regions.
 * Resolves the supplied display line back through normalisation before
 * looking it up so callers can pass either the original or the normalised
 * form.
 */
export const regionFor = (line: string, result: CompareResult): Region => {
	const normalised = normaliseLine(line, result.options);
	const inA = result.a.normalisedSet.has(normalised);
	const inB = result.b.normalisedSet.has(normalised);
	if (inA && inB) return 'common';
	if (inB) return 'b-only';
	return 'a-only';
};

/**
 * Pick the result array for an operation.
 */
export const resultFor = (kind: OperationKind, result: CompareResult): readonly string[] => {
	if (kind === 'intersection') return result.intersection;
	if (kind === 'union') return result.union;
	if (kind === 'difference-a') return result.differenceA;
	if (kind === 'difference-b') return result.differenceB;
	return result.symmetric;
};

/**
 * Two overlapping word lists for the rail's "Load sample" action.
 */
export const SAMPLE_LIST_A = `apple
banana
cherry
date
fig
grape`;

export const SAMPLE_LIST_B = `banana
cherry
grape
kiwi
date
mango`;
