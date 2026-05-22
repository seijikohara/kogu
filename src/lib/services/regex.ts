/**
 * Regular expression service.
 * Provides safe compilation, structured match results, replacement,
 * and an explanation helper that surfaces flags, group counts, and
 * the metacharacter classes present in the pattern.
 */

import { getErrorMessage } from '@/lib/utils';

export type Result<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: string };

export interface RegexFlags {
	readonly global: boolean;
	readonly ignoreCase: boolean;
	readonly multiline: boolean;
	readonly dotAll: boolean;
	readonly unicode: boolean;
	readonly sticky: boolean;
}

export const DEFAULT_FLAGS: RegexFlags = {
	global: true,
	ignoreCase: false,
	multiline: false,
	dotAll: false,
	unicode: false,
	sticky: false,
};

export interface RegexFlagInfo {
	readonly id: keyof RegexFlags;
	readonly char: string;
	readonly label: string;
	readonly description: string;
}

export const FLAG_INFO: readonly RegexFlagInfo[] = [
	{ id: 'global', char: 'g', label: 'Global', description: 'Find all matches, not just the first' },
	{ id: 'ignoreCase', char: 'i', label: 'Ignore case', description: 'Case-insensitive matching' },
	{ id: 'multiline', char: 'm', label: 'Multiline', description: '^ and $ match line boundaries' },
	{ id: 'dotAll', char: 's', label: 'Dot-all', description: '. matches newline characters' },
	{
		id: 'unicode',
		char: 'u',
		label: 'Unicode',
		description: 'Treat pattern as Unicode code points',
	},
	{ id: 'sticky', char: 'y', label: 'Sticky', description: 'Match only at lastIndex' },
];

export const flagsToString = (flags: RegexFlags): string =>
	FLAG_INFO.filter((info) => flags[info.id])
		.map((info) => info.char)
		.join('');

// Always request capture-group indices via the `d` flag so the page can
// color each captured slice inside the test text. Sticky and global
// together would conflict with `matchAll`, so the caller controls those
// — we only inject `d` if it isn't already in the user's flag string.
const withIndicesFlag = (flagString: string): string =>
	flagString.includes('d') ? flagString : `${flagString}d`;

export const compileRegex = (pattern: string, flags: RegexFlags): Result<RegExp> => {
	if (pattern.length === 0) return { ok: false, error: 'Empty pattern' };
	try {
		const flagString = withIndicesFlag(flagsToString(flags));
		return { ok: true, value: new RegExp(pattern, flagString) };
	} catch (e) {
		return { ok: false, error: getErrorMessage(e) };
	}
};

export interface GroupSlice {
	readonly value: string;
	readonly start: number;
	readonly end: number;
}

export interface RegexMatch {
	readonly index: number;
	readonly endIndex: number;
	readonly fullMatch: string;
	readonly groups: readonly GroupSlice[];
	readonly namedGroups: Readonly<Record<string, GroupSlice>>;
}

type IndicesArray = ReadonlyArray<readonly [number, number] | undefined>;
type IndicesGroups = Readonly<Record<string, readonly [number, number] | undefined>>;

const readIndices = (m: RegExpMatchArray | RegExpExecArray): IndicesArray => {
	const raw = (m as unknown as { indices?: IndicesArray }).indices;
	return raw ?? [];
};

const readIndicesGroups = (indices: IndicesArray): IndicesGroups => {
	const raw = (indices as unknown as { groups?: IndicesGroups }).groups;
	return raw ?? {};
};

const toMatch = (m: RegExpMatchArray | RegExpExecArray): RegexMatch => {
	const indices = readIndices(m);
	const matchStart = m.index ?? 0;
	const matchEnd = matchStart + (m[0]?.length ?? 0);
	const groups = m.slice(1).map<GroupSlice>((value, idx) => {
		const range = indices[idx + 1];
		if (range && value !== undefined) {
			return { value: value ?? '', start: range[0], end: range[1] };
		}
		return { value: value ?? '', start: -1, end: -1 };
	});
	const namedRanges = readIndicesGroups(indices);
	const namedEntries = Object.entries(m.groups ?? {}).map<[string, GroupSlice]>(([name, value]) => {
		const range = namedRanges[name];
		if (range && value !== undefined) {
			return [name, { value: value ?? '', start: range[0], end: range[1] }];
		}
		return [name, { value: value ?? '', start: -1, end: -1 }];
	});
	return {
		index: matchStart,
		endIndex: matchEnd,
		fullMatch: m[0] ?? '',
		groups,
		namedGroups: Object.fromEntries(namedEntries),
	};
};

