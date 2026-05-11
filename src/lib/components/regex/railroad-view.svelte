<script lang="ts">
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
	} from '$lib/services/regex-railroad.js';
	import type { VizNode } from '$lib/services/regex-viz.js';

	interface Props {
		readonly node: VizNode;
	}

	let { node }: Props = $props();

	const diagram = $derived(layoutRailroad(node));

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

	const skipPath = (
		leftEntryX: number,
		rightExitX: number,
		entryY: number,
		topY: number
	): string => {
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
</script>

<svg
	viewBox="0 0 {diagram.width} {diagram.height}"
	width={diagram.width}
	height={diagram.height}
	class="text-foreground"
	role="img"
	aria-label="Railroad diagram of regex pattern"
>
	{@render railNode(diagram.root)}
</svg>

{#snippet railNode(n: RailroadNode)}
	{#if n.kind === 'terminal'}
		{@render terminalSnippet(n)}
	{:else if n.kind === 'sequence'}
		{@render sequenceSnippet(n)}
	{:else if n.kind === 'choice'}
		{@render choiceSnippet(n)}
	{:else if n.kind === 'group'}
		{@render groupSnippet(n)}
	{:else if n.kind === 'quantifier'}
		{@render quantifierSnippet(n)}
	{/if}
{/snippet}

{#snippet terminalSnippet(n: TerminalNode)}
	{@const tone = terminalTone(n.nodeKind)}
	<rect
		x={n.x}
		y={n.y}
		width={n.width}
		height={n.height}
		rx={n.nodeKind === 'char' ? 13 : 4}
		class={`${tone.fill} ${tone.stroke}`}
		stroke-width="1"
	/>
	<text
		x={n.x + n.width / 2}
		y={n.entryY}
		text-anchor="middle"
		dominant-baseline="middle"
		class={`${tone.text} font-mono text-[11px]`}
	>
		{n.label}
	</text>
{/snippet}

{#snippet sequenceSnippet(n: SequenceNode)}
	{#each n.children as child, i (i)}
		{@const prev = i > 0 ? n.children[i - 1] : undefined}
		{#if prev}
			<path
				d={horizontalRail(prev.x + prev.width, prev.exitY, child.x, child.entryY)}
				class="stroke-muted-foreground/60 fill-none"
				stroke-width="1.5"
			/>
		{/if}
		{@render railNode(child)}
	{/each}
{/snippet}

{#snippet choiceSnippet(n: ChoiceNode)}
	{#each n.children as child, i (i)}
		<path
			d={horizontalRail(n.x, n.entryY, child.x, child.entryY)}
			class="stroke-muted-foreground/60 fill-none"
			stroke-width="1.5"
		/>
		<path
			d={horizontalRail(child.x + child.width, child.exitY, n.x + n.width, n.exitY)}
			class="stroke-muted-foreground/60 fill-none"
			stroke-width="1.5"
		/>
		{@render railNode(child)}
	{/each}
{/snippet}

{#snippet groupSnippet(n: GroupNode)}
	{@const tone = groupTone(n)}
	<rect
		x={n.x}
		y={n.y + 4}
		width={n.width}
		height={n.height - 4}
		rx={6}
		class={`${tone.fill} ${tone.stroke}`}
		stroke-width="1"
		stroke-dasharray={n.variant === 'capture' || n.variant === 'named' ? undefined : '4 3'}
	/>
	<text
		x={n.x + 10}
		y={n.y + 14}
		class={`${tone.title} font-mono text-[10px]`}
		dominant-baseline="middle"
	>
		{n.title}
	</text>
	<path
		d={horizontalRail(n.x, n.entryY, n.child.x, n.child.entryY)}
		class="stroke-muted-foreground/60 fill-none"
		stroke-width="1.5"
	/>
	<path
		d={horizontalRail(n.child.x + n.child.width, n.child.exitY, n.x + n.width, n.exitY)}
		class="stroke-muted-foreground/60 fill-none"
		stroke-width="1.5"
	/>
	{@render railNode(n.child)}
{/snippet}

{#snippet quantifierSnippet(n: QuantifierNode)}
	{@const inner = n.child}
	{@const hasSkip = n.min === 0}
	{@const hasLoop = n.max === null || n.max > 1}
	{@const loopY = n.y + n.height - RAIL_CONSTANTS.QUANT_LABEL_HEIGHT - RAIL_CONSTANTS.LOOP_ARC}
	{@const skipY = n.y + RAIL_CONSTANTS.SKIP_ARC}
	<path
		d={horizontalRail(n.x, n.entryY, inner.x, inner.entryY)}
		class="stroke-muted-foreground/60 fill-none"
		stroke-width="1.5"
	/>
	<path
		d={horizontalRail(inner.x + inner.width, inner.exitY, n.x + n.width, n.exitY)}
		class="stroke-muted-foreground/60 fill-none"
		stroke-width="1.5"
	/>
	{#if hasLoop}
		<path
			d={loopPath(inner.x, inner.x + inner.width, n.entryY, loopY)}
			class="stroke-muted-foreground/50 fill-none"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
		<text
			x={(inner.x + inner.x + inner.width) / 2}
			y={loopY + RAIL_CONSTANTS.QUANT_LABEL_HEIGHT}
			text-anchor="middle"
			dominant-baseline="hanging"
			class="fill-muted-foreground font-mono text-[9px]"
		>
			{quantifierLabelText(n)}
		</text>
	{:else}
		<text
			x={(inner.x + inner.x + inner.width) / 2}
			y={n.y + n.height - 2}
			text-anchor="middle"
			dominant-baseline="ideographic"
			class="fill-muted-foreground font-mono text-[9px]"
		>
			{quantifierLabelText(n)}
		</text>
	{/if}
	{#if hasSkip}
		<path
			d={skipPath(inner.x, inner.x + inner.width, n.entryY, skipY)}
			class="stroke-muted-foreground/50 fill-none"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
	{/if}
	{@render railNode(inner)}
{/snippet}
