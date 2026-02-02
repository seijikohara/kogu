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
	class="flex items-center gap-2 rounded-md px-2 py-1 transition-colors {disabled
		? 'cursor-not-allowed opacity-50'
		: 'cursor-pointer hover:bg-muted/50'}"
>
	<Checkbox {checked} {disabled} onCheckedChange={handleChange} class="h-3.5 w-3.5" />
	<span class="text-sm">{label}</span>
	{#if hint}
		<span class="text-xs text-muted-foreground">({hint})</span>
	{/if}
</label>
