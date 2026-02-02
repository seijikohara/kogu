<script lang="ts">
	import {
		Camera,
		CheckCircle2,
		CircleDot,
		Cpu,
		HardDrive,
		Laptop,
		Monitor,
		Printer,
		Radar,
		Radio,
		Router,
		Server,
		Smartphone,
		Speaker,
		Tablet,
		Tv,
		Wifi,
	} from '@lucide/svelte';
	import type { DeviceCategory } from '$lib/services/device-classifier.js';

	interface Props {
		readonly ips: readonly string[];
		readonly hostname: string | null;
		readonly vendor: string | null;
		readonly openPortCount: number;
		readonly discoveryMethodCount: number;
		readonly mdnsServiceCount: number;
		readonly selected: boolean;
		readonly isNew?: boolean;
		readonly deviceCategory?: DeviceCategory;
		readonly onclick: () => void;
	}

	let {
		ips,
		hostname,
		vendor,
		openPortCount,
		discoveryMethodCount,
		mdnsServiceCount,
		selected,
		isNew = false,
		deviceCategory = 'unknown',
		onclick,
	}: Props = $props();

	const DEVICE_ICONS: Record<DeviceCategory, typeof Server> = {
		router: Router,
		access_point: Wifi,
		switch: Router,
		printer: Printer,
		nas: HardDrive,
		camera: Camera,
		media_player: Tv,
		speaker: Speaker,
		phone: Smartphone,
		tablet: Tablet,
		desktop: Monitor,
		laptop: Laptop,
		server: Server,
		iot: Cpu,
		unknown: CircleDot,
	};

	const DeviceIcon = $derived(DEVICE_ICONS[deviceCategory] ?? CircleDot);

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
	<DeviceIcon
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
						class="flex items-center gap-0.5 rounded bg-success/10 px-1.5 py-0.5 text-2xs font-medium text-success"
						title="{openPortCount} open ports"
					>
						<CheckCircle2 class="h-2.5 w-2.5" />
						{openPortCount}
					</span>
				{/if}
				{#if discoveryMethodCount > 0}
					<span
						class="flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-2xs font-medium text-primary"
						title="{discoveryMethodCount} discovery methods"
					>
						<Radar class="h-2.5 w-2.5" />
						{discoveryMethodCount}
					</span>
				{/if}
				{#if mdnsServiceCount > 0}
					<span
						class="flex items-center gap-0.5 rounded bg-purple-500/10 px-1.5 py-0.5 text-2xs font-medium text-purple-600 dark:text-purple-400"
						title="{mdnsServiceCount} mDNS services"
					>
						<Radio class="h-2.5 w-2.5" />
						{mdnsServiceCount}
					</span>
				{/if}
			</div>
		</div>

		<!-- Hostname -->
		{#if hostname}
			<p class="truncate text-xs text-muted-foreground" title={hostname}>
				{hostname}
			</p>
		{/if}

		<!-- Vendor -->
		{#if vendor}
			<p class="truncate text-2xs text-muted-foreground/70" title={vendor}>
				{vendor}
			</p>
		{/if}

		<!-- Additional IPs (IPv4/IPv6) -->
		{#if hasMultipleIps}
			<div class="mt-0.5 flex flex-wrap gap-1">
				{#each ips.slice(1) as ip (ip)}
					<span
						class="rounded bg-muted px-1 py-0.5 font-mono text-2xs text-muted-foreground"
						title={ip}
					>
						{isIPv6(ip) ? 'IPv6' : ip}
					</span>
				{/each}
			</div>
		{/if}
	</div>
</button>
