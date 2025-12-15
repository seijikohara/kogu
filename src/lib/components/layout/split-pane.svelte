<script lang="ts">
	import { PaneGroup, Pane, Handle } from '$lib/components/ui/resizable/index.js';
	import type { Snippet } from 'svelte';

	type Direction = 'horizontal' | 'vertical';

	interface Props {
		direction?: Direction;
		defaultSizes?: [number, number];
		minSizes?: [number, number];
		class?: string;
		left?: Snippet;
		right?: Snippet;
		top?: Snippet;
		bottom?: Snippet;
	}

	let {
		direction = 'horizontal',
		defaultSizes = [50, 50],
		minSizes = [20, 20],
		class: className = '',
		left,
		right,
		top,
		bottom,
	}: Props = $props();
</script>

<PaneGroup direction={direction} class="flex-1 {className}">
	{#if direction === 'horizontal'}
		<Pane defaultSize={defaultSizes[0]} minSize={minSizes[0]} class="flex flex-col overflow-hidden">
			{@render left?.()}
		</Pane>
		<Handle withHandle />
		<Pane defaultSize={defaultSizes[1]} minSize={minSizes[1]} class="flex flex-col overflow-hidden">
			{@render right?.()}
		</Pane>
	{:else}
		<Pane defaultSize={defaultSizes[0]} minSize={minSizes[0]} class="flex flex-col overflow-hidden">
			{@render top?.()}
		</Pane>
		<Handle withHandle />
		<Pane defaultSize={defaultSizes[1]} minSize={minSizes[1]} class="flex flex-col overflow-hidden">
			{@render bottom?.()}
		</Pane>
	{/if}
</PaneGroup>
