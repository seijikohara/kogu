<script lang="ts">
	import type { Component } from 'svelte';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { cn } from '$lib/utils.js';

	interface SelectOption {
		readonly value: string;
		readonly label: string;
		readonly icon?: Component;
		readonly description?: string;
		readonly disabled?: boolean;
	}

	interface Props {
		label?: string;
		value?: string;
		options: readonly SelectOption[] | readonly string[];
		placeholder?: string;
		displayValue?: string;
		size?: 'default' | 'compact';
		onchange?: (value: string) => void;
	}

	let {
		label,
		value = $bindable(''),
		options,
		placeholder,
		displayValue,
		size = 'default',
		onchange,
	}: Props = $props();

	const normalizedOptions = $derived<readonly SelectOption[]>(
		options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt))
	);

	const selected = $derived(normalizedOptions.find((opt) => opt.value === value));
	const display = $derived(displayValue ?? selected?.label ?? value);

	const handleChange = (newValue: string | undefined) => {
		if (newValue !== undefined) {
			value = newValue;
			onchange?.(newValue);
		}
	};

	const labelClass = $derived(
		size === 'compact'
			? 'text-xs uppercase tracking-wide text-muted-foreground'
			: 'text-sm font-medium'
	);

	const triggerClass = $derived(
		cn('w-full bg-background', size === 'compact' ? 'h-7 text-xs' : 'h-9 text-sm')
	);
</script>

<div class="space-y-1">
	{#if label}
		<Label class={labelClass}>{label}</Label>
	{/if}
	<Select.Root type="single" {value} onValueChange={handleChange}>
		<Select.Trigger class={triggerClass}>
			{#if selected?.icon}
				{@const TriggerIcon = selected.icon}
				<TriggerIcon class="size-4 shrink-0" />
			{/if}
			{#if display}
				<span class="min-w-0 flex-1 truncate text-left">{display}</span>
			{:else if placeholder}
				<span class="min-w-0 flex-1 truncate text-left text-muted-foreground">{placeholder}</span>
			{/if}
		</Select.Trigger>
		<Select.Content>
			{#each normalizedOptions as opt (opt.value)}
				<Select.Item value={opt.value} disabled={opt.disabled}>
					{#snippet children()}
						{#if opt.icon}
							{@const ItemIcon = opt.icon}
							<ItemIcon class="size-4 shrink-0" />
						{/if}
						{#if opt.description}
							<div class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="truncate text-sm">{opt.label}</span>
								<span class="truncate text-xs text-muted-foreground">{opt.description}</span>
							</div>
						{:else}
							<span class="min-w-0 flex-1 truncate">{opt.label}</span>
						{/if}
					{/snippet}
				</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
