<script lang="ts">
	import {
		CheckCircle2,
		ChevronRight,
		Clock,
		Copy,
		Cpu,
		Globe,
		Hash,
		Lock,
		Monitor,
		Network,
		Play,
		Radar,
		Server,
		Settings,
		Shield,
		Wifi,
		XCircle,
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { MdnsServiceInfo, PortInfo } from '$lib/services/network-scanner.js';
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
		discoveryMethods,
		discoveries,
		ports,
		scanDurationMs,
		onscan,
		scanDisabled = false,
	}: Props = $props();

	const isIPv6 = (ip: string): boolean => ip.includes(':');
	const primaryIp = $derived(ips[0] ?? '');
	const ipv4Addresses = $derived(ips.filter((ip) => !isIPv6(ip)));
	const ipv6Addresses = $derived(ips.filter((ip) => isIPv6(ip)));

	const openPorts = $derived([...ports].filter((p) => p.state === 'open'));
	const closedPorts = $derived([...ports].filter((p) => p.state === 'closed'));
	const filteredPorts = $derived([...ports].filter((p) => p.state === 'filtered'));

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
			default:
				return method;
		}
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

	const getServiceName = (port: PortInfo): string => {
		if (port.service) return port.service;
		return WELL_KNOWN_SERVICES[port.port] ?? '';
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
					<!-- Hostname (primary if available, fallback to NetBIOS name) -->
					{#if hostname || netbiosName}
						{@const displayName = hostname ?? netbiosName}
						{@const displaySource = hostname ? hostnameSource : 'netbios'}
						<div class="flex items-center gap-2">
							<h2 class="text-lg font-semibold">{displayName}</h2>
							{#if displaySource}
								<span
									class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
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
				</div>
			</div>
			{#if scanDurationMs}
				<div class="text-right text-xs text-muted-foreground">
					<div class="flex items-center gap-1">
						<Clock class="h-3 w-3" />
						<span>{formatDuration(scanDurationMs)}</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Stats -->
		<div class="mt-3 flex gap-4 text-xs">
			{#if discoveryMethods.length > 0}
				<div class="flex items-center gap-1.5">
					<Radar class="h-3.5 w-3.5 text-primary" />
					<span class="text-muted-foreground">Discovery:</span>
					<span class="font-medium"
						>{discoveryMethods.length} method{discoveryMethods.length > 1 ? 's' : ''}</span
					>
				</div>
			{/if}
			{#if ports.length > 0}
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
			{/if}
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-auto p-4">
		<!-- IP Addresses Section -->
		{#if ips.length > 1 || ipv6Addresses.length > 0}
			<div class="mb-4">
				<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
					<Hash class="h-4 w-4 text-muted-foreground" />
					IP Addresses
				</h3>
				<div class="space-y-2">
					<!-- IPv4 -->
					{#if ipv4Addresses.length > 0}
						<div class="rounded-lg border bg-card p-3">
							<div class="mb-1.5 text-[10px] font-medium text-muted-foreground">IPv4</div>
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
					<!-- IPv6 -->
					{#if ipv6Addresses.length > 0}
						<div class="rounded-lg border bg-card p-3">
							<div class="mb-1.5 text-[10px] font-medium text-muted-foreground">IPv6</div>
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

		<!-- Device Info (MAC Address / Vendor / NetBIOS) -->
		{#if macAddress || vendor || netbiosName}
			<div class="mb-4">
				<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
					<Cpu class="h-4 w-4 text-muted-foreground" />
					Device Info
				</h3>
				<div class="rounded-lg border bg-card p-3">
					{#if netbiosName}
						<div class="flex items-center justify-between">
							<div>
								<div class="text-[10px] font-medium text-muted-foreground">NetBIOS Name</div>
								<div class="flex items-center gap-2">
									<span class="flex items-center gap-2">
										<Monitor class="h-4 w-4 text-blue-500" />
										<span class="font-mono text-sm font-medium">{netbiosName}</span>
									</span>
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
						</div>
					{/if}
					{#if macAddress}
						<div class={netbiosName ? 'mt-2 border-t pt-2' : ''}>
							<div class="text-[10px] font-medium text-muted-foreground">MAC Address</div>
							<div class="flex items-center gap-2">
								<span class="font-mono text-sm font-medium">{macAddress}</span>
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
						<div class={macAddress || netbiosName ? 'mt-2 border-t pt-2' : ''}>
							<div class="text-[10px] font-medium text-muted-foreground">Vendor</div>
							<div class="text-sm">{vendor}</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Discovery Methods -->
		{#if discoveries.length > 0}
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
										<p class="text-[10px] text-muted-foreground">
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
			</div>
		{/if}

		<!-- mDNS Services -->
		{#if mdnsServices && mdnsServices.length > 0}
			<div class="mb-4">
				<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
					<Settings class="h-4 w-4 text-blue-500" />
					mDNS Services ({mdnsServices.length})
				</h3>
				<div class="space-y-2">
					{#each mdnsServices as service (`${service.instanceName}-${service.serviceType}`)}
						<div class="rounded-lg border bg-card p-3">
							<div class="flex items-start justify-between">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="truncate font-medium">{service.instanceName}</span>
										<span
											class="shrink-0 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400"
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
												class="flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
											>
												<ChevronRight class="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
												TXT Properties ({service.properties.length})
											</summary>
											<div
												class="mt-1.5 max-h-24 overflow-y-auto rounded bg-muted/50 p-2 text-[10px]"
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
			</div>
		{/if}

		<!-- Open Ports -->
		{#if openPorts.length > 0}
			<div class="mb-4">
				<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
					<CheckCircle2 class="h-4 w-4 text-green-500" />
					Open Ports ({openPorts.length})
				</h3>
				<div class="space-y-2">
					{#each openPorts as port (port.port)}
						{@const PortIcon = getPortIcon(port.port)}
						{@const serviceName = getServiceName(port)}
						<div class="rounded-lg border bg-card p-3">
							<div class="flex items-start justify-between">
								<div class="flex items-start gap-3">
									<div class="rounded bg-green-500/10 p-1.5">
										<PortIcon class="h-4 w-4 text-green-600 dark:text-green-400" />
									</div>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="font-mono text-base font-semibold">{port.port}</span>
											{#if serviceName}
												<span class="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
													{serviceName}
												</span>
											{/if}
											<span class="text-xs font-medium {getStateColor(port.state)}">
												{port.state}
											</span>
										</div>
										{#if port.banner}
											<details class="mt-2">
												<summary
													class="flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
												>
													<ChevronRight class="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
													Banner / Version Info
												</summary>
												<div
													class="mt-1.5 rounded bg-muted/50 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground"
												>
													{port.banner}
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
					<Shield class="h-4 w-4 text-yellow-500" />
					Filtered Ports ({filteredPorts.length})
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each filteredPorts as port (port.port)}
						{@const serviceName = getServiceName(port)}
						<div
							class="flex items-center gap-1.5 rounded border bg-yellow-500/5 px-2 py-1 text-xs"
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
				<p class="mt-2 text-[10px] text-muted-foreground">
					Filtered ports are blocked by a firewall or security software.
				</p>
			</div>
		{/if}

		<!-- Closed Ports -->
		{#if closedPorts.length > 0}
			<div class="mb-4">
				<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
					<XCircle class="h-4 w-4 text-red-500" />
					Closed Ports ({closedPorts.length})
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each closedPorts as port (port.port)}
						{@const serviceName = getServiceName(port)}
						<div
							class="flex items-center gap-1.5 rounded border bg-red-500/5 px-2 py-1 text-xs"
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

		<!-- No Data -->
		{#if discoveries.length === 0 && ports.length === 0}
			<div class="flex h-full items-center justify-center text-muted-foreground">
				<div class="text-center">
					<Network class="mx-auto mb-2 h-8 w-8 opacity-50" />
					<p class="text-sm">No data available</p>
					<p class="mt-1 text-xs">Run a port scan to discover open services</p>
				</div>
			</div>
		{/if}

		<!-- Action: Scan Ports -->
		{#if onscan && ports.length === 0}
			<div class="border-t pt-4">
				<h3 class="mb-2 text-sm font-medium">Actions</h3>
				<button
					type="button"
					class="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
					onclick={() => onscan(primaryIp)}
					disabled={scanDisabled}
				>
					<Play class="h-4 w-4" />
					<span>Scan Ports on This Host</span>
				</button>
			</div>
		{/if}
	</div>
</div>
