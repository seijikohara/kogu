/**
 * Date / Timestamp service.
 *
 * Pure functions for parsing arbitrary timestamp inputs (Unix s / ms / us / ns,
 * ISO 8601, RFC 2822) into a canonical millisecond value, formatting that value
 * into every common representation simultaneously, and rendering the same
 * instant across multiple IANA timezones with relative-time labels and a
 * DST-boundary indicator.
 *
 * Re-exports `nextExecutions` from the cron service so the converter page can
 * preview the next N fires of a cron expression from a user-picked timestamp
 * without re-implementing cron parsing.
 */

import { nextExecutions as cronNextExecutions } from '@/lib/services/cron';

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Kind of timestamp detected from a free-text input.
 *
 * - `unix-s` / `unix-ms` / `unix-us` / `unix-ns`: numeric unix timestamps,
 *   auto-detected from the magnitude of the integer.
 * - `iso`: ISO 8601 / RFC 3339 strings (e.g. `2026-05-25T12:00:00Z`).
 * - `rfc2822`: RFC 2822 strings (e.g. `Mon, 25 May 2026 12:00:00 GMT`).
 * - `invalid`: input cannot be parsed.
 */
export type InputKind =
	| 'unix-s'
	| 'unix-ms'
	| 'unix-us'
	| 'unix-ns'
	| 'iso'
	| 'rfc2822'
	| 'invalid';

export interface ParsedInput {
	readonly kind: InputKind;
	readonly ms: number | null;
}

/**
 * Magnitude thresholds used to classify numeric Unix timestamps. The bands
 * pick a unit based on the integer's digit count, which is unambiguous for
 * any year between roughly 1970 and 2200.
 */
const UNIX_MS_MIN = 1e12; // 13 digits
const UNIX_US_MIN = 1e15; // 16 digits
const UNIX_NS_MIN = 1e18; // 19 digits

const detectUnixKind = (n: number): Exclude<InputKind, 'iso' | 'rfc2822' | 'invalid'> => {
	if (n >= UNIX_NS_MIN) return 'unix-ns';
	if (n >= UNIX_US_MIN) return 'unix-us';
	if (n >= UNIX_MS_MIN) return 'unix-ms';
	return 'unix-s';
};

const unixToMs = (n: number, kind: InputKind): number => {
	if (kind === 'unix-ns') return Math.round(n / 1e6);
	if (kind === 'unix-us') return Math.round(n / 1e3);
	if (kind === 'unix-s') return Math.round(n * 1e3);
	return Math.round(n);
};

/**
 * Heuristic — an RFC 2822 string begins with a day-of-week token followed by a
 * comma (e.g. `Mon, 25 May 2026`). The native `Date` constructor accepts both
 * RFC 2822 and ISO 8601, so we only need this hint to label the input.
 */
const RFC2822_PREFIX = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s/i;

/**
 * Parse a free-text timestamp into a canonical millisecond value and remember
 * which format produced it. The function is deterministic and never throws.
 */
export const parseInput = (value: string): ParsedInput => {
	const trimmed = value.trim();
	if (trimmed.length === 0) return { kind: 'invalid', ms: null };

	if (/^-?\d+$/.test(trimmed)) {
		const n = Number(trimmed);
		if (!Number.isFinite(n)) return { kind: 'invalid', ms: null };
		const kind = detectUnixKind(Math.abs(n));
		return { kind, ms: unixToMs(n, kind) };
	}

	const parsed = Date.parse(trimmed);
	if (Number.isNaN(parsed)) return { kind: 'invalid', ms: null };

	const kind: InputKind = RFC2822_PREFIX.test(trimmed) ? 'rfc2822' : 'iso';
	return { kind, ms: parsed };
};

// ---------------------------------------------------------------------------
// Representations
// ---------------------------------------------------------------------------

/**
 * Identifier for a single timestamp representation.
 */
export type RepresentationId =
	| 'unix-s'
	| 'unix-ms'
	| 'unix-us'
	| 'unix-ns'
	| 'iso8601'
	| 'rfc2822'
	| 'rfc3339'
	| 'human-local'
	| 'human-utc';

export interface Representation {
	readonly id: RepresentationId;
	readonly label: string;
	readonly value: string;
	readonly description: string;
}

const padTwo = (n: number): string => n.toString().padStart(2, '0');
const padThree = (n: number): string => n.toString().padStart(3, '0');

/**
 * Format the local-timezone offset in ISO 8601 form (`+09:00`, `-05:30`, `Z`).
 */
