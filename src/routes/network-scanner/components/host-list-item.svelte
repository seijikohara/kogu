<script lang="ts">
	import { CheckCircle2, Server } from '@lucide/svelte';
	import type { HostResult } from '$lib/services/network-scanner.js';

	interface Props {
		readonly host: HostResult;
		readonly selected: boolean;
		readonly onclick: () => void;
	}

	let { host, selected, onclick }: Props = $props();

	const openPortCount = $derived(host.ports.filter((p) => p.state === 'open').length);
</script>

<button
	type="button"
	class="flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0
		{selected ? 'bg-primary/10' : 'hover:bg-muted/50'}"
	{onclick}
>
	<Server
		class="mt-0.5 h-4 w-4 shrink-0 {openPortCount > 0 ? 'text-green-500' : 'text-muted-foreground'}"
	/>
	<div class="min-w-0 flex-1">
		<!-- IP Address -->
		<div class="flex items-center gap-2">
			<span class="font-mono text-sm font-medium">{host.ip}</span>
			{#if openPortCount > 0}
				<span
					class="flex items-center gap-0.5 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400"
				>
					<CheckCircle2 class="h-2.5 w-2.5" />
					{openPortCount}
				</span>
			{/if}
		</div>

		<!-- Hostname -->
		{#if host.hostname}
			<p class="truncate text-xs text-muted-foreground" title={host.hostname}>
				{host.hostname}
			</p>
		{/if}
	</div>
</button>
