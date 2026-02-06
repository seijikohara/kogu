<script lang="ts">
	import {
		Camera,
		CheckCircle2,
		ChevronRight,
		CircleDot,
		Clock,
		Copy,
		Cpu,
		Database,
		Globe,
		HardDrive,
		Hash,
		Info,
		Laptop,
		Lock,
		Mail,
		Monitor,
		Network,
		Play,
		Printer,
		Radar,
		Radio,
		Router,
		Server,
		Shield,
		Smartphone,
		Speaker,
		Tablet,
		Terminal,
		Tv,
		Wifi,
		XCircle,
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		DEVICE_CATEGORIES,
		type DeviceCategory,
		type DeviceClassification,
	} from '$lib/services/device-classifier.js';
	import type {
		MdnsServiceInfo,
		PortInfo,
		SnmpDeviceInfo,
		SsdpDeviceInfo,
		WsDiscoveryInfo,
	} from '$lib/services/network-scanner.js';
	import { formatDuration, WELL_KNOWN_SERVICES } from '$lib/services/network-scanner.js';

	interface DiscoveryInfo {
		method: string;
		durationMs: number;
		error: string | null;
	}

	interface Props {
		readonly ips: readonly string[];
		readonly hostname: string | null;
		readonly hostnameSource?: string | null;
		readonly netbiosName?: string | null;
		readonly macAddress?: string | null;
		readonly vendor?: string | null;
		readonly mdnsServices?: readonly MdnsServiceInfo[];
		readonly ssdpDevice?: SsdpDeviceInfo | null;
		readonly wsDiscovery?: WsDiscoveryInfo | null;
		readonly snmpInfo?: SnmpDeviceInfo | null;
		readonly tlsNames?: readonly string[];
		readonly classification?: DeviceClassification | null;
		readonly discoveryMethods: readonly string[];
		readonly discoveries: readonly DiscoveryInfo[];
		readonly ports: readonly PortInfo[];
		readonly scanDurationMs: number | null;
		readonly onscan?: (ip: string) => void;
		readonly scanDisabled?: boolean;
	}

	let {
		ips,
		hostname,
		hostnameSource = null,
		netbiosName = null,
		macAddress = null,
		vendor = null,
		mdnsServices = [],
		ssdpDevice = null,
		wsDiscovery = null,
		snmpInfo = null,
		tlsNames = [],
		classification = null,
		discoveryMethods,
		discoveries,
		ports,
		scanDurationMs,
		onscan,
		scanDisabled = false,
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

	// Filter out uninformative hostnames
	const IGNORED_HOSTNAMES = new Set(['localhost', 'localhost.local', 'localhost.localdomain']);
	const isUsefulHostname = (name: string | null | undefined): name is string =>
		!!name && !IGNORED_HOSTNAMES.has(name.toLowerCase());

	const deviceCategory = $derived(classification?.category ?? 'unknown');
	const HeaderIcon = $derived(DEVICE_ICONS[deviceCategory] ?? CircleDot);

	const confidenceLabel = $derived.by(() => {
		if (!classification || classification.confidence === 0) return null;
		if (classification.confidence >= 0.7) return 'High';
		if (classification.confidence >= 0.4) return 'Medium';
		return 'Low';
	});

	const confidenceColor = $derived.by(() => {
		if (!classification || classification.confidence === 0) return '';
		if (classification.confidence >= 0.7) return 'text-success';
		if (classification.confidence >= 0.4) return 'text-warning';
		return 'text-muted-foreground';
	});

	// Tab state
	type Tab = 'overview' | 'ports' | 'discovery' | 'services';
	let activeTab = $state<Tab>('overview');

	const isIPv6 = (ip: string): boolean => ip.includes(':');
	const primaryIp = $derived(ips[0] ?? '');
	const ipv4Addresses = $derived(ips.filter((ip) => !isIPv6(ip)));
	const ipv6Addresses = $derived(ips.filter((ip) => isIPv6(ip)));

	const openPorts = $derived([...ports].filter((p) => p.state === 'open'));
	const closedPorts = $derived([...ports].filter((p) => p.state === 'closed'));
	const filteredPorts = $derived([...ports].filter((p) => p.state === 'filtered'));

	// Quick action derived values
	const hasWebPort = $derived(
		ports.some((p) => p.state === 'open' && [80, 443, 8080, 8443].includes(p.port))
	);
	const hasSshPort = $derived(ports.some((p) => p.state === 'open' && p.port === 22));

	const openInBrowser = async () => {
		const webPort = ports.find((p) => p.state === 'open' && [443, 8443, 80, 8080].includes(p.port));
		if (!webPort) return;
		const protocol = [443, 8443].includes(webPort.port) ? 'https' : 'http';
		const url =
			webPort.port === 80 || webPort.port === 443
				? `${protocol}://${primaryIp}`
				: `${protocol}://${primaryIp}:${webPort.port}`;
		const { openUrl } = await import('@tauri-apps/plugin-opener');
		openUrl(url);
	};

	const copySshCommand = () => {
		copyToClipboard(`ssh ${hostname ?? primaryIp}`, 'SSH command');
	};

	// Tab definitions with counts
	const tabs = $derived([
		{ id: 'overview' as const, label: 'Overview', icon: Info, count: null },
		{
			id: 'ports' as const,
			label: 'Ports',
			icon: Network,
			count: openPorts.length > 0 ? openPorts.length : null,
		},
		{
			id: 'discovery' as const,
			label: 'Discovery',
			icon: Radar,
			count: discoveries.length > 0 ? discoveries.length : null,
		},
		{
			id: 'services' as const,
			label: 'Services',
			icon: Radio,
			count: mdnsServices.length > 0 ? mdnsServices.length : null,
		},
	]);

	const copyToClipboard = async (text: string, label: string) => {
		await navigator.clipboard.writeText(text);
		toast.success(`${label} copied`);
	};

	const formatMethodName = (method: string) =>
		method
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');

	const getMethodDescription = (method: string): string => {
		switch (method) {
			case 'icmp_ping':
				return 'ICMP Echo Request (ping)';
			case 'arp_scan':
				return 'ARP Request (local network)';
			case 'tcp_syn':
				return 'TCP SYN Probe (half-open)';
			case 'tcp_connect':
				return 'TCP Connect (full handshake)';
			case 'mdns':
				return 'mDNS/Bonjour Discovery';
			case 'ssdp':
				return 'SSDP/UPnP Discovery';
			case 'udp_scan':
				return 'UDP Probe (DNS, NetBIOS, SNMP)';
			case 'icmpv6_ping':
				return 'ICMPv6 Echo Request';
			case 'ws_discovery':
				return 'WS-Discovery (SOAP/UDP)';
			case 'arp_cache':
				return 'OS ARP Cache';
			case 'local':
				return 'Local Interface';
			default:
				return method;
		}
	};

	/** Whether SSDP device info has meaningful content */
	const hasSsdpInfo = $derived(
		ssdpDevice &&
			(ssdpDevice.friendlyName ||
				ssdpDevice.manufacturer ||
				ssdpDevice.modelName ||
				ssdpDevice.deviceType ||
				ssdpDevice.server)
	);

	const getPortIcon = (port: number) => {
		if ([443, 8443].includes(port)) return Lock;
		if ([80, 8080].includes(port)) return Globe;
		if (port === 22) return Terminal;
		if ([3306, 5432, 27017, 6379].includes(port)) return Database;
		if ([25, 110, 143, 993, 995].includes(port)) return Mail;
		if ([21, 445, 139, 548].includes(port)) return HardDrive;
		if ([3389, 5900].includes(port)) return Monitor;
		if (port === 53) return Globe;
		return Network;
	};

	const getStateColor = (state: string) => {
		switch (state) {
			case 'open':
				return 'text-success';
			case 'closed':
				return 'text-destructive';
			case 'filtered':
				return 'text-warning';
			default:
				return 'text-muted-foreground';
		}
	};

	const getServiceName = (port: PortInfo): string => {
		if (port.service) return port.service;
		return WELL_KNOWN_SERVICES[port.port] ?? '';
	};
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Header -->
	<div class="shrink-0 border-b bg-surface-3 px-4 py-3">
		<div class="flex items-start justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-primary/10 p-2">
					<HeaderIcon class="h-5 w-5 text-primary" />
				</div>
				<div>
					<!-- Hostname (primary if available, fallback to NetBIOS name or SSDP friendly name) -->
					{#if isUsefulHostname(hostname) || isUsefulHostname(netbiosName) || isUsefulHostname(ssdpDevice?.friendlyName)}
						{@const displayName = isUsefulHostname(hostname)
							? hostname
							: isUsefulHostname(netbiosName)
								? netbiosName
								: ssdpDevice?.friendlyName}
						{@const displaySource = isUsefulHostname(hostname)
							? hostnameSource
							: isUsefulHostname(netbiosName)
								? 'netbios'
								: 'ssdp'}
						<div class="flex items-center gap-2">
							<h2 class="text-lg font-semibold">{displayName}</h2>
							{#if displaySource}
								<span
									class="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
									title="Resolved via {displaySource.toUpperCase()}"
								>
									{displaySource.toUpperCase()}
								</span>
							{/if}
							<button
								type="button"
								class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								onclick={() => copyToClipboard(displayName ?? '', 'Hostname')}
								title="Copy hostname"
							>
								<Copy class="h-3.5 w-3.5" />
							</button>
						</div>
						<div class="flex items-center gap-2">
							<span class="font-mono text-sm text-muted-foreground">{primaryIp}</span>
							<button
								type="button"
								class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								onclick={() => copyToClipboard(primaryIp, 'IP address')}
								title="Copy IP"
							>
								<Copy class="h-3 w-3" />
							</button>
						</div>
					{:else}
						<div class="flex items-center gap-2">
							<h2 class="font-mono text-lg font-semibold">{primaryIp}</h2>
							<button
								type="button"
								class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								onclick={() => copyToClipboard(primaryIp, 'IP address')}
								title="Copy IP"
							>
								<Copy class="h-3.5 w-3.5" />
							</button>
						</div>
						<p class="text-xs text-muted-foreground">Hostname not resolved</p>
					{/if}
					<!-- Device type + confidence -->
					{#if classification && classification.category !== 'unknown'}
						<div class="mt-1 flex items-center gap-2">
							<span class="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
								{DEVICE_CATEGORIES[classification.category].label}
							</span>
							{#if confidenceLabel}
								<span class="text-xs {confidenceColor}">{confidenceLabel} confidence</span>
							{/if}
						</div>
					{/if}
				</div>
			</div>
			<!-- Quick actions -->
			<div class="flex items-center gap-1">
				{#if hasWebPort}
					<Tooltip.Root>
						<Tooltip.Trigger>
							<button
								type="button"
								class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								onclick={openInBrowser}
								aria-label="Open in browser"
							>
								<Globe class="h-3.5 w-3.5" />
							</button>
						</Tooltip.Trigger>
						<Tooltip.Content>Open in browser</Tooltip.Content>
					</Tooltip.Root>
				{/if}
				{#if hasSshPort}
					<Tooltip.Root>
						<Tooltip.Trigger>
							<button
								type="button"
								class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								onclick={copySshCommand}
								aria-label="Copy SSH command"
							>
								<Terminal class="h-3.5 w-3.5" />
							</button>
						</Tooltip.Trigger>
						<Tooltip.Content>Copy SSH command</Tooltip.Content>
					</Tooltip.Root>
				{/if}
				{#if scanDurationMs}
					<div class="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
						<Clock class="h-3 w-3" />
						<span>{formatDuration(scanDurationMs)}</span>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Tabs -->
	<div class="shrink-0 flex border-b bg-surface-2">
		{#each tabs as tab (tab.id)}
			{@const TabIcon = tab.icon}
			<button
				type="button"
				class="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors
					{activeTab === tab.id
					? 'border-b-2 border-primary text-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => (activeTab = tab.id)}
			>
				<TabIcon class="h-3.5 w-3.5" />
				{tab.label}
				{#if tab.count !== null}
					<span class="rounded-full bg-muted px-1.5 py-0.5 text-xs">{tab.count}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	<div class="flex-1 overflow-auto p-4">
		{#key activeTab}
			<div class="animate-fade-in">
				<!-- Overview Tab -->
				{#if activeTab === 'overview'}
					<!-- Summary Stats -->
					<div class="mb-4 grid grid-cols-2 gap-2">
						<div class="rounded-lg border bg-card p-2.5">
							<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Hash class="h-3 w-3" />
								IPs
							</div>
							<div class="mt-0.5 text-base font-semibold tabular-nums">{ips.length}</div>
						</div>
						<div class="rounded-lg border bg-card p-2.5">
							<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
								<CheckCircle2 class="h-3 w-3 text-success" />
								Open Ports
							</div>
							<div class="mt-0.5 text-base font-semibold tabular-nums">{openPorts.length}</div>
						</div>
						<div class="rounded-lg border bg-card p-2.5">
							<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Radar class="h-3 w-3 text-primary" />
								Discovery
							</div>
							<div class="mt-0.5 text-base font-semibold tabular-nums">{discoveries.length}</div>
						</div>
						<div class="rounded-lg border bg-card p-2.5">
							<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Radio class="h-3 w-3 text-info" />
								Services
							</div>
							<div class="mt-0.5 text-base font-semibold tabular-nums">{mdnsServices.length}</div>
						</div>
					</div>

					<!-- IP Addresses Section -->
					{#if ips.length > 1 || ipv6Addresses.length > 0}
						<div class="mb-4">
							<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
								<Hash class="h-4 w-4 text-muted-foreground" />
								IP Addresses
							</h3>
							<div class="space-y-2">
								{#if ipv4Addresses.length > 0}
									<div class="rounded-lg border bg-card p-3">
										<div class="mb-1.5 text-xs font-medium text-muted-foreground">IPv4</div>
										<div class="flex flex-wrap gap-2">
											{#each ipv4Addresses as ip (ip)}
												<button
													type="button"
													class="flex items-center gap-1.5 rounded bg-muted px-2 py-1 font-mono text-xs transition-colors hover:bg-muted/80"
													onclick={() => copyToClipboard(ip, 'IP address')}
													title="Copy {ip}"
												>
													{ip}
													<Copy class="h-3 w-3 text-muted-foreground" />
												</button>
											{/each}
										</div>
									</div>
								{/if}
								{#if ipv6Addresses.length > 0}
									<div class="rounded-lg border bg-card p-3">
										<div class="mb-1.5 text-xs font-medium text-muted-foreground">IPv6</div>
										<div class="space-y-1">
											{#each ipv6Addresses as ip (ip)}
												<button
													type="button"
													class="flex w-full items-center justify-between gap-2 rounded bg-muted px-2 py-1 font-mono text-xs transition-colors hover:bg-muted/80"
													onclick={() => copyToClipboard(ip, 'IP address')}
													title="Copy {ip}"
												>
													<span class="truncate">{ip}</span>
													<Copy class="h-3 w-3 shrink-0 text-muted-foreground" />
												</button>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Device Classification -->
					{#if classification && classification.category !== 'unknown'}
						<div class="mb-4">
							<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
								<HeaderIcon class="h-4 w-4 text-muted-foreground" />
								Device Type
							</h3>
							<div class="rounded-lg border bg-card p-3">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="text-sm font-medium">
											{DEVICE_CATEGORIES[classification.category].label}
										</span>
										{#if confidenceLabel}
											<span
												class="rounded px-1.5 py-0.5 text-xs font-medium {confidenceColor} bg-muted"
											>
												{confidenceLabel}
											</span>
										{/if}
									</div>
									<span class="text-xs text-muted-foreground">
										{(classification.confidence * 100).toFixed(0)}%
									</span>
								</div>
								<p class="mt-1 text-xs text-muted-foreground">
									{DEVICE_CATEGORIES[classification.category].description}
								</p>
								{#if classification.evidence.length > 0}
									<div class="mt-2 border-t pt-2">
										<div class="text-xs text-muted-foreground">
											{#each classification.evidence as evidence}
												<div class="flex items-center gap-1">
													<span class="text-[8px]">-</span>
													<span>{evidence}</span>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Device Info -->
					{#if macAddress || vendor || netbiosName}
						<div class="mb-4">
							<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
								<Cpu class="h-4 w-4 text-muted-foreground" />
								Device Info
							</h3>
							<div class="grid grid-cols-2 gap-2">
								{#if netbiosName}
									<div class="rounded-lg border bg-card p-2.5">
										<div class="text-xs text-muted-foreground">NetBIOS Name</div>
										<div class="mt-0.5 flex items-center gap-1.5 font-mono text-sm font-medium">
											{netbiosName}
											<button
												type="button"
												class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
												onclick={() => copyToClipboard(netbiosName ?? '', 'NetBIOS name')}
												title="Copy NetBIOS name"
											>
												<Copy class="h-3 w-3" />
											</button>
										</div>
									</div>
								{/if}
								{#if macAddress}
									<div class="rounded-lg border bg-card p-2.5">
										<div class="text-xs text-muted-foreground">MAC Address</div>
										<div class="mt-0.5 flex items-center gap-1.5 font-mono text-sm font-medium">
											{macAddress}
											<button
												type="button"
												class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
												onclick={() => copyToClipboard(macAddress ?? '', 'MAC address')}
												title="Copy MAC address"
											>
												<Copy class="h-3 w-3" />
											</button>
										</div>
									</div>
								{/if}
								{#if vendor}
									<div
										class="rounded-lg border bg-card p-2.5 {netbiosName && macAddress
											? 'col-span-2'
											: ''}"
									>
										<div class="text-xs text-muted-foreground">Vendor</div>
										<div class="mt-0.5 text-sm">{vendor}</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}

					<!-- UPnP/SSDP Device Info -->
					{#if hasSsdpInfo}
						<div class="mb-4">
							<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
								<Wifi class="h-4 w-4 text-muted-foreground" />
								UPnP Device
							</h3>
							<div class="rounded-lg border bg-card p-3">
								{#if ssdpDevice?.friendlyName}
									<div>
										<div class="text-xs font-medium text-muted-foreground">Friendly Name</div>
										<div class="text-sm font-medium">{ssdpDevice.friendlyName}</div>
									</div>
								{/if}
								{#if ssdpDevice?.manufacturer || ssdpDevice?.modelName}
									<div class={ssdpDevice?.friendlyName ? 'mt-2 border-t pt-2' : ''}>
										<div class="text-xs font-medium text-muted-foreground">
											{ssdpDevice?.manufacturer && ssdpDevice?.modelName
												? 'Manufacturer / Model'
												: ssdpDevice?.manufacturer
													? 'Manufacturer'
													: 'Model'}
										</div>
										<div class="text-sm">
											{[ssdpDevice?.manufacturer, ssdpDevice?.modelName].filter(Boolean).join(' ')}
											{#if ssdpDevice?.modelNumber}
												<span class="text-muted-foreground">({ssdpDevice.modelNumber})</span>
											{/if}
										</div>
									</div>
								{/if}
								{#if ssdpDevice?.deviceType}
									<div
										class={ssdpDevice?.friendlyName ||
										ssdpDevice?.manufacturer ||
										ssdpDevice?.modelName
											? 'mt-2 border-t pt-2'
											: ''}
									>
										<div class="text-xs font-medium text-muted-foreground">Device Type</div>
										<div class="font-mono text-xs text-muted-foreground">
											{ssdpDevice.deviceType}
										</div>
									</div>
								{/if}
								{#if ssdpDevice?.server}
									<div class="mt-2 border-t pt-2">
										<div class="text-xs font-medium text-muted-foreground">Server</div>
										<div class="font-mono text-xs text-muted-foreground">{ssdpDevice.server}</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}

					<!-- WS-Discovery Info -->
					{#if wsDiscovery && (wsDiscovery.deviceTypes.length > 0 || wsDiscovery.scopes.length > 0)}
						<div class="mb-4">
							<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
								<Globe class="h-4 w-4 text-muted-foreground" />
								WS-Discovery
							</h3>
							<div class="rounded-lg border bg-card p-3">
								{#if wsDiscovery.deviceTypes.length > 0}
									<div>
										<div class="text-xs font-medium text-muted-foreground">Device Types</div>
										<div class="mt-1 space-y-0.5">
											{#each wsDiscovery.deviceTypes as dtype (dtype)}
												<div class="font-mono text-xs text-muted-foreground">{dtype}</div>
											{/each}
										</div>
									</div>
								{/if}
								{#if wsDiscovery.scopes.length > 0}
									<div class={wsDiscovery.deviceTypes.length > 0 ? 'mt-2 border-t pt-2' : ''}>
										<div class="text-xs font-medium text-muted-foreground">Scopes</div>
										<div class="mt-1 max-h-20 space-y-0.5 overflow-y-auto">
											{#each wsDiscovery.scopes as scope (scope)}
												<div class="break-all font-mono text-xs text-muted-foreground">{scope}</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}

					<!-- SNMP Info -->
					{#if snmpInfo && (snmpInfo.sysName || snmpInfo.sysDescr || snmpInfo.sysLocation || snmpInfo.sysContact)}
						<div class="mb-4">
							<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
								<Server class="h-4 w-4 text-muted-foreground" />
								SNMP
							</h3>
							<div class="rounded-lg border bg-card p-3 space-y-2">
								{#if snmpInfo.sysName}
									<div>
										<div class="text-xs font-medium text-muted-foreground">System Name</div>
										<div class="text-sm">{snmpInfo.sysName}</div>
									</div>
								{/if}
								{#if snmpInfo.sysDescr}
									<div>
										<div class="text-xs font-medium text-muted-foreground">Description</div>
										<div class="text-xs text-muted-foreground break-words">{snmpInfo.sysDescr}</div>
									</div>
								{/if}
								{#if snmpInfo.sysLocation}
									<div>
										<div class="text-xs font-medium text-muted-foreground">Location</div>
										<div class="text-sm">{snmpInfo.sysLocation}</div>
									</div>
								{/if}
								{#if snmpInfo.sysContact}
									<div>
										<div class="text-xs font-medium text-muted-foreground">Contact</div>
										<div class="text-sm">{snmpInfo.sysContact}</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}

					<!-- TLS Certificate Names -->
					{#if tlsNames && tlsNames.length > 0}
						<div class="mb-4">
							<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
								<Shield class="h-4 w-4 text-muted-foreground" />
								TLS Certificate
							</h3>
							<div class="rounded-lg border bg-card p-3">
								<div class="text-xs font-medium text-muted-foreground">
									Subject Alternative Names
								</div>
								<div class="mt-1 space-y-0.5">
									{#each tlsNames as name (name)}
										<div class="font-mono text-sm">{name}</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					<!-- Ports Tab -->
				{:else if activeTab === 'ports'}
					{#if ports.length === 0}
						<div class="flex h-full items-center justify-center">
							<div class="max-w-xs text-center">
								<div class="mx-auto mb-3 inline-flex rounded-2xl bg-muted p-3">
									<Network class="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 class="mb-1 text-sm font-semibold">No Port Scan Data</h3>
								<p class="mb-4 text-xs leading-relaxed text-muted-foreground">
									Run a port scan to detect open services and potential vulnerabilities.
								</p>
								{#if onscan}
									<button
										type="button"
										class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
										onclick={() => onscan(primaryIp)}
										disabled={scanDisabled}
									>
										<Play class="h-4 w-4" />
										<span>Scan Ports</span>
									</button>
								{/if}
							</div>
						</div>
					{:else}
						<!-- Port Summary Bar -->
						<div class="mb-4 rounded-lg border bg-card p-3">
							<div class="flex items-center justify-between text-sm">
								<span class="font-medium">Port Summary</span>
								<span class="text-xs text-muted-foreground">{ports.length} scanned</span>
							</div>
							<div class="mt-2 flex gap-4 text-xs">
								<span class="flex items-center gap-1.5">
									<span class="h-2 w-2 rounded-full bg-success"></span>
									{openPorts.length} open
								</span>
								<span class="flex items-center gap-1.5">
									<span class="h-2 w-2 rounded-full bg-warning"></span>
									{filteredPorts.length} filtered
								</span>
								<span class="flex items-center gap-1.5">
									<span class="h-2 w-2 rounded-full bg-destructive"></span>
									{closedPorts.length} closed
								</span>
							</div>
							<div class="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
								{#if openPorts.length > 0}
									<div
										class="bg-success"
										style="width: {(openPorts.length / ports.length) * 100}%"
									></div>
								{/if}
								{#if filteredPorts.length > 0}
									<div
										class="bg-warning"
										style="width: {(filteredPorts.length / ports.length) * 100}%"
									></div>
								{/if}
								{#if closedPorts.length > 0}
									<div
										class="bg-destructive"
										style="width: {(closedPorts.length / ports.length) * 100}%"
									></div>
								{/if}
							</div>
						</div>

						<!-- Open Ports -->
						{#if openPorts.length > 0}
							<div class="mb-4">
								<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
									<CheckCircle2 class="h-4 w-4 text-success" />
									Open Ports ({openPorts.length})
								</h3>
								<div class="space-y-2">
									{#each openPorts as port (port.port)}
										{@const PortIcon = getPortIcon(port.port)}
										{@const serviceName = getServiceName(port)}
										<div
											class="rounded-lg border bg-card p-3 transition-colors hover:border-border/80"
										>
											<div class="flex items-start justify-between">
												<div class="flex items-start gap-3">
													<div class="rounded bg-success/10 p-1.5">
														<PortIcon class="h-4 w-4 text-success" />
													</div>
													<div class="min-w-0 flex-1">
														<div class="flex items-center gap-2">
															<span class="font-mono text-base font-semibold">{port.port}</span>
															{#if serviceName}
																<span class="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
																	{serviceName}
																</span>
															{/if}
														</div>
														{#if port.banner}
															<details class="mt-2">
																<summary
																	class="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
																>
																	<ChevronRight
																		class="h-3 w-3 transition-transform [[open]>&]:rotate-90"
																	/>
																	Banner / Version Info
																</summary>
																<div
																	class="mt-1.5 rounded bg-muted/50 p-2 font-mono text-xs leading-relaxed text-muted-foreground"
																>
																	{port.banner}
																</div>
															</details>
														{/if}
														{#if port.tlsCert}
															<details class="mt-2">
																<summary
																	class="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
																>
																	<ChevronRight
																		class="h-3 w-3 transition-transform [[open]>&]:rotate-90"
																	/>
																	<Lock class="h-3 w-3" />
																	TLS Certificate
																	{#if port.tlsCert.isSelfSigned}
																		<span
																			class="rounded bg-warning/10 px-1 py-0.5 text-xs font-medium text-warning"
																		>
																			Self-signed
																		</span>
																	{/if}
																</summary>
																<div class="mt-1.5 space-y-1.5 rounded bg-muted/50 p-2 text-xs">
																	{#if port.tlsCert.commonName}
																		<div class="flex gap-1">
																			<span class="shrink-0 font-medium text-muted-foreground"
																				>CN:</span
																			>
																			<span class="break-all font-mono">
																				{port.tlsCert.commonName}
																			</span>
																		</div>
																	{/if}
																	{#if port.tlsCert.issuer}
																		<div class="flex gap-1">
																			<span class="shrink-0 font-medium text-muted-foreground"
																				>Issuer:</span
																			>
																			<span class="break-all font-mono">
																				{port.tlsCert.issuer}
																			</span>
																		</div>
																	{/if}
																	{#if port.tlsCert.subjectAltNames && port.tlsCert.subjectAltNames.length > 0}
																		<div>
																			<span class="font-medium text-muted-foreground">SAN:</span>
																			<div class="ml-3 mt-0.5 space-y-0.5">
																				{#each port.tlsCert.subjectAltNames as san (san)}
																					<div class="break-all font-mono">
																						{san}
																					</div>
																				{/each}
																			</div>
																		</div>
																	{/if}
																</div>
															</details>
														{/if}
													</div>
												</div>
												<button
													type="button"
													class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
													onclick={() => copyToClipboard(String(port.port), 'Port number')}
													title="Copy port"
												>
													<Copy class="h-3 w-3" />
												</button>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Filtered Ports -->
						{#if filteredPorts.length > 0}
							<div class="mb-4">
								<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
									<Shield class="h-4 w-4 text-warning" />
									Filtered Ports ({filteredPorts.length})
								</h3>
								<div class="flex flex-wrap gap-2">
									{#each filteredPorts as port (port.port)}
										{@const serviceName = getServiceName(port)}
										<div
											class="flex items-center gap-1.5 rounded border bg-warning/5 px-2 py-1 text-xs"
											title={serviceName
												? `${port.port}/${serviceName} - Firewall or security software blocking`
												: `Port ${port.port} - Firewall or security software blocking`}
										>
											<span class="font-mono font-medium">{port.port}</span>
											{#if serviceName}
												<span class="text-muted-foreground">/{serviceName}</span>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Closed Ports -->
						{#if closedPorts.length > 0}
							<div class="mb-4">
								<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
									<XCircle class="h-4 w-4 text-destructive" />
									Closed Ports ({closedPorts.length})
								</h3>
								<div class="flex flex-wrap gap-2">
									{#each closedPorts as port (port.port)}
										{@const serviceName = getServiceName(port)}
										<div
											class="flex items-center gap-1.5 rounded border bg-destructive/5 px-2 py-1 text-xs"
											title={serviceName
												? `${port.port}/${serviceName} - No service listening`
												: `Port ${port.port} - No service listening`}
										>
											<span class="font-mono font-medium">{port.port}</span>
											{#if serviceName}
												<span class="text-muted-foreground">/{serviceName}</span>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{/if}

					<!-- Discovery Tab -->
				{:else if activeTab === 'discovery'}
					{#if discoveries.length === 0}
						<div class="flex h-full items-center justify-center">
							<div class="max-w-xs text-center">
								<div class="mx-auto mb-3 inline-flex rounded-2xl bg-muted p-3">
									<Radar class="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 class="mb-1 text-sm font-semibold">No Discovery Data</h3>
								<p class="text-xs leading-relaxed text-muted-foreground">
									Run host discovery to detect this device using various network protocols.
								</p>
							</div>
						</div>
					{:else}
						<div class="space-y-2">
							{#each discoveries as discovery (discovery.method)}
								<div class="rounded-lg border bg-card p-3 transition-colors hover:border-border/80">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-3">
											<div
												class="rounded p-1.5 {discovery.error
													? 'bg-destructive/10'
													: 'bg-success/10'}"
											>
												{#if discovery.error}
													<XCircle class="h-4 w-4 text-destructive" />
												{:else}
													<CheckCircle2 class="h-4 w-4 text-success" />
												{/if}
											</div>
											<div>
												<span class="font-medium">{formatMethodName(discovery.method)}</span>
												<p class="text-xs text-muted-foreground">
													{getMethodDescription(discovery.method)}
												</p>
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
					{/if}

					<!-- Services Tab -->
				{:else if activeTab === 'services'}
					{#if !mdnsServices || mdnsServices.length === 0}
						<div class="flex h-full items-center justify-center">
							<div class="max-w-xs text-center">
								<div class="mx-auto mb-3 inline-flex rounded-2xl bg-muted p-3">
									<Radio class="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 class="mb-1 text-sm font-semibold">No mDNS Services</h3>
								<p class="text-xs leading-relaxed text-muted-foreground">
									This host is not advertising any services via mDNS/Bonjour.
								</p>
							</div>
						</div>
					{:else}
						<div class="space-y-2">
							{#each mdnsServices as service (`${service.instanceName}-${service.serviceType}`)}
								<div class="rounded-lg border bg-card p-3 transition-colors hover:border-border/80">
									<div class="flex items-start justify-between">
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<span class="truncate font-medium">{service.instanceName}</span>
												<span
													class="shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info"
												>
													{service.serviceType.replace(/\._tcp\.local\.$/, '').replace(/^_/, '')}
												</span>
											</div>
											<div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
												<span class="font-mono">Port {service.port}</span>
											</div>
											{#if service.properties.length > 0}
												<details class="mt-2">
													<summary
														class="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
													>
														<ChevronRight
															class="h-3 w-3 transition-transform [[open]>&]:rotate-90"
														/>
														TXT Properties ({service.properties.length})
													</summary>
													<div
														class="mt-1.5 max-h-24 overflow-y-auto rounded bg-muted/50 p-2 text-xs"
													>
														{#each service.properties as [key, value] (`${key}-${value}`)}
															<div class="flex gap-2">
																<span class="font-medium text-muted-foreground">{key}:</span>
																<span class="font-mono break-all">{value || '(empty)'}</span>
															</div>
														{/each}
													</div>
												</details>
											{/if}
										</div>
										<button
											type="button"
											class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
											onclick={() =>
												copyToClipboard(
													`${service.instanceName} (${service.serviceType}:${service.port})`,
													'Service info'
												)}
											title="Copy service info"
										>
											<Copy class="h-3 w-3" />
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		{/key}
	</div>
</div>
