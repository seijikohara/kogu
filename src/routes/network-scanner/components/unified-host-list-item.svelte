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
		readonly hostId: string;
		readonly ips: readonly string[];
		readonly hostname: string | null;
		readonly hostnameSource?: string | null;
		readonly macAddress?: string | null;
		readonly vendor: string | null;
		readonly openPortCount: number;
		readonly discoveryMethodCount: number;
		readonly mdnsServiceCount: number;
		readonly selected: boolean;
		readonly isNew?: boolean;
		readonly deviceCategory?: DeviceCategory;
		readonly hasPortScan?: boolean;
		readonly onclick: () => void;
	}

	let {
		hostId,
		ips,
		hostname,
		hostnameSource = null,
		macAddress = null,
		vendor,
		openPortCount,
		discoveryMethodCount,
		mdnsServiceCount,
		selected,
		isNew = false,
		deviceCategory = 'unknown',
		hasPortScan = false,
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

	const primaryIp = $derived(ips[0] ?? '');
	const isIPv6 = (ip: string): boolean => ip.includes(':');
	const additionalIpv4s = $derived(ips.slice(1).filter((ip) => !isIPv6(ip)));
	const ipv6Count = $derived(ips.filter(isIPv6).length);
	const ipv6Addresses = $derived(ips.filter(isIPv6));

	// Supplementary line: always show vendor and/or MAC when available
	const macDisplay = $derived(macAddress ? macAddress.toUpperCase() : null);
	const supplementaryText = $derived(
		vendor && macDisplay ? `${vendor} · ${macDisplay}` : (vendor ?? macDisplay)
	);
	const supplementaryIsMono = $derived(!vendor && !!macDisplay);
</script>

<button
	type="button"
	data-host-id={hostId}
	class="flex w-full items-start gap-2 border-b border-border border-l-2 px-3 py-2.5 text-left transition-colors last:border-b-0
		{selected ? 'border-l-primary bg-primary/10' : 'border-l-transparent hover:bg-interactive-hover'}
		{isNew ? 'animate-highlight-new' : ''}"
	{onclick}
>
	<!-- Device icon -->
	<div class="mt-0.5 flex w-8 shrink-0 items-center justify-center">
		<DeviceIcon class="h-4 w-4 {openPortCount > 0 ? 'text-success' : 'text-muted-foreground'}" />
	</div>
	<div class="min-w-0 flex-1">
		<!-- Primary IP + IPv6 badge + status dot + badges -->
		<div class="flex items-center gap-2">
			<span class="font-mono text-sm font-medium">{primaryIp}</span>
			{#if ipv6Count > 0}
				<span
					class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
					title={ipv6Addresses.join('\n')}
				>
					IPv6{ipv6Count > 1 ? ` ×${ipv6Count}` : ''}
				</span>
			{/if}
			{#if hasPortScan}
				<span
					class="h-1.5 w-1.5 shrink-0 rounded-full {openPortCount > 0
						? 'bg-success'
						: 'bg-muted-foreground/50'}"
					title={openPortCount > 0 ? `${openPortCount} open ports` : 'No open ports'}
				></span>
			{/if}
			<!-- Badges -->
			<div class="flex items-center gap-1">
				{#if openPortCount > 0}
					<span
						class="flex items-center gap-0.5 rounded bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success"
						title="{openPortCount} open ports"
					>
						<CheckCircle2 class="h-2.5 w-2.5" />
						{openPortCount}
					</span>
				{/if}
				{#if discoveryMethodCount > 1}
					<span
						class="flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
						title="{discoveryMethodCount} discovery methods"
					>
						<Radar class="h-2.5 w-2.5" />
						{discoveryMethodCount}
					</span>
				{/if}
				{#if mdnsServiceCount > 0}
					<span
						class="flex items-center gap-0.5 rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info"
						title="{mdnsServiceCount} mDNS services"
					>
						<Radio class="h-2.5 w-2.5" />
						{mdnsServiceCount}
					</span>
				{/if}
			</div>
		</div>

		<!-- Hostname + source badge -->
		{#if hostname}
			<div class="flex items-center gap-1.5">
				<p class="truncate text-xs text-muted-foreground" title={hostname}>
					{hostname}
				</p>
				{#if hostnameSource}
					<span
						class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase text-muted-foreground"
					>
						{hostnameSource}
					</span>
				{/if}
			</div>
		{/if}

		<!-- Supplementary info: vendor and/or MAC address -->
		{#if supplementaryText}
			<p
				class="truncate text-xs text-muted-foreground/70 {supplementaryIsMono ? 'font-mono' : ''}"
				title={supplementaryText}
			>
				{supplementaryText}
			</p>
		{/if}

		<!-- Additional IPv4 addresses -->
		{#if additionalIpv4s.length > 0}
			<div class="mt-0.5 flex flex-wrap gap-1">
				{#each additionalIpv4s as ip (ip)}
					<span
						class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
						title={ip}
					>
						{ip}
					</span>
				{/each}
			</div>
		{/if}
	</div>
</button>
