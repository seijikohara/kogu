<script lang="ts">
	import { CircleCheck, CircleX } from '@lucide/svelte';

	interface Props {
		valid: boolean | null;
		validLabel?: string;
		invalidLabel?: string;
	}

	let { valid, validLabel = 'Valid', invalidLabel = 'Invalid' }: Props = $props();
</script>

{#if valid === true}
	<span class="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
		<CircleCheck class="h-3.5 w-3.5" />
		{validLabel}
	</span>
{:else if valid === false}
	<span
		class="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
	>
		<CircleX class="h-3.5 w-3.5" />
		{invalidLabel}
	</span>
{/if}
