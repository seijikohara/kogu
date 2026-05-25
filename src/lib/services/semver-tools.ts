/**
 * Semantic versioning utilities — pure wrappers around the `semver` package
 * with explicit result types so the UI layer can render parse / compare /
 * range / bump views without ever throwing.
 */
import semver from 'semver';

const PRE_IDENTIFIERS: readonly string[] = [
	'major',
	'premajor',
	'minor',
	'preminor',
	'patch',
	'prepatch',
	'prerelease',
];

export interface ParsedVersion {
	readonly raw: string;
	readonly major: number;
	readonly minor: number;
	readonly patch: number;
	readonly prerelease: readonly (string | number)[];
	readonly build: readonly string[];
	readonly version: string; // major.minor.patch
	readonly fullVersion: string; // canonical with prerelease+build
}

export interface ParseError {
	readonly ok: false;
	readonly error: string;
}

export type ParseResult = { readonly ok: true; readonly parsed: ParsedVersion } | ParseError;

export type DiffKind =
	| 'major'
	| 'minor'
	| 'patch'
	| 'premajor'
	| 'preminor'
	| 'prepatch'
	| 'prerelease'
	| null;

export type CompareSign = '<' | '=' | '>';

export interface CompareResult {
	readonly ok: true;
	readonly a: ParsedVersion;
	readonly b: ParsedVersion;
	readonly sign: CompareSign;
	readonly bump: DiffKind; // null when equal
	readonly metadataOnly: boolean; // same version+prerelease but build differs
}

export interface BumpResult {
	readonly ok: true;
	readonly major: string;
	readonly minor: string;
	readonly patch: string;
	readonly premajor: string;
	readonly preminor: string;
	readonly prepatch: string;
	readonly prerelease: string;
}

export interface RangeResult {
	readonly ok: true;
	readonly satisfies: boolean;
	readonly range: string; // normalized
	readonly version: string;
	readonly matchedRange?: string; // which subrange satisfied
	readonly minVersion?: string; // minVersion of the range
	readonly explanation: string; // human readable
}

export type ReleaseStep =
	| {
			readonly ok: true;
			readonly from: string;
			readonly to: string;
			readonly bump: DiffKind;
			readonly direction: 'forward' | 'same' | 'backward';
	  }
	| {
			readonly ok: false;
			readonly from: string;
			readonly to: string;
			readonly error: string;
	  };

const buildFromRaw = (raw: string): readonly string[] => {
	const plus = raw.indexOf('+');
	if (plus === -1) return [];
	return raw
		.slice(plus + 1)
		.split('.')
		.filter((segment) => segment.length > 0);
};

const toParsed = (sv: semver.SemVer): ParsedVersion => ({
	raw: sv.raw,
	major: sv.major,
	minor: sv.minor,
	patch: sv.patch,
	prerelease: [...sv.prerelease],
	// semver's `SemVer.build` only carries metadata when explicitly retained.
	// Reading `raw` keeps us aligned with what the user typed.
	build: buildFromRaw(sv.raw),
	version: `${sv.major}.${sv.minor}.${sv.patch}`,
	fullVersion: sv.version,
});

export const parseVersion = (input: string): ParseResult => {
	const trimmed = input.trim();
	if (trimmed.length === 0) return { ok: false, error: 'Empty input.' };
	const parsed = semver.parse(trimmed);
	if (!parsed) return { ok: false, error: 'Not a valid semantic version.' };
	return { ok: true, parsed: toParsed(parsed) };
};

const isDiffKind = (value: semver.ReleaseType | null): value is Exclude<DiffKind, null> => {
	if (value === null) return false;
	return PRE_IDENTIFIERS.includes(value);
};

export const compareVersions = (a: string, b: string): CompareResult | ParseError => {
	const parsedA = parseVersion(a);
	if (!parsedA.ok) return { ok: false, error: `A: ${parsedA.error}` };
	const parsedB = parseVersion(b);
	if (!parsedB.ok) return { ok: false, error: `B: ${parsedB.error}` };

	const cmp = semver.compare(parsedA.parsed.fullVersion, parsedB.parsed.fullVersion);
	const sign: CompareSign = cmp < 0 ? '<' : cmp > 0 ? '>' : '=';

	const rawDiff = semver.diff(parsedA.parsed.fullVersion, parsedB.parsed.fullVersion);
	const bump: DiffKind = isDiffKind(rawDiff) ? rawDiff : null;

	const sameCore =
		parsedA.parsed.version === parsedB.parsed.version &&
		parsedA.parsed.prerelease.join('.') === parsedB.parsed.prerelease.join('.');
	const buildA = parsedA.parsed.build.join('.');
	const buildB = parsedB.parsed.build.join('.');
	const metadataOnly = sameCore && buildA !== buildB;

	return {
		ok: true,
		a: parsedA.parsed,
		b: parsedB.parsed,
		sign,
		bump,
		metadataOnly,
	};
};

