/**
 * Regex visualization helpers.
 * Parses a pattern with `regexp-tree` and produces a flat structural
 * tree the page can render as nested cards / badges.
 */

import { parse } from 'regexp-tree';
import { getErrorMessage } from '@/lib/utils';

export type Result<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: string };

export type VizNodeKind =
	| 'sequence'
	| 'alternation'
	| 'group'
	| 'capture-group'
	| 'named-group'
	| 'non-capture-group'
	| 'lookahead'
	| 'lookbehind'
	| 'negative-lookahead'
	| 'negative-lookbehind'
	| 'repetition'
	| 'char'
	| 'char-class'
	| 'meta'
	| 'anchor'
	| 'backreference'
	| 'unknown';

export interface QuantifierInfo {
	readonly min: number;
	readonly max: number | null;
	readonly greedy: boolean;
}

export interface VizNode {
	readonly kind: VizNodeKind;
	readonly label: string;
	readonly detail?: string;
	readonly children: readonly VizNode[];
	readonly groupNumber?: number;
	readonly groupName?: string;
	readonly quantifier?: QuantifierInfo;
}

const groupKind = (node: { capturing?: boolean; name?: string; kind?: string }): VizNodeKind => {
	if (node.kind === 'Lookahead') return 'lookahead';
	if (node.kind === 'NegativeLookahead') return 'negative-lookahead';
	if (node.kind === 'Lookbehind') return 'lookbehind';
	if (node.kind === 'NegativeLookbehind') return 'negative-lookbehind';
	if (node.name) return 'named-group';
	if (node.capturing) return 'capture-group';
	return 'non-capture-group';
};

const charLabel = (raw: { kind: string; value: string; codePoint?: number }): string => {
	if (raw.kind === 'meta') return raw.value;
	if (raw.kind === 'control') return raw.value;
	if (raw.value === ' ') return '⎵ space';
	if (raw.value === '\t') return '\\t tab';
	if (raw.value === '\n') return '\\n LF';
	if (raw.value === '\r') return '\\r CR';
	return raw.value;
};

const charKind = (raw: { kind: string; value: string }): VizNodeKind => {
	if (raw.kind === 'meta') return 'meta';
	if (raw.kind === 'control') return 'meta';
	return 'char';
};

const assertionLabel = (kind: string): string => {
	if (kind === '^') return '^ start';
	if (kind === '$') return '$ end';
	if (kind === '\\b') return '\\b boundary';
	if (kind === '\\B') return '\\B non-boundary';
	return kind;
};

const repetitionLabel = (q: {
	kind: string;
	from?: number;
	to?: number;
	greedy: boolean;
}): string => {
	const greedy = q.greedy ? '' : ' (lazy)';
	if (q.kind === '*') return `0 or more${greedy}`;
	if (q.kind === '+') return `1 or more${greedy}`;
	if (q.kind === '?') return `0 or 1${greedy}`;
	if (q.kind === 'Range') {
		if (q.to === undefined) return `${q.from}+ times${greedy}`;
		if (q.from === q.to) return `${q.from} times${greedy}`;
		return `${q.from}-${q.to} times${greedy}`;
	}
	return q.kind;
};

const repetitionInfo = (q: {
	kind: string;
	from?: number;
	to?: number;
	greedy: boolean;
}): QuantifierInfo => {
	if (q.kind === '*') return { min: 0, max: null, greedy: q.greedy };
	if (q.kind === '+') return { min: 1, max: null, greedy: q.greedy };
	if (q.kind === '?') return { min: 0, max: 1, greedy: q.greedy };
	if (q.kind === 'Range') {
		const min = q.from ?? 0;
		const max = q.to ?? null;
		return { min, max, greedy: q.greedy };
	}
	return { min: 1, max: 1, greedy: q.greedy };
};

const characterClassLabel = (node: {
	negative: boolean;
	expressions?: readonly unknown[];
}): string => {
	const negate = node.negative ? '^' : '';
	const inner = (node.expressions ?? []).map((expr) => characterClassExpr(expr)).join('');
	return `[${negate}${inner}]`;
};

const characterClassExpr = (expr: unknown): string => {
	if (typeof expr !== 'object' || expr === null) return '';
	const e = expr as {
		type: string;
		value?: string;
		from?: { value: string };
		to?: { value: string };
	};
	if (e.type === 'Char' && e.value !== undefined) return e.value;
	if (e.type === 'ClassRange' && e.from && e.to) return `${e.from.value}-${e.to.value}`;
	return '';
};

