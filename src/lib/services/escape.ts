/**
 * Multi-flavor escape / unescape service.
 *
 * Pure functions per flavor (JSON / JavaScript / HTML / XML / CSV / Shell).
 * Each `escape*` produces both a plain string and a segment list so consumers
 * can highlight characters that needed escaping. Each `unescape*` is fault
 * tolerant — on malformed input it returns the original string unchanged.
 */

export type EscapeFlavor = 'json' | 'javascript' | 'html' | 'xml' | 'csv' | 'shell';

export interface JsonEscapeOptions {
	readonly escapeUnicode: boolean;
	readonly preserveForwardSlash: boolean;
}

export interface JsEscapeOptions {
	readonly quoteStyle: 'single' | 'double';
	readonly escapeUnicode: boolean;
}

export interface HtmlEscapeOptions {
	readonly entityForm: 'named' | 'numeric';
	readonly encodeNonAscii: boolean;
}

export interface XmlEscapeOptions {
	readonly amp: boolean;
	readonly lt: boolean;
	readonly gt: boolean;
	readonly quot: boolean;
	readonly apos: boolean;
}

export type CsvSeparator = ',' | ';' | '\t';

export interface CsvEscapeOptions {
	readonly separator: CsvSeparator;
	readonly quoteStyle: 'always' | 'minimal';
}

export type ShellDialect = 'bash' | 'powershell' | 'cmd';

export interface ShellEscapeOptions {
	readonly dialect: ShellDialect;
}

export interface FlavorOptions {
	readonly json: JsonEscapeOptions;
	readonly javascript: JsEscapeOptions;
	readonly html: HtmlEscapeOptions;
	readonly xml: XmlEscapeOptions;
	readonly csv: CsvEscapeOptions;
	readonly shell: ShellEscapeOptions;
}

export const DEFAULT_FLAVOR_OPTIONS: FlavorOptions = {
	json: { escapeUnicode: false, preserveForwardSlash: true },
	javascript: { quoteStyle: 'single', escapeUnicode: false },
	html: { entityForm: 'named', encodeNonAscii: false },
	xml: { amp: true, lt: true, gt: true, quot: true, apos: true },
	csv: { separator: ',', quoteStyle: 'minimal' },
	shell: { dialect: 'bash' },
};

export interface EscapedSegment {
	readonly text: string;
	readonly changed: boolean;
}

const concatSegments = (segments: readonly EscapedSegment[]): string =>
	segments.map((seg) => seg.text).join('');

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

const toHexCodePoint = (code: number, width: number): string =>
	code.toString(16).toUpperCase().padStart(width, '0');

const escapeJsonChar = (char: string, opts: JsonEscapeOptions): string | null => {
	switch (char) {
		case '\\':
			return '\\\\';
		case '"':
			return '\\"';
		case '\b':
			return '\\b';
		case '\f':
			return '\\f';
		case '\n':
			return '\\n';
		case '\r':
			return '\\r';
		case '\t':
			return '\\t';
		case '/':
			return opts.preserveForwardSlash ? null : '\\/';
		default: {
			const code = char.charCodeAt(0);
			if (code < 0x20) return `\\u${toHexCodePoint(code, 4)}`;
			if (opts.escapeUnicode && code > 0x7e) return `\\u${toHexCodePoint(code, 4)}`;
			return null;
		}
	}
};

export const escapeJsonSegments = (
	raw: string,
	opts: JsonEscapeOptions
): readonly EscapedSegment[] =>
	Array.from(raw).map((char) => {
		const escaped = escapeJsonChar(char, opts);
		return escaped === null ? { text: char, changed: false } : { text: escaped, changed: true };
	});

export const escapeJson = (raw: string, opts: JsonEscapeOptions): string =>
	concatSegments(escapeJsonSegments(raw, opts));

export const unescapeJson = (esc: string, _opts: JsonEscapeOptions): string => {
	if (!esc) return esc;
	// JSON.parse only accepts a quoted string. Strip outermost quotes if present
	// before attempting to parse so users can paste either form.
	const wrapped = esc.startsWith('"') && esc.endsWith('"') && esc.length >= 2 ? esc : `"${esc}"`;
	try {
		const parsed = JSON.parse(wrapped) as unknown;
		return typeof parsed === 'string' ? parsed : esc;
	} catch {
		return esc;
	}
};

