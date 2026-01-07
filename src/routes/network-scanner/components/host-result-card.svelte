<script lang="ts">
	import { ChevronDown, ChevronRight, Clock, Globe, Server, Terminal } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { cn } from '$lib/utils.js';
	import { formatDuration, type HostResult } from '$lib/services/network-scanner.js';

	interface Props {
		readonly host: HostResult;
		readonly expanded: boolean;
		readonly ontoggle: () => void;
	}

	let { host, expanded, ontoggle }: Props = $props();

	const openPorts = $derived(host.ports.filter((p) => p.state === 'open'));
</script>

<div class="rounded-lg border bg-card">
	<!-- Header -->
	<button
		type="button"
		class="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
		onclick={ontoggle}
	>
		<div class="flex items-center gap-3">
			{#if expanded}
				<ChevronDown class="h-4 w-4 text-muted-foreground" />
			{:else}
				<ChevronRight class="h-4 w-4 text-muted-foreground" />
			{/if}

			<Server class="h-4 w-4 text-primary" />

			<div class="flex flex-col">
				<span class="font-mono text-sm font-medium">{host.ip}</span>
				{#if host.hostname}
					<span class="flex items-center gap-1 text-xs text-muted-foreground">
						<Globe class="h-3 w-3" />
						{host.hostname}
					</span>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-4 text-xs text-muted-foreground">
			<span class="rounded-full bg-green-500/10 px-2 py-0.5 text-green-600 dark:text-green-400">
				{openPorts.length} open
			</span>
			<span class="flex items-center gap-1">
				<Clock class="h-3 w-3" />
				{formatDuration(host.scanDurationMs)}
			</span>
		</div>
	</button>

	<!-- Expanded Content -->
	{#if expanded}
		<div class="border-t px-4 py-3">
			<table class="w-full text-xs">
				<thead>
					<tr class="text-left text-muted-foreground">
						<th class="pb-2 pr-4 font-medium">Port</th>
						<th class="pb-2 pr-4 font-medium">State</th>
						<th class="pb-2 pr-4 font-medium">Service</th>
						<th class="pb-2 font-medium">Banner</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border/50">
					{#each openPorts as port (port.port)}
						<tr class="hover:bg-muted/30">
							<td class="py-2 pr-4 font-mono">{port.port}</td>
							<td class="py-2 pr-4">
								<span
									class={cn(
										'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
										port.state === 'open' && 'bg-green-500/10 text-green-600 dark:text-green-400',
										port.state === 'filtered' &&
											'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
										port.state === 'closed' && 'bg-red-500/10 text-red-600 dark:text-red-400'
									)}
								>
									{port.state}
								</span>
							</td>
							<td class="py-2 pr-4 text-muted-foreground">
								{port.service ?? '-'}
							</td>
							<td class="py-2">
								{#if port.banner}
									<div class="flex items-center gap-2">
										<code
											class="max-w-[300px] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"
										>
											{port.banner}
										</code>
										<CopyButton
											text={port.banner}
											toastLabel="Banner"
											size="icon"
											class="h-5 w-5"
										/>
									</div>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
