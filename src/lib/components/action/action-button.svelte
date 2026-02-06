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
		variant?: 'default' | 'outline' | 'destructive' | 'ghost' | 'secondary';
		size?: 'default' | 'sm';
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
		size = 'default',
		class: className,
		onclick,
	}: Props = $props();

	const displayLabel = $derived(loading ? (loadingLabel ?? `${label}...`) : label);

	// Icon size based on button size
	const iconClass = $derived(size === 'sm' ? 'mr-1.5 h-3.5 w-3.5' : 'mr-2 h-4 w-4');
	const spinnerClass = $derived(size === 'sm' ? 'mr-1.5 h-3.5 w-3.5' : 'mr-2 h-4 w-4');

	// Button height class based on size
	const sizeClass = $derived(size === 'sm' ? 'h-8 text-xs' : 'h-9');
</script>

<Button {variant} class={cn('w-full', sizeClass, className)} {disabled} onclick={() => onclick()}>
	{#if loading}
		<div
			class={cn(
				spinnerClass,
				'animate-spin rounded-full border-2 border-current border-t-transparent'
			)}
		></div>
	{:else if Icon}
		<Icon class={iconClass} />
	{/if}
	{displayLabel}
</Button>
