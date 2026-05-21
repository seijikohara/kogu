/**
 * Railroad diagram layout engine for regex visualization.
 *
 * Converts a `VizNode` tree (from regex-viz.ts) into a positioned
 * `RailroadNode` tree that a Svelte renderer can walk to emit SVG.
 * Layout is conventional railroad geometry:
 *
 * - Each laid-out node exposes its bounding box (width, height) and the
 *   Y-coordinate of its entry and exit rails. Parents place children on a
 *   shared horizontal rail by aligning `entryY` / `exitY`.
 * - Sequences place children left-to-right, padding each gap with a
 *   straight rail segment.
 * - Choices stack all branches vertically. The first branch sits on the
 *   centerline; subsequent branches fan downward with a curved diverge
 *   at the left and converge at the right.
 * - Quantifiers wrap a child with a loop arc beneath (for `*` and `+`)
 *   and a skip arc above (for `*` and `?`).
 * - Groups wrap a child in a titled bordered box.
 *
 * The engine is pure: input `VizNode` -> output `RailroadDiagram`. No DOM,
 * no SVG strings; the consumer walks the tree itself.
 */

import type { VizNode } from './regex-viz.js';

const BOX_HEIGHT = 26;
const CHAR_WIDTH = 7.2;
const MIN_BOX_WIDTH = 32;
const BOX_PADDING_X = 10;
const SEQUENCE_GAP = 14;
const CHOICE_VERT_GAP = 10;
const CHOICE_DIVERGE = 18;
const GROUP_PAD_X = 14;
const GROUP_PAD_Y_TOP = 22;
const GROUP_PAD_Y_BOTTOM = 10;
const LOOP_ARC = 10;
const LOOP_VERT = 14;
const SKIP_ARC = 10;
const SKIP_VERT = 14;
const QUANT_LABEL_HEIGHT = 12;
const DIAGRAM_PAD = 12;

export type TerminalKind = 'char' | 'char-class' | 'meta' | 'anchor' | 'backreference' | 'unknown';

export type RailroadNode = TerminalNode | SequenceNode | ChoiceNode | GroupNode | QuantifierNode;

export interface BaseNode {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly entryY: number;
	readonly exitY: number;
}

export interface TerminalNode extends BaseNode {
	readonly kind: 'terminal';
	readonly label: string;
	readonly nodeKind: TerminalKind;
}

export interface SequenceNode extends BaseNode {
	readonly kind: 'sequence';
	readonly children: readonly RailroadNode[];
}

export interface ChoiceNode extends BaseNode {
	readonly kind: 'choice';
	readonly children: readonly RailroadNode[];
}

export type GroupVariant =
	| 'capture'
	| 'named'
	| 'non-capture'
	| 'lookahead'
	| 'lookbehind'
	| 'negative-lookahead'
	| 'negative-lookbehind';

export interface GroupNode extends BaseNode {
	readonly kind: 'group';
	readonly child: RailroadNode;
	readonly title: string;
	readonly variant: GroupVariant;
	readonly groupNumber?: number;
}

export interface QuantifierNode extends BaseNode {
	readonly kind: 'quantifier';
	readonly child: RailroadNode;
	readonly label: string;
	readonly min: number;
	readonly max: number | null;
	readonly greedy: boolean;
}

export interface RailroadDiagram {
	readonly width: number;
	readonly height: number;
	readonly root: RailroadNode;
}

interface SizedNode {
	readonly width: number;
	readonly up: number;
	readonly down: number;
}

const EMPTY_VIZ_NODE: VizNode = { kind: 'unknown', label: '?', children: [] };
const FALLBACK_SIZED: SizedNode = {
	width: MIN_BOX_WIDTH,
	up: BOX_HEIGHT / 2,
	down: BOX_HEIGHT / 2,
};

const measureLabel = (label: string): number =>
	Math.max(MIN_BOX_WIDTH, Math.ceil(label.length * CHAR_WIDTH) + BOX_PADDING_X * 2);

const flattenChoice = (node: VizNode): readonly VizNode[] => {
	if (node.kind !== 'alternation') return [node];
	return node.children.flatMap(flattenChoice);
};

const groupVariant = (kind: VizNode['kind']): GroupVariant | null => {
	if (kind === 'capture-group') return 'capture';
	if (kind === 'named-group') return 'named';
	if (kind === 'non-capture-group') return 'non-capture';
	if (kind === 'lookahead') return 'lookahead';
	if (kind === 'lookbehind') return 'lookbehind';
	if (kind === 'negative-lookahead') return 'negative-lookahead';
	if (kind === 'negative-lookbehind') return 'negative-lookbehind';
	if (kind === 'group') return 'non-capture';
	return null;
};

