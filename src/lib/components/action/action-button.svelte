<script lang="ts">
	import type { Component } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		label: string;
		icon?: Component;
		loading?: boolean;
		loadingLabel?: string;
		disabled?: boolean;
		variant?: 'default' | 'outline' | 'destructive';
		class?: string;
		onclick: () => void;
	}

	let {
		label,
		icon: Icon,
		loading = false,
		loadingLabel,
		disabled = false,
		variant = 'default',
		class: className,
		onclick,
	}: Props = $props();

	const displayLabel = $derived(loading ? (loadingLabel ?? `${label}...`) : label);
</script>

<Button {variant} class={cn('w-full', className)} {disabled} onclick={() => onclick()}>
	{#if loading}
		<div
			class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
		></div>
	{:else if Icon}
		<Icon class="mr-2 h-4 w-4" />
	{/if}
	{displayLabel}
</Button>
