<script lang="ts">
	import { CheckCircle2, Radar, Server } from '@lucide/svelte';

	interface Props {
		readonly ips: readonly string[];
		readonly hostname: string | null;
		readonly openPortCount: number;
		readonly discoveryMethodCount: number;
		readonly selected: boolean;
		readonly isNew?: boolean;
		readonly onclick: () => void;
	}

	let {
		ips,
		hostname,
		openPortCount,
		discoveryMethodCount,
		selected,
		isNew = false,
		onclick,
	}: Props = $props();

	const isIPv6 = (ip: string): boolean => ip.includes(':');
	const primaryIp = $derived(ips[0] ?? '');
	const hasMultipleIps = $derived(ips.length > 1);
</script>

<button
	type="button"
	class="flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0
		{selected ? 'bg-primary/10' : 'hover:bg-muted/50'}
		{isNew ? 'animate-highlight-new' : ''}"
	{onclick}
>
	<Server
		class="mt-0.5 h-4 w-4 shrink-0 {openPortCount > 0 ? 'text-green-500' : 'text-muted-foreground'}"
	/>
	<div class="min-w-0 flex-1">
		<!-- Primary IP -->
		<div class="flex items-center gap-2">
			<span class="font-mono text-sm font-medium">{primaryIp}</span>
			<!-- Badges -->
			<div class="flex items-center gap-1">
				{#if openPortCount > 0}
					<span
						class="flex items-center gap-0.5 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400"
					>
						<CheckCircle2 class="h-2.5 w-2.5" />
						{openPortCount}
					</span>
				{/if}
				{#if discoveryMethodCount > 0}
					<span
						class="flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
					>
						<Radar class="h-2.5 w-2.5" />
						{discoveryMethodCount}
					</span>
				{/if}
			</div>
		</div>

		<!-- Hostname or additional IPs -->
		{#if hostname}
			<p class="truncate text-xs text-muted-foreground" title={hostname}>
				{hostname}
			</p>
		{/if}

		<!-- Additional IPs (IPv4/IPv6) -->
		{#if hasMultipleIps}
			<div class="mt-0.5 flex flex-wrap gap-1">
				{#each ips.slice(1) as ip (ip)}
					<span
						class="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground"
						title={ip}
					>
						{isIPv6(ip) ? 'IPv6' : ip}
					</span>
				{/each}
			</div>
		{/if}
	</div>
</button>