const groupTitle = (node: VizNode, variant: GroupVariant): string => {
	if (variant === 'capture')
		return node.groupNumber !== undefined ? `Group #${node.groupNumber}` : 'group';
	if (variant === 'named') return node.groupName ? `<${node.groupName}>` : 'named group';
	if (variant === 'non-capture') return '(?:…)';
	if (variant === 'lookahead') return '(?=…)';
	if (variant === 'lookbehind') return '(?<=…)';
	if (variant === 'negative-lookahead') return '(?!…)';
	if (variant === 'negative-lookbehind') return '(?<!…)';
	return 'group';
};

const terminalKind = (kind: VizNode['kind']): TerminalKind => {
	if (kind === 'char') return 'char';
	if (kind === 'char-class') return 'char-class';
	if (kind === 'meta') return 'meta';
	if (kind === 'anchor') return 'anchor';
	if (kind === 'backreference') return 'backreference';
	return 'unknown';
};

const isTerminalKind = (kind: VizNode['kind']): boolean =>
	kind === 'char' ||
	kind === 'char-class' ||
	kind === 'meta' ||
	kind === 'anchor' ||
	kind === 'backreference' ||
	kind === 'unknown';

const measure = (node: VizNode): SizedNode => {
	if (isTerminalKind(node.kind)) {
		const w = measureLabel(node.label);
		return { width: w, up: BOX_HEIGHT / 2, down: BOX_HEIGHT / 2 };
	}

	if (node.kind === 'sequence') {
		const measured = node.children.map(measure);
		if (measured.length === 0) {
			return { width: MIN_BOX_WIDTH, up: BOX_HEIGHT / 2, down: BOX_HEIGHT / 2 };
		}
		const width =
			measured.reduce((sum, m) => sum + m.width, 0) + SEQUENCE_GAP * (measured.length - 1);
		const up = Math.max(...measured.map((m) => m.up));
		const down = Math.max(...measured.map((m) => m.down));
		return { width, up, down };
	}

	if (node.kind === 'alternation') {
		const branches = flattenChoice(node).map(measure);
		const [first, ...rest] = branches;
		if (!first) return FALLBACK_SIZED;
		const innerWidth = Math.max(...branches.map((b) => b.width));
		const width = innerWidth + CHOICE_DIVERGE * 2;
		const up = first.up;
		const restHeight = rest.reduce((sum, b) => sum + CHOICE_VERT_GAP + b.up + b.down, 0);
		const down = first.down + restHeight;
		return { width, up, down };
	}

	if (node.kind === 'repetition') {
		const innerNode = node.children[0] ?? EMPTY_VIZ_NODE;
		const inner = measure(innerNode);
		const q = node.quantifier;
		const min = q?.min ?? 1;
		const max = q?.max ?? null;
		const hasLoop = max === null || max > 1;
		const hasSkip = min === 0;
		const width = inner.width + LOOP_ARC * 2;
		const up = inner.up + (hasSkip ? SKIP_VERT + SKIP_ARC : 0);
		const down =
			inner.down + (hasLoop ? LOOP_VERT + LOOP_ARC + QUANT_LABEL_HEIGHT : QUANT_LABEL_HEIGHT);
		return { width, up, down };
	}

	const variant = groupVariant(node.kind);
	if (variant) {
		const innerNode = node.children[0] ?? EMPTY_VIZ_NODE;
		const inner = measure(innerNode);
		const width = inner.width + GROUP_PAD_X * 2;
		const up = inner.up + GROUP_PAD_Y_TOP;
		const down = inner.down + GROUP_PAD_Y_BOTTOM;
		return { width, up, down };
	}

	const w = measureLabel(node.label);
	return { width: w, up: BOX_HEIGHT / 2, down: BOX_HEIGHT / 2 };
};

