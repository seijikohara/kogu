<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';

	interface Props {
		label: string;
		checked?: boolean;
		disabled?: boolean;
		hint?: string;
		onchange?: (checked: boolean) => void;
	}

	let { label, checked = $bindable(false), disabled = false, hint, onchange }: Props = $props();

	const handleChange = (value: boolean | 'indeterminate') => {
		const newValue = !!value;
		checked = newValue;
		onchange?.(newValue);
	};
</script>

<label
	class="flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors {disabled
		? 'cursor-not-allowed opacity-50'
		: 'cursor-pointer hover:bg-interactive-hover'}"
>
	<Checkbox
		{checked}
		{disabled}
		onCheckedChange={handleChange}
		class="mt-0.5 h-4 w-4 shrink-0 bg-background"
	/>
	<span class="min-w-0 text-sm font-medium leading-snug">{label}</span>
	{#if hint}
		<span class="shrink-0 text-xs text-muted-foreground">({hint})</span>
	{/if}
</label>
