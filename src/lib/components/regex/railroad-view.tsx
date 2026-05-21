import { useMemo } from 'react';

import {
	type ChoiceNode,
	type GroupNode,
	layoutRailroad,
	type QuantifierNode,
	RAIL_CONSTANTS,
	type RailroadNode,
	type SequenceNode,
	type TerminalKind,
	type TerminalNode,
} from '@/lib/services/regex-railroad.js';
import type { VizNode } from '@/lib/services/regex-viz.js';

interface RailroadViewProps {
	readonly node: VizNode;
}

interface Tone {
	readonly fill: string;
	readonly stroke: string;
	readonly text: string;
}

const TERMINAL_TONE: Record<TerminalKind, Tone> = {
	char: { fill: 'fill-card', stroke: 'stroke-border', text: 'fill-foreground' },
	'char-class': {
		fill: 'fill-info/10',
		stroke: 'stroke-info/40',
		text: 'fill-info',
	},
	meta: {
		fill: 'fill-violet-500/10',
		stroke: 'stroke-violet-500/40',
		text: 'fill-violet-500',
	},
	anchor: {
		fill: 'fill-amber-500/10',
		stroke: 'stroke-amber-500/40',
		text: 'fill-amber-500',
	},
	backreference: {
		fill: 'fill-rose-500/10',
		stroke: 'stroke-rose-500/40',
		text: 'fill-rose-500',
	},
	unknown: {
		fill: 'fill-muted',
		stroke: 'stroke-border',
		text: 'fill-muted-foreground',
	},
};

const NEUTRAL_TONE: Tone = {
	fill: 'fill-muted',
	stroke: 'stroke-border',
	text: 'fill-muted-foreground',
};

const terminalTone = (kind: TerminalKind): Tone => TERMINAL_TONE[kind] ?? NEUTRAL_TONE;

interface GroupTone {
	readonly stroke: string;
	readonly title: string;
	readonly fill: string;
}

const GROUP_PALETTE: readonly GroupTone[] = [
	{ stroke: 'stroke-blue-500/50', title: 'fill-blue-500', fill: 'fill-blue-500/[0.03]' },
	{
		stroke: 'stroke-emerald-500/50',
		title: 'fill-emerald-500',
		fill: 'fill-emerald-500/[0.03]',
	},
	{
		stroke: 'stroke-fuchsia-500/50',
		title: 'fill-fuchsia-500',
		fill: 'fill-fuchsia-500/[0.03]',
	},
	{ stroke: 'stroke-amber-500/50', title: 'fill-amber-500', fill: 'fill-amber-500/[0.03]' },
	{ stroke: 'stroke-rose-500/50', title: 'fill-rose-500', fill: 'fill-rose-500/[0.03]' },
	{ stroke: 'stroke-cyan-500/50', title: 'fill-cyan-500', fill: 'fill-cyan-500/[0.03]' },
	{ stroke: 'stroke-violet-500/50', title: 'fill-violet-500', fill: 'fill-violet-500/[0.03]' },
	{ stroke: 'stroke-lime-500/50', title: 'fill-lime-500', fill: 'fill-lime-500/[0.03]' },
];

const NEUTRAL_GROUP: GroupTone = {
	stroke: 'stroke-border',
	title: 'fill-muted-foreground',
	fill: 'fill-card',
};

const groupPaletteEntry = (oneBasedIndex: number): GroupTone =>
	GROUP_PALETTE[(Math.max(1, oneBasedIndex) - 1) % GROUP_PALETTE.length] ?? NEUTRAL_GROUP;

const groupTone = (g: GroupNode): GroupTone =>
	g.variant === 'capture' && g.groupNumber !== undefined
		? groupPaletteEntry(g.groupNumber)
		: NEUTRAL_GROUP;

const horizontalRail = (x1: number, y1: number, x2: number, y2: number): string => {
	if (Math.abs(y1 - y2) < 0.5) return `M ${x1} ${y1} L ${x2} ${y2}`;
	const midX = (x1 + x2) / 2;
	return `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`;
};

