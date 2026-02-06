<script lang="ts">
	import type { Component } from 'svelte';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { cn } from '$lib/utils.js';

	interface ModeOption {
		value: string;
		label: string;
		description?: string;
		icon?: Component;
	}

	interface Props {
		label?: string;
		value?: string;
		options: ModeOption[];
		onchange?: (value: string) => void;
		layout?: 'horizontal' | 'stacked';
		descriptionDisplay?: 'selected' | 'all' | 'none';
	}

	let {
		label,
		value = $bindable(''),
		options,
		onchange,
		layout = 'horizontal',
		descriptionDisplay = 'selected',
	}: Props = $props();

	const selected = $derived(options.find((o) => o.value === value));

	// Generate grid-cols class based on options count for horizontal layout
	const gridColsClass = $derived(
		layout === 'horizontal'
			? options.length === 2
				? 'grid-cols-2'
				: options.length === 3
					? 'grid-cols-3'
					: options.length === 4
						? 'grid-cols-2'
						: 'grid-cols-2'
			: ''
	);

	// Generate unique ID for accessibility
	const uid = $props.id();
</script>

<div class="space-y-2">
	{#if label}
		<Label id="{uid}-label" class="text-sm font-medium">{label}</Label>
	{/if}

	<ToggleGroup.Root
		type="single"
		{value}
		onValueChange={(v) => {
			if (v) {
				value = v;
				onchange?.(v);
			}
		}}
		aria-labelledby={label ? `${uid}-label` : undefined}
		class={cn(
			'w-full rounded-lg bg-muted p-1 ring-1 ring-border',
			layout === 'horizontal' ? `grid ${gridColsClass} gap-1` : 'flex flex-col gap-1'
		)}
	>
		{#each options as option (option.value)}
			{@const Icon = option.icon}
			<ToggleGroup.Item
				value={option.value}
				class={cn(
					'h-9 w-full min-w-0 px-2 text-sm font-medium rounded-md transition-all',
					'flex items-center gap-1.5',
					layout === 'horizontal' ? 'justify-center' : 'justify-start',
					'data-[state=on]:bg-background data-[state=on]:shadow-sm',
					'data-[state=on]:ring-1 data-[state=on]:ring-border/60',
					'data-[state=off]:bg-background/50 data-[state=off]:text-muted-foreground',
					'data-[state=off]:hover:bg-background/80 data-[state=off]:hover:text-foreground'
				)}
			>
				{#if Icon}
					<Icon class="h-3.5 w-3.5 shrink-0" />
				{/if}
				<span class={layout === 'horizontal' ? 'truncate' : ''}>{option.label}</span>
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>

	{#if descriptionDisplay === 'selected' && selected?.description}
		<p class="text-xs text-muted-foreground">{selected.description}</p>
	{/if}

	{#if descriptionDisplay === 'all'}
		<div class="space-y-0.5">
			{#each options as option (option.value)}
				{#if option.description}
					<p class="text-xs text-muted-foreground">
						<span class="font-medium">{option.label}:</span>
						{option.description}
					</p>
				{/if}
			{/each}
		</div>
	{/if}
</div>
