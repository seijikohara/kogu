/**
 * CSV / TSV Tool service.
 *
 * Pure functions for parsing delimited text into a normalized table, detecting
 * per-column data types, and formatting the table back into eight target
 * representations (CSV / TSV / JSON / YAML / SQL / Markdown / HTML).
 *
 * The parser relies on `papaparse` for tolerant CSV handling (quoted fields,
 * embedded newlines, escaped quotes). Delimiter detection samples the first
 * few lines and picks the candidate that yields the most consistent column
 * count.
 */
import Papa from 'papaparse';
import * as yaml from 'yaml';

export type Delimiter = ',' | '\t' | ';' | '|';

export type OutputFormat =
	| 'csv'
	| 'tsv'
	| 'json-objects'
	| 'json-arrays'
	| 'yaml'
	| 'sql-insert'
	| 'markdown'
	| 'html';

export type ColumnType = 'string' | 'number' | 'date' | 'bool' | 'email';

export interface ParsedTable {
	readonly headers: readonly string[];
	readonly rows: readonly (readonly string[])[];
	/** Stable per-row ids that survive sort / filter / edit operations. */
	readonly rowIds: readonly string[];
	/** Stable per-column ids that survive rename / reorder operations. */
	readonly colIds: readonly string[];
	readonly delimiter: Delimiter;
	readonly hasHeader: boolean;
	readonly errors: readonly string[];
}

let idCounter = 0;
const nextId = (prefix: string): string => {
	idCounter += 1;
	return `${prefix}-${idCounter}`;
};

export interface ParseHint {
	readonly delimiter?: Delimiter;
	readonly hasHeader?: boolean;
}

export interface FormatOptions {
	readonly sqlTableName?: string;
}

export interface ColumnStats {
	readonly count: number;
	readonly nulls: number;
	readonly unique: number;
	readonly min: string | null;
	readonly max: string | null;
	readonly type: ColumnType;
}

const CANDIDATE_DELIMITERS: readonly Delimiter[] = [',', '\t', ';', '|'];

const DELIMITER_LABELS: Readonly<Record<Delimiter, string>> = {
	',': 'Comma',
	'\t': 'Tab',
	';': 'Semicolon',
	'|': 'Pipe',
};

export const getDelimiterLabel = (d: Delimiter): string => DELIMITER_LABELS[d];

/**
 * Built-in sample dataset. Mixed types let users see column-type detection
 * (string / number / date / bool / email) the moment they click "Sample".
 */
export const SAMPLE_TEXT = `id,name,email,age,active,joined
1,Ada Lovelace,ada@example.com,36,true,1843-11-15
2,Alan Turing,alan@example.com,41,true,1936-05-28
3,Grace Hopper,grace@example.com,85,false,1944-08-07
4,Linus Torvalds,linus@example.com,54,true,1991-09-17
5,Margaret Hamilton,margaret@example.com,87,true,1969-07-20
6,Donald Knuth,donald@example.com,86,true,1968-01-01
7,Edsger Dijkstra,edsger@example.com,72,false,1972-04-15`;

/**
 * Sample lines for delimiter heuristics. Reading the entire input would be
 * wasteful for large files; the first ~10 non-empty lines are enough to
 * disambiguate the four standard delimiters.
 */
const SAMPLE_LINES = 10;

const splitFirstLines = (text: string): readonly string[] =>
	text
		.split(/\r\n|\n|\r/)
		.filter((line) => line.length > 0)
		.slice(0, SAMPLE_LINES);

const countDelimiterOutsideQuotes = (line: string, delimiter: Delimiter): number => {
	let count = 0;
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
			continue;
		}
		if (!inQuotes && ch === delimiter) count++;
	}
	return count;
};

const variance = (values: readonly number[]): number => {
	if (values.length === 0) return Number.POSITIVE_INFINITY;
	const mean = values.reduce((s, v) => s + v, 0) / values.length;
	return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
};

/**
 * Pick the delimiter that yields the most consistent (low-variance, non-zero)
 * column count across sample lines. Ties favour the order in
 * `CANDIDATE_DELIMITERS` (comma first).
 */
