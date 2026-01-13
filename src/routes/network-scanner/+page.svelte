<script lang="ts">
	import {
		AlertCircle,
		CheckCircle2,
		ChevronRight,
		Clock,
		Download,
		Loader2,
		Network,
		Play,
		Radar,
		RefreshCw,
		Server,
		Square,
		X,
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ActionButton } from '$lib/components/action';
	import {
		FormCheckbox,
		FormInfo,
		FormInput,
		FormMode,
		FormSection,
		FormSlider,
	} from '$lib/components/form';
	import { PageLayout } from '$lib/components/layout';
	import * as Resizable from '$lib/components/ui/resizable';
	import {
		DATABASE_PORTS,
		DEFAULT_CONCURRENCY,
		DEFAULT_SYN_PORTS,
		DEFAULT_TIMEOUT_MS,
		discoverHosts,
		DISCOVERY_METHODS,
		exportToCsv,
		exportToJson,
		formatDuration,
		getDiscoveryMethods,
		getLocalNetworkInterfaces,
		isValidPortRange,
		isValidTarget,
		listenToScanProgress,
		MAX_CONCURRENCY,
		MAX_TIMEOUT_MS,
		MIN_CONCURRENCY,
		MIN_TIMEOUT_MS,
		PORT_PRESETS,
		QUICK_SCAN_PORTS,
		SCAN_MODES,
		startNetworkScan,
		WEB_PORTS,
		WELL_KNOWN_SERVICES,
		type DiscoveryMethod,
		type DiscoveryOptions,
		type DiscoveryResult,
		type HostMetadata,
		type HostResult,
		type LocalNetworkInfo,
		type MdnsServiceInfo,
		type NetworkInterface,
		type PortInfo,
		type PortPreset,
		type ScanMode,
		type ScanProgress,
		type ScanResults,
	} from '$lib/services/network-scanner.js';
	import { UnifiedHostDetailPanel, UnifiedHostListItem } from './components/index.js';

	// =========================================================================
	// Unified Host Structure
	// =========================================================================
	interface DiscoveryInfo {
		method: string;
		durationMs: number;
		error: string | null;
	}

	interface UnifiedHost {
		/** Unique identifier for UI key */
		id: string;
		/** All IP addresses (IPv4/IPv6) */
		ips: string[];
		/** Resolved hostname */
		hostname: string | null;
		/** Source of hostname resolution (dns, mdns, netbios) */
		hostnameSource: string | null;
		/** NetBIOS name */
		netbiosName: string | null;
		/** MAC address (from ARP scan) */
		macAddress: string | null;
		/** Vendor name (from OUI lookup) */
		vendor: string | null;
		/** mDNS services advertised by this host */
		mdnsServices: MdnsServiceInfo[];
		/** Discovery methods that found this host */
		discoveryMethods: string[];
		/** Discovery details */
		discoveries: DiscoveryInfo[];
		/** Port scan results */
		ports: PortInfo[];
		/** Port scan duration */
		scanDurationMs: number | null;
	}

	// Form state
	let target = $state('');
	let scanMode = $state<ScanMode>('quick');
	let portPreset = $state<PortPreset>('well_known');
	let portRange = $state('');
	let concurrency = $state(DEFAULT_CONCURRENCY);
	let timeoutMs = $state(DEFAULT_TIMEOUT_MS);

	// Name resolution options (all enabled by default)
	let resolveDns = $state(true);
	let resolveMdns = $state(true);
	let resolveNetbios = $state(true);
	let resolveTimeoutMs = $state(2000);

	// Derived: any resolution enabled
	const resolveHostname = $derived(resolveDns || resolveMdns || resolveNetbios);

	// Discovery options (all methods enabled by default)
	let discoveryMethods = $state<Set<DiscoveryMethod>>(
		new Set(['icmp_ping', 'arp_scan', 'tcp_syn', 'tcp_connect', 'mdns'])
	);
	let availableMethods = $state<Map<string, boolean>>(new Map());
	let discoveryResults = $state<DiscoveryResult[]>([]);
	let isDiscovering = $state(false);

	// Network interface state
	let networkInfo = $state<LocalNetworkInfo | null>(null);
	let isLoadingInterfaces = $state(false);

	// Scan state
	let isScanning = $state(false);
	let progress = $state<ScanProgress | null>(null);
	let results = $state<ScanResults | null>(null);
	let discoveredHosts = $state<HostResult[]>([]);
	let error = $state<string | null>(null);

	// UI state
	let showOptions = $state(true);
	let selectedHostId = $state<string | null>(null);
	let recentlyDiscoveredIds = $state<Set<string>>(new Set());

	// =========================================================================
	// Unified Host List (merges Find Hosts + Scan Ports results)
	// =========================================================================

	/** Check if IP is IPv6 */
	const isIPv6 = (ip: string): boolean => ip.includes(':');

	/** Get merge key for a host (hostname if available, otherwise IP) */
	const getMergeKey = (ip: string, hostname: string | null): string => {
		// If hostname exists, use it as merge key (allows IPv4/IPv6 merge)
		if (hostname) return `host:${hostname.toLowerCase()}`;
		return `ip:${ip}`;
	};

	/** Sort IPs: IPv4 first, then IPv6 */
	const sortIps = (ips: string[]): string[] =>
		[...ips].sort((a, b) => {
			const aIsV6 = isIPv6(a);
			const bIsV6 = isIPv6(b);
			if (aIsV6 !== bIsV6) return aIsV6 ? 1 : -1;
			return a.localeCompare(b);
		});

	// Derived: unified host list from both discovery and scan results
	const unifiedHosts = $derived.by((): UnifiedHost[] => {
		const hostMap = new Map<string, UnifiedHost>();

		// Helper: get or create host entry
		const getOrCreateHost = (
			ip: string,
			hostname: string | null,
			metadata?: HostMetadata
		): UnifiedHost => {
			const key = getMergeKey(ip, hostname);
			let host = hostMap.get(key);

			// Also check if this IP exists under a different key
			if (!host) {
				for (const [existingKey, existingHost] of hostMap) {
					if (existingHost.ips.includes(ip)) {
						host = existingHost;
						break;
					}
					// Merge if hostname matches
					if (hostname && existingHost.hostname?.toLowerCase() === hostname.toLowerCase()) {
						host = existingHost;
						break;
					}
				}
			}

			if (!host) {
				host = {
					id: key,
					ips: [ip],
					hostname: hostname ?? metadata?.hostname ?? null,
					hostnameSource: metadata?.hostnameSource ?? null,
					netbiosName: metadata?.netbiosName ?? null,
					macAddress: metadata?.macAddress ?? null,
					vendor: metadata?.vendor ?? null,
					mdnsServices: metadata?.mdnsServices ? [...metadata.mdnsServices] : [],
					discoveryMethods: [],
					discoveries: [],
					ports: [],
					scanDurationMs: null,
				};
				hostMap.set(key, host);
			} else {
				// Add IP if not already present
				if (!host.ips.includes(ip)) {
					host.ips.push(ip);
					host.ips = sortIps(host.ips);
				}
				// Update hostname if we have one and host doesn't
				if (hostname && !host.hostname) {
					host.hostname = hostname;
					// Update the key
					const newKey = getMergeKey(ip, hostname);
					if (newKey !== host.id) {
						hostMap.delete(host.id);
						host.id = newKey;
						hostMap.set(newKey, host);
					}
				}
				// Update hostname from metadata if not set
				if (!host.hostname && metadata?.hostname) {
					host.hostname = metadata.hostname;
					host.hostnameSource = metadata.hostnameSource ?? null;
				}
				// Update hostname source if not set
				if (!host.hostnameSource && metadata?.hostnameSource) {
					host.hostnameSource = metadata.hostnameSource;
				}
				// Update NetBIOS name if not set
				if (!host.netbiosName && metadata?.netbiosName) {
					host.netbiosName = metadata.netbiosName;
				}
				// Update MAC address if not set
				if (!host.macAddress && metadata?.macAddress) {
					host.macAddress = metadata.macAddress;
				}
				// Update vendor if not set
				if (!host.vendor && metadata?.vendor) {
					host.vendor = metadata.vendor;
				}
				// Merge mDNS services (avoid duplicates)
				if (metadata?.mdnsServices) {
					for (const service of metadata.mdnsServices) {
						const exists = host.mdnsServices.some(
							(s) =>
								s.instanceName === service.instanceName && s.serviceType === service.serviceType
						);
						if (!exists) {
							host.mdnsServices.push(service);
						}
					}
				}
			}
			return host;
		};

		// 1. Add hosts from discovery results
		for (const result of discoveryResults) {
			for (const ip of result.hosts) {
				// Use hostname from discovery if available (e.g., from mDNS)
				const hostname = result.hostnames[ip] ?? null;
				// Get extended metadata if available
				const metadata = result.hostMetadata?.[ip];
				const host = getOrCreateHost(ip, hostname, metadata);
				if (!host.discoveryMethods.includes(result.method)) {
					host.discoveryMethods.push(result.method);
				}
				// Add discovery info if not duplicate
				const hasDiscovery = host.discoveries.some(
					(d) => d.method === result.method && d.durationMs === result.durationMs
				);
				if (!hasDiscovery) {
					host.discoveries.push({
						method: result.method,
						durationMs: result.durationMs,
						error: result.error,
					});
				}
			}
		}

		// 2. Add/merge hosts from port scan results
		for (const scanHost of discoveredHosts) {
			const host = getOrCreateHost(scanHost.ip, scanHost.hostname ?? null);

			// Merge ports (avoid duplicates)
			for (const port of scanHost.ports) {
				const existingPort = host.ports.find((p) => p.port === port.port);
				if (!existingPort) {
					host.ports.push(port);
				} else if (port.state === 'open' && existingPort.state !== 'open') {
					// Update to open state if we found it open
					const idx = host.ports.indexOf(existingPort);
					host.ports[idx] = port;
				}
			}

			// Sort ports by number
			host.ports.sort((a, b) => a.port - b.port);

			// Update scan duration
			if (scanHost.scanDurationMs) {
				host.scanDurationMs = (host.scanDurationMs ?? 0) + scanHost.scanDurationMs;
			}
		}

		// Sort hosts: by first IP
		return [...hostMap.values()].sort((a, b) => {
			const aIp = a.ips[0] ?? '';
			const bIp = b.ips[0] ?? '';
			return aIp.localeCompare(bIp);
		});
	});

	// Derived: selected unified host
	const selectedHost = $derived(unifiedHosts.find((h) => h.id === selectedHostId) ?? null);

	// Derived: hosts without port scans
	const hostsWithoutScans = $derived(unifiedHosts.filter((h) => h.ports.length === 0));

	// Derived: stats
	const totalOpenPorts = $derived(
		unifiedHosts.reduce((sum, h) => sum + h.ports.filter((p) => p.state === 'open').length, 0)
	);
	const hostsWithOpenPorts = $derived(
		unifiedHosts.filter((h) => h.ports.some((p) => p.state === 'open')).length
	);

	// Derived
	const canScan = $derived(isValidTarget(target) && !isScanning);
	const needsPortRange = $derived(scanMode === 'custom' && portPreset === 'custom');
	const isPortRangeValid = $derived(!needsPortRange || isValidPortRange(portRange));
	const progressPercentage = $derived(progress?.type === 'progress' ? progress.percentage : 0);
	const progressCurrentIp = $derived(progress?.type === 'progress' ? progress.current_ip : null);
	const progressDiscoveredHosts = $derived(
		progress?.type === 'progress' ? progress.discovered_hosts : 0
	);
	const progressDiscoveredPorts = $derived(
		progress?.type === 'progress' ? progress.discovered_ports : 0
	);
	const progressText = $derived(
		progress?.type === 'progress'
			? `${progress.scanned_hosts} / ${progress.total_hosts} hosts`
			: progress?.type === 'started'
				? `Scanning ${progress.total_hosts} hosts, ${progress.total_ports} ports each`
				: ''
	);
	const allDiscoveredHosts = $derived([...new Set(discoveryResults.flatMap((r) => r.hosts))]);

	// Event listener cleanup
	let unlistenFn = $state<(() => void) | null>(null);

	// Load available discovery methods on mount
	$effect(() => {
		handleLoadDiscoveryMethods();
	});

	const handleProgressEvent = (event: ScanProgress) => {
		progress = event;

		if (event.type === 'host_discovered') {
			discoveredHosts = [...discoveredHosts, event.host];
			const hostKey = getMergeKey(event.host.ip, event.host.hostname ?? null);

			// Mark as recently discovered for animation
			recentlyDiscoveredIds = new Set([...recentlyDiscoveredIds, hostKey]);

			// Remove from recently discovered after animation completes
			setTimeout(() => {
				recentlyDiscoveredIds = new Set([...recentlyDiscoveredIds].filter((id) => id !== hostKey));
			}, 1500);

			// Auto-select first host if none selected
			if (selectedHostId === null) {
				selectedHostId = hostKey;
			}
		} else if (event.type === 'completed') {
			results = event.results;
			isScanning = false;
			recentlyDiscoveredIds = new Set(); // Clear all
			toast.success('Scan completed', {
				description: `Found ${event.results.totalOpenPorts} open ports on ${event.results.hostsWithOpenPorts} hosts`,
			});
		} else if (event.type === 'error') {
			error = event.message;
			isScanning = false;
			recentlyDiscoveredIds = new Set(); // Clear all
			toast.error('Scan failed', { description: event.message });
		}
	};

	const handleScan = async () => {
		if (!canScan || !isPortRangeValid) return;

		isScanning = true;
		error = null;
		results = null;
		// Don't clear discoveredHosts to allow merging with discovery results
		// discoveredHosts = [];
		progress = null;

		// Setup progress listener
		try {
			unlistenFn = await listenToScanProgress(handleProgressEvent);
		} catch (e) {
			error = 'Failed to setup event listener';
			isScanning = false;
			return;
		}

		try {
			await startNetworkScan({
				target: target.trim(),
				mode: scanMode,
				portPreset,
				portRange: needsPortRange ? portRange.trim() : undefined,
				concurrency,
				timeoutMs,
				resolveHostname,
				resolution: resolveHostname
					? {
							dns: resolveDns,
							mdns: resolveMdns,
							netbios: resolveNetbios,
							timeoutMs: resolveTimeoutMs,
						}
					: undefined,
			});
		} catch (e) {
			if (isScanning) {
				error = e instanceof Error ? e.message : String(e);
				toast.error('Scan failed', { description: error });
			}
		} finally {
			if (unlistenFn) {
				unlistenFn();
				unlistenFn = null;
			}
			isScanning = false;
		}
	};

	const handleCancel = () => {
		if (unlistenFn) {
			unlistenFn();
			unlistenFn = null;
		}
		isScanning = false;
		toast.info('Scan cancelled');
	};

	const handleClear = () => {
		results = null;
		discoveredHosts = [];
		discoveryResults = [];
		progress = null;
		error = null;
		selectedHostId = null;
		recentlyDiscoveredIds = new Set();
	};

	const handleExportJson = () => {
		if (!results) return;
		const json = exportToJson(results);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `network-scan-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success('Exported as JSON');
	};

	const handleExportCsv = () => {
		if (!results) return;
		const csv = exportToCsv(results);
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `network-scan-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success('Exported as CSV');
	};

	const handleLoadInterfaces = async () => {
		isLoadingInterfaces = true;
		try {
			networkInfo = await getLocalNetworkInterfaces();
			// Auto-fill with primary IPv4 CIDR if available
			const primary = networkInfo.primaryIpv4;
			if (primary?.suggestedCidr) {
				target = primary.suggestedCidr;
				toast.success('Target auto-filled', {
					description: `Using ${primary.name} (${primary.ip})`,
				});
			} else if (networkInfo.interfaces.length > 0) {
				// Find first non-loopback interface with suggested CIDR
				const usable = networkInfo.interfaces.find((i) => !i.isLoopback && i.suggestedCidr);
				if (usable?.suggestedCidr) {
					target = usable.suggestedCidr;
					toast.success('Target auto-filled', {
						description: `Using ${usable.name} (${usable.ip})`,
					});
				} else {
					toast.warning('No suitable network interface found');
				}
			}
		} catch (e) {
			toast.error('Failed to load network interfaces');
		} finally {
			isLoadingInterfaces = false;
		}
	};

	const handleSelectInterface = (iface: NetworkInterface) => {
		if (iface.suggestedCidr) {
			target = iface.suggestedCidr;
		} else {
			target = iface.ip;
		}
	};

	const handleLoadDiscoveryMethods = async () => {
		try {
			const methods = await getDiscoveryMethods();
			availableMethods = new Map(methods);
		} catch (e) {
			toast.error('Failed to check discovery method availability');
		}
	};

	const toggleDiscoveryMethod = (method: DiscoveryMethod) => {
		const newSet = new Set(discoveryMethods);
		if (newSet.has(method)) {
			newSet.delete(method);
		} else {
			newSet.add(method);
		}
		discoveryMethods = newSet;
	};

	const handleDiscovery = async () => {
		if (!isValidTarget(target) || discoveryMethods.size === 0) return;

		isDiscovering = true;
		// Don't clear discoveryResults to allow merging with scan results
		// discoveryResults = [];

		try {
			const options: DiscoveryOptions = {
				methods: [...discoveryMethods],
				timeoutMs,
				concurrency,
				synPorts: [...DEFAULT_SYN_PORTS],
				resolveNetbios,
			};

			const newResults = await discoverHosts([target.trim()], options);
			// Merge with existing results
			discoveryResults = [...discoveryResults, ...newResults];

			// Auto-select first discovered host if none selected
			const allHosts = [...new Set(newResults.flatMap((r) => r.hosts))];
			if (allHosts.length > 0) {
				if (selectedHostId === null) {
					const firstIp = allHosts.sort()[0];
					if (firstIp) {
						selectedHostId = getMergeKey(firstIp, null);
					}
				}
				toast.success('Discovery completed', {
					description: `Found ${allHosts.length} hosts`,
				});
			} else {
				toast.info('Discovery completed', {
					description: 'No hosts found',
				});
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			toast.error('Discovery failed', { description: msg });
		} finally {
			isDiscovering = false;
		}
	};

	const selectHost = (hostId: string) => {
		selectedHostId = hostId;
	};

	const handleScanDiscoveredHost = (ip: string) => {
		target = ip;
		handleScan();
	};
</script>

<svelte:head>
	<title>Network Scanner - Kogu</title>
</svelte:head>

<PageLayout valid={results ? true : null} bind:showOptions>
	{#snippet statusContent()}
		{#if results}
			<span class="text-muted-foreground">
				Hosts: <strong class="text-foreground">{results.hostsWithOpenPorts}</strong>
			</span>
			<span class="text-muted-foreground">
				Ports: <strong class="text-foreground">{results.totalOpenPorts}</strong>
			</span>
			<span class="text-muted-foreground">
				Duration: <strong class="text-foreground">{formatDuration(results.scanDurationMs)}</strong>
			</span>
		{:else if isScanning && progress?.type === 'progress'}
			<span class="text-muted-foreground">
				Progress: <strong class="text-foreground">{progress.percentage.toFixed(0)}%</strong>
			</span>
		{/if}
	{/snippet}

	{#snippet options()}
		<!-- 1. Target -->
		<FormSection title="Target">
			<div class="space-y-2">
				<FormInput
					label="Host / IP / CIDR"
					bind:value={target}
					placeholder="192.168.1.1 or 192.168.1.0/24"
				/>
				{#if target && !isValidTarget(target)}
					<p class="text-[10px] text-destructive">Invalid target format</p>
				{/if}
				<button
					type="button"
					class="flex w-full items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
					onclick={handleLoadInterfaces}
					disabled={isLoadingInterfaces || isScanning}
				>
					{#if isLoadingInterfaces}
						<Loader2 class="h-3 w-3 animate-spin" />
						<span>Detecting...</span>
					{:else}
						<RefreshCw class="h-3 w-3" />
						<span>Detect Local Network</span>
					{/if}
				</button>
			</div>
			{#if networkInfo && networkInfo.interfaces.length > 0}
				<div class="mt-2 space-y-1">
					<p class="text-[10px] font-medium text-muted-foreground">Available interfaces:</p>
					<div class="max-h-24 space-y-1 overflow-y-auto">
						{#each networkInfo.interfaces.filter((i) => !i.isLoopback && i.suggestedCidr) as iface (iface.ip)}
							<button
								type="button"
								class="flex w-full items-center justify-between rounded border border-input bg-background px-2 py-1 text-left text-[10px] transition-colors hover:bg-accent"
								onclick={() => handleSelectInterface(iface)}
							>
								<span class="font-medium">{iface.name}</span>
								<span class="text-muted-foreground">{iface.suggestedCidr}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</FormSection>

		<!-- 2. Host Discovery -->
		<FormSection title="Host Discovery">
			<p class="mb-2 text-[10px] text-muted-foreground">Find active hosts before port scanning:</p>
			<div class="space-y-1">
				{#each DISCOVERY_METHODS as method (method.value)}
					{@const isAvailable = availableMethods.get(method.value) ?? !method.requiresPrivileges}
					{@const isSelected = discoveryMethods.has(method.value)}
					<button
						type="button"
						class="flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs transition-colors
							{isSelected
							? 'border-primary bg-primary/10 text-foreground'
							: 'border-input bg-background text-muted-foreground hover:bg-accent'}
							{!isAvailable && 'opacity-50'}"
						onclick={() => toggleDiscoveryMethod(method.value)}
						disabled={!isAvailable || isDiscovering || isScanning}
					>
						<div class="flex items-center gap-2">
							<div
								class="h-3 w-3 rounded border {isSelected
									? 'border-primary bg-primary'
									: 'border-input'}"
							>
								{#if isSelected}
									<svg class="h-full w-full text-primary-foreground" viewBox="0 0 12 12">
										<path
											fill="currentColor"
											d="M10.28 2.28L4.5 8.06 1.72 5.28a.75.75 0 00-1.06 1.06l3.5 3.5a.75.75 0 001.06 0l6.5-6.5a.75.75 0 00-1.06-1.06z"
										/>
									</svg>
								{/if}
							</div>
							<span class="font-medium">{method.label}</span>
						</div>
						<span class="text-[10px] text-muted-foreground">
							{#if !isAvailable}
								(no privileges)
							{:else if method.requiresPrivileges}
								(available)
							{/if}
						</span>
					</button>
				{/each}
			</div>
			{#if discoveryMethods.size > 0}
				<div class="mt-3">
					<ActionButton
						label="Find Hosts"
						icon={Radar}
						loading={isDiscovering}
						loadingLabel="Discovering..."
						disabled={!isValidTarget(target) || isScanning}
						onclick={handleDiscovery}
					/>
				</div>
			{/if}
			{#if discoveryResults.length > 0}
				<div class="mt-2 rounded border border-border bg-muted/30 p-2">
					<p class="text-[10px] font-medium text-muted-foreground">Results:</p>
					<div class="mt-1 max-h-20 space-y-0.5 overflow-y-auto">
						{#each discoveryResults as result (result.method)}
							<div class="text-[10px]">
								<span class="font-medium">{result.method}:</span>
								{#if result.error}
									<span class="text-destructive">{result.error}</span>
								{:else}
									<span class="text-muted-foreground">{result.hosts.length} host(s)</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</FormSection>

		<!-- 3. Name Resolution -->
		<FormSection title="Name Resolution">
			<p class="mb-2 text-[10px] text-muted-foreground">Resolve IP addresses to hostnames:</p>
			<div class="space-y-1.5">
				<FormCheckbox label="DNS Reverse Lookup (PTR)" bind:checked={resolveDns} />
				<FormCheckbox label="mDNS / Bonjour (.local)" bind:checked={resolveMdns} />
				<FormCheckbox label="NetBIOS (Windows)" bind:checked={resolveNetbios} />
			</div>
			{#if resolveHostname}
				<div class="mt-3 border-t border-border pt-3">
					<FormSlider
						label="Timeout"
						bind:value={resolveTimeoutMs}
						min={500}
						max={5000}
						step={500}
						hint={`${resolveTimeoutMs}ms`}
					/>
				</div>
			{/if}
		</FormSection>

		<!-- 4. Port Scan -->
		<FormSection title="Port Scan">
			<!-- Mode -->
			<p class="mb-1.5 text-[10px] font-medium text-muted-foreground">Scan Mode</p>
			<FormMode
				value={scanMode}
				options={SCAN_MODES.map((m) => ({ value: m.value, label: m.label }))}
				onchange={(v) => (scanMode = v as ScanMode)}
			/>
			<p class="mt-1 text-[10px] text-muted-foreground">
				{SCAN_MODES.find((m) => m.value === scanMode)?.description}
			</p>

			<!-- Quick Scan Port Details -->
			{#if scanMode === 'quick'}
				<details class="mt-2 rounded border border-border bg-muted/30">
					<summary
						class="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
					>
						<ChevronRight class="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
						Target Ports ({QUICK_SCAN_PORTS.length})
					</summary>
					<div class="max-h-48 overflow-y-auto border-t border-border">
						<div class="grid grid-cols-2 gap-px bg-border">
							{#each QUICK_SCAN_PORTS as port (port)}
								<div
									class="flex items-center justify-between bg-background px-2 py-1"
									title={WELL_KNOWN_SERVICES[port] ?? `Port ${port}`}
								>
									<span class="font-mono text-[10px] font-medium">{port}</span>
									<span class="truncate text-[9px] text-muted-foreground">
										{WELL_KNOWN_SERVICES[port] ?? ''}
									</span>
								</div>
							{/each}
						</div>
					</div>
				</details>
			{/if}

			<!-- Port Selection (custom時のみ) -->
			{#if scanMode === 'custom'}
				<div class="mt-3 border-t border-border pt-3">
					<p class="mb-1.5 text-[10px] font-medium text-muted-foreground">Port Selection</p>
					<FormMode
						value={portPreset}
						options={PORT_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
						onchange={(v) => (portPreset = v as PortPreset)}
					/>

					<!-- Port Details for each preset -->
					{#if portPreset === 'well_known'}
						<p class="mt-1.5 text-[10px] text-muted-foreground">
							Standard ports 1-1024 (1,024 ports)
						</p>
					{:else if portPreset === 'web'}
						<details class="mt-2 rounded border border-border bg-muted/30">
							<summary
								class="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
							>
								<ChevronRight class="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
								Web Ports ({WEB_PORTS.length})
							</summary>
							<div class="max-h-32 overflow-y-auto border-t border-border">
								<div class="grid grid-cols-2 gap-px bg-border">
									{#each WEB_PORTS as port (port)}
										<div
											class="flex items-center justify-between bg-background px-2 py-1"
											title={WELL_KNOWN_SERVICES[port] ?? `Port ${port}`}
										>
											<span class="font-mono text-[10px] font-medium">{port}</span>
											<span class="truncate text-[9px] text-muted-foreground">
												{WELL_KNOWN_SERVICES[port] ?? ''}
											</span>
										</div>
									{/each}
								</div>
							</div>
						</details>
					{:else if portPreset === 'database'}
						<details class="mt-2 rounded border border-border bg-muted/30">
							<summary
								class="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
							>
								<ChevronRight class="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
								Database Ports ({DATABASE_PORTS.length})
							</summary>
							<div class="max-h-32 overflow-y-auto border-t border-border">
								<div class="grid grid-cols-2 gap-px bg-border">
									{#each DATABASE_PORTS as port (port)}
										<div
											class="flex items-center justify-between bg-background px-2 py-1"
											title={WELL_KNOWN_SERVICES[port] ?? `Port ${port}`}
										>
											<span class="font-mono text-[10px] font-medium">{port}</span>
											<span class="truncate text-[9px] text-muted-foreground">
												{WELL_KNOWN_SERVICES[port] ?? ''}
											</span>
										</div>
									{/each}
								</div>
							</div>
						</details>
					{:else if portPreset === 'custom'}
						<div class="mt-2">
							<FormInput
								label="Port Range"
								bind:value={portRange}
								placeholder="80,443,8080 or 1-1024"
							/>
							{#if portRange && !isValidPortRange(portRange)}
								<p class="mt-1 text-[10px] text-destructive">Invalid port range format</p>
							{:else}
								<p class="mt-1 text-[10px] text-muted-foreground">
									Examples: 80,443,8080 or 1-1024 or 22,80-100,443
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Scan Settings -->
			<div class="mt-3 border-t border-border pt-3">
				<p class="mb-2 text-[10px] font-medium text-muted-foreground">Scan Settings</p>
				<FormSlider
					label="Concurrent Connections"
					bind:value={concurrency}
					min={MIN_CONCURRENCY}
					max={MAX_CONCURRENCY}
					step={10}
					hint={`${concurrency}`}
				/>
				<FormSlider
					label="Connection Timeout"
					bind:value={timeoutMs}
					min={MIN_TIMEOUT_MS}
					max={MAX_TIMEOUT_MS}
					step={100}
					hint={`${timeoutMs}ms`}
				/>
			</div>

			<!-- Action Button -->
			<div class="mt-3">
				{#if isScanning}
					<ActionButton
						label="Cancel Scan"
						icon={Square}
						variant="destructive"
						onclick={handleCancel}
					/>
				{:else}
					<ActionButton
						label="Scan Ports"
						icon={Play}
						loading={isScanning}
						loadingLabel="Scanning..."
						disabled={!canScan || !isPortRangeValid}
						onclick={handleScan}
					/>
				{/if}
			</div>
		</FormSection>

		<!-- 4. Results Actions -->
		{#if results}
			<FormSection title="Results">
				<div class="space-y-2">
					<ActionButton label="Clear Results" variant="outline" onclick={handleClear} />
					<ActionButton
						label="Export JSON"
						icon={Download}
						variant="outline"
						onclick={handleExportJson}
					/>
					<ActionButton
						label="Export CSV"
						icon={Download}
						variant="outline"
						onclick={handleExportCsv}
					/>
				</div>
			</FormSection>
		{/if}

		<!-- 6. Help Info -->
		<FormSection title="Help">
			<FormInfo showIcon={false}>
				<div class="space-y-2">
					<div>
						<p class="text-[10px] font-medium">Host Discovery Methods</p>
						<ul class="mt-0.5 list-inside list-disc text-[10px] text-muted-foreground">
							<li>ICMP Ping: needs root privileges</li>
							<li>ARP Scan: local network, needs libpcap</li>
							<li>TCP SYN: needs raw socket</li>
							<li>TCP Connect: no privileges needed</li>
							<li>mDNS: Bonjour/Avahi devices</li>
						</ul>
					</div>
					<div>
						<p class="text-[10px] font-medium">Port Scan Modes</p>
						<ul class="mt-0.5 list-inside list-disc text-[10px] text-muted-foreground">
							<li>Quick: 25 common ports</li>
							<li>Full: All 65535 ports</li>
							<li>Custom: User-defined range</li>
						</ul>
					</div>
				</div>
			</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Results Panel -->
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Progress Bar -->
		{#if isDiscovering}
			<div class="shrink-0 border-b bg-muted/20 px-4 py-3">
				<div class="mb-2 flex items-center gap-2">
					<Loader2 class="h-4 w-4 animate-spin text-primary" />
					<span class="text-sm font-medium">Finding Hosts...</span>
					<span class="text-xs text-muted-foreground">
						{discoveryMethods.size} method{discoveryMethods.size > 1 ? 's' : ''} selected
					</span>
				</div>
				<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
					<div class="h-full animate-pulse bg-primary" style="width: 100%"></div>
				</div>
			</div>
		{:else if isScanning}
			<div class="shrink-0 border-b bg-muted/20 px-4 py-3">
				<!-- Main progress info -->
				<div class="mb-2 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Loader2 class="h-4 w-4 animate-spin text-primary" />
						<span class="text-sm font-medium">Scanning Ports...</span>
						<span class="text-xs text-muted-foreground">{progressText}</span>
					</div>
					<span class="text-sm font-medium text-primary">{progressPercentage.toFixed(0)}%</span>
				</div>

				<!-- Progress bar -->
				<div class="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
					<div
						class="h-full bg-primary transition-all duration-300"
						style={`width: ${progressPercentage}%`}
					></div>
				</div>

				<!-- Detailed stats -->
				<div class="flex items-center justify-between text-[10px]">
					<div class="flex items-center gap-4">
						{#if progressCurrentIp}
							<span class="flex items-center gap-1 text-muted-foreground">
								<span>Next:</span>
								<span class="font-mono font-medium text-foreground">{progressCurrentIp}</span>
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-4">
						{#if progressDiscoveredHosts > 0}
							<span class="flex items-center gap-1 text-green-600 dark:text-green-400">
								<Server class="h-3 w-3" />
								<span class="font-medium">{progressDiscoveredHosts}</span>
								<span>hosts found</span>
							</span>
						{/if}
						{#if progressDiscoveredPorts > 0}
							<span class="flex items-center gap-1 text-green-600 dark:text-green-400">
								<Network class="h-3 w-3" />
								<span class="font-medium">{progressDiscoveredPorts}</span>
								<span>ports open</span>
							</span>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Main Content -->
		<div class="flex-1 overflow-hidden">
			{#if unifiedHosts.length > 0}
				<!-- Unified 2-Pane Layout: Host List + Detail -->
				<Resizable.PaneGroup direction="horizontal" class="h-full">
					<!-- Left Pane: Host List -->
					<Resizable.Pane defaultSize={35} minSize={20} maxSize={50}>
						<div class="flex h-full flex-col border-r">
							<!-- Host List Header -->
							<div class="flex h-9 shrink-0 items-center justify-between border-b bg-muted/30 px-3">
								<span class="text-xs font-medium text-muted-foreground">
									Hosts ({unifiedHosts.length})
								</span>
								{#if totalOpenPorts > 0}
									<span class="text-[10px] text-green-600 dark:text-green-400">
										{totalOpenPorts} open ports
									</span>
								{/if}
							</div>
							<!-- Host List -->
							<div class="flex-1 overflow-auto">
								{#each unifiedHosts as host (host.id)}
									<UnifiedHostListItem
										ips={host.ips}
										hostname={host.hostname ?? host.netbiosName}
										openPortCount={host.ports.filter((p) => p.state === 'open').length}
										discoveryMethodCount={host.discoveryMethods.length}
										selected={selectedHostId === host.id}
										isNew={recentlyDiscoveredIds.has(host.id)}
										onclick={() => selectHost(host.id)}
									/>
								{/each}
							</div>
							<!-- Scan All Button (only if we have hosts without port scans) -->
							{#if hostsWithoutScans.length > 0}
								<div class="shrink-0 border-t bg-muted/30 p-2">
									<button
										type="button"
										class="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
										onclick={() => {
											target = hostsWithoutScans.flatMap((h) => h.ips).join(',');
											handleScan();
										}}
										disabled={isScanning}
									>
										<Play class="h-3 w-3" />
										<span>Scan {hostsWithoutScans.length} Unscanned Hosts</span>
									</button>
								</div>
							{/if}
						</div>
					</Resizable.Pane>

					<Resizable.Handle withHandle />

					<!-- Right Pane: Host Detail -->
					<Resizable.Pane defaultSize={65} minSize={40}>
						{#if selectedHost}
							<UnifiedHostDetailPanel
								ips={selectedHost.ips}
								hostname={selectedHost.hostname}
								hostnameSource={selectedHost.hostnameSource}
								netbiosName={selectedHost.netbiosName}
								macAddress={selectedHost.macAddress}
								vendor={selectedHost.vendor}
								mdnsServices={selectedHost.mdnsServices}
								discoveryMethods={selectedHost.discoveryMethods}
								discoveries={selectedHost.discoveries}
								ports={selectedHost.ports}
								scanDurationMs={selectedHost.scanDurationMs}
								onscan={(ip) => handleScanDiscoveredHost(ip)}
								scanDisabled={isScanning}
							/>
						{:else}
							<div class="flex h-full items-center justify-center text-muted-foreground">
								<div class="text-center">
									<Server class="mx-auto mb-2 h-8 w-8 opacity-50" />
									<p class="text-sm">Select a host to view details</p>
								</div>
							</div>
						{/if}
					</Resizable.Pane>
				</Resizable.PaneGroup>
			{:else if error}
				<div class="flex h-full items-center justify-center">
					<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
						<AlertCircle class="mx-auto mb-2 h-8 w-8 text-destructive" />
						<p class="text-sm text-destructive">{error}</p>
					</div>
				</div>
			{:else}
				<div class="flex h-full items-center justify-center text-muted-foreground">
					<div class="text-center">
						<Radar class="mx-auto mb-2 h-12 w-12 opacity-50" />
						<p class="text-sm">Enter a target and start scanning</p>
						<p class="mt-1 text-xs">IP address, hostname, or CIDR notation</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Summary Footer -->
		{#if results}
			<div class="shrink-0 border-t bg-muted/30 px-4 py-2">
				<div class="flex items-center justify-between text-xs text-muted-foreground">
					<div class="flex items-center gap-4">
						<span class="flex items-center gap-1">
							<Server class="h-3 w-3" />
							{results.totalHostsScanned} hosts scanned
						</span>
						<span class="flex items-center gap-1">
							<CheckCircle2 class="h-3 w-3 text-green-500" />
							{results.hostsWithOpenPorts} with open ports
						</span>
						<span class="flex items-center gap-1">
							<Network class="h-3 w-3" />
							{results.totalOpenPorts} ports open
						</span>
					</div>
					<span class="flex items-center gap-1">
						<Clock class="h-3 w-3" />
						{formatDuration(results.scanDurationMs)}
					</span>
				</div>
			</div>
		{/if}
	</div>
</PageLayout>