// ---------------------------------------------------------------------------
// JavaScript
// ---------------------------------------------------------------------------

const escapeJsChar = (char: string, opts: JsEscapeOptions): string | null => {
	const quoteChar = opts.quoteStyle === 'single' ? "'" : '"';
	switch (char) {
		case '\\':
			return '\\\\';
		case '\b':
			return '\\b';
		case '\f':
			return '\\f';
		case '\n':
			return '\\n';
		case '\r':
			return '\\r';
		case '\t':
			return '\\t';
		case '\v':
			return '\\v';
		case '\0':
			return '\\0';
		default: {
			if (char === quoteChar) return `\\${char}`;
			const code = char.charCodeAt(0);
			if (code < 0x20) return `\\x${toHexCodePoint(code, 2)}`;
			if (opts.escapeUnicode && code > 0x7e) {
				if (code > 0xff) return `\\u${toHexCodePoint(code, 4)}`;
				return `\\x${toHexCodePoint(code, 2)}`;
			}
			return null;
		}
	}
};

export const escapeJsSegments = (raw: string, opts: JsEscapeOptions): readonly EscapedSegment[] =>
	Array.from(raw).map((char) => {
		const escaped = escapeJsChar(char, opts);
		return escaped === null ? { text: char, changed: false } : { text: escaped, changed: true };
	});

export const escapeJs = (raw: string, opts: JsEscapeOptions): string =>
	concatSegments(escapeJsSegments(raw, opts));

const JS_UNESCAPE_SIMPLE: Record<string, string> = {
	'\\': '\\',
	"'": "'",
	'"': '"',
	'`': '`',
	b: '\b',
	f: '\f',
	n: '\n',
	r: '\r',
	t: '\t',
	v: '\v',
	'0': '\0',
};

export const unescapeJs = (esc: string, _opts: JsEscapeOptions): string => {
	if (!esc) return esc;
	const chars = Array.from(esc);
	const out: string[] = [];
	let i = 0;
	while (i < chars.length) {
		const ch = chars[i];
		if (ch === undefined) break;
		if (ch !== '\\' || i === chars.length - 1) {
			out.push(ch);
			i += 1;
			continue;
		}
		const next = chars[i + 1];
		if (next === undefined) {
			out.push(ch);
			i += 1;
			continue;
		}
		if (next === 'x') {
			const hex = esc.slice(i + 2, i + 4);
			if (/^[0-9a-fA-F]{2}$/.test(hex)) {
				out.push(String.fromCharCode(Number.parseInt(hex, 16)));
				i += 4;
				continue;
			}
		}
		if (next === 'u') {
			if (esc[i + 2] === '{') {
				const end = esc.indexOf('}', i + 3);
				const hex = end > -1 ? esc.slice(i + 3, end) : '';
				if (/^[0-9a-fA-F]+$/.test(hex)) {
					out.push(String.fromCodePoint(Number.parseInt(hex, 16)));
					i = end + 1;
					continue;
				}
			}
			const hex = esc.slice(i + 2, i + 6);
			if (/^[0-9a-fA-F]{4}$/.test(hex)) {
				out.push(String.fromCharCode(Number.parseInt(hex, 16)));
				i += 6;
				continue;
			}
		}
		const simple = JS_UNESCAPE_SIMPLE[next];
		if (simple !== undefined) {
			out.push(simple);
			i += 2;
			continue;
		}
		// Unknown escape — preserve the trailing char (mirrors JS semantics).
		out.push(next);
		i += 2;
	}
	return out.join('');
};

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

const HTML_NAMED_ENTITIES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

const HTML_NUMERIC_ENTITIES: Record<string, string> = {
	'&': '&#38;',
	'<': '&#60;',
	'>': '&#62;',
	'"': '&#34;',
	"'": '&#39;',
};

const escapeHtmlChar = (char: string, opts: HtmlEscapeOptions): string | null => {
	const table = opts.entityForm === 'named' ? HTML_NAMED_ENTITIES : HTML_NUMERIC_ENTITIES;
	const mapped = table[char];
	if (mapped !== undefined) return mapped;
	if (!opts.encodeNonAscii) return null;
	const code = char.codePointAt(0);
	if (code !== undefined && code > 0x7e) {
		return opts.entityForm === 'named' ? `&#${code};` : `&#${code};`;
	}
	return null;
};