export const detectDelimiter = (text: string): Delimiter => {
	const lines = splitFirstLines(text);
	if (lines.length === 0) return ',';

	const scored = CANDIDATE_DELIMITERS.map((d) => {
		const counts = lines.map((line) => countDelimiterOutsideQuotes(line, d));
		const nonZero = counts.filter((c) => c > 0);
		const avg = nonZero.reduce((s, v) => s + v, 0) / Math.max(1, nonZero.length);
		return {
			delimiter: d,
			score: nonZero.length === 0 ? -1 : avg / (1 + variance(counts)),
		};
	});

	const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
	return best.score <= 0 ? ',' : best.delimiter;
};

const looksLikeHeader = (firstRow: readonly string[], secondRow: readonly string[]): boolean => {
	if (firstRow.length === 0) return false;
	if (firstRow.length !== secondRow.length) return true;

	const firstHasAllStrings = firstRow.every((cell) => {
		const trimmed = cell.trim();
		if (trimmed === '') return false;
		return Number.isNaN(Number(trimmed));
	});
	const secondHasAnyNumeric = secondRow.some((cell) => {
		const trimmed = cell.trim();
		if (trimmed === '') return false;
		return !Number.isNaN(Number(trimmed));
	});
	return firstHasAllStrings && secondHasAnyNumeric;
};

/**
 * Parse delimited text into a `ParsedTable`. Delimiter and header presence
 * are auto-detected when not supplied via `hint`. Rows are normalized to the
 * header column count: shorter rows get padded with empty strings, longer
 * rows are flagged via `errors`.
 */
export const parseTable = (text: string, hint?: ParseHint): ParsedTable => {
	if (!text || text.trim() === '') {
		return {
			headers: [],
			rows: [],
			rowIds: [],
			colIds: [],
			delimiter: hint?.delimiter ?? ',',
			hasHeader: hint?.hasHeader ?? true,
			errors: [],
		};
	}

	const delimiter = hint?.delimiter ?? detectDelimiter(text);

	const parsed = Papa.parse<string[]>(text, {
		delimiter,
		skipEmptyLines: 'greedy',
		// Disable automatic header detection — the caller decides.
		header: false,
		// Treat all fields as strings; type inference is layered on top via
		// `detectColumnTypes`.
		dynamicTyping: false,
	});

	const rawRows: readonly (readonly string[])[] = (parsed.data ?? []).map((row) =>
		row.map((cell) => (cell ?? '').toString())
	);

	const errors = parsed.errors
		.filter((e) => e.type !== 'FieldMismatch' || e.code !== 'TooFewFields')
		.map((e) => `${e.type}: ${e.message}${e.row !== undefined ? ` (row ${e.row + 1})` : ''}`);

	if (rawRows.length === 0) {
		return {
			headers: [],
			rows: [],
			rowIds: [],
			colIds: [],
			delimiter,
			hasHeader: hint?.hasHeader ?? true,
			errors,
		};
	}

	const detectedHasHeader =
		hint?.hasHeader ??
		(rawRows.length >= 2 && rawRows[0] && rawRows[1]
			? looksLikeHeader(rawRows[0], rawRows[1])
			: true);

	const firstRow = rawRows[0] ?? [];
	const columnCount = firstRow.length;

	const headers: readonly string[] = detectedHasHeader
		? firstRow.map((h, i) => h.trim() || `column_${i + 1}`)
		: Array.from({ length: columnCount }, (_, i) => `column_${i + 1}`);

	const dataRows = detectedHasHeader ? rawRows.slice(1) : rawRows;

	const normalizedRows: readonly (readonly string[])[] = dataRows.map((row) => {
		if (row.length === columnCount) return row;
		if (row.length < columnCount) {
			return [...row, ...Array.from({ length: columnCount - row.length }, () => '')];
		}
		return row.slice(0, columnCount);
	});

	const mismatchErrors: readonly string[] = dataRows
		.map((row, idx) =>
			row.length !== columnCount
				? `Row ${idx + 1 + (detectedHasHeader ? 1 : 0)}: expected ${columnCount} columns, got ${row.length}`
				: null
		)
		.filter((s): s is string => s !== null);

	return {
		headers,
		rows: normalizedRows,
		rowIds: normalizedRows.map(() => nextId('r')),
		colIds: headers.map(() => nextId('c')),
		delimiter,
		hasHeader: detectedHasHeader,
		errors: [...errors, ...mismatchErrors],
	};
};

