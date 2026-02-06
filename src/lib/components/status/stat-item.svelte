<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		readonly label: string;
		readonly value: string | number;
		readonly icon?: Component;
		readonly variant?: 'default' | 'success' | 'warning' | 'error';
	}

	let { label, value, icon: Icon, variant = 'default' }: Props = $props();

	const variantStyles = {
		default: 'text-foreground',
		success: 'text-success',
		warning: 'text-warning',
		error: 'text-destructive',
	} as const;
</script>

<span class="stat-item flex items-center gap-1.5 text-muted-foreground/80">
	{#if Icon}
		<Icon class="h-3.5 w-3.5" />
	{/if}
	<span class="text-xs">{label}:</span>
	<strong class={cn('font-semibold tabular-nums', variantStyles[variant])}>{value}</strong>
</span>
