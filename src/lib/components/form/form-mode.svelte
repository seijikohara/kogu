<script lang="ts">
	import type { Component } from 'svelte';
	import { Label } from '$lib/components/ui/label/index.js';
	import { cn } from '$lib/utils.js';

	interface ModeOption {
		value: string;
		label: string;
		icon?: Component;
	}

	interface Props {
		label?: string;
		value?: string;
		options: ModeOption[];
		size?: 'sm' | 'md';
		onchange?: (value: string) => void;
	}

	let { label, value = $bindable(''), options, size = 'md', onchange }: Props = $props();

	const handleSelect = (optionValue: string) => {
		value = optionValue;
		onchange?.(optionValue);
	};
</script>

<div class="space-y-1.5">
	{#if label}
		<Label class="text-xs font-medium text-muted-foreground">{label}</Label>
	{/if}
	<div class="flex gap-0.5 rounded-md bg-muted p-0.5">
		{#each options as option (option.value)}
			{@const isSelected = value === option.value}
			{@const Icon = option.icon}
			<button
				type="button"
				class={cn(
					'flex flex-1 items-center justify-center gap-1.5 rounded-sm transition-all',
					size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
					isSelected
						? 'bg-background text-foreground shadow-sm ring-1 ring-border/30'
						: 'text-muted-foreground hover:text-foreground'
				)}
				onclick={() => handleSelect(option.value)}
			>
				{#if Icon}
					<Icon class={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
				{/if}
				<span class="font-medium">{option.label}</span>
			</button>
		{/each}
	</div>
</div>
