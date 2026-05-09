<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		label: string;
		value?: string;
		placeholder?: string;
		rows?: number;
		hint?: string;
		size?: 'default' | 'compact';
		class?: string;
		onchange?: (value: string) => void;
	}

	let {
		label,
		value = $bindable(''),
		placeholder = '',
		rows = 4,
		hint,
		size = 'default',
		class: className,
		onchange,
	}: Props = $props();

	const labelClass = $derived(
		size === 'compact'
			? 'text-xs uppercase tracking-wide text-muted-foreground'
			: 'text-sm font-medium'
	);
</script>

<div class="space-y-1.5">
	<Label class={labelClass}>{label}</Label>
	<Textarea
		{placeholder}
		{rows}
		bind:value
		class={cn(className)}
		oninput={(e) => onchange?.((e.currentTarget as HTMLTextAreaElement).value)}
	/>
	{#if hint}
		<p class="text-xs text-muted-foreground">{hint}</p>
	{/if}
</div>
