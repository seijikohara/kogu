<script lang="ts">
	import { cn } from '$lib/utils.js';

	interface Language {
		readonly value: string;
		readonly label: string;
	}

	interface Props {
		readonly languages: readonly Language[];
		value?: string;
		onchange?: (value: string) => void;
	}

	let { languages, value = '', onchange }: Props = $props();

	// Handle native select change - using direct DOM event binding
	const handleChange = (e: Event) => {
		const select = e.target as HTMLSelectElement;
		const newValue = select.value;
		onchange?.(newValue);
	};
</script>

<select
	{value}
	onchange={handleChange}
	class={cn(
		'h-7 w-[140px] cursor-pointer appearance-none rounded-md border border-input bg-background px-2 pr-6 text-xs',
		'hover:bg-accent hover:text-accent-foreground',
		'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
		'select-arrow'
	)}
>
	{#each languages as language (language.value)}
		<option value={language.value}>{language.label}</option>
	{/each}
</select>