const loopPath = (
	leftEntryX: number,
	rightExitX: number,
	entryY: number,
	bottomY: number
): string => {
	const arc = RAIL_CONSTANTS.LOOP_ARC;
	return [
		`M ${leftEntryX} ${entryY}`,
		`A ${arc} ${arc} 0 0 1 ${leftEntryX - arc} ${entryY + arc}`,
		`L ${leftEntryX - arc} ${bottomY - arc}`,
		`A ${arc} ${arc} 0 0 1 ${leftEntryX} ${bottomY}`,
		`L ${rightExitX} ${bottomY}`,
		`A ${arc} ${arc} 0 0 1 ${rightExitX + arc} ${bottomY - arc}`,
		`L ${rightExitX + arc} ${entryY + arc}`,
		`A ${arc} ${arc} 0 0 1 ${rightExitX} ${entryY}`,
	].join(' ');
};

const skipPath = (leftEntryX: number, rightExitX: number, entryY: number, topY: number): string => {
	const arc = RAIL_CONSTANTS.SKIP_ARC;
	return [
		`M ${leftEntryX} ${entryY}`,
		`A ${arc} ${arc} 0 0 0 ${leftEntryX - arc} ${entryY - arc}`,
		`L ${leftEntryX - arc} ${topY + arc}`,
		`A ${arc} ${arc} 0 0 0 ${leftEntryX} ${topY}`,
		`L ${rightExitX} ${topY}`,
		`A ${arc} ${arc} 0 0 0 ${rightExitX + arc} ${topY + arc}`,
		`L ${rightExitX + arc} ${entryY - arc}`,
		`A ${arc} ${arc} 0 0 0 ${rightExitX} ${entryY}`,
	].join(' ');
};

const quantifierLabelText = (q: QuantifierNode): string => {
	const greedy = q.greedy ? '' : ' ?';
	if (q.min === 0 && q.max === null) return `0+${greedy}`;
	if (q.min === 1 && q.max === null) return `1+${greedy}`;
	if (q.min === 0 && q.max === 1) return `0–1${greedy}`;
	if (q.max === null) return `${q.min}+${greedy}`;
	if (q.min === q.max) return `${q.min}×${greedy}`;
	return `${q.min}–${q.max}${greedy}`;
};

// Node coordinates are unique within a single laid-out diagram and stable per
// render pass, so `(kind, x, y)` is a safe React key without threading IDs
// through the layout engine.
const nodeKey = (n: RailroadNode): string => `${n.kind}-${n.x}-${n.y}`;

function RailNode({ n }: { readonly n: RailroadNode }) {
	if (n.kind === 'terminal') return <TerminalGlyph n={n} />;
	if (n.kind === 'sequence') return <SequenceGlyph n={n} />;
	if (n.kind === 'choice') return <ChoiceGlyph n={n} />;
	if (n.kind === 'group') return <GroupGlyph n={n} />;
	return <QuantifierGlyph n={n} />;
}

function TerminalGlyph({ n }: { readonly n: TerminalNode }) {
	const tone = terminalTone(n.nodeKind);
	return (
		<>
			<rect
				x={n.x}
				y={n.y}
				width={n.width}
				height={n.height}
				rx={n.nodeKind === 'char' ? 13 : 4}
				className={`${tone.fill} ${tone.stroke}`}
				strokeWidth="1"
			/>
			<text
				x={n.x + n.width / 2}
				y={n.entryY}
				textAnchor="middle"
				dominantBaseline="middle"
				className={`${tone.text} font-mono text-2xs`}
			>
				{n.label}
			</text>
		</>
	);
}

function SequenceGlyph({ n }: { readonly n: SequenceNode }) {
	return (
		<>
			{n.children.map((child, i) => {
				const prev = i > 0 ? n.children[i - 1] : undefined;
				return (
					<g key={nodeKey(child)}>
						{prev ? (
							<path
								d={horizontalRail(prev.x + prev.width, prev.exitY, child.x, child.entryY)}
								className="fill-none stroke-muted-foreground/60"
								strokeWidth="1.5"
							/>
						) : null}
						<RailNode n={child} />
					</g>
				);
			})}
		</>
	);
}

