<script lang="ts">
	import { Copy } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		text: string;
		label?: string;
		toastLabel?: string;
		variant?: 'default' | 'ghost' | 'outline';
		size?: 'default' | 'sm' | 'icon';
		class?: string;
		showLabel?: boolean;
		disabled?: boolean;
	}

	let {
		text,
		label = 'Copy',
		toastLabel,
		variant = 'ghost',
		size = 'sm',
		class: className,
		showLabel = true,
		disabled = false,
	}: Props = $props();

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${toastLabel ?? label} copied to clipboard`);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};
</script>

<Button
	{variant}
	{size}
	{disabled}
	class={cn(size === 'sm' && 'h-7 gap-1 px-2 text-xs', className)}
	onclick={handleCopy}
>
	<Copy class={size === 'icon' ? 'h-4 w-4' : 'h-3 w-3'} />
	{#if showLabel && size !== 'icon'}
		{label}
	{/if}
</Button>
