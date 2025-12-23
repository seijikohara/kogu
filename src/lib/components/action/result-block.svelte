<script lang="ts">
	import { Copy } from '@lucide/svelte';
	import type { Component, Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		title: string;
		content: string;
		icon?: Component;
		copyable?: boolean;
		copyLabel?: string;
		variant?: 'default' | 'success' | 'warning' | 'error';
		mono?: boolean;
		maxHeight?: string;
		children?: Snippet;
	}

	let {
		title,
		content,
		icon: Icon,
		copyable = true,
		copyLabel,
		variant = 'default',
		mono = true,
		maxHeight,
		children,
	}: Props = $props();

	const variantStyles = {
		default: 'border bg-muted/30',
		success: 'border-green-500/30 bg-green-500/10',
		warning: 'border-amber-500/30 bg-amber-500/10',
		error: 'border-destructive/50 bg-destructive/10',
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(content);
			toast.success(`${copyLabel ?? title} copied to clipboard`);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};
</script>

<div class={cn('rounded-lg p-4', variantStyles[variant])}>
	<div class="mb-2 flex items-center justify-between">
		<div class="flex items-center gap-2">
			{#if Icon}
				<Icon class="h-4 w-4" />
			{/if}
			<span class="text-sm font-medium">{title}</span>
		</div>
		{#if copyable && content}
			<Button variant="ghost" size="sm" class="h-7 gap-1 px-2 text-xs" onclick={handleCopy}>
				<Copy class="h-3 w-3" />
				Copy
			</Button>
		{/if}
	</div>
	{#if children}
		{@render children()}
	{:else}
		<code
			class={cn(
				'block break-all rounded bg-muted p-3 text-sm',
				mono && 'font-mono',
				maxHeight && 'overflow-auto'
			)}
			style={maxHeight ? `max-height: ${maxHeight}` : undefined}
		>
			{content}
		</code>
	{/if}
</div>