const fallback = (next: string | null, current: string): string => next ?? current;

export const calculateBumps = (version: string, identifier = 'rc'): BumpResult | ParseError => {
	const parsed = parseVersion(version);
	if (!parsed.ok) return parsed;
	const full = parsed.parsed.fullVersion;
	const id = identifier.trim().length > 0 ? identifier.trim() : 'rc';
	return {
		ok: true,
		major: fallback(semver.inc(full, 'major'), full),
		minor: fallback(semver.inc(full, 'minor'), full),
		patch: fallback(semver.inc(full, 'patch'), full),
		premajor: fallback(semver.inc(full, 'premajor', id), full),
		preminor: fallback(semver.inc(full, 'preminor', id), full),
		prepatch: fallback(semver.inc(full, 'prepatch', id), full),
		prerelease: fallback(semver.inc(full, 'prerelease', id), full),
	};
};

const splitSubranges = (range: string): readonly string[] =>
	range
		.split('||')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

const findMatchedSubrange = (range: string, version: string): string | undefined => {
	const subranges = splitSubranges(range);
	if (subranges.length <= 1) return subranges[0];
	return subranges.find((subrange) => {
		try {
			return semver.satisfies(version, subrange);
		} catch {
			return false;
		}
	});
};

export const testRange = (range: string, version: string): RangeResult | ParseError => {
	const trimmedRange = range.trim();
	const trimmedVersion = version.trim();
	if (trimmedRange.length === 0) return { ok: false, error: 'Range is empty.' };
	if (trimmedVersion.length === 0) return { ok: false, error: 'Version is empty.' };

	const normalized = semver.validRange(trimmedRange);
	if (!normalized) return { ok: false, error: 'Not a valid version range.' };
	if (!semver.valid(trimmedVersion)) return { ok: false, error: 'Not a valid semantic version.' };

	const satisfies = semver.satisfies(trimmedVersion, normalized);
	const min = semver.minVersion(normalized);
	const matchedRange = satisfies ? findMatchedSubrange(trimmedRange, trimmedVersion) : undefined;

	const explanation = satisfies
		? matchedRange && matchedRange !== trimmedRange
			? `Version satisfies subrange "${matchedRange}".`
			: `Version satisfies range "${normalized}".`
		: `Version does not satisfy range "${normalized}".`;

	return {
		ok: true,
		satisfies,
		range: normalized,
		version: trimmedVersion,
		matchedRange,
		minVersion: min?.version,
		explanation,
	};
};

const computeStep = (from: string, to: string): ReleaseStep => {
	const fromParsed = parseVersion(from);
	if (!fromParsed.ok) return { ok: false, from, to, error: `from: ${fromParsed.error}` };
	const toParsed = parseVersion(to);
	if (!toParsed.ok) return { ok: false, from, to, error: `to: ${toParsed.error}` };

	const fullFrom = fromParsed.parsed.fullVersion;
	const fullTo = toParsed.parsed.fullVersion;
	const cmp = semver.compare(fullFrom, fullTo);
	const direction: 'forward' | 'same' | 'backward' =
		cmp === 0 ? 'same' : cmp < 0 ? 'forward' : 'backward';

	const rawDiff = semver.diff(fullFrom, fullTo);
	const bump: DiffKind = isDiffKind(rawDiff) ? rawDiff : null;

	return { ok: true, from, to, bump, direction };
};

export const computeReleaseSteps = (versions: readonly string[]): readonly ReleaseStep[] => {
	const cleaned = versions.map((v) => v.trim()).filter((v) => v.length > 0);
	if (cleaned.length < 2) return [];
	return cleaned.slice(1).map((to, idx) => {
		const from = cleaned[idx] ?? '';
		return computeStep(from, to);
	});
};

export const SAMPLE_VERSION = '1.2.3-rc.1+build.456';
export const SAMPLE_VERSION_A = '1.2.3';
export const SAMPLE_VERSION_B = '2.0.0-beta.1';
export const SAMPLE_RANGE = '^1.2.0';
export const SAMPLE_RANGE_VERSION = '1.5.3';
export const SAMPLE_TIMELINE: readonly string[] = [
	'1.0.0',
	'1.0.1',
	'1.1.0',
	'1.1.1',
	'2.0.0-rc.1',
	'2.0.0',
];
export const SAMPLE_TIMELINE_TEXT = SAMPLE_TIMELINE.join('\n');
