<script lang="ts">
	import {
		AlertCircle,
		Check,
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
		Shield,
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
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
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
		getMergeKey,
		isValidPortRange,
		isValidTarget,
		listenToDiscoveryProgress,
		listenToScanProgress,
		MAX_CONCURRENCY,
		MAX_TIMEOUT_MS,
		mergeHosts,
		MIN_CONCURRENCY,
		MIN_TIMEOUT_MS,
		PORT_PRESETS,
		QUICK_SCAN_PORTS,
		SCAN_MODES,
		startNetworkScan,
		WEB_PORTS,
		WELL_KNOWN_SERVICES,
		checkNetScannerPrivileges,
		setupNetScannerPrivileges,
		type DiscoveryInfo,
		type DiscoveryMethod,
		type DiscoveryOptions,
		type DiscoveryProgress,
		type DiscoveryResult,
		type HostMetadata,
		type HostResult,
		type LocalNetworkInfo,
		type MdnsServiceInfo,
		type NetworkInterface,
		type PortInfo,
		type PortPreset,
		type PrivilegeStatus,
		type ScanMode,
		type ScanProgress,
		type ScanResults,
		type UnifiedHost,
	} from '$lib/services/network-scanner.js';
	import { classifyHosts } from '$lib/services/device-classifier.js';
	import { UnifiedHostDetailPanel, UnifiedHostListItem } from './components/index.js';

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
		new Set(['icmp_ping', 'tcp_connect', 'mdns', 'ssdp', 'arp_cache'])
	);
	let availableMethods = $state<Map<string, boolean>>(new Map());
	let discoveryResults = $state<DiscoveryResult[]>([]);
	let isDiscovering = $state(false);

	// Per-method progress tracking
	let methodProgress = $state<Map<string, DiscoveryProgress>>(new Map());
	let unlistenDiscoveryProgressFn = $state<(() => void) | null>(null);

	// Privilege state
	let privilegeStatus = $state<PrivilegeStatus | null>(null);
	let isSettingUpPrivileges = $state(false);

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
	let portRangeTouched = $state(false);
	let hasAutoSelected = $state(false); // Only auto-select on first host discovery

	// Elapsed time tracking for LoadingOverlay
	let elapsedMs = $state(0);
	let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);

	const startTimer = () => {
		elapsedMs = 0;
		timerInterval = setInterval(() => {
			elapsedMs += 100;
		}, 100);
	};

	const stopTimer = () => {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	};

	const formatElapsedTime = (ms: number): string => {
		if (ms < 1000) return `${Math.round(ms)}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	};

	const elapsedTimeDisplay = $derived(formatElapsedTime(elapsedMs));

	// =========================================================================
	// Unified Host List (merges Find Hosts + Scan Ports results)
	// =========================================================================

	// Derived: unified host list from both discovery and scan results
	// Uses optimized O(n) mergeHosts function from service layer
	const unifiedHosts = $derived(mergeHosts(discoveryResults, discoveredHosts));

	// Derived: device classifications for all hosts
	const hostClassifications = $derived(classifyHosts(unifiedHosts));

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

	// Load available discovery methods and privilege status on mount, cleanup on unmount
	$effect(() => {
		handleLoadDiscoveryMethods();
		handleCheckPrivileges();

		return () => {
			stopTimer();
			unlistenFn?.();
		};
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

			// Auto-select first host only once (don't override user selection)
			if (!hasAutoSelected && selectedHostId === null) {
				selectedHostId = hostKey;
				hasAutoSelected = true;
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
		startTimer();
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
			stopTimer();
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
			stopTimer();
			isScanning = false;
		}
	};

	const handleCancel = () => {
		if (unlistenFn) {
			unlistenFn();
			unlistenFn = null;
		}
		stopTimer();
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
		portRangeTouched = false;
		hasAutoSelected = false; // Reset auto-selection flag
		methodProgress = new Map(); // Clear discovery method progress
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

	const handleCheckPrivileges = async () => {
		try {
			privilegeStatus = await checkNetScannerPrivileges();
		} catch {
			// Net-scanner sidecar not available - silently handle
			privilegeStatus = null;
		}
	};

	const handleSetupPrivileges = async () => {
		isSettingUpPrivileges = true;
		try {
			privilegeStatus = await setupNetScannerPrivileges();
			if (privilegeStatus.setupCompleted) {
				toast.success('Privilege setup completed', {
					description: 'Advanced scanning methods are now available',
				});
				// Reload discovery methods to reflect new availability
				await handleLoadDiscoveryMethods();
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (!msg.includes('cancelled')) {
				toast.error('Privilege setup failed', { description: msg });
			}
		} finally {
			isSettingUpPrivileges = false;
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
		startTimer();
		// Clear per-method progress
		methodProgress = new Map();
		// Don't clear discoveryResults to allow merging with scan results
		// discoveryResults = [];

		// Setup discovery progress listener
		try {
			unlistenDiscoveryProgressFn = await listenToDiscoveryProgress((progress) => {
				methodProgress = new Map(methodProgress).set(progress.method, progress);
			});
		} catch (e) {
			// Continue without progress tracking if listener fails
		}

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

			// Auto-select first discovered host only once (don't override user selection)
			const allHosts = [...new Set(newResults.flatMap((r) => r.hosts))];
			if (allHosts.length > 0) {
				if (!hasAutoSelected && selectedHostId === null) {
					const firstIp = allHosts.sort()[0];
					if (firstIp) {
						selectedHostId = getMergeKey(firstIp, null);
						hasAutoSelected = true;
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
			if (unlistenDiscoveryProgressFn) {
				unlistenDiscoveryProgressFn();
				unlistenDiscoveryProgressFn = null;
			}
			stopTimer();
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

<ToolShell layout="master-detail" valid={results ? true : null} bind:showRail={showOptions}>
	{#snippet statusContent()}
		{#if results}
			<StatItem label="Hosts" value={results.hostsWithOpenPorts} />
			<StatItem label="Ports" value={results.totalOpenPorts} />
			<StatItem label="Duration" value={formatDuration(results.scanDurationMs)} />
		{:else if isScanning && progress?.type === 'progress'}
			<StatItem label="Progress" value="{progress.percentage.toFixed(0)}%" />
		{/if}
	{/snippet}

	{#snippet rail()}
		<!-- 1. Target -->
		<FormSection title="Target">
			<div class="space-y-2">
				<FormInput
					label="Host / IP / CIDR"
					bind:value={target}
					placeholder="192.168.1.1 or 192.168.1.0/24"
				/>
				{#if target && !isValidTarget(target)}
					<p class="text-2xs text-destructive">Invalid target format</p>
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
					<p class="text-2xs font-medium text-muted-foreground">Available interfaces:</p>
					<div class="max-h-24 space-y-1 overflow-y-auto">
						{#each networkInfo.interfaces.filter((i) => !i.isLoopback && i.suggestedCidr) as iface (iface.ip)}
							<button
								type="button"
								class="flex w-full items-center justify-between rounded border border-input bg-background px-2 py-1 text-left text-2xs transition-colors hover:bg-accent"
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
			<p class="mb-2 text-2xs text-muted-foreground">Find active hosts before port scanning:</p>
			<div class="space-y-1">
				{#each DISCOVERY_METHODS as method (method.value)}
					{@const isAvailable = availableMethods.get(method.value) ?? !method.requiresPrivileges}
					{@const isSelected = discoveryMethods.has(method.value)}
					{@const isDisabled = !isAvailable || isDiscovering || isScanning}
					<label
						class="flex w-full cursor-pointer items-center justify-between rounded border px-2 py-1.5 text-left text-xs transition-colors
							{isSelected
							? 'border-primary bg-primary/10 text-foreground'
							: 'border-input bg-background text-muted-foreground hover:bg-accent'}
							{isDisabled && 'pointer-events-none opacity-50'}"
					>
						<div class="flex items-center gap-2">
							<input
								type="checkbox"
								class="sr-only"
								checked={isSelected}
								disabled={isDisabled}
								onchange={() => toggleDiscoveryMethod(method.value)}
							/>
							<div
								class="flex h-3 w-3 items-center justify-center rounded border {isSelected
									? 'border-primary bg-primary'
									: 'border-input'}"
								aria-hidden="true"
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
						<span class="text-2xs text-muted-foreground">
							{#if !isAvailable}
								(no privileges)
							{:else if method.requiresPrivileges}
								(available)
							{/if}
						</span>
					</label>
				{/each}
			</div>

			<!-- Name Resolution (collapsible) -->
			<details class="mt-3 rounded border border-border bg-muted/30">
				<summary
					class="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-2xs font-medium text-muted-foreground hover:text-foreground"
				>
					<ChevronRight class="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
					Name Resolution
					{#if resolveHostname}
						<span class="ml-auto text-2xs">
							({[resolveDns && 'DNS', resolveMdns && 'mDNS', resolveNetbios && 'NetBIOS']
								.filter(Boolean)
								.join(', ')})
						</span>
					{/if}
				</summary>
				<div class="border-t border-border p-2 space-y-1.5">
					<FormCheckbox label="DNS Reverse Lookup (PTR)" bind:checked={resolveDns} />
					<FormCheckbox label="mDNS / Bonjour (.local)" bind:checked={resolveMdns} />
					<FormCheckbox label="NetBIOS (Windows)" bind:checked={resolveNetbios} />
					{#if resolveHostname}
						<div class="mt-2 border-t border-border pt-2">
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
				</div>
			</details>

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
					<p class="text-2xs font-medium text-muted-foreground">Results:</p>
					<div class="mt-1 max-h-20 space-y-0.5 overflow-y-auto">
						{#each discoveryResults as result (result.method)}
							<div class="text-2xs">
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

		<!-- 3. Port Scan -->
		<FormSection title="Port Scan">
			<!-- Mode -->
			<p class="mb-1.5 text-2xs font-medium text-muted-foreground">Scan Mode</p>
			<FormMode
				value={scanMode}
				options={SCAN_MODES.map((m) => ({ value: m.value, label: m.label }))}
				onchange={(v) => (scanMode = v as ScanMode)}
			/>
			<p class="mt-1 text-2xs text-muted-foreground">
				{SCAN_MODES.find((m) => m.value === scanMode)?.description}
			</p>

			<!-- Quick Scan Port Details -->
			{#if scanMode === 'quick'}
				<details class="mt-2 rounded border border-border bg-muted/30">
					<summary
						class="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-2xs font-medium text-muted-foreground hover:text-foreground"
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
									<span class="font-mono text-2xs font-medium">{port}</span>
									<span class="truncate text-2xs text-muted-foreground">
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
					<p class="mb-1.5 text-2xs font-medium text-muted-foreground">Port Selection</p>
					<FormMode
						value={portPreset}
						options={PORT_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
						onchange={(v) => (portPreset = v as PortPreset)}
					/>

					<!-- Port Details for each preset -->
					{#if portPreset === 'well_known'}
						<p class="mt-1.5 text-2xs text-muted-foreground">Standard ports 1-1024 (1,024 ports)</p>
					{:else if portPreset === 'web'}
						<details class="mt-2 rounded border border-border bg-muted/30">
							<summary
								class="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-2xs font-medium text-muted-foreground hover:text-foreground"
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
											<span class="font-mono text-2xs font-medium">{port}</span>
											<span class="truncate text-2xs text-muted-foreground">
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
								class="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-2xs font-medium text-muted-foreground hover:text-foreground"
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
											<span class="font-mono text-2xs font-medium">{port}</span>
											<span class="truncate text-2xs text-muted-foreground">
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
								onblur={() => (portRangeTouched = true)}
							/>
							{#if portRangeTouched && portRange && !isValidPortRange(portRange)}
								<p class="mt-1 text-2xs text-destructive">Invalid port range format</p>
							{:else}
								<p class="mt-1 text-2xs text-muted-foreground">
									Examples: 80,443,8080 or 1-1024 or 22,80-100,443
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Scan Settings -->
			<div class="mt-3 border-t border-border pt-3">
				<p class="mb-2 text-2xs font-medium text-muted-foreground">Scan Settings</p>
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

		<!-- 4. Results -->
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
	{/snippet}

	<!-- Results Panel -->
	<div class="relative flex h-full flex-col overflow-hidden">
		<!-- Privilege Setup Banner -->
		{#if privilegeStatus && !privilegeStatus.setupCompleted && privilegeStatus.setupAvailable}
			<div class="flex shrink-0 items-center gap-3 border-b bg-warning/10 px-4 py-2">
				<Shield class="h-4 w-4 text-warning" />
				<span class="flex-1 text-xs text-amber-700 dark:text-amber-300">
					Advanced scanning (TCP SYN) requires privilege setup
				</span>
				<button
					class="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
					disabled={isSettingUpPrivileges}
					onclick={handleSetupPrivileges}
				>
					{#if isSettingUpPrivileges}
						<Loader2 class="inline-block h-3 w-3 animate-spin" />
					{:else}
						Setup Privileges
					{/if}
				</button>
			</div>
		{/if}

		<!-- Discovery Progress Panel -->
		{#if isDiscovering}
			<div class="shrink-0 border-b bg-muted/20 px-4 py-3">
				<div class="mb-2 flex items-center gap-2">
					<Loader2 class="h-4 w-4 animate-spin text-primary" />
					<span class="text-sm font-medium">Finding Hosts...</span>
					<span class="text-xs text-muted-foreground">
						Running {discoveryMethods.size} method{discoveryMethods.size > 1 ? 's' : ''} in parallel
					</span>
				</div>
				<!-- Per-method progress -->
				<div
					class="grid gap-2"
					style="grid-template-columns: repeat({Math.min(discoveryMethods.size, 5)}, 1fr);"
				>
					{#each [...discoveryMethods] as method (method)}
						{@const progress = methodProgress.get(method)}
						<div class="space-y-1">
							<div class="flex items-center justify-between text-xs">
								<span
									class="font-medium truncate"
									title={DISCOVERY_METHODS.find((m) => m.value === method)?.label ?? method}
								>
									{DISCOVERY_METHODS.find((m) => m.value === method)?.label ?? method}
								</span>
								{#if progress?.status === 'completed'}
									<Check class="h-3 w-3 shrink-0 text-green-500" />
								{:else if progress?.status === 'error'}
									<X class="h-3 w-3 shrink-0 text-destructive" />
								{:else if progress?.status === 'running'}
									<Loader2 class="h-3 w-3 shrink-0 animate-spin text-primary" />
								{:else}
									<Clock class="h-3 w-3 shrink-0 text-muted-foreground" />
								{/if}
							</div>
							<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
								<div
									class="h-full transition-all duration-300"
									class:bg-primary={progress?.status === 'running'}
									class:bg-green-500={progress?.status === 'completed'}
									class:bg-destructive={progress?.status === 'error'}
									class:animate-pulse={progress?.status === 'running'}
									style="width: {progress?.status === 'completed' || progress?.status === 'error'
										? 100
										: progress?.status === 'running'
											? 60
											: 0}%"
								></div>
							</div>
							<div class="flex items-center justify-between text-2xs text-muted-foreground">
								{#if progress?.hostsFound !== undefined && progress.hostsFound > 0}
									<span class="text-success">{progress.hostsFound} hosts</span>
								{:else}
									<span>&nbsp;</span>
								{/if}
								{#if progress?.durationMs !== undefined && progress.durationMs !== null}
									<span>{(progress.durationMs / 1000).toFixed(1)}s</span>
								{/if}
							</div>
						</div>
					{/each}
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
					<div class="flex items-center gap-3">
						<span class="text-sm font-medium text-primary">{progressPercentage.toFixed(0)}%</span>
						<button
							type="button"
							class="rounded px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
							onclick={handleCancel}
						>
							Cancel
						</button>
					</div>
				</div>

				<!-- Progress bar -->
				<div class="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
					<div
						class="h-full bg-primary transition-all duration-300"
						style={`width: ${progressPercentage}%`}
					></div>
				</div>

				<!-- Detailed stats -->
				<div class="flex items-center justify-between text-2xs">
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
							<span class="flex items-center gap-1 text-success">
								<Server class="h-3 w-3" />
								<span class="font-medium">{progressDiscoveredHosts}</span>
								<span>hosts found</span>
							</span>
						{/if}
						{#if progressDiscoveredPorts > 0}
							<span class="flex items-center gap-1 text-success">
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
									<span class="text-2xs text-success">
										{totalOpenPorts} open ports
									</span>
								{/if}
							</div>
							<!-- Host List -->
							<div class="flex-1 overflow-auto">
								{#each unifiedHosts as host (host.id)}
									<UnifiedHostListItem
										ips={host.ips}
										hostname={host.hostname ??
											host.netbiosName ??
											host.ssdpDevice?.friendlyName ??
											null}
										vendor={host.vendor}
										openPortCount={host.ports.filter((p) => p.state === 'open').length}
										discoveryMethodCount={host.discoveryMethods.length}
										mdnsServiceCount={host.mdnsServices.length}
										selected={selectedHostId === host.id}
										isNew={recentlyDiscoveredIds.has(host.id)}
										deviceCategory={hostClassifications.get(host.id)?.category}
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
								ssdpDevice={selectedHost.ssdpDevice}
								wsDiscovery={selectedHost.wsDiscovery}
								classification={hostClassifications.get(selectedHost.id) ?? null}
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
</ToolShell>
