<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { cn } from '$lib/utils.js';

	interface SelectOption {
		value: string;
		label: string;
	}

	interface Props {
		label?: string;
		value?: string;
		options: SelectOption[] | string[];
		displayValue?: string;
		size?: 'default' | 'compact';
		onchange?: (value: string) => void;
	}

	let {
		label,
		value = $bindable(''),
		options,
		displayValue,
		size = 'default',
		onchange,
	}: Props = $props();

	// Normalize options to SelectOption format
	const normalizedOptions = $derived(
		options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt))
	);

	// Get display value
	const display = $derived(
		displayValue ?? normalizedOptions.find((opt) => opt.value === value)?.label ?? value
	);

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
		<Select.Trigger class={triggerClass}>{display}</Select.Trigger>
		<Select.Content>
			{#each normalizedOptions as opt}
				<Select.Item value={opt.value}>{opt.label}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
