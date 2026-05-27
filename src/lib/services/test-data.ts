/**
 * Test data file generator.
 *
 * Produces synthetic tabular datasets from a column specification
 * (type, options, nullable rate, uniqueness) at a chosen row count,
 * then serializes them to CSV / TSV / JSON / NDJSON / SQL.
 *
 * Generation runs through a Mulberry32 PRNG seeded by the user so
 * any (spec, seed) pair is reproducible. The locale-specific
 * provider is reseeded on each call so name / address style follows
 * the chosen locale deterministically.
 */

import { fakerDE, fakerEN, fakerES, fakerFR, fakerJA, type Faker } from '@faker-js/faker';

export type ColumnType =
	| 'integer'
	| 'float'
	| 'string'
	| 'uuid'
	| 'email'
	| 'phone'
	| 'url'
	| 'date'
	| 'datetime'
	| 'boolean'
	| 'lorem-words'
	| 'lorem-sentences'
	| 'pick-from-list'
	| 'sequence'
	| 'regex'
	| 'first-name'
	| 'last-name'
	| 'full-name'
	| 'company'
	| 'city'
	| 'country'
	| 'street-address';

export type Locale = 'en' | 'ja' | 'fr' | 'de' | 'es';
export type OutputFormat = 'csv' | 'tsv' | 'json' | 'ndjson' | 'sql';

export interface ColumnSpec {
	/**
	 * Stable identifier used by the builder UI as a React key so
	 * reorder / rename operations do not remount form rows. The
	 * value is opaque to the generator itself.
	 */
	readonly id: string;
	readonly name: string;
	readonly type: ColumnType;
	readonly nullablePercent?: number;
	readonly unique?: boolean;
	readonly options?: Record<string, unknown>;
}

export interface DatasetSpec {
	readonly columns: readonly ColumnSpec[];
	readonly rowCount: number;
	readonly locale: Locale;
	readonly seed: number;
}

export const COLUMN_TYPES: readonly ColumnType[] = [
	'integer',
	'float',
	'string',
	'uuid',
	'email',
	'phone',
	'url',
	'date',
	'datetime',
	'boolean',
	'lorem-words',
	'lorem-sentences',
	'pick-from-list',
	'sequence',
	'regex',
	'first-name',
	'last-name',
	'full-name',
	'company',
	'city',
	'country',
	'street-address',
];

export const COLUMN_TYPE_LABELS: Readonly<Record<ColumnType, string>> = {
	integer: 'Integer',
	float: 'Float',
	string: 'String',
	uuid: 'UUID',
	email: 'Email',
	phone: 'Phone',
	url: 'URL',
	date: 'Date',
	datetime: 'Date / Time',
	boolean: 'Boolean',
	'lorem-words': 'Lorem words',
	'lorem-sentences': 'Lorem sentences',
	'pick-from-list': 'Pick from list',
	sequence: 'Sequence',
	regex: 'Regex pattern',
	'first-name': 'First name',
	'last-name': 'Last name',
	'full-name': 'Full name',
	company: 'Company',
	city: 'City',
	country: 'Country',
	'street-address': 'Street address',
};

export const LOCALES: readonly Locale[] = ['en', 'ja', 'fr', 'de', 'es'];

export const LOCALE_LABELS: Readonly<Record<Locale, string>> = {
	en: 'English',
	ja: '日本語',
	fr: 'Français',
	de: 'Deutsch',
	es: 'Español',
};

export const OUTPUT_FORMATS: readonly OutputFormat[] = ['csv', 'tsv', 'json', 'ndjson', 'sql'];

export const OUTPUT_FORMAT_LABELS: Readonly<Record<OutputFormat, string>> = {
	csv: 'CSV (comma separated)',
	tsv: 'TSV (tab separated)',
	json: 'JSON (array of objects)',
	ndjson: 'NDJSON (line-delimited)',
	sql: 'SQL INSERT statements',
};

export const OUTPUT_FORMAT_EXTENSIONS: Readonly<Record<OutputFormat, string>> = {
	csv: 'csv',
	tsv: 'tsv',
	json: 'json',
	ndjson: 'ndjson',
	sql: 'sql',
};

