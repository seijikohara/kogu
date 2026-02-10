<script lang="ts">
	import type { Component } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import { formatShortcut, isModKey } from '$lib/utils/keyboard.js';

	interface Props {
		label: string;
		icon?: Component;
		loading?: boolean;
		loadingLabel?: string;
		disabled?: boolean;
		variant?: 'default' | 'outline' | 'destructive' | 'ghost' | 'secondary';
		size?: 'default' | 'sm';
		class?: string;
		shortcut?: boolean;
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
		shortcut = false,
		onclick,
	}: Props = $props();

	const displayLabel = $derived(loading ? (loadingLabel ?? `${label}...`) : label);

	// Icon size based on button size
	const iconClass = $derived(size === 'sm' ? 'mr-1.5 h-3.5 w-3.5' : 'mr-2 h-4 w-4');
	const spinnerClass = $derived(size === 'sm' ? 'mr-1.5 h-3.5 w-3.5' : 'mr-2 h-4 w-4');

	// Button height class based on size
	const sizeClass = $derived(size === 'sm' ? 'h-8 text-xs' : 'h-9');

	// Shortcut badge text
	const shortcutLabel = $derived(formatShortcut('⏎', true));

	// Register Cmd+Enter shortcut
	$effect(() => {
		if (!shortcut) return;
		const handler = (e: KeyboardEvent) => {
			if (isModKey(e) && e.key === 'Enter' && !disabled && !loading) {
				e.preventDefault();
				onclick();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});
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
	{#if shortcut && !loading}
		<kbd class="ml-1.5 rounded border border-current/20 px-1 py-0.5 font-mono text-2xs opacity-60">
			{shortcutLabel}
		</kbd>
	{/if}
</Button>