function ChoiceGlyph({ n }: { readonly n: ChoiceNode }) {
	return (
		<>
			{n.children.map((child) => (
				<g key={nodeKey(child)}>
					<path
						d={horizontalRail(n.x, n.entryY, child.x, child.entryY)}
						className="fill-none stroke-muted-foreground/60"
						strokeWidth="1.5"
					/>
					<path
						d={horizontalRail(child.x + child.width, child.exitY, n.x + n.width, n.exitY)}
						className="fill-none stroke-muted-foreground/60"
						strokeWidth="1.5"
					/>
					<RailNode n={child} />
				</g>
			))}
		</>
	);
}

function GroupGlyph({ n }: { readonly n: GroupNode }) {
	const tone = groupTone(n);
	const dashed = n.variant === 'capture' || n.variant === 'named' ? undefined : '4 3';
	return (
		<>
			<rect
				x={n.x}
				y={n.y + 4}
				width={n.width}
				height={n.height - 4}
				rx={6}
				className={`${tone.fill} ${tone.stroke}`}
				strokeWidth="1"
				strokeDasharray={dashed}
			/>
			<text
				x={n.x + 10}
				y={n.y + 14}
				className={`${tone.title} font-mono text-[10px]`}
				dominantBaseline="middle"
			>
				{n.title}
			</text>
			<path
				d={horizontalRail(n.x, n.entryY, n.child.x, n.child.entryY)}
				className="fill-none stroke-muted-foreground/60"
				strokeWidth="1.5"
			/>
			<path
				d={horizontalRail(n.child.x + n.child.width, n.child.exitY, n.x + n.width, n.exitY)}
				className="fill-none stroke-muted-foreground/60"
				strokeWidth="1.5"
			/>
			<RailNode n={n.child} />
		</>
	);
}

function QuantifierGlyph({ n }: { readonly n: QuantifierNode }) {
	const inner = n.child;
	const hasSkip = n.min === 0;
	const hasLoop = n.max === null || n.max > 1;
	const loopY = n.y + n.height - RAIL_CONSTANTS.QUANT_LABEL_HEIGHT - RAIL_CONSTANTS.LOOP_ARC;
	const skipY = n.y + RAIL_CONSTANTS.SKIP_ARC;
	const labelX = (inner.x + inner.x + inner.width) / 2;
	return (
		<>
			<path
				d={horizontalRail(n.x, n.entryY, inner.x, inner.entryY)}
				className="fill-none stroke-muted-foreground/60"
				strokeWidth="1.5"
			/>
			<path
				d={horizontalRail(inner.x + inner.width, inner.exitY, n.x + n.width, n.exitY)}
				className="fill-none stroke-muted-foreground/60"
				strokeWidth="1.5"
			/>
			{hasLoop ? (
				<>
					<path
						d={loopPath(inner.x, inner.x + inner.width, n.entryY, loopY)}
						className="fill-none stroke-muted-foreground/50"
						strokeWidth="1.5"
						strokeDasharray="3 3"
					/>
					<text
						x={labelX}
						y={loopY + RAIL_CONSTANTS.QUANT_LABEL_HEIGHT}
						textAnchor="middle"
						dominantBaseline="hanging"
						className="fill-muted-foreground font-mono text-[9px]"
					>
						{quantifierLabelText(n)}
					</text>
				</>
			) : (
				<text
					x={labelX}
					y={n.y + n.height - 2}
					textAnchor="middle"
					dominantBaseline="ideographic"
					className="fill-muted-foreground font-mono text-[9px]"
				>
					{quantifierLabelText(n)}
				</text>
			)}
			{hasSkip ? (
				<path
					d={skipPath(inner.x, inner.x + inner.width, n.entryY, skipY)}
					className="fill-none stroke-muted-foreground/50"
					strokeWidth="1.5"
					strokeDasharray="3 3"
				/>
			) : null}
			<RailNode n={inner} />
		</>
	);
}

export function RailroadView({ node }: RailroadViewProps) {
	const diagram = useMemo(() => layoutRailroad(node), [node]);
	return (
		<svg
			viewBox={`0 0 ${diagram.width} ${diagram.height}`}
			width={diagram.width}
			height={diagram.height}
			className="text-foreground"
			role="img"
			aria-label="Railroad diagram of regex pattern"
		>
			<RailNode n={diagram.root} />
		</svg>
	);
}

export type { RailroadViewProps };