export const isColumnType = (value: string): value is ColumnType =>
	COLUMN_TYPES.includes(value as ColumnType);
export const isLocale = (value: string): value is Locale => LOCALES.includes(value as Locale);
export const isOutputFormat = (value: string): value is OutputFormat =>
	OUTPUT_FORMATS.includes(value as OutputFormat);

export const ROW_COUNT_MIN = 1;
export const ROW_COUNT_MAX = 100_000;

/**
 * Default options for newly added columns, keyed by type so the UI
 * can hydrate sensible defaults without each call site duplicating
 * the same literals.
 */
export const DEFAULT_COLUMN_OPTIONS: Readonly<Record<ColumnType, Record<string, unknown>>> = {
	integer: { min: 1, max: 1000 },
	float: { min: 0, max: 1, decimals: 2 },
	string: { length: 12 },
	uuid: {},
	email: {},
	phone: {},
	url: {},
	date: { format: 'YYYY-MM-DD', yearsBack: 5 },
	datetime: { format: 'ISO', yearsBack: 5 },
	boolean: {},
	'lorem-words': { count: 4 },
	'lorem-sentences': { count: 1 },
	'pick-from-list': { values: 'red, green, blue' },
	sequence: { start: 1, step: 1 },
	regex: { pattern: '[A-Z]{2}-[0-9]{4}' },
	'first-name': {},
	'last-name': {},
	'full-name': {},
	company: {},
	city: {},
	country: {},
	'street-address': {},
};

/**
 * Generate a stable column identifier. Uses `crypto.randomUUID` when
 * available (all supported browsers + Tauri WebView) and falls back
 * to a counter for the rare environment without it (test setups,
 * old Safari) so the persisted store does not crash at boot.
 */
let columnIdCounter = 0;
export const createColumnId = (): string => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	columnIdCounter += 1;
	return `col-${Date.now().toString(36)}-${columnIdCounter}`;
};

export const SAMPLE_SPEC: DatasetSpec = {
	columns: [
		{
			id: 'sample-id',
			name: 'id',
			type: 'sequence',
			options: { start: 1, step: 1 },
			unique: true,
		},
		{ id: 'sample-name', name: 'name', type: 'full-name' },
		{ id: 'sample-email', name: 'email', type: 'email' },
		{ id: 'sample-age', name: 'age', type: 'integer', options: { min: 18, max: 80 } },
		{
			id: 'sample-created',
			name: 'created',
			type: 'datetime',
			options: { format: 'ISO', yearsBack: 3 },
		},
	],
	rowCount: 25,
	locale: 'en',
	seed: 42,
};

export const EMPTY_SPEC: DatasetSpec = {
	columns: [],
	rowCount: 25,
	locale: 'en',
	seed: 42,
};

/**
 * Repair persisted specs that predate the `id` field. Required after
 * the column-id migration; safe to call on already-migrated specs.
 */
export const ensureColumnIds = (spec: DatasetSpec): DatasetSpec => {
	const needsRepair = spec.columns.some(
		(column) => typeof column.id !== 'string' || column.id.length === 0
	);
	if (!needsRepair) return spec;
	return {
		...spec,
		columns: spec.columns.map((column) =>
			typeof column.id === 'string' && column.id.length > 0
				? column
				: { ...column, id: createColumnId() }
		),
	};
};

