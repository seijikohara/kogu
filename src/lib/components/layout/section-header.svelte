<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		readonly title: string;
		readonly count?: number;
		readonly trailing?: Snippet;
	}

	let { title, count, trailing }: Props = $props();
</script>

<div
	class="flex h-8 shrink-0 items-center justify-between border-b border-border/60 bg-surface-2 px-3"
>
	<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
		{title}
		{#if count !== undefined}
			<span class="ml-1 tabular-nums">({count})</span>
		{/if}
	</span>
	{#if trailing}
		{@render trailing()}
	{/if}
</div>
