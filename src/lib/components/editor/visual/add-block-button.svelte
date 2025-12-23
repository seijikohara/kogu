<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { getAddBlockButtonState, handleAddBlockClick } from './add-block-button-state.svelte.js';

	// Get reactive state
	const state = getAddBlockButtonState();

	// Handle click
	const handleClick = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		handleAddBlockClick();
	};
</script>

{#if state.isVisible}
	<button
		type="button"
		class="add-block-button fixed z-50 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
		style="left: {state.position.x}px; top: {state.position.y}px;"
		aria-label="Add block"
		onclick={handleClick}
	>
		<Plus class="h-4 w-4" />
	</button>
{/if}