export const findMatches = (
	pattern: string,
	flags: RegexFlags,
	text: string
): Result<readonly RegexMatch[]> => {
	const compiled = compileRegex(pattern, flags);
	if (!compiled.ok) return compiled;
	const regex = compiled.value;
	if (!regex.global) {
		const result = text.match(regex);
		return { ok: true, value: result ? [toMatch(result)] : [] };
	}
	return { ok: true, value: Array.from(text.matchAll(regex), toMatch) };
};

export const replaceText = (
	pattern: string,
	flags: RegexFlags,
	text: string,
	replacement: string
): Result<string> => {
	const compiled = compileRegex(pattern, flags);
	if (!compiled.ok) return compiled;
	try {
		return { ok: true, value: text.replace(compiled.value, replacement) };
	} catch (e) {
		return { ok: false, error: getErrorMessage(e) };
	}
};

export interface FeatureUsage {
	readonly token: string;
	readonly description: string;
}

const FEATURE_PROBES: readonly FeatureUsage[] = [
	{ token: '^', description: 'Anchors to the start of the string (or line with the m flag).' },
	{ token: '$', description: 'Anchors to the end of the string (or line with the m flag).' },
	{ token: '.', description: 'Matches any character except newline (or any with the s flag).' },
	{ token: '\\d', description: 'Matches a digit (0-9).' },
	{ token: '\\D', description: 'Matches a non-digit.' },
	{ token: '\\w', description: 'Matches a word character (letters, digits, underscore).' },
	{ token: '\\W', description: 'Matches a non-word character.' },
	{ token: '\\s', description: 'Matches whitespace.' },
	{ token: '\\S', description: 'Matches non-whitespace.' },
	{ token: '\\b', description: 'Asserts a word boundary.' },
	{ token: '\\B', description: 'Asserts a non-word boundary.' },
	{ token: '|', description: 'Alternation: matches either side.' },
	{ token: '[', description: 'Character class: matches any of the listed characters.' },
	{ token: '*', description: 'Quantifier: 0 or more (greedy).' },
	{ token: '+', description: 'Quantifier: 1 or more (greedy).' },
	{ token: '?', description: 'Quantifier: 0 or 1 (greedy) or makes a quantifier lazy.' },
	{ token: '{', description: 'Quantifier: explicit min/max repetition.' },
	{ token: '(?:', description: 'Non-capturing group.' },
	{ token: '(?<', description: 'Named capture group.' },
	{ token: '(?=', description: 'Positive lookahead.' },
	{ token: '(?!', description: 'Negative lookahead.' },
	{ token: '(?<=', description: 'Positive lookbehind.' },
	{ token: '(?<!', description: 'Negative lookbehind.' },
];

export const findFeatures = (pattern: string): readonly FeatureUsage[] =>
	FEATURE_PROBES.filter((probe) => pattern.includes(probe.token));

export const countCaptureGroups = (pattern: string): number => {
	// Strip escaped parentheses, then count `(` that aren't followed by `?:`/`?=`/`?!`/`?<=`/`?<!`.
	const stripped = pattern.replace(/\\./g, '');
	const matches = stripped.matchAll(/\((?!\?[:=!]|\?<[=!])/g);
	return Array.from(matches).length;
};

export const SAMPLE_PATTERN =
	'(?<protocol>https?)://(?<host>[\\w.-]+)(?::(?<port>\\d+))?(?<path>/[^?#\\s]*)?';

export const SAMPLE_TEST_TEXT = `Visit https://example.com and http://example.org:8080/path?query=1.
Also see https://kogu.io/docs and http://test.local:3000/.`;

export const SAMPLE_REPLACEMENT = '[$<host>]';
