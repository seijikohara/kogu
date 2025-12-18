<script lang="ts">
	import { Info } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		showIcon?: boolean;
		children?: Snippet;
	}

	let { title, showIcon = true, children }: Props = $props();
</script>

<div class="rounded-md border bg-muted/30 p-2.5 text-[11px]">
	{#if title}
		<div class="mb-1.5 flex items-center gap-1 font-medium text-foreground">
			{#if showIcon}
				<Info class="h-3 w-3" />
			{/if}
			{title}
		</div>
	{/if}
	<div class="text-muted-foreground">
		{@render children?.()}
	</div>
</div>