export const escapeHtmlSegments = (
	raw: string,
	opts: HtmlEscapeOptions
): readonly EscapedSegment[] =>
	Array.from(raw).map((char) => {
		const escaped = escapeHtmlChar(char, opts);
		return escaped === null ? { text: char, changed: false } : { text: escaped, changed: true };
	});

export const escapeHtml = (raw: string, opts: HtmlEscapeOptions): string =>
	concatSegments(escapeHtmlSegments(raw, opts));

// Common named HTML entities used for the bidirectional unescape pass.
const HTML_NAMED_DECODE: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	copy: '©',
	reg: '®',
	trade: '™',
	hellip: '…',
	mdash: '—',
	ndash: '–',
	lsquo: '‘',
	rsquo: '’',
	ldquo: '“',
	rdquo: '”',
	laquo: '«',
	raquo: '»',
	cent: '¢',
	pound: '£',
	yen: '¥',
	euro: '€',
	sect: '§',
	para: '¶',
	middot: '·',
	deg: '°',
	plusmn: '±',
	times: '×',
	divide: '÷',
};

const decodeHtmlEntity = (entity: string): string | null => {
	// Numeric: &#NN; or &#xHH;
	if (entity.startsWith('#')) {
		const isHex = entity.startsWith('#x') || entity.startsWith('#X');
		const digits = isHex ? entity.slice(2) : entity.slice(1);
		const radix = isHex ? 16 : 10;
		if (!new RegExp(isHex ? '^[0-9a-fA-F]+$' : '^[0-9]+$').test(digits)) return null;
		const code = Number.parseInt(digits, radix);
		if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return null;
		try {
			return String.fromCodePoint(code);
		} catch {
			return null;
		}
	}
	const named = HTML_NAMED_DECODE[entity];
	return named ?? null;
};

export const unescapeHtml = (esc: string, _opts: HtmlEscapeOptions): string =>
	esc.replace(/&([#a-zA-Z0-9]+);/g, (match, body: string) => {
		const decoded = decodeHtmlEntity(body);
		return decoded ?? match;
	});

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

const escapeXmlChar = (char: string, opts: XmlEscapeOptions): string | null => {
	if (char === '&' && opts.amp) return '&amp;';
	if (char === '<' && opts.lt) return '&lt;';
	if (char === '>' && opts.gt) return '&gt;';
	if (char === '"' && opts.quot) return '&quot;';
	if (char === "'" && opts.apos) return '&apos;';
	return null;
};

export const escapeXmlSegments = (raw: string, opts: XmlEscapeOptions): readonly EscapedSegment[] =>
	Array.from(raw).map((char) => {
		const escaped = escapeXmlChar(char, opts);
		return escaped === null ? { text: char, changed: false } : { text: escaped, changed: true };
	});

export const escapeXml = (raw: string, opts: XmlEscapeOptions): string =>
	concatSegments(escapeXmlSegments(raw, opts));

const XML_NAMED_DECODE: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
};

const decodeXmlEntity = (entity: string): string | null => {
	if (entity.startsWith('#')) {
		const isHex = entity.startsWith('#x') || entity.startsWith('#X');
		const digits = isHex ? entity.slice(2) : entity.slice(1);
		const radix = isHex ? 16 : 10;
		if (!new RegExp(isHex ? '^[0-9a-fA-F]+$' : '^[0-9]+$').test(digits)) return null;
		const code = Number.parseInt(digits, radix);
		if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return null;
		try {
			return String.fromCodePoint(code);
		} catch {
			return null;
		}
	}
	const named = XML_NAMED_DECODE[entity];
	return named ?? null;
};

