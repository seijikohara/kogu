<script lang="ts">
	import { CheckCircle2, Clock, Copy, Play, Radar, Server } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { DiscoveryResult } from '$lib/services/network-scanner.js';
	import { formatDuration } from '$lib/services/network-scanner.js';

	interface DiscoveryInfo {
		method: string;
		durationMs: number;
		error: string | null;
	}

	interface Props {
		readonly ip: string;
		readonly discoveries: readonly DiscoveryInfo[];
		readonly onscan?: () => void;
		readonly scanDisabled?: boolean;
	}

	let { ip, discoveries, onscan, scanDisabled = false }: Props = $props();

	const copyToClipboard = async (text: string, label: string) => {
		await navigator.clipboard.writeText(text);
		toast.success(`${label} copied`);
	};

	const formatMethodName = (method: string) =>
		method
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Header -->
	<div class="shrink-0 border-b bg-muted/30 px-4 py-3">
		<div class="flex items-start justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-green-500/10 p-2">
					<Server class="h-5 w-5 text-green-500" />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h2 class="font-mono text-lg font-semibold">{ip}</h2>
						<button
							type="button"
							class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							onclick={() => copyToClipboard(ip, 'IP address')}
							title="Copy IP"
						>
							<Copy class="h-3.5 w-3.5" />
						</button>
					</div>
					<p class="text-sm text-muted-foreground">
						Discovered via {discoveries.length} method{discoveries.length > 1 ? 's' : ''}
					</p>
				</div>
			</div>
		</div>

		<!-- Stats -->
		<div class="mt-3 flex items-center gap-4">
			<div class="flex items-center gap-1.5 text-xs">
				<CheckCircle2 class="h-3.5 w-3.5 text-green-500" />
				<span class="text-muted-foreground">Host is reachable</span>
			</div>
		</div>
	</div>

	<!-- Discovery Details -->
	<div class="flex-1 overflow-auto p-4">
		<div class="mb-4">
			<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
				<Radar class="h-4 w-4 text-primary" />
				Discovery Methods
			</h3>
			<div class="space-y-2">
				{#each discoveries as discovery (discovery.method)}
					<div class="rounded-lg border bg-card p-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div class="rounded bg-primary/10 p-1.5">
									<Radar class="h-4 w-4 text-primary" />
								</div>
								<div>
									<span class="font-medium">{formatMethodName(discovery.method)}</span>
									{#if discovery.error}
										<p class="mt-0.5 text-xs text-destructive">{discovery.error}</p>
									{/if}
								</div>
							</div>
							<div class="flex items-center gap-1 text-xs text-muted-foreground">
								<Clock class="h-3 w-3" />
								<span>{formatDuration(discovery.durationMs)}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Action: Scan Ports -->
		{#if onscan}
			<div class="border-t pt-4">
				<h3 class="mb-2 text-sm font-medium">Actions</h3>
				<button
					type="button"
					class="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
					onclick={onscan}
					disabled={scanDisabled}
				>
					<Play class="h-4 w-4" />
					<span>Scan Ports on This Host</span>
				</button>
			</div>
		{/if}
	</div>
</div>
