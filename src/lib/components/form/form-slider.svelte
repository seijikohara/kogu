<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';

	interface Props {
		label: string;
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		showValue?: boolean;
		valueLabel?: string;
		hint?: string;
		onchange?: (value: number) => void;
	}

	let {
		label,
		value = $bindable(0),
		min = 0,
		max = 100,
		step = 1,
		showValue = true,
		valueLabel,
		hint,
		onchange,
	}: Props = $props();

	const displayValue = $derived(valueLabel ?? String(value));
</script>

<div class="space-y-1.5">
	<div class="flex items-center justify-between gap-2">
		<Label class="min-w-0 truncate text-sm font-medium">{label}</Label>
		{#if showValue}
			<span class="shrink-0 text-sm font-medium tabular-nums">{displayValue}</span>
		{/if}
	</div>
	<Slider type="single" bind:value {min} {max} {step} onValueChange={(v) => onchange?.(v)} />
	{#if hint}
		<p class="text-xs text-muted-foreground">{hint}</p>
	{/if}
</div>
