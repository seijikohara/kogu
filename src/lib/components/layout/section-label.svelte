<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		title?: string;
		icon?: Component;
		iconClass?: string;
		class?: string;
		children?: Snippet;
	}

	let {
		title,
		icon: Icon,
		iconClass = 'h-4 w-4 text-muted-foreground',
		class: className,
		children,
	}: Props = $props();
</script>

<h3 class={cn('mb-2 flex items-center gap-2 text-sm font-medium', className)}>
	{#if Icon}
		<Icon class={iconClass} />
	{/if}
	{#if title}
		{title}
	{/if}
	{@render children?.()}
</h3>
