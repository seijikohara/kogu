<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';

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

	const handleInput = (e: Event) => {
		const target = e.target as HTMLInputElement;
		const newValue = Number(target.value);
		value = newValue;
		onchange?.(newValue);
	};
</script>

<div class="space-y-1.5">
	<div class="flex items-center justify-between gap-2">
		<Label class="min-w-0 truncate text-sm font-medium">{label}</Label>
		{#if showValue}
			<span class="shrink-0 text-sm font-medium tabular-nums">{displayValue}</span>
		{/if}
	</div>
	<input
		type="range"
		{value}
		{min}
		{max}
		{step}
		oninput={handleInput}
		class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
	/>
	{#if hint}
		<p class="text-xs text-muted-foreground">{hint}</p>
	{/if}
</div>