export const unescapeXml = (esc: string, _opts: XmlEscapeOptions): string =>
	esc.replace(/&([#a-zA-Z0-9]+);/g, (match, body: string) => {
		const decoded = decodeXmlEntity(body);
		return decoded ?? match;
	});

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const csvNeedsQuoting = (raw: string, separator: CsvSeparator): boolean =>
	raw.includes('"') || raw.includes(separator) || raw.includes('\n') || raw.includes('\r');

export const escapeCsvSegments = (
	raw: string,
	opts: CsvEscapeOptions
): readonly EscapedSegment[] => {
	const mustQuote = opts.quoteStyle === 'always' || csvNeedsQuoting(raw, opts.separator);
	if (!mustQuote) {
		return [{ text: raw, changed: false }];
	}
	const segments: EscapedSegment[] = [{ text: '"', changed: true }];
	for (const char of Array.from(raw)) {
		if (char === '"') {
			segments.push({ text: '""', changed: true });
		} else {
			segments.push({ text: char, changed: false });
		}
	}
	segments.push({ text: '"', changed: true });
	return segments;
};

export const escapeCsv = (raw: string, opts: CsvEscapeOptions): string =>
	concatSegments(escapeCsvSegments(raw, opts));

export const unescapeCsv = (esc: string, _opts: CsvEscapeOptions): string => {
	if (esc.length < 2 || !esc.startsWith('"') || !esc.endsWith('"')) return esc;
	const inner = esc.slice(1, -1);
	return inner.replace(/""/g, '"');
};

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

const escapeShellBash = (raw: string): readonly EscapedSegment[] => {
	// Single-quote wrap; embedded single quotes become `'\''`.
	if (raw.length === 0) {
		return [{ text: "''", changed: true }];
	}
	const segments: EscapedSegment[] = [{ text: "'", changed: true }];
	for (const char of Array.from(raw)) {
		if (char === "'") {
			segments.push({ text: "'\\''", changed: true });
		} else {
			segments.push({ text: char, changed: false });
		}
	}
	segments.push({ text: "'", changed: true });
	return segments;
};

const escapeShellPowershell = (raw: string): readonly EscapedSegment[] => {
	// Single-quote wrap; embedded single quotes are doubled.
	if (raw.length === 0) {
		return [{ text: "''", changed: true }];
	}
	const segments: EscapedSegment[] = [{ text: "'", changed: true }];
	for (const char of Array.from(raw)) {
		if (char === "'") {
			segments.push({ text: "''", changed: true });
		} else {
			segments.push({ text: char, changed: false });
		}
	}
	segments.push({ text: "'", changed: true });
	return segments;
};

const CMD_SPECIAL = new Set(['^', '&', '|', '<', '>', '(', ')', '%', '!', '"']);

const escapeShellCmd = (raw: string): readonly EscapedSegment[] => {
	// Wrap in double quotes; escape `"` and special chars with `^`.
	if (raw.length === 0) {
		return [{ text: '""', changed: true }];
	}
	const segments: EscapedSegment[] = [{ text: '"', changed: true }];
	for (const char of Array.from(raw)) {
		if (char === '"') {
			segments.push({ text: '\\"', changed: true });
			continue;
		}
		if (CMD_SPECIAL.has(char)) {
			segments.push({ text: `^${char}`, changed: true });
			continue;
		}
		segments.push({ text: char, changed: false });
	}
	segments.push({ text: '"', changed: true });
	return segments;
};

export const escapeShellSegments = (
	raw: string,
	opts: ShellEscapeOptions
): readonly EscapedSegment[] => {
	switch (opts.dialect) {
		case 'powershell':
			return escapeShellPowershell(raw);
		case 'cmd':
			return escapeShellCmd(raw);
		default:
			return escapeShellBash(raw);
	}
};

export const escapeShell = (raw: string, opts: ShellEscapeOptions): string =>
	concatSegments(escapeShellSegments(raw, opts));

const unescapeShellBash = (esc: string): string => {
	if (esc.length < 2 || !esc.startsWith("'") || !esc.endsWith("'")) return esc;
	// Reverse the `'\''` -> `'` sequence used by the bash escaper, then drop
	// the outer quotes.
	return esc.slice(1, -1).replace(/'\\''/g, "'");
};

const unescapeShellPowershell = (esc: string): string => {
	if (esc.length < 2 || !esc.startsWith("'") || !esc.endsWith("'")) return esc;
	return esc.slice(1, -1).replace(/''/g, "'");
};

const unescapeShellCmd = (esc: string): string => {
	if (esc.length < 2 || !esc.startsWith('"') || !esc.endsWith('"')) return esc;
	const inner = esc.slice(1, -1);
	const chars = Array.from(inner);
	const out: string[] = [];
	let i = 0;
	while (i < chars.length) {
		const ch = chars[i];
		if (ch === undefined) break;
		const next = chars[i + 1];
		if (ch === '\\' && next === '"') {
			out.push('"');
			i += 2;
			continue;
		}
		if (ch === '^' && next !== undefined && CMD_SPECIAL.has(next)) {
			out.push(next);
			i += 2;
			continue;
		}
		out.push(ch);
		i += 1;
	}
	return out.join('');
};

export const unescapeShell = (esc: string, opts: ShellEscapeOptions): string => {
	switch (opts.dialect) {
		case 'powershell':
			return unescapeShellPowershell(esc);
		case 'cmd':
			return unescapeShellCmd(esc);
		default:
			return unescapeShellBash(esc);
	}
};

// ---------------------------------------------------------------------------
// Dispatchers
// ---------------------------------------------------------------------------

export const escapeSegmentsByFlavor = (
	flavor: EscapeFlavor,
	raw: string,
	opts: FlavorOptions
): readonly EscapedSegment[] => {
	switch (flavor) {
		case 'json':
			return escapeJsonSegments(raw, opts.json);
		case 'javascript':
			return escapeJsSegments(raw, opts.javascript);
		case 'html':
			return escapeHtmlSegments(raw, opts.html);
		case 'xml':
			return escapeXmlSegments(raw, opts.xml);
		case 'csv':
			return escapeCsvSegments(raw, opts.csv);
		case 'shell':
			return escapeShellSegments(raw, opts.shell);
	}
};

export const escapeByFlavor = (flavor: EscapeFlavor, raw: string, opts: FlavorOptions): string =>
	concatSegments(escapeSegmentsByFlavor(flavor, raw, opts));

export const unescapeByFlavor = (
	flavor: EscapeFlavor,
	esc: string,
	opts: FlavorOptions
): string => {
	switch (flavor) {
		case 'json':
			return unescapeJson(esc, opts.json);
		case 'javascript':
			return unescapeJs(esc, opts.javascript);
		case 'html':
			return unescapeHtml(esc, opts.html);
		case 'xml':
			return unescapeXml(esc, opts.xml);
		case 'csv':
			return unescapeCsv(esc, opts.csv);
		case 'shell':
			return unescapeShell(esc, opts.shell);
	}
};

// ---------------------------------------------------------------------------
// Samples
// ---------------------------------------------------------------------------

export interface FlavorSample {
	readonly raw: string;
	readonly escaped: string;
}

export const SAMPLES: Record<EscapeFlavor, FlavorSample> = {
	json: {
		raw: `Hello "world"
New line	tab`,
		escaped: '"Hello \\"world\\"\\nNew line\\ttab"',
	},
	javascript: {
		raw: `She's "here"
on a new line`,
		escaped: "'She\\'s \"here\"\\non a new line'",
	},
	html: {
		raw: '<a href="x">A & B</a>',
		escaped: '&lt;a href=&quot;x&quot;&gt;A &amp; B&lt;/a&gt;',
	},
	xml: {
		raw: `<x attr="v">A & B's</x>`,
		escaped: '&lt;x attr=&quot;v&quot;&gt;A &amp; B&apos;s&lt;/x&gt;',
	},
	csv: {
		raw: `hello,"world"
row 2`,
		escaped: `"hello,""world""
row 2"`,
	},
	shell: {
		raw: "echo 'hi $USER'",
		escaped: "'echo '\\''hi $USER'\\'''",
	},
};

export const FLAVOR_LABELS: Record<EscapeFlavor, string> = {
	json: 'JSON string',
	javascript: 'JavaScript string',
	html: 'HTML entities',
	xml: 'XML entities',
	csv: 'CSV cell',
	shell: 'Shell argument',
};

export const FLAVOR_DESCRIPTIONS: Record<EscapeFlavor, string> = {
	json: 'Escape characters so the result is a valid JSON string literal — backslash, quote, control characters, and optionally non-ASCII.',
	javascript:
		'Escape characters so the result is a valid JavaScript string literal — backslash, the active quote character, and control characters.',
	html: 'Convert HTML markup characters into named or numeric entities so they render as text instead of markup.',
	xml: 'Convert XML markup characters into entity references. Each entity can be toggled individually.',
	csv: 'Wrap fields containing separators, quotes, or newlines in double quotes; embedded quotes are doubled.',
	shell: 'Quote and escape a shell argument so it survives parsing by the chosen shell dialect.',
};
