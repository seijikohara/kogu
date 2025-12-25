<script lang="ts">
	import {
		CheckCircle2,
		Clock,
		Copy,
		Globe,
		Lock,
		Network,
		Server,
		Shield,
		XCircle,
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { HostResult, PortInfo } from '$lib/services/network-scanner.js';
	import { formatDuration } from '$lib/services/network-scanner.js';

	interface Props {
		readonly host: HostResult;
	}

	let { host }: Props = $props();

	const openPorts = $derived(host.ports.filter((p) => p.state === 'open'));
	const closedPorts = $derived(host.ports.filter((p) => p.state === 'closed'));
	const filteredPorts = $derived(host.ports.filter((p) => p.state === 'filtered'));

	const copyToClipboard = async (text: string, label: string) => {
		await navigator.clipboard.writeText(text);
		toast.success(`${label} copied`);
	};

	const getPortIcon = (port: number) => {
		if (port === 443 || port === 8443) return Lock;
		if (port === 80 || port === 8080) return Globe;
		if (port === 22) return Shield;
		return Network;
	};

	const getStateColor = (state: string) => {
		switch (state) {
			case 'open':
				return 'text-green-500';
			case 'closed':
				return 'text-red-500';
			case 'filtered':
				return 'text-yellow-500';
			default:
				return 'text-muted-foreground';
		}
	};
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Header -->
	<div class="shrink-0 border-b bg-muted/30 px-4 py-3">
		<div class="flex items-start justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-primary/10 p-2">
					<Server class="h-5 w-5 text-primary" />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h2 class="font-mono text-lg font-semibold">{host.ip}</h2>
						<button
							type="button"
							class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							onclick={() => copyToClipboard(host.ip, 'IP address')}
							title="Copy IP"
						>
							<Copy class="h-3.5 w-3.5" />
						</button>
					</div>
					{#if host.hostname}
						<div class="flex items-center gap-2">
							<p class="text-sm text-muted-foreground">{host.hostname}</p>
							<button
								type="button"
								class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								onclick={() => copyToClipboard(host.hostname ?? '', 'Hostname')}
								title="Copy hostname"
							>
								<Copy class="h-3 w-3" />
							</button>
						</div>
					{/if}
				</div>
			</div>
			<div class="text-right text-xs text-muted-foreground">
				<div class="flex items-center gap-1">
					<Clock class="h-3 w-3" />
					<span>{formatDuration(host.scanDurationMs)}</span>
				</div>
			</div>
		</div>

		<!-- Stats -->
		<div class="mt-3 flex gap-4 text-xs">
			<div class="flex items-center gap-1.5">
				<CheckCircle2 class="h-3.5 w-3.5 text-green-500" />
				<span class="text-muted-foreground">Open:</span>
				<span class="font-medium">{openPorts.length}</span>
			</div>
			{#if closedPorts.length > 0}
				<div class="flex items-center gap-1.5">
					<XCircle class="h-3.5 w-3.5 text-red-500" />
					<span class="text-muted-foreground">Closed:</span>
					<span class="font-medium">{closedPorts.length}</span>
				</div>
			{/if}
			{#if filteredPorts.length > 0}
				<div class="flex items-center gap-1.5">
					<Shield class="h-3.5 w-3.5 text-yellow-500" />
					<span class="text-muted-foreground">Filtered:</span>
					<span class="font-medium">{filteredPorts.length}</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Port List -->
	<div class="flex-1 overflow-auto p-4">
		{#if openPorts.length > 0}
			<div class="mb-4">
				<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
					<CheckCircle2 class="h-4 w-4 text-green-500" />
					Open Ports
				</h3>
				<div class="space-y-2">
					{#each openPorts as port (port.port)}
						{@const PortIcon = getPortIcon(port.port)}
						<div class="rounded-lg border bg-card p-3">
							<div class="flex items-start justify-between">
								<div class="flex items-center gap-3">
									<div class="rounded bg-green-500/10 p-1.5">
										<PortIcon class="h-4 w-4 text-green-600 dark:text-green-400" />
									</div>
									<div>
										<div class="flex items-center gap-2">
											<span class="font-mono font-semibold">{port.port}</span>
											{#if port.service}
												<span class="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
													{port.service}
												</span>
											{/if}
										</div>
										{#if port.banner}
											<p class="mt-1 font-mono text-xs text-muted-foreground" title={port.banner}>
												{port.banner.length > 80 ? `${port.banner.slice(0, 80)}...` : port.banner}
											</p>
										{/if}
									</div>
								</div>
								<span class="text-xs font-medium {getStateColor(port.state)}">
									{port.state}
								</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if filteredPorts.length > 0}
			<div class="mb-4">
				<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
					<Shield class="h-4 w-4 text-yellow-500" />
					Filtered Ports
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each filteredPorts as port (port.port)}
						<div class="flex items-center gap-1.5 rounded border bg-yellow-500/5 px-2 py-1 text-xs">
							<span class="font-mono font-medium">{port.port}</span>
							{#if port.service}
								<span class="text-muted-foreground">({port.service})</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if closedPorts.length > 0}
			<div>
				<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
					<XCircle class="h-4 w-4 text-red-500" />
					Closed Ports
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each closedPorts as port (port.port)}
						<div class="flex items-center gap-1.5 rounded border bg-red-500/5 px-2 py-1 text-xs">
							<span class="font-mono font-medium">{port.port}</span>
							{#if port.service}
								<span class="text-muted-foreground">({port.service})</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if host.ports.length === 0}
			<div class="flex h-full items-center justify-center text-muted-foreground">
				<div class="text-center">
					<Network class="mx-auto mb-2 h-8 w-8 opacity-50" />
					<p class="text-sm">No ports scanned</p>
				</div>
			</div>
		{/if}
	</div>
</div>
