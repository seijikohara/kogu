/**
 * Lightweight regex syntax tokenizer for the pattern editor.
 * Emits a flat list of tokens classified by role; the editor renders
 * each as a colored span behind a transparent textarea.
 * Capture groups are numbered so the editor can mirror the global
 * group-color palette.
 */

import { groupColor } from './regex-design.js';

export type TokenKind =
	| 'group-open'
	| 'group-close'
	| 'group-meta'
	| 'char-class'
	| 'quantifier'
	| 'anchor'
	| 'escape'
	| 'alternation'
	| 'literal';

export interface Token {
	readonly kind: TokenKind;
	readonly text: string;
	readonly groupIndex?: number;
}

const ANCHOR_ESCAPES = new Set(['\\b', '\\B', '\\A', '\\Z', '\\z']);

const isQuantifierStart = (input: string, i: number): boolean => {
	const c = input[i];
	if (c === '*' || c === '+' || c === '?') return true;
	if (c === '{') {
		// Look ahead for `{n}`, `{n,}`, or `{n,m}`.
		const close = input.indexOf('}', i);
		if (close === -1) return false;
		const body = input.slice(i + 1, close);
		return /^\d+(,\d*)?$/.test(body);
	}
	return false;
};

const readQuantifier = (input: string, i: number): string => {
	const c = input[i];
	if (c === '*' || c === '+' || c === '?') {
		const next = input[i + 1];
		return next === '?' || next === '+' ? input.slice(i, i + 2) : (c ?? '');
	}
	// `{...}` form
	const close = input.indexOf('}', i);
	const base = input.slice(i, close + 1);
	const next = input[close + 1];
	return next === '?' ? `${base}?` : base;
};

const readGroupHeader = (input: string, i: number): { text: string; isCapturing: boolean } => {
	// We've just consumed `(`. Inspect what's right after.
	const rest = input.slice(i);
	// (?:  (?=  (?!  (?<=  (?<!  (?<name>  (?i:  (?P<name>
	const m = rest.match(/^\((\?(?::|=|!|<=|<!|<[^>]*>|P<[^>]*>|[imsx]+:|))/);
	if (!m) return { text: '(', isCapturing: true };
	const captured = m[0];
	// Capturing if `(?<name>` (no `=`/`!`/`P`) or just `(`.
	const isNamed = /^\(\?<[^=!][^>]*>$/.test(captured);
	const isLegacyNamed = /^\(\?P<[^>]*>$/.test(captured);
	const isCapturing = isNamed || isLegacyNamed;
	return { text: captured, isCapturing };
};

const readCharClass = (input: string, i: number): string => {
	// `[`...`]` with `\]` escape support. The scan position is tracked via a
	// const cursor object so the inner walk does not need a `let`.
	const cursor = { j: i + 1 };
	if (input[cursor.j] === '^') cursor.j += 1;
	// A `]` immediately after `[` or `[^` is literal.
	if (input[cursor.j] === ']') cursor.j += 1;
	while (cursor.j < input.length && input[cursor.j] !== ']') {
		cursor.j += input[cursor.j] === '\\' && cursor.j + 1 < input.length ? 2 : 1;
	}
	return input.slice(i, Math.min(cursor.j + 1, input.length));
};

export const tokenizeRegex = (pattern: string): readonly Token[] => {
	// Sequential scanner: the cursor (position + capture counter) lives in a
	// const holder object, and the output token list / capturing-group stack
	// are const arrays mutated in place. No `let` bindings needed.
	const out: Token[] = [];
	const groupStack: number[] = [];
	const cursor = { i: 0, captureCount: 0 };
	while (cursor.i < pattern.length) {
		const c = pattern[cursor.i] ?? '';
		// Escape sequence
		if (c === '\\') {
			const pair = pattern.slice(cursor.i, cursor.i + 2);
			if (ANCHOR_ESCAPES.has(pair)) {
				out.push({ kind: 'anchor', text: pair });
			} else if (pair === '\\') {
				out.push({ kind: 'literal', text: pair });
			} else {
				out.push({ kind: 'escape', text: pair });
			}
			cursor.i += 2;
			continue;
		}
		// Anchor
		if (c === '^' || c === '$') {
			out.push({ kind: 'anchor', text: c });
			cursor.i += 1;
			continue;
		}
		// Alternation
		if (c === '|') {
			out.push({ kind: 'alternation', text: c });
			cursor.i += 1;
			continue;
		}
		// Group open
		if (c === '(') {
			const header = readGroupHeader(pattern, cursor.i);
			const groupIndex = header.isCapturing ? cursor.captureCount + 1 : undefined;
			if (header.isCapturing) cursor.captureCount += 1;
			groupStack.push(groupIndex ?? 0);
			if (header.text === '(') {
				out.push({ kind: 'group-open', text: '(', groupIndex });
			} else {
				out.push({ kind: 'group-open', text: '(', groupIndex });
				out.push({ kind: 'group-meta', text: header.text.slice(1) });
			}
			cursor.i += header.text.length;
			continue;
		}
		// Group close
		if (c === ')') {
			const groupIndex = groupStack.pop() ?? 0;
			out.push({ kind: 'group-close', text: ')', groupIndex });
			cursor.i += 1;
			continue;
		}
		// Char class
		if (c === '[') {
			const text = readCharClass(pattern, cursor.i);
			out.push({ kind: 'char-class', text });
			cursor.i += text.length;
			continue;
		}
		// Quantifier
		if (isQuantifierStart(pattern, cursor.i)) {
			const text = readQuantifier(pattern, cursor.i);
			out.push({ kind: 'quantifier', text });
			cursor.i += text.length;
			continue;
		}
		// Literal character
		out.push({ kind: 'literal', text: c });
		cursor.i += 1;
	}
	return out;
};

const escapeHtml = (value: string): string =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const renderHighlight = (pattern: string): string => {
	const tokens = tokenizeRegex(pattern);
	const parts = tokens.map((token) => {
		const html = escapeHtml(token.text);
		if (token.kind === 'literal') return `<span>${html}</span>`;
		if (token.kind === 'group-open' || token.kind === 'group-close') {
			if (token.groupIndex && token.groupIndex > 0) {
				const palette = groupColor(token.groupIndex);
				return `<span class="font-bold ${palette.text}">${html}</span>`;
			}
			return `<span class="text-muted-foreground">${html}</span>`;
		}
		const kindClass: Record<TokenKind, string> = {
			'group-open': '',
			'group-close': '',
			'group-meta': 'text-muted-foreground',
			'char-class': 'text-amber-500',
			quantifier: 'text-violet-500',
			anchor: 'text-yellow-500 font-semibold',
			escape: 'text-cyan-500',
			alternation: 'text-yellow-500 font-semibold',
			literal: '',
		};
		return `<span class="${kindClass[token.kind]}">${html}</span>`;
	});
	return parts.join('');
};
