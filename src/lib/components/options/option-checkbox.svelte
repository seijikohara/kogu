<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';

	interface Props {
		label: string;
		checked?: boolean;
		onchange?: (checked: boolean) => void;
	}

	let { label, checked = $bindable(false), onchange }: Props = $props();

	const handleChange = (value: boolean | 'indeterminate') => {
		const newValue = !!value;
		checked = newValue;
		onchange?.(newValue);
	};
</script>

<label
	class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-muted/50"
>
	<Checkbox {checked} onCheckedChange={handleChange} class="h-3.5 w-3.5" />
	<span class="text-xs">{label}</span>
</label>
