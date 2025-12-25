<script lang="ts">
	import { Server } from '@lucide/svelte';

	interface Props {
		readonly ip: string;
		readonly methods: readonly string[];
		readonly selected: boolean;
		readonly onclick: () => void;
	}

	let { ip, methods, selected, onclick }: Props = $props();
</script>

<button
	type="button"
	class="flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0
		{selected ? 'bg-primary/10' : 'hover:bg-muted/50'}"
	{onclick}
>
	<Server class="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
	<div class="min-w-0 flex-1">
		<!-- IP Address -->
		<span class="font-mono text-sm font-medium">{ip}</span>

		<!-- Discovery Methods -->
		{#if methods.length > 0}
			<p class="truncate text-xs text-muted-foreground" title={methods.join(', ')}>
				via {methods.join(', ')}
			</p>
		{/if}
	</div>
</button>
