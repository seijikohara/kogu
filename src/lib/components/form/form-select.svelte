<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';

	interface SelectOption {
		value: string;
		label: string;
	}

	interface Props {
		label: string;
		value?: string;
		options: SelectOption[] | string[];
		displayValue?: string;
		onchange?: (value: string) => void;
	}

	let { label, value = $bindable(''), options, displayValue, onchange }: Props = $props();

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
</script>

<div class="space-y-1">
	<Label class="text-sm font-medium">{label}</Label>
	<Select.Root type="single" {value} onValueChange={handleChange}>
		<Select.Trigger class="h-9 w-full text-sm bg-background">{display}</Select.Trigger>
		<Select.Content>
			{#each normalizedOptions as opt}
				<Select.Item value={opt.value}>{opt.label}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