// ---------------------------------------------------------------------------
// Column type detection
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BOOL_VALUES = new Set(['true', 'false', 'yes', 'no', 't', 'f', 'y', 'n', '1', '0']);
const DATE_RE = /^\d{4}-\d{1,2}-\d{1,2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?$/;

const isNumber = (s: string): boolean => {
	const t = s.trim();
	if (t === '') return false;
	const n = Number(t);
	return !Number.isNaN(n) && Number.isFinite(n);
};

const isBool = (s: string): boolean => BOOL_VALUES.has(s.trim().toLowerCase());

const isDate = (s: string): boolean => {
	const t = s.trim();
	if (!DATE_RE.test(t)) return false;
	const d = new Date(t);
	return !Number.isNaN(d.getTime());
};

const isEmail = (s: string): boolean => EMAIL_RE.test(s.trim());

const detectCellType = (cell: string): ColumnType | null => {
	const t = cell.trim();
	if (t === '') return null;
	if (isBool(t)) return 'bool';
	if (isNumber(t)) return 'number';
	if (isDate(t)) return 'date';
	if (isEmail(t)) return 'email';
	return 'string';
};

/**
 * Infer a single type for each column. A column resolves to `string` when
 * cells disagree on type. Empty cells are ignored. Boolean inference is
 * intentionally narrow — only the literal set above — to avoid mistaking
 * "y"-prefixed words for boolean values.
 */
export const detectColumnTypes = (table: ParsedTable): readonly ColumnType[] => {
	const { headers, rows } = table;
	return headers.map((_, col) => {
		const seen = new Set<ColumnType>();
		for (const row of rows) {
			const cell = row[col];
			if (cell === undefined) continue;
			const t = detectCellType(cell);
			if (t === null) continue;
			seen.add(t);
			if (seen.size > 1) return 'string';
		}
		const only = seen.values().next();
		return only.done ? 'string' : only.value;
	});
};

/**
 * Per-column statistics for the hoverable header tooltip. Min / max use
 * lexicographic comparison for non-numeric columns and numeric comparison
 * for numeric columns.
 */
export const computeColumnStats = (table: ParsedTable): readonly ColumnStats[] => {
	const types = detectColumnTypes(table);
	return table.headers.map((_, col) => {
		const cells = table.rows.map((row) => row[col] ?? '');
		const nonEmpty = cells.filter((c) => c.trim() !== '');
		const unique = new Set(nonEmpty).size;
		const type = types[col] ?? 'string';

		let min: string | null = null;
		let max: string | null = null;
		if (nonEmpty.length > 0) {
			if (type === 'number') {
				const nums = nonEmpty.map((c) => Number(c.trim())).filter((n) => !Number.isNaN(n));
				if (nums.length > 0) {
					min = String(Math.min(...nums));
					max = String(Math.max(...nums));
				}
			} else {
				const sorted = [...nonEmpty].sort();
				min = sorted[0] ?? null;
				max = sorted[sorted.length - 1] ?? null;
			}
		}

		return {
			count: cells.length,
			nulls: cells.length - nonEmpty.length,
			unique,
			min,
			max,
			type,
		};
	});
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const escapeCsvCell = (cell: string, delimiter: string): string => {
	const needsQuotes =
		cell.includes(delimiter) || cell.includes('"') || cell.includes('\n') || cell.includes('\r');
	const escaped = cell.replace(/"/g, '""');
	return needsQuotes ? `"${escaped}"` : escaped;
};

const toDelimited = (table: ParsedTable, delimiter: string): string => {
	const headerLine = table.headers.map((h) => escapeCsvCell(h, delimiter)).join(delimiter);
	const rowLines = table.rows.map((row) =>
		row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter)
	);
	return [headerLine, ...rowLines].join('\n');
};

const coerceCellForJson = (cell: string, type: ColumnType): string | number | boolean | null => {
	const t = cell.trim();
	if (t === '') return null;
	if (type === 'number') {
		const n = Number(t);
		return Number.isFinite(n) ? n : cell;
	}
	if (type === 'bool') {
		const lower = t.toLowerCase();
		if (lower === 'true' || lower === 'yes' || lower === 't' || lower === 'y' || lower === '1')
			return true;
		if (lower === 'false' || lower === 'no' || lower === 'f' || lower === 'n' || lower === '0')
			return false;
		return cell;
	}
	return cell;
};

const toJsonObjects = (table: ParsedTable): string => {
	const types = detectColumnTypes(table);
	const objects = table.rows.map((row) =>
		Object.fromEntries(
			table.headers.map((h, i) => [h, coerceCellForJson(row[i] ?? '', types[i] ?? 'string')])
		)
	);
	return JSON.stringify(objects, null, 2);
};

const toJsonArrays = (table: ParsedTable): string => {
	const matrix = [table.headers, ...table.rows.map((r) => [...r])];
	return JSON.stringify(matrix, null, 2);
};

const toYaml = (table: ParsedTable): string => {
	const types = detectColumnTypes(table);
	const objects = table.rows.map((row) =>
		Object.fromEntries(
			table.headers.map((h, i) => [h, coerceCellForJson(row[i] ?? '', types[i] ?? 'string')])
		)
	);
	return yaml.stringify(objects);
};

const sanitizeSqlIdentifier = (name: string): string => {
	const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
	const safe = /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
	return safe || 'col';
};

const formatSqlValue = (cell: string, type: ColumnType): string => {
	const t = cell.trim();
	if (t === '') return 'NULL';
	if (type === 'number' && isNumber(t)) return t;
	if (type === 'bool' && isBool(t)) {
		const lower = t.toLowerCase();
		const truthy =
			lower === 'true' || lower === 'yes' || lower === 't' || lower === 'y' || lower === '1';
		return truthy ? 'TRUE' : 'FALSE';
	}
	return `'${cell.replace(/'/g, "''")}'`;
};

const toSqlInsert = (table: ParsedTable, tableName: string): string => {
	const types = detectColumnTypes(table);
	const safeTable = sanitizeSqlIdentifier(tableName || 'my_table');
	const safeColumns = table.headers.map(sanitizeSqlIdentifier).join(', ');
	const statements = table.rows.map((row) => {
		const values = row.map((cell, i) => formatSqlValue(cell, types[i] ?? 'string')).join(', ');
		return `INSERT INTO ${safeTable} (${safeColumns}) VALUES (${values});`;
	});
	return statements.join('\n');
};

const escapeMarkdownCell = (cell: string): string =>
	cell.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

const toMarkdown = (table: ParsedTable): string => {
	if (table.headers.length === 0) return '';
	const headerLine = `| ${table.headers.map(escapeMarkdownCell).join(' | ')} |`;
	const sepLine = `| ${table.headers.map(() => '---').join(' | ')} |`;
	const rowLines = table.rows.map(
		(row) => `| ${row.map((c) => escapeMarkdownCell(c)).join(' | ')} |`
	);
	return [headerLine, sepLine, ...rowLines].join('\n');
};

const escapeHtml = (s: string): string =>
	s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const toHtml = (table: ParsedTable): string => {
	const head = `\t<thead>\n\t\t<tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>\n\t</thead>`;
	const body = `\t<tbody>\n${table.rows
		.map((row) => `\t\t<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
		.join('\n')}\n\t</tbody>`;
	return `<table>\n${head}\n${body}\n</table>`;
};

/**
 * Format a `ParsedTable` into one of eight target representations. SQL output
 * uses a generic, dialect-neutral `INSERT INTO t (...) VALUES (...);` form.
 */
export const formatTable = (
	table: ParsedTable,
	format: OutputFormat,
	opts?: FormatOptions
): string => {
	if (table.headers.length === 0) return '';
	switch (format) {
		case 'csv':
			return toDelimited(table, ',');
		case 'tsv':
			return toDelimited(table, '\t');
		case 'json-objects':
			return toJsonObjects(table);
		case 'json-arrays':
			return toJsonArrays(table);
		case 'yaml':
			return toYaml(table);
		case 'sql-insert':
			return toSqlInsert(table, opts?.sqlTableName ?? 'my_table');
		case 'markdown':
			return toMarkdown(table);
		case 'html':
			return toHtml(table);
	}
};

// ---------------------------------------------------------------------------
// Mutation helpers (return new tables — `ParsedTable` is fully readonly)
// ---------------------------------------------------------------------------

export const updateCell = (
	table: ParsedTable,
	rowIndex: number,
	colIndex: number,
	value: string
): ParsedTable => {
	const rows = table.rows.map((row, r) =>
		r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row
	);
	return { ...table, rows };
};

export const renameHeader = (table: ParsedTable, colIndex: number, value: string): ParsedTable => ({
	...table,
	headers: table.headers.map((h, i) => (i === colIndex ? value : h)),
});

export const addRow = (table: ParsedTable): ParsedTable => ({
	...table,
	rows: [...table.rows, table.headers.map(() => '')],
	rowIds: [...table.rowIds, nextId('r')],
});

export const removeRow = (table: ParsedTable, rowIndex: number): ParsedTable => ({
	...table,
	rows: table.rows.filter((_, i) => i !== rowIndex),
	rowIds: table.rowIds.filter((_, i) => i !== rowIndex),
});

export const addColumn = (table: ParsedTable, name = 'new_column'): ParsedTable => ({
	...table,
	headers: [...table.headers, name],
	colIds: [...table.colIds, nextId('c')],
	rows: table.rows.map((row) => [...row, '']),
});

export const removeColumn = (table: ParsedTable, colIndex: number): ParsedTable => ({
	...table,
	headers: table.headers.filter((_, i) => i !== colIndex),
	colIds: table.colIds.filter((_, i) => i !== colIndex),
	rows: table.rows.map((row) => row.filter((_, i) => i !== colIndex)),
});

// ---------------------------------------------------------------------------
// Sort & filter helpers
// ---------------------------------------------------------------------------

export type SortDirection = 'asc' | 'desc';

/**
 * Build a display ordering over `rows`. Returns the original row indexes,
 * filtered by `query` and sorted (when `sort` is set) by the column at
 * `sort.columnIndex` using the given column `type`. Keeping the indexes (not
 * the rows themselves) lets the caller map back to stable row ids and to the
 * underlying table for in-place edits without identity searches.
 */
export const computeDisplayOrder = (
	rows: readonly (readonly string[])[],
	query: string,
	sort: { readonly columnIndex: number; readonly direction: SortDirection } | null,
	columnType: ColumnType
): readonly number[] => {
	const q = query.trim().toLowerCase();
	const filtered: number[] = [];
	rows.forEach((row, idx) => {
		if (q === '' || row.some((cell) => cell.toLowerCase().includes(q))) filtered.push(idx);
	});
	if (!sort) return filtered;
	const sign = sort.direction === 'asc' ? 1 : -1;
	return [...filtered].sort((aIdx, bIdx) => {
		const a = rows[aIdx];
		const b = rows[bIdx];
		const av = a?.[sort.columnIndex] ?? '';
		const bv = b?.[sort.columnIndex] ?? '';
		if (columnType === 'number') {
			const an = Number(av);
			const bn = Number(bv);
			const aBad = Number.isNaN(an);
			const bBad = Number.isNaN(bn);
			if (aBad && bBad) return 0;
			if (aBad) return 1;
			if (bBad) return -1;
			return sign * (an - bn);
		}
		return sign * av.localeCompare(bv);
	});
};
