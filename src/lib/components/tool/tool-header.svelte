<script lang="ts">
	
	import type { Snippet } from 'svelte';
import ValidityBadge from '$lib/components/feedback/validity-badge.svelte';

	interface StatItem {
		label: string;
		value: string | number;
	}

	interface Props {
		title?: string;
		stats?: StatItem[];
		validity?: boolean | null;
		validityLabel?: string;
		invalidityLabel?: string;
		error?: string;
		formatBadge?: string;
		tabs?: Snippet;
		extra?: Snippet;
	}

	let {
		title = '',
		stats = [],
		validity = null,
		validityLabel = 'Valid',
		invalidityLabel = 'Invalid',
		error = '',
		formatBadge = '',
		tabs,
		extra,
	}: Props = $props();
</script>

<header class="flex h-12 shrink-0 items-center justify-between border-b px-4">
	<div class="flex items-center gap-4">
		{#if title}
			<h1 class="text-lg font-semibold">{title}</h1>
		{/if}

		{#if tabs}
			{@render tabs()}
		{/if}
	</div>

	<div class="flex items-center gap-3 text-xs">
		{#if error}
			<span class="max-w-md truncate text-destructive" title={error}>{error}</span>
		{:else if stats.length > 0}
			{#if formatBadge}
				<span class="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary"
					>{formatBadge}</span
				>
			{/if}
			{#each stats as stat}
				<span class="text-muted-foreground">
					{stat.label}: <strong class="text-foreground">{stat.value}</strong>
				</span>
			{/each}
		{:else}
			<span class="text-muted-foreground/50">No input</span>
		{/if}

		{#if extra}
			{@render extra()}
		{/if}

		<ValidityBadge valid={validity} validLabel={validityLabel} invalidLabel={invalidityLabel} />
	</div>
</header>
