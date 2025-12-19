<script lang="ts">
	import { FormInfo, FormSection } from '$lib/components/form';

	interface DetectedItem {
		show: boolean;
		label: string;
		value: string | number | boolean;
		warning?: boolean;
	}

	interface Props {
		title?: string;
		items: DetectedItem[];
		showIcon?: boolean;
	}

	let { title = 'Detected', items, showIcon = false }: Props = $props();

	const visibleItems = $derived(items.filter((item) => item.show));
	const hasItems = $derived(visibleItems.length > 0);
</script>

{#if hasItems}
	<FormSection {title}>
		<FormInfo {showIcon}>
			{#each visibleItems as item}
				<p class={item.warning ? 'text-amber-600 dark:text-amber-400' : ''}>
					<strong>{item.label}:</strong>
					{typeof item.value === 'boolean' ? (item.value ? 'Yes' : 'No') : item.value}
				</p>
			{/each}
		</FormInfo>
	</FormSection>
{/if}