// Mulberry32 — a tiny, stable PRNG. Used so `seed` produces a
// deterministic stream and Regenerate ticks shift the output
// without depending on Math.random.
const createRng = (seed: number): (() => number) => {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const pickInt = (rng: () => number, min: number, max: number): number => {
	const lo = Math.ceil(min);
	const hi = Math.floor(max);
	if (hi <= lo) return lo;
	return Math.floor(rng() * (hi - lo + 1)) + lo;
};

const pickFloat = (rng: () => number, min: number, max: number, decimals: number): string => {
	const value = rng() * (max - min) + min;
	const safeDecimals = Math.max(0, Math.min(20, Math.floor(decimals)));
	return value.toFixed(safeDecimals);
};

const STRING_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const pickString = (rng: () => number, length: number): string => {
	const safeLength = Math.max(0, Math.min(4096, Math.floor(length)));
	return Array.from({ length: safeLength }, () => {
		const idx = Math.floor(rng() * STRING_ALPHABET.length);
		return STRING_ALPHABET.charAt(idx);
	}).join('');
};

const pad2 = (n: number): string => n.toString().padStart(2, '0');

const formatDate = (date: Date, format: string): string => {
	const year = date.getUTCFullYear().toString();
	const month = pad2(date.getUTCMonth() + 1);
	const day = pad2(date.getUTCDate());
	const hours = pad2(date.getUTCHours());
	const minutes = pad2(date.getUTCMinutes());
	const seconds = pad2(date.getUTCSeconds());
	if (format === 'ISO') return date.toISOString();
	if (format === 'UNIX') return Math.floor(date.getTime() / 1000).toString();
	if (format === 'UNIX_MS') return date.getTime().toString();
	return format
		.replaceAll('YYYY', year)
		.replaceAll('MM', month)
		.replaceAll('DD', day)
		.replaceAll('HH', hours)
		.replaceAll('mm', minutes)
		.replaceAll('ss', seconds);
};

const pickPastDate = (rng: () => number, yearsBack: number): Date => {
	const now = Date.now();
	const span = Math.max(1, yearsBack) * 365.25 * 24 * 60 * 60 * 1000;
	const offset = Math.floor(rng() * span);
	return new Date(now - offset);
};

const splitListValues = (raw: unknown): readonly string[] => {
	if (typeof raw !== 'string') return [];
	return raw
		.split(/[,\n]/u)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
};

/**
 * Generate a value from a regex pattern using a simple recursive
 * generator. Supports literal chars, char classes ([abc] / [a-z]),
 * predefined classes (\d \w \s), quantifiers ({n} {n,m} ? + *),
 * groups and alternation. Anchors (^ $) and zero-width assertions
 * are not supported. Returns a best-effort string on parse failure.
 */
export const generateFromRegex = (pattern: string, rng: () => number, maxRepeat = 8): string => {
	let pos = 0;
	const input = pattern.startsWith('^') ? pattern.slice(1) : pattern;
	const stripped = input.endsWith('$') ? input.slice(0, -1) : input;

	const parseClass = (): string => {
		// At a `[` — parse char ranges and members, then return one char.
		pos++; // consume [
		const members: string[] = [];
		while (pos < stripped.length && stripped.charAt(pos) !== ']') {
			const ch = stripped.charAt(pos);
			if (ch === '\\' && pos + 1 < stripped.length) {
				members.push(expandEscape(stripped.charAt(pos + 1)));
				pos += 2;
				continue;
			}
			if (pos + 2 < stripped.length && stripped.charAt(pos + 1) === '-') {
				const lo = ch.charCodeAt(0);
				const hi = stripped.charAt(pos + 2).charCodeAt(0);
				const [start, end] = lo <= hi ? [lo, hi] : [hi, lo];
				for (let code = start; code <= end; code++) {
					members.push(String.fromCharCode(code));
				}
				pos += 3;
				continue;
			}
			members.push(ch);
			pos++;
		}
		pos++; // consume ]
		const pool = members.join('') || 'x';
		return pool.charAt(Math.floor(rng() * pool.length));
	};

	const expandEscape = (esc: string): string => {
		if (esc === 'd') return '0123456789';
		if (esc === 'D') return 'abcdefghijklmnopqrstuvwxyz';
		if (esc === 'w') return 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
		if (esc === 'W') return '!@#$%^&*';
		if (esc === 's') return ' ';
		if (esc === 'S') return 'x';
		if (esc === 'n') return '\n';
		if (esc === 't') return '\t';
		return esc;
	};

	const parseRepeat = (): readonly [number, number] | null => {
		// At a `{` — parse {n} or {n,m}.
		if (stripped.charAt(pos) !== '{') return null;
		const end = stripped.indexOf('}', pos);
		if (end < 0) return null;
		const body = stripped.slice(pos + 1, end);
		const parts = body.split(',').map((s) => s.trim());
		const lo = Number.parseInt(parts[0] ?? '', 10);
		const hi = parts.length > 1 ? Number.parseInt(parts[1] ?? '', 10) : lo;
		if (Number.isNaN(lo) || Number.isNaN(hi)) return null;
		pos = end + 1;
		return [lo, hi];
	};

	const parseAtom = (): string => {
		const ch = stripped.charAt(pos);
		if (ch === '(') {
			pos++; // consume (
			const branches: string[][] = [[]];
			while (pos < stripped.length && stripped.charAt(pos) !== ')') {
				if (stripped.charAt(pos) === '|') {
					branches.push([]);
					pos++;
					continue;
				}
				branches[branches.length - 1]?.push(parseAtomWithRepeat());
			}
			pos++; // consume )
			const choice = branches[Math.floor(rng() * branches.length)] ?? [];
			return choice.join('');
		}
		if (ch === '[') return parseClass();
		if (ch === '\\') {
			const esc = stripped.charAt(pos + 1) ?? '';
			pos += 2;
			const pool = expandEscape(esc);
			return pool.charAt(Math.floor(rng() * pool.length));
		}
		if (ch === '.') {
			pos++;
			return STRING_ALPHABET.charAt(Math.floor(rng() * STRING_ALPHABET.length));
		}
		pos++;
		return ch;
	};

	const parseAtomWithRepeat = (): string => {
		const atom = parseAtom();
		const next = stripped.charAt(pos);
		if (next === '?') {
			pos++;
			return rng() < 0.5 ? atom : '';
		}
		if (next === '+') {
			pos++;
			const n = pickInt(rng, 1, maxRepeat);
			return atom.repeat(n);
		}
		if (next === '*') {
			pos++;
			const n = pickInt(rng, 0, maxRepeat);
			return atom.repeat(n);
		}
		if (next === '{') {
			const range = parseRepeat();
			if (!range) return atom;
			const [lo, hi] = range;
			const n = pickInt(rng, lo, hi);
			return atom.repeat(n);
		}
		return atom;
	};

	try {
		const out: string[] = [];
		while (pos < stripped.length) {
			out.push(parseAtomWithRepeat());
		}
		return out.join('');
	} catch {
		return pattern;
	}
};

const FAKER_INSTANCES: Readonly<Record<Locale, Faker>> = {
	en: fakerEN,
	ja: fakerJA,
	fr: fakerFR,
	de: fakerDE,
	es: fakerES,
};

const createFaker = (locale: Locale, seed: number): Faker => {
	// Use the pre-built locale instance — `seed()` mutates shared
	// state, but the row generator runs synchronously to completion
	// before any other caller can observe it.
	const faker = FAKER_INSTANCES[locale] ?? fakerEN;
	faker.seed(seed);
	return faker;
};

interface CellContext {
	readonly rng: () => number;
	readonly faker: Faker;
	readonly rowIndex: number;
	readonly uniqueSet: Set<string> | null;
}

const optNumber = (opts: Record<string, unknown>, key: string, fallback: number): number => {
	const raw = opts[key];
	return typeof raw === 'number' ? raw : fallback;
};

const optString = (opts: Record<string, unknown>, key: string, fallback: string): string => {
	const raw = opts[key];
	return typeof raw === 'string' ? raw : fallback;
};

const generateCellValue = (column: ColumnSpec, ctx: CellContext): string => {
	const opts = column.options ?? {};
	const { rng, faker, rowIndex } = ctx;
	switch (column.type) {
		case 'integer': {
			const min = optNumber(opts, 'min', 1);
			const max = optNumber(opts, 'max', 1000);
			return pickInt(rng, Math.min(min, max), Math.max(min, max)).toString();
		}
		case 'float': {
			const min = optNumber(opts, 'min', 0);
			const max = optNumber(opts, 'max', 1);
			const decimals = optNumber(opts, 'decimals', 2);
			return pickFloat(rng, Math.min(min, max), Math.max(min, max), decimals);
		}
		case 'string': {
			const length = optNumber(opts, 'length', 12);
			return pickString(rng, length);
		}
		case 'uuid':
			return faker.string.uuid();
		case 'email':
			return faker.internet.email().toLowerCase();
		case 'phone':
			return faker.phone.number();
		case 'url':
			return faker.internet.url();
		case 'date': {
			const format = optString(opts, 'format', 'YYYY-MM-DD');
			const yearsBack = optNumber(opts, 'yearsBack', 5);
			return formatDate(pickPastDate(rng, yearsBack), format);
		}
		case 'datetime': {
			const format = optString(opts, 'format', 'ISO');
			const yearsBack = optNumber(opts, 'yearsBack', 5);
			return formatDate(pickPastDate(rng, yearsBack), format);
		}
		case 'boolean':
			return rng() < 0.5 ? 'false' : 'true';
		case 'lorem-words': {
			const count = optNumber(opts, 'count', 4);
			return faker.lorem.words(Math.max(1, Math.min(200, Math.floor(count))));
		}
		case 'lorem-sentences': {
			const count = optNumber(opts, 'count', 1);
			return faker.lorem.sentences(Math.max(1, Math.min(50, Math.floor(count))));
		}
		case 'pick-from-list': {
			const values = splitListValues(opts['values']);
			if (values.length === 0) return '';
			return values[Math.floor(rng() * values.length)] ?? '';
		}
		case 'sequence': {
			const start = optNumber(opts, 'start', 1);
			const step = optNumber(opts, 'step', 1);
			return (start + rowIndex * step).toString();
		}
		case 'regex': {
			const pattern = optString(opts, 'pattern', '[A-Z]{2}-[0-9]{4}');
			return generateFromRegex(pattern, rng);
		}
		case 'first-name':
			return faker.person.firstName();
		case 'last-name':
			return faker.person.lastName();
		case 'full-name':
			return faker.person.fullName();
		case 'company':
			return faker.company.name();
		case 'city':
			return faker.location.city();
		case 'country':
			return faker.location.country();
		case 'street-address':
			return faker.location.streetAddress();
		default:
			return '';
	}
};

/**
 * Generate a 2D array of cell values for the supplied spec. Each
 * row is a `readonly string[]` aligned with `spec.columns`. Cells
 * may be the literal empty string when `nullablePercent` fires.
 *
 * Uniqueness is enforced via per-column `Set`s with up to 50 retries
 * before falling back to a counter suffix so generation never
 * deadlocks for narrow value spaces.
 */
export const generateDataset = (spec: DatasetSpec): readonly (readonly string[])[] => {
	const rng = createRng(spec.seed);
	const faker = createFaker(spec.locale, spec.seed);
	const rowCount = Math.max(0, Math.min(ROW_COUNT_MAX, Math.floor(spec.rowCount)));

	const uniqueSets = new Map<number, Set<string>>();
	spec.columns.forEach((col, idx) => {
		if (col.unique) uniqueSets.set(idx, new Set<string>());
	});

	return Array.from({ length: rowCount }, (_unused, rowIndex) =>
		spec.columns.map((col, colIdx) => {
			const nullChance = Math.max(0, Math.min(100, col.nullablePercent ?? 0));
			if (nullChance > 0 && rng() * 100 < nullChance) return '';

			const uniqueSet = uniqueSets.get(colIdx) ?? null;
			const ctx: CellContext = { rng, faker, rowIndex, uniqueSet };

			if (!uniqueSet) return generateCellValue(col, ctx);

			for (let attempt = 0; attempt < 50; attempt++) {
				const candidate = generateCellValue(col, ctx);
				if (!uniqueSet.has(candidate)) {
					uniqueSet.add(candidate);
					return candidate;
				}
			}
			const fallback = `${generateCellValue(col, ctx)}-${rowIndex}`;
			uniqueSet.add(fallback);
			return fallback;
		})
	);
};

const escapeDelimited = (value: string, delimiter: string): string => {
	if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
};

const formatDelimited = (
	rows: readonly (readonly string[])[],
	headers: readonly string[],
	delimiter: string
): string => {
	const headerLine = headers.map((h) => escapeDelimited(h, delimiter)).join(delimiter);
	const bodyLines = rows.map((row) =>
		row.map((c) => escapeDelimited(c, delimiter)).join(delimiter)
	);
	return [headerLine, ...bodyLines].join('\n');
};

const tryParseNumber = (value: string): number | null => {
	if (value.trim().length === 0) return null;
	if (!/^-?\d+(\.\d+)?$/u.test(value)) return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
};

const toJsonValue = (value: string): string | number | boolean | null => {
	if (value.length === 0) return null;
	if (value === 'true') return true;
	if (value === 'false') return false;
	const n = tryParseNumber(value);
	if (n !== null) return n;
	return value;
};

const formatJson = (rows: readonly (readonly string[])[], headers: readonly string[]): string => {
	const objects = rows.map((row) => {
		const obj: Record<string, string | number | boolean | null> = {};
		headers.forEach((header, idx) => {
			obj[header] = toJsonValue(row[idx] ?? '');
		});
		return obj;
	});
	return JSON.stringify(objects, null, 2);
};

const formatNdjson = (rows: readonly (readonly string[])[], headers: readonly string[]): string =>
	rows
		.map((row) => {
			const obj: Record<string, string | number | boolean | null> = {};
			headers.forEach((header, idx) => {
				obj[header] = toJsonValue(row[idx] ?? '');
			});
			return JSON.stringify(obj);
		})
		.join('\n');

const escapeSqlIdentifier = (name: string): string => `"${name.replaceAll('"', '""')}"`;

const escapeSqlValue = (value: string): string => {
	if (value.length === 0) return 'NULL';
	if (value === 'true' || value === 'false') return value.toUpperCase();
	const n = tryParseNumber(value);
	if (n !== null) return value;
	return `'${value.replaceAll("'", "''")}'`;
};

const formatSql = (
	rows: readonly (readonly string[])[],
	headers: readonly string[],
	tableName: string
): string => {
	const safeTable = escapeSqlIdentifier(tableName || 'generated_data');
	const cols = headers.map(escapeSqlIdentifier).join(', ');
	const inserts = rows.map((row) => {
		const values = row.map(escapeSqlValue).join(', ');
		return `INSERT INTO ${safeTable} (${cols}) VALUES (${values});`;
	});
	return inserts.join('\n');
};

/**
 * Serialize the generated rows + headers to the requested format.
 * `sqlTableName` is required only for `format === 'sql'`; other
 * formats ignore it.
 */
export const formatOutput = (
	rows: readonly (readonly string[])[],
	headers: readonly string[],
	format: OutputFormat,
	sqlTableName?: string
): string => {
	switch (format) {
		case 'csv':
			return formatDelimited(rows, headers, ',');
		case 'tsv':
			return formatDelimited(rows, headers, '\t');
		case 'json':
			return formatJson(rows, headers);
		case 'ndjson':
			return formatNdjson(rows, headers);
		case 'sql':
			return formatSql(rows, headers, sqlTableName ?? 'generated_data');
		default:
			return '';
	}
};

const HUMAN_UNITS: readonly string[] = ['B', 'KB', 'MB', 'GB'];

/**
 * Format a byte count as a human-readable string (e.g. `12.3 KB`).
 * Used by the status bar to give the user a sense of how large
 * the generated file will be before they save it.
 */
export const humanSize = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < HUMAN_UNITS.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${HUMAN_UNITS[unitIndex]}`;
};

/**
 * Approximate UTF-8 byte length of `text` without allocating a new
 * `Uint8Array`. Sufficient for status-bar size hints; for exact
 * byte counts (e.g. hashing) use `TextEncoder` directly.
 */
export const approxUtf8Bytes = (text: string): number => new TextEncoder().encode(text).length;