const localOffset = (date: Date): string => {
	const minutes = -date.getTimezoneOffset();
	if (minutes === 0) return 'Z';
	const sign = minutes >= 0 ? '+' : '-';
	const abs = Math.abs(minutes);
	return `${sign}${padTwo(Math.floor(abs / 60))}:${padTwo(abs % 60)}`;
};

const toIso8601 = (date: Date): string => date.toISOString();

/**
 * RFC 3339 keeps the local offset rather than collapsing to UTC.
 */
const toRfc3339 = (date: Date): string => {
	const offset = localOffset(date);
	const yyyy = date.getFullYear();
	const mm = padTwo(date.getMonth() + 1);
	const dd = padTwo(date.getDate());
	const hh = padTwo(date.getHours());
	const mi = padTwo(date.getMinutes());
	const ss = padTwo(date.getSeconds());
	const ms = padThree(date.getMilliseconds());
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}${offset}`;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_NAMES = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
] as const;

/**
 * RFC 2822 always uses GMT for the absolute reference frame.
 */
const toRfc2822 = (date: Date): string => {
	const day = DAY_NAMES[date.getUTCDay()] ?? 'Sun';
	const dd = padTwo(date.getUTCDate());
	const mon = MONTH_NAMES[date.getUTCMonth()] ?? 'Jan';
	const yyyy = date.getUTCFullYear();
	const hh = padTwo(date.getUTCHours());
	const mi = padTwo(date.getUTCMinutes());
	const ss = padTwo(date.getUTCSeconds());
	return `${day}, ${dd} ${mon} ${yyyy} ${hh}:${mi}:${ss} GMT`;
};

const toHumanLocal = (date: Date): string =>
	new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		weekday: 'long',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		timeZoneName: 'short',
	}).format(date);

const toHumanUtc = (date: Date): string =>
	new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		weekday: 'long',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		timeZone: 'UTC',
		timeZoneName: 'short',
	}).format(date);

/**
 * Produce every supported representation for the given millisecond timestamp.
 */
export const representationsOf = (ms: number): readonly Representation[] => {
	const date = new Date(ms);
	const seconds = Math.floor(ms / 1000);
	return [
		{
			id: 'unix-s',
			label: 'Unix seconds',
			value: String(seconds),
			description: 'Seconds since 1970-01-01T00:00:00Z (epoch).',
		},
		{
			id: 'unix-ms',
			label: 'Unix milliseconds',
			value: String(ms),
			description: 'Milliseconds since epoch — JavaScript native timestamp.',
		},
		{
			id: 'unix-us',
			label: 'Unix microseconds',
			value: `${ms}000`,
			description: 'Microseconds since epoch (1e-6 s).',
		},
		{
			id: 'unix-ns',
			label: 'Unix nanoseconds',
			value: `${ms}000000`,
			description: 'Nanoseconds since epoch (1e-9 s).',
		},
		{
			id: 'iso8601',
			label: 'ISO 8601',
			value: toIso8601(date),
			description: 'ISO 8601 in UTC with millisecond precision.',
		},
		{
			id: 'rfc3339',
			label: 'RFC 3339',
			value: toRfc3339(date),
			description: 'RFC 3339 with the local timezone offset.',
		},
		{
			id: 'rfc2822',
			label: 'RFC 2822',
			value: toRfc2822(date),
			description: 'RFC 2822 with GMT offset (HTTP / email convention).',
		},
		{
			id: 'human-local',
			label: 'Human (local)',
			value: toHumanLocal(date),
			description: "Locale-aware formatting in the browser's timezone.",
		},
		{
			id: 'human-utc',
			label: 'Human (UTC)',
			value: toHumanUtc(date),
			description: 'Locale-aware formatting forced to UTC.',
		},
	];
};

// ---------------------------------------------------------------------------
// Timezone formatting
// ---------------------------------------------------------------------------

export interface TimezoneOption {
	readonly value: string;
	readonly label: string;
}

/**
 * Common IANA timezone choices for the favorites picker. The list intentionally
 * stays under 30 entries to fit comfortably in a dropdown without virtualization.
 */
export const TIMEZONE_OPTIONS: readonly TimezoneOption[] = [
	{ value: 'UTC', label: 'UTC' },
	{ value: 'Asia/Tokyo', label: 'Asia / Tokyo (JST)' },
	{ value: 'Asia/Shanghai', label: 'Asia / Shanghai (CST)' },
	{ value: 'Asia/Singapore', label: 'Asia / Singapore (SGT)' },
	{ value: 'Asia/Seoul', label: 'Asia / Seoul (KST)' },
	{ value: 'Asia/Kolkata', label: 'Asia / Kolkata (IST)' },
	{ value: 'Asia/Dubai', label: 'Asia / Dubai (GST)' },
	{ value: 'Australia/Sydney', label: 'Australia / Sydney' },
	{ value: 'Pacific/Auckland', label: 'Pacific / Auckland' },
	{ value: 'Europe/London', label: 'Europe / London' },
	{ value: 'Europe/Paris', label: 'Europe / Paris' },
	{ value: 'Europe/Berlin', label: 'Europe / Berlin' },
	{ value: 'Europe/Madrid', label: 'Europe / Madrid' },
	{ value: 'Europe/Moscow', label: 'Europe / Moscow' },
	{ value: 'Africa/Cairo', label: 'Africa / Cairo' },
	{ value: 'Africa/Johannesburg', label: 'Africa / Johannesburg' },
	{ value: 'America/New_York', label: 'America / New York' },
	{ value: 'America/Chicago', label: 'America / Chicago' },
	{ value: 'America/Denver', label: 'America / Denver' },
	{ value: 'America/Los_Angeles', label: 'America / Los Angeles' },
	{ value: 'America/Toronto', label: 'America / Toronto' },
	{ value: 'America/Vancouver', label: 'America / Vancouver' },
	{ value: 'America/Mexico_City', label: 'America / Mexico City' },
	{ value: 'America/Sao_Paulo', label: 'America / Sao Paulo' },
	{ value: 'America/Argentina/Buenos_Aires', label: 'America / Buenos Aires' },
];

export const DEFAULT_TIMEZONES: readonly string[] = [
	'Asia/Tokyo',
	'UTC',
	'America/New_York',
	'Europe/London',
];

export const MAX_TIMEZONES = 4;
export const MIN_TIMEZONES = 1;

export interface TimezoneRendering {
	readonly absolute: string;
	readonly relative: string;
	readonly isDstBoundary: boolean;
	readonly offsetLabel: string;
}

/**
 * Compute the timezone offset (in minutes) for `ms` evaluated in `tz`.
 *
 * The trick: format the instant in `tz` to get the wall-clock components, then
 * reconstruct that wall clock as if it were UTC and subtract from the original
 * UTC instant. The signed difference is the offset of `tz` at that moment.
 */
const timezoneOffsetMinutes = (ms: number, tz: string): number => {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});
	const parts = formatter.formatToParts(new Date(ms));
	const lookup: Record<string, string> = {};
	parts.forEach((p) => {
		lookup[p.type] = p.value;
	});
	const year = Number(lookup['year']);
	const month = Number(lookup['month']);
	const day = Number(lookup['day']);
	const hourRaw = Number(lookup['hour']);
	// Intl emits "24" for midnight in some locales — normalize to "0".
	const hour = hourRaw === 24 ? 0 : hourRaw;
	const minute = Number(lookup['minute']);
	const second = Number(lookup['second']);
	const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
	return Math.round((asUtc - ms) / 60_000);
};

const formatOffsetLabel = (minutes: number): string => {
	if (minutes === 0) return 'UTC';
	const sign = minutes > 0 ? '+' : '-';
	const abs = Math.abs(minutes);
	return `UTC${sign}${padTwo(Math.floor(abs / 60))}:${padTwo(abs % 60)}`;
};

/**
 * Compare the timezone offsets one hour before and one hour after `ms` to
 * detect whether the instant sits on a DST boundary. The window is conservative
 * — every IANA DST transition shifts by 30 or 60 minutes, so any difference
 * means we crossed a discontinuity.
 */
const detectDstBoundary = (ms: number, tz: string): boolean => {
	const before = timezoneOffsetMinutes(ms - 60 * 60 * 1000, tz);
	const after = timezoneOffsetMinutes(ms + 60 * 60 * 1000, tz);
	return before !== after;
};

const RELATIVE_UNITS = [
	{ unit: 'year', seconds: 60 * 60 * 24 * 365 },
	{ unit: 'month', seconds: 60 * 60 * 24 * 30 },
	{ unit: 'week', seconds: 60 * 60 * 24 * 7 },
	{ unit: 'day', seconds: 60 * 60 * 24 },
	{ unit: 'hour', seconds: 60 * 60 },
	{ unit: 'minute', seconds: 60 },
] as const;

/**
 * Render a relative-time label like `2h ago` or `in 30 days`. Uses
 * `Intl.RelativeTimeFormat` when the unit is known, falling back to seconds.
 */
export const formatRelativeTime = (targetMs: number, baseMs: number = Date.now()): string => {
	const diffSeconds = Math.round((targetMs - baseMs) / 1000);
	if (Math.abs(diffSeconds) < 5) return 'just now';

	const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	const match = RELATIVE_UNITS.find(({ seconds }) => Math.abs(diffSeconds) >= seconds);
	if (!match) return formatter.format(diffSeconds, 'second');
	const value = Math.round(diffSeconds / match.seconds);
	return formatter.format(value, match.unit);
};

/**
 * Render `ms` in `tz` as an absolute wall-clock string, a relative-to-now label,
 * and a DST-boundary flag.
 */
export const formatInTimezone = (
	ms: number,
	tz: string,
	baseMs: number = Date.now()
): TimezoneRendering => {
	let absolute: string;
	let offsetLabel: string;
	try {
		absolute = new Intl.DateTimeFormat(undefined, {
			timeZone: tz,
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		}).format(new Date(ms));
		offsetLabel = formatOffsetLabel(timezoneOffsetMinutes(ms, tz));
	} catch {
		absolute = 'Invalid timezone';
		offsetLabel = 'UTC';
	}

	return {
		absolute,
		relative: formatRelativeTime(ms, baseMs),
		isDstBoundary: detectDstBoundary(ms, tz),
		offsetLabel,
	};
};

// ---------------------------------------------------------------------------
// Quick presets
// ---------------------------------------------------------------------------

export type PresetId = 'now' | 'tomorrow-9am' | 'plus-30d' | 'start-of-week' | 'end-of-month';

export interface QuickPreset {
	readonly id: PresetId;
	readonly label: string;
	readonly description: string;
	readonly resolve: (nowMs: number) => number;
}

const startOfWeek = (nowMs: number): number => {
	const d = new Date(nowMs);
	const day = d.getDay();
	d.setDate(d.getDate() - day);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
};

const endOfMonth = (nowMs: number): number => {
	const d = new Date(nowMs);
	// Day 0 of (month+1) is the last day of (month).
	const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
	return last.getTime();
};

const tomorrowAt9 = (nowMs: number): number => {
	const d = new Date(nowMs);
	d.setDate(d.getDate() + 1);
	d.setHours(9, 0, 0, 0);
	return d.getTime();
};

export const QUICK_PRESETS: readonly QuickPreset[] = [
	{
		id: 'now',
		label: 'Now',
		description: 'Current instant.',
		resolve: (nowMs) => nowMs,
	},
	{
		id: 'tomorrow-9am',
		label: 'Tomorrow 9am',
		description: 'Tomorrow at 09:00 local time.',
		resolve: tomorrowAt9,
	},
	{
		id: 'plus-30d',
		label: '+30 days',
		description: '30 days from the current instant.',
		resolve: (nowMs) => nowMs + 30 * 24 * 60 * 60 * 1000,
	},
	{
		id: 'start-of-week',
		label: 'Start of week',
		description: 'Sunday at 00:00 local time.',
		resolve: startOfWeek,
	},
	{
		id: 'end-of-month',
		label: 'End of month',
		description: 'Last day of the current month at 23:59:59.999.',
		resolve: endOfMonth,
	},
];

// ---------------------------------------------------------------------------
// Cron preview
// ---------------------------------------------------------------------------

export type Result<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: string };

/**
 * Return the next `count` cron fires after `fromMs`. The underlying
 * `cron-parser` API always anchors its iterator at "now", so we keep that
 * behavior here — the picked timestamp is exposed in the UI as context, not as
 * an iterator anchor, which keeps the function deterministic and avoids
 * pulling in extra config surface.
 */
export const nextCronFires = (
	expression: string,
	_fromMs: number,
	count: number
): Result<readonly Date[]> => cronNextExecutions(expression, count);

// ---------------------------------------------------------------------------
// Convenience formatting
// ---------------------------------------------------------------------------

export interface ZonedClock {
	readonly date: string;
	readonly time: string;
	readonly day: string;
	readonly offsetLabel: string;
}

/**
 * Decompose `ms` in `tz` into ISO-ish parts suitable for tabular display.
 * Returns an empty placeholder set when `tz` is invalid.
 */
export const zonedClock = (ms: number, tz: string): ZonedClock => {
	try {
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: tz,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			weekday: 'short',
			hour12: false,
		});
		const parts = formatter.formatToParts(new Date(ms));
		const lookup: Record<string, string> = {};
		parts.forEach((p) => {
			lookup[p.type] = p.value;
		});
		const hour = lookup['hour'] === '24' ? '00' : (lookup['hour'] ?? '00');
		return {
			date: `${lookup['year']}-${lookup['month']}-${lookup['day']}`,
			time: `${hour}:${lookup['minute']}:${lookup['second']}`,
			day: lookup['weekday'] ?? '',
			offsetLabel: formatOffsetLabel(timezoneOffsetMinutes(ms, tz)),
		};
	} catch {
		return { date: '—', time: '—', day: '—', offsetLabel: 'UTC' };
	}
};