const layoutNode = (node: VizNode, x: number, entryY: number): RailroadNode => {
	if (isTerminalKind(node.kind)) {
		const w = measureLabel(node.label);
		return {
			kind: 'terminal',
			x,
			y: entryY - BOX_HEIGHT / 2,
			width: w,
			height: BOX_HEIGHT,
			entryY,
			exitY: entryY,
			label: node.label,
			nodeKind: terminalKind(node.kind),
		};
	}

	if (node.kind === 'sequence') {
		if (node.children.length === 0) {
			return layoutNode(EMPTY_VIZ_NODE, x, entryY);
		}
		// Lay out children left-to-right, threading the running x position
		// through a reduce so neither the cursor nor the accumulator needs let.
		const layout = node.children.reduce<{ children: RailroadNode[]; cursorX: number }>(
			(acc, childNode) => {
				const child = layoutNode(childNode, acc.cursorX, entryY);
				return {
					children: [...acc.children, child],
					cursorX: child.x + child.width + SEQUENCE_GAP,
				};
			},
			{ children: [], cursorX: x }
		);
		const { children, cursorX } = layout;
		const totalWidth = cursorX - x - SEQUENCE_GAP;
		const ups = children.map((c) => c.entryY - c.y);
		const downs = children.map((c) => c.y + c.height - c.exitY);
		const up = ups.reduce((a, b) => Math.max(a, b), BOX_HEIGHT / 2);
		const down = downs.reduce((a, b) => Math.max(a, b), BOX_HEIGHT / 2);
		return {
			kind: 'sequence',
			x,
			y: entryY - up,
			width: totalWidth,
			height: up + down,
			entryY,
			exitY: entryY,
			children,
		};
	}

	if (node.kind === 'alternation') {
		const branches = flattenChoice(node);
		const sized = branches.map(measure);
		const [firstBranch, ...restBranches] = branches;
		const [firstSized, ...restSized] = sized;
		if (!firstBranch || !firstSized) {
			return layoutNode(EMPTY_VIZ_NODE, x, entryY);
		}
		const innerWidth = sized.reduce((acc, s) => Math.max(acc, s.width), 0);
		const totalWidth = innerWidth + CHOICE_DIVERGE * 2;
		const firstChildX = x + CHOICE_DIVERGE + (innerWidth - firstSized.width) / 2;
		const firstChild = layoutNode(firstBranch, firstChildX, entryY);
		const initialCursorY = entryY + firstSized.down + CHOICE_VERT_GAP;
		// Place remaining branches top-to-bottom, threading the running y
		// position through a reduce so the cursor avoids `let`.
		const restLayout = restBranches.reduce<{ children: RailroadNode[]; cursorY: number }>(
			(acc, branch, i) => {
				const s = restSized[i];
				if (!branch || !s) return acc;
				const childEntryY = acc.cursorY + s.up;
				const childX = x + CHOICE_DIVERGE + (innerWidth - s.width) / 2;
				return {
					children: [...acc.children, layoutNode(branch, childX, childEntryY)],
					cursorY: childEntryY + s.down + CHOICE_VERT_GAP,
				};
			},
			{ children: [], cursorY: initialCursorY }
		);
		const children: RailroadNode[] = [firstChild, ...restLayout.children];
		const up = firstSized.up;
		const down = restLayout.cursorY - entryY - CHOICE_VERT_GAP;
		return {
			kind: 'choice',
			x,
			y: entryY - up,
			width: totalWidth,
			height: up + down,
			entryY,
			exitY: entryY,
			children,
		};
	}

	if (node.kind === 'repetition') {
		const childNode = node.children[0] ?? EMPTY_VIZ_NODE;
		const innerSized = measure(childNode);
		const q = node.quantifier;
		const min = q?.min ?? 1;
		const max = q?.max ?? null;
		const hasSkip = min === 0;
		const innerEntryY = entryY;
		const child = layoutNode(childNode, x + LOOP_ARC, innerEntryY);
		const totalWidth = innerSized.width + LOOP_ARC * 2;
		const up = innerSized.up + (hasSkip ? SKIP_VERT + SKIP_ARC : 0);
		const down = innerSized.down + LOOP_VERT + LOOP_ARC + QUANT_LABEL_HEIGHT;
		return {
			kind: 'quantifier',
			x,
			y: entryY - up,
			width: totalWidth,
			height: up + down,
			entryY,
			exitY: entryY,
			child,
			label: node.label,
			min,
			max,
			greedy: q?.greedy ?? true,
		};
	}

	const variant = groupVariant(node.kind);
	if (variant) {
		const childNode = node.children[0] ?? EMPTY_VIZ_NODE;
		const innerSized = measure(childNode);
		const child = layoutNode(childNode, x + GROUP_PAD_X, entryY);
		const totalWidth = innerSized.width + GROUP_PAD_X * 2;
		const up = innerSized.up + GROUP_PAD_Y_TOP;
		const down = innerSized.down + GROUP_PAD_Y_BOTTOM;
		return {
			kind: 'group',
			x,
			y: entryY - up,
			width: totalWidth,
			height: up + down,
			entryY,
			exitY: entryY,
			child,
			title: groupTitle(node, variant),
			variant,
			groupNumber: node.groupNumber,
		};
	}

	return layoutNode({ kind: 'unknown', label: node.label, children: [] }, x, entryY);
};

export const layoutRailroad = (node: VizNode): RailroadDiagram => {
	const sized = measure(node);
	const entryY = DIAGRAM_PAD + sized.up;
	const root = layoutNode(node, DIAGRAM_PAD, entryY);
	const width = root.width + DIAGRAM_PAD * 2;
	const height = sized.up + sized.down + DIAGRAM_PAD * 2;
	return { width, height, root };
};

export const RAIL_CONSTANTS = {
	BOX_HEIGHT,
	SEQUENCE_GAP,
	CHOICE_DIVERGE,
	LOOP_ARC,
	LOOP_VERT,
	SKIP_ARC,
	SKIP_VERT,
	GROUP_PAD_X,
	GROUP_PAD_Y_TOP,
	GROUP_PAD_Y_BOTTOM,
	QUANT_LABEL_HEIGHT,
	DIAGRAM_PAD,
} as const;
