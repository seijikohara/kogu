<script lang="ts">
	import { AlertTriangle } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { ValidityBadge } from '$lib/components/status';

	interface Props {
		readonly valid?: boolean | null;
		readonly error?: string;
		readonly children?: Snippet;
	}

	let { valid, error, children }: Props = $props();

	const hasContent = $derived(children || valid !== undefined || error);
</script>

{#if hasContent}
	<footer
		class="flex h-7 shrink-0 items-center justify-between border-t border-border/60 bg-surface-2 px-3"
	>
		<div class="flex items-center gap-2 text-xs">
			{#if error}
				<AlertTriangle class="h-3 w-3 shrink-0 text-destructive" />
				<span class="max-w-md truncate text-destructive" title={error}>{error}</span>
			{:else if children}
				{@render children()}
			{/if}
		</div>
		{#if valid !== undefined}
			<ValidityBadge {valid} />
		{/if}
	</footer>
{/if}