// biome-ignore lint/suspicious/noExplicitAny: regexp-tree exposes a recursive AST without exported types.
const buildVizNode = (node: any): VizNode => {
	if (!node || typeof node !== 'object') return { kind: 'unknown', label: '?', children: [] };
	const type = node.type as string;
	if (type === 'RegExp') return buildVizNode(node.body);
	if (type === 'Alternative') {
		const expressions = (node.expressions ?? []) as unknown[];
		if (expressions.length === 0) {
			return { kind: 'sequence', label: 'empty', children: [] };
		}
		if (expressions.length === 1) return buildVizNode(expressions[0]);
		return {
			kind: 'sequence',
			label: 'sequence',
			detail: `${expressions.length} elements`,
			children: expressions.map(buildVizNode),
		};
	}
	if (type === 'Disjunction') {
		return {
			kind: 'alternation',
			label: 'alternation',
			detail: 'matches either branch',
			children: [buildVizNode(node.left), buildVizNode(node.right)],
		};
	}
	if (type === 'Group') {
		const kind = groupKind(node);
		const labelMap: Record<VizNodeKind, string> = {
			sequence: 'group',
			alternation: 'group',
			group: 'group',
			'capture-group': 'capture group',
			'named-group': `named group: ${node.name ?? ''}`,
			'non-capture-group': 'non-capturing group',
			lookahead: 'lookahead (?=)',
			lookbehind: 'lookbehind (?<=)',
			'negative-lookahead': 'negative lookahead (?!)',
			'negative-lookbehind': 'negative lookbehind (?<!)',
			repetition: 'repetition',
			char: 'char',
			'char-class': 'char-class',
			meta: 'meta',
			anchor: 'anchor',
			backreference: 'backreference',
			unknown: 'unknown',
		};
		return {
			kind,
			label: labelMap[kind],
			detail: node.number !== undefined ? `#${node.number}` : undefined,
			children: [buildVizNode(node.expression)],
			groupNumber: typeof node.number === 'number' ? node.number : undefined,
			groupName: typeof node.name === 'string' ? node.name : undefined,
		};
	}
	if (type === 'Repetition') {
		return {
			kind: 'repetition',
			label: repetitionLabel(node.quantifier),
			children: [buildVizNode(node.expression)],
			quantifier: repetitionInfo(node.quantifier),
		};
	}
	if (type === 'Char') {
		return {
			kind: charKind(node),
			label: charLabel(node),
			children: [],
		};
	}
	if (type === 'CharacterClass') {
		return {
			kind: 'char-class',
			label: characterClassLabel(node),
			detail: node.negative ? 'negated' : undefined,
			children: [],
		};
	}
	if (type === 'Assertion') {
		const kind = node.kind as string;
		if (
			kind === 'Lookahead' ||
			kind === 'NegativeLookahead' ||
			kind === 'Lookbehind' ||
			kind === 'NegativeLookbehind'
		) {
			const map: Record<string, VizNodeKind> = {
				Lookahead: 'lookahead',
				NegativeLookahead: 'negative-lookahead',
				Lookbehind: 'lookbehind',
				NegativeLookbehind: 'negative-lookbehind',
			};
			return {
				kind: map[kind] ?? 'group',
				label: kind,
				children: node.assertion ? [buildVizNode(node.assertion)] : [],
			};
		}
		return {
			kind: 'anchor',
			label: assertionLabel(kind),
			children: [],
		};
	}
	if (type === 'Backreference') {
		const ref = node.reference !== undefined ? `\\${node.reference}` : `(${node.kind})`;
		return {
			kind: 'backreference',
			label: `backreference ${ref}`,
			children: [],
		};
	}
	return {
		kind: 'unknown',
		label: type ?? 'unknown',
		detail: JSON.stringify(node).slice(0, 40),
		children: [],
	};
};

// `regexp-tree.parse` accepts either a `/pattern/flags` literal string or a
// real RegExp instance. Building a RegExp first sidesteps the literal's
// forward-slash escaping rule, so patterns like `https?://...` parse cleanly.
export const visualizeRegex = (pattern: string, flagString: string): Result<VizNode> => {
	if (pattern.length === 0) return { ok: false, error: 'Empty pattern' };
	try {
		const re = new RegExp(pattern, flagString);
		const ast = parse(re);
		return { ok: true, value: buildVizNode(ast) };
	} catch (e) {
		return { ok: false, error: getErrorMessage(e) };
	}
};
