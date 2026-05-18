import { createFileRoute } from '@tanstack/react-router';
import { Channel } from '@tauri-apps/api/core';
import {
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
	Square,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ActionButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormError,
	FormInput,
	FormMode,
	FormSection,
	FormSlider,
} from '@/lib/components/form';
import { UnifiedHostDetailPanel, UnifiedHostListItem } from '@/lib/components/network-scanner';
import { ToolShell } from '@/lib/components/shell';
import { EmptyState, ErrorDisplay, StatItem } from '@/lib/components/status';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/lib/components/ui/accordion';
import { Card, CardContent } from '@/lib/components/ui/card';
import { ListItemButton } from '@/lib/components/ui/list-item-button';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/lib/components/ui/resizable';
import { Skeleton } from '@/lib/components/ui/skeleton';
import { classifyHosts } from '@/lib/services/device-classifier';
import {
	cancelDiscovery,
	cancelNetworkScan,
	DATABASE_PORTS,
	DEFAULT_CONCURRENCY,
	DEFAULT_DISCOVERY_METHODS,
	DEFAULT_SYN_PORTS,
	DEFAULT_TIMEOUT_MS,
	DISCOVERY_METHODS,
	type DiscoveryEvent,
	type DiscoveryMethod,
	type DiscoveryOptions,
	type DiscoveryProgress,
	type DiscoveryResult,
	discoverHosts,
	exportToCsv,
	exportToJson,
	formatDuration,
	getDiscoveryMethods,
	getLocalNetworkInterfaces,
	getMergeKey,
	type HostResult,
	isValidPortRange,
	isValidTarget,
	listenToScanProgress,
	type LocalNetworkInfo,
	MAX_CONCURRENCY,
	MAX_TIMEOUT_MS,
	mergeHosts,
	MIN_CONCURRENCY,
	MIN_TIMEOUT_MS,
	type NetworkInterface,
	PORT_PRESETS,
	type PortPreset,
	QUICK_SCAN_PORTS,
	SCAN_MODES,
	type ScanMode,
	type ScanProgress,
	type ScanResults,
	startNetworkScan,
	type UnifiedHost,
	WEB_PORTS,
	WELL_KNOWN_SERVICES,
} from '@/lib/services/network-scanner';
import { createToolOptionsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface NetworkScannerOptions {
	readonly target: string;
	readonly scanMode: ScanMode;
	readonly discoveryMethods: readonly DiscoveryMethod[];
}

const useNetworkScannerOptions = createToolOptionsStore<NetworkScannerOptions>('network-scanner', {
	target: '',
	scanMode: 'quick',
	discoveryMethods: [...DEFAULT_DISCOVERY_METHODS],
});

// Filter out uninformative hostnames (e.g. mDNS resolving random IPs as "localhost.local")
const IGNORED_HOSTNAMES = new Set(['localhost', 'localhost.local', 'localhost.localdomain']);
const isUsefulHostname = (name: string | null | undefined): name is string =>
	!!name && !IGNORED_HOSTNAMES.has(name.toLowerCase());

const getDisplayHostname = (host: UnifiedHost): { name: string; source: string | null } | null => {
	if (isUsefulHostname(host.hostname)) return { name: host.hostname, source: host.hostnameSource };
	if (isUsefulHostname(host.netbiosName)) return { name: host.netbiosName, source: 'netbios' };
	if (host.ssdpDevice?.friendlyName && isUsefulHostname(host.ssdpDevice.friendlyName))
		return { name: host.ssdpDevice.friendlyName, source: 'ssdp' };
	return null;
};

/** Replace discovery results for methods that have been resolved with hostname data */
const replaceWithResolvedResults = (
	current: readonly DiscoveryResult[],
	resolved: readonly DiscoveryResult[]
): DiscoveryResult[] => {
	const resolvedMethods = new Set(resolved.map((r) => r.method));
	return [...current.filter((r) => !resolvedMethods.has(r.method)), ...resolved];
};

export const Route = createFileRoute('/network-scanner')({
	component: NetworkScannerPage,
});

function NetworkScannerPage() {
	const { value: options, patch } = useNetworkScannerOptions();
	const { target, scanMode } = options;
	const discoveryMethodList = options.discoveryMethods;
	const discoveryMethods = useMemo(
		() => new Set<DiscoveryMethod>(discoveryMethodList),
		[discoveryMethodList]
	);

	// Ephemeral form state — not persisted
	const [portPreset, setPortPreset] = useState<PortPreset>('well_known');
	const [portRange, setPortRange] = useState('');
	const [concurrency, setConcurrency] = useState<number>(DEFAULT_CONCURRENCY);
	const [timeoutMs, setTimeoutMs] = useState<number>(DEFAULT_TIMEOUT_MS);

	// Name resolution options (all enabled by default)
	const [resolveDns, setResolveDns] = useState<boolean>(true);
	const [resolveMdns, setResolveMdns] = useState<boolean>(true);
	const [resolveNetbios, setResolveNetbios] = useState<boolean>(true);
	const [resolveTimeoutMs, setResolveTimeoutMs] = useState<number>(2000);

	const resolveHostname = resolveDns || resolveMdns || resolveNetbios;

	// Discovery state
	const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>([]);
	const [isDiscovering, setIsDiscovering] = useState(false);
	const [methodProgress, setMethodProgress] = useState<Map<string, DiscoveryProgress>>(new Map());
	const currentDiscoveryIdRef = useRef<string | null>(null);

	// Network interface state
	const [networkInfo, setNetworkInfo] = useState<LocalNetworkInfo | null>(null);
	const [isLoadingInterfaces, setIsLoadingInterfaces] = useState(false);

	// Scan state
	const [isScanning, setIsScanning] = useState(false);
	const currentScanIdRef = useRef<string | null>(null);
	const [progress, setProgress] = useState<ScanProgress | null>(null);
	const [results, setResults] = useState<ScanResults | null>(null);
	const [discoveredHosts, setDiscoveredHosts] = useState<HostResult[]>([]);
	const [error, setError] = useState<string | null>(null);

	// UI state
	const [showOptions, setShowOptions] = useState(true);
	const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
	const [recentlyDiscoveredIds, setRecentlyDiscoveredIds] = useState<Set<string>>(new Set());
	const [portRangeTouched, setPortRangeTouched] = useState(false);
	const hasAutoSelectedRef = useRef(false);

	// Elapsed timer
	const [, setElapsedMs] = useState(0);
	const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Latest unlisten + cancelled refs to keep async callbacks decoupled from
	// React batching (scan progress events arrive faster than render).
	const unlistenRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		document.title = 'Network Scanner — Kogu';
	}, []);

	const startTimer = useCallback(() => {
		setElapsedMs(0);
		timerIntervalRef.current = setInterval(() => {
			setElapsedMs((prev) => prev + 100);
		}, 100);
	}, []);

	const stopTimer = useCallback(() => {
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
		}
	}, []);

	// Sanity-check discovery availability on mount; cleanup on unmount.
	useEffect(() => {
		getDiscoveryMethods().catch(() => {
			toast.error('Failed to check discovery method availability');
		});
		return () => {
			if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
			unlistenRef.current?.();
		};
	}, []);

	const unifiedHosts = useMemo(
		() => mergeHosts(discoveryResults, discoveredHosts),
		[discoveryResults, discoveredHosts]
	);
	const hostClassifications = useMemo(() => classifyHosts(unifiedHosts), [unifiedHosts]);
	const selectedHost = unifiedHosts.find((h) => h.id === selectedHostId) ?? null;
	const hostsWithoutScans = unifiedHosts.filter((h) => h.ports.length === 0);
	const totalOpenPorts = unifiedHosts.reduce(
		(sum, h) => sum + h.ports.filter((p) => p.state === 'open').length,
		0
	);

	const canScan = isValidTarget(target) && !isScanning;
	const needsPortRange = scanMode === 'custom' && portPreset === 'custom';
	const isPortRangeValid = !needsPortRange || isValidPortRange(portRange);
	const progressPercentage = progress?.type === 'progress' ? progress.percentage : 0;
	const progressCurrentIp = progress?.type === 'progress' ? progress.current_ip : null;
	const progressDiscoveredHosts = progress?.type === 'progress' ? progress.discovered_hosts : 0;
	const progressDiscoveredPorts = progress?.type === 'progress' ? progress.discovered_ports : 0;
	const progressText =
		progress?.type === 'progress'
			? `${progress.scanned_hosts} / ${progress.total_hosts} hosts`
			: progress?.type === 'started'
				? `Scanning ${progress.total_hosts} hosts, ${progress.total_ports} ports each`
				: '';

	const setTarget = useCallback((next: string) => patch({ target: next }), [patch]);
	const setScanMode = useCallback((next: ScanMode) => patch({ scanMode: next }), [patch]);
	const setDiscoveryMethodList = useCallback(
		(next: readonly DiscoveryMethod[]) => patch({ discoveryMethods: next }),
		[patch]
	);

	const handleProgressEvent = useCallback((event: ScanProgress) => {
		setProgress(event);

		if (event.type === 'host_discovered') {
			setDiscoveredHosts((prev) => [...prev, event.host]);
			const hostKey = getMergeKey(event.host.ip, event.host.hostname ?? null);

			// Mark as recently discovered for animation
			setRecentlyDiscoveredIds((prev) => {
				const next = new Set(prev);
				next.add(hostKey);
				return next;
			});

			// Remove from recently discovered after animation completes
			setTimeout(() => {
				setRecentlyDiscoveredIds((prev) => {
					const next = new Set(prev);
					next.delete(hostKey);
					return next;
				});
			}, 1500);

			// Auto-select first host only once (don't override user selection)
			if (!hasAutoSelectedRef.current) {
				setSelectedHostId((prev) => {
					if (prev !== null) return prev;
					hasAutoSelectedRef.current = true;
					return hostKey;
				});
			}
		} else if (event.type === 'completed') {
			setResults(event.results);
			setIsScanning(false);
			setRecentlyDiscoveredIds(new Set());
			toast.success('Scan completed', {
				description: `Found ${event.results.totalOpenPorts} open ports on ${event.results.hostsWithOpenPorts} hosts`,
			});
		} else if (event.type === 'error') {
			setError(event.message);
			setIsScanning(false);
			setRecentlyDiscoveredIds(new Set());
			toast.error('Scan failed', { description: event.message });
		}
	}, []);

	const handleScan = useCallback(async () => {
		if (!canScan || !isPortRangeValid) return;

		// Cancel any running scan before starting a new one
		const previousScanId = currentScanIdRef.current;
		if (previousScanId) {
			await cancelNetworkScan(previousScanId);
		}

		const scanId = crypto.randomUUID();
		currentScanIdRef.current = scanId;

		setIsScanning(true);
		startTimer();
		setError(null);
		setResults(null);
		// Don't clear discoveredHosts to allow merging with discovery results
		setProgress(null);

		// Setup progress listener
		try {
			unlistenRef.current = await listenToScanProgress(handleProgressEvent);
		} catch {
			setError('Failed to setup event listener');
			stopTimer();
			setIsScanning(false);
			currentScanIdRef.current = null;
			return;
		}

		try {
			await startNetworkScan(
				{
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
				},
				scanId
			);
		} catch (e) {
			if (currentScanIdRef.current === scanId) {
				const message = e instanceof Error ? e.message : String(e);
				setError(message);
				// Don't show error toast for cancellation
				if (!message.includes('cancelled')) {
					toast.error('Scan failed', { description: message });
				}
			}
		} finally {
			// Only clean up if this is still the current scan
			if (currentScanIdRef.current === scanId) {
				if (unlistenRef.current) {
					unlistenRef.current();
					unlistenRef.current = null;
				}
				stopTimer();
				setIsScanning(false);
				currentScanIdRef.current = null;
			}
		}
	}, [
		canScan,
		isPortRangeValid,
		target,
		scanMode,
		portPreset,
		portRange,
		needsPortRange,
		concurrency,
		timeoutMs,
		resolveHostname,
		resolveDns,
		resolveMdns,
		resolveNetbios,
		resolveTimeoutMs,
		startTimer,
		stopTimer,
		handleProgressEvent,
	]);

	const handleCancel = useCallback(async () => {
		const scanId = currentScanIdRef.current;
		if (scanId) {
			await cancelNetworkScan(scanId);
		}
		if (unlistenRef.current) {
			unlistenRef.current();
			unlistenRef.current = null;
		}
		stopTimer();
		setIsScanning(false);
		currentScanIdRef.current = null;
		toast.info('Scan cancelled');
	}, [stopTimer]);

	const handleClear = useCallback(() => {
		setResults(null);
		setDiscoveredHosts([]);
		setDiscoveryResults([]);
		setProgress(null);
		setError(null);
		setSelectedHostId(null);
		currentScanIdRef.current = null;
		setRecentlyDiscoveredIds(new Set());
		setPortRangeTouched(false);
		hasAutoSelectedRef.current = false;
		setMethodProgress(new Map());
	}, []);

	const exportFile = (content: string, mime: string, extension: string) => {
		const blob = new Blob([content], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `network-scan-${new Date().toISOString().slice(0, 10)}.${extension}`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleExportJson = () => {
		if (!results) return;
		exportFile(exportToJson(results), 'application/json', 'json');
		toast.success('Exported as JSON');
	};

	const handleExportCsv = () => {
		if (!results) return;
		exportFile(exportToCsv(results), 'text/csv', 'csv');
		toast.success('Exported as CSV');
	};

	const handleLoadInterfaces = async () => {
		setIsLoadingInterfaces(true);
		try {
			const info = await getLocalNetworkInterfaces();
			setNetworkInfo(info);
			// Auto-fill with primary IPv4 CIDR if available
			const primary = info.primaryIpv4;
			if (primary?.suggestedCidr) {
				setTarget(primary.suggestedCidr);
				toast.success('Target auto-filled', {
					description: `Using ${primary.name} (${primary.ip})`,
				});
			} else if (info.interfaces.length > 0) {
				const usable = info.interfaces.find((i) => !i.isLoopback && i.suggestedCidr);
				if (usable?.suggestedCidr) {
					setTarget(usable.suggestedCidr);
					toast.success('Target auto-filled', {
						description: `Using ${usable.name} (${usable.ip})`,
					});
				} else {
					toast.warning('No suitable network interface found');
				}
			}
		} catch (e) {
			toast.error('Failed to load network interfaces', {
				description: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setIsLoadingInterfaces(false);
		}
	};

	const handleSelectInterface = (iface: NetworkInterface) => {
		if (iface.suggestedCidr) {
			setTarget(iface.suggestedCidr);
		} else {
			setTarget(iface.ip);
		}
	};

	const toggleDiscoveryMethod = (method: DiscoveryMethod) => {
		const next = new Set(discoveryMethods);
		if (next.has(method)) {
			next.delete(method);
		} else {
			next.add(method);
		}
		setDiscoveryMethodList([...next]);
	};

	const autoSelectFirstHost = useCallback((hosts: readonly string[]) => {
		if (hasAutoSelectedRef.current || hosts.length === 0) return;
		const firstIp = [...hosts].sort()[0];
		if (!firstIp) return;
		setSelectedHostId((prev) => {
			if (prev !== null) return prev;
			hasAutoSelectedRef.current = true;
			return getMergeKey(firstIp, null);
		});
	}, []);

	const handleDiscovery = async () => {
		if (!isValidTarget(target) || discoveryMethods.size === 0) return;

		// Cancel any running discovery before starting a new one
		const previousId = currentDiscoveryIdRef.current;
		if (previousId) {
			await cancelDiscovery(previousId);
		}

		// Clear previous results to avoid mixing old and new data
		setDiscoveryResults([]);
		hasAutoSelectedRef.current = false;
		setSelectedHostId(null);

		setIsDiscovering(true);
		startTimer();
		setMethodProgress(new Map());

		const discoveryId = crypto.randomUUID();
		currentDiscoveryIdRef.current = discoveryId;

		const channel = new Channel<DiscoveryEvent>();
		channel.onmessage = (message: DiscoveryEvent) => {
			// Ignore events from a stale discovery (cancelled and replaced)
			if (currentDiscoveryIdRef.current !== discoveryId) return;

			switch (message.event) {
				case 'methodStarted':
					setMethodProgress((prev) => {
						const next = new Map(prev);
						next.set(message.data.method, {
							method: message.data.method,
							status: 'running',
							hostsFound: 0,
							durationMs: null,
							error: null,
						});
						return next;
					});
					break;
				case 'methodCompleted': {
					const { result } = message.data;
					setMethodProgress((prev) => {
						const next = new Map(prev);
						next.set(result.method, {
							method: result.method,
							status: result.error ? 'error' : 'completed',
							hostsFound: result.hosts.length,
							durationMs: result.durationMs,
							error: result.error ?? null,
						});
						return next;
					});
					// Merge result immediately — unifiedHosts re-derives → UI updates
					setDiscoveryResults((prev) => [...prev, result]);
					autoSelectFirstHost(result.hosts);
					break;
				}
				case 'resolvingHostnames':
					// Could show "Resolving hostnames..." in UI if desired
					break;
				case 'completed':
					setDiscoveryResults((prev) => replaceWithResolvedResults(prev, message.data.results));
					break;
				case 'cancelled':
					break;
			}
		};

		try {
			const discoveryOptions: DiscoveryOptions = {
				methods: [...discoveryMethods],
				timeoutMs,
				concurrency,
				synPorts: [...DEFAULT_SYN_PORTS],
				resolveNetbios,
			};

			await discoverHosts([target.trim()], discoveryOptions, channel, discoveryId);

			// Use merged unifiedHosts count (accurate, deduplicated)
			if (unifiedHosts.length > 0) {
				toast.success('Discovery completed', {
					description: `Found ${unifiedHosts.length} hosts`,
				});
			} else {
				toast.info('Discovery completed', {
					description: 'No hosts found',
				});
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (!msg.includes('cancelled')) {
				toast.error('Discovery failed', { description: msg });
			}
		} finally {
			// Only clean up if this is still the current discovery
			if (currentDiscoveryIdRef.current === discoveryId) {
				stopTimer();
				setIsDiscovering(false);
				currentDiscoveryIdRef.current = null;
			}
		}
	};

	const handleCancelDiscovery = async () => {
		const discoveryId = currentDiscoveryIdRef.current;
		if (discoveryId) {
			await cancelDiscovery(discoveryId);
		}
		toast.info('Discovery cancelled');
	};

	const selectHost = (hostId: string) => {
		setSelectedHostId(hostId);
	};

	const handleHostListKeydown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
		if (unifiedHosts.length === 0) return;
		e.preventDefault();
		const currentIdx = unifiedHosts.findIndex((h) => h.id === selectedHostId);

		let nextIdx: number;
		switch (e.key) {
			case 'ArrowDown':
				nextIdx = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, unifiedHosts.length - 1);
				break;
			case 'ArrowUp':
				nextIdx = currentIdx < 0 ? 0 : Math.max(currentIdx - 1, 0);
				break;
			case 'Home':
				nextIdx = 0;
				break;
			case 'End':
				nextIdx = unifiedHosts.length - 1;
				break;
			default:
				return;
		}
		const next = unifiedHosts[nextIdx];
		if (next) {
			selectHost(next.id);
			document.querySelector(`[data-host-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
		}
	};

	const handleScanDiscoveredHost = (ip: string, mode: ScanMode) => {
		setTarget(ip);
		setScanMode(mode);
		handleScan().catch(() => {});
	};

	const statusContent = results ? (
		<>
			<StatItem label="Hosts" value={results.hostsWithOpenPorts} />
			<StatItem label="Ports" value={results.totalOpenPorts} />
			<StatItem label="Duration" value={formatDuration(results.scanDurationMs)} />
		</>
	) : isScanning && progress?.type === 'progress' ? (
		<StatItem label="Progress" value={`${progress.percentage.toFixed(0)}%`} />
	) : unifiedHosts.length > 0 ? (
		<StatItem label="Hosts" value={unifiedHosts.length} />
	) : null;

	const usableInterfaces = networkInfo?.interfaces.filter((i) => !i.isLoopback && i.suggestedCidr);

	const rail = (
		<>
			{/* 1. Target */}
			<FormSection title="Target">
				<div className="space-y-2">
					<FormInput
						label="Host / IP / CIDR"
						value={target}
						onValueChange={setTarget}
						placeholder="192.168.1.1 or 192.168.1.0/24"
					/>
					{target && !isValidTarget(target) ? <FormError message="Invalid target format" /> : null}
					<ActionButton
						label="Detect Local Network"
						icon={RefreshCw}
						loading={isLoadingInterfaces}
						loadingLabel="Detecting..."
						disabled={isScanning}
						variant="outline"
						onClick={() => {
							handleLoadInterfaces().catch(() => {});
						}}
					/>
				</div>
				{usableInterfaces && usableInterfaces.length > 0 ? (
					<div className="mt-2 space-y-1">
						<p className="text-xs font-medium text-muted-foreground">Available interfaces:</p>
						<div className="max-h-32 space-y-1 overflow-y-auto">
							{usableInterfaces.map((iface) => (
								<ListItemButton
									key={iface.ip}
									variant="card"
									size="sm"
									onClick={() => handleSelectInterface(iface)}
								>
									<span className="flex min-w-0 flex-col items-start gap-0.5">
										<span className="font-medium">{iface.name}</span>
										<span className="break-all font-mono text-2xs text-muted-foreground">
											{iface.suggestedCidr}
										</span>
									</span>
								</ListItemButton>
							))}
						</div>
					</div>
				) : null}
			</FormSection>

			{/* 2. Host Discovery */}
			<FormSection title="Host Discovery">
				<p className="mb-2 text-xs leading-snug text-muted-foreground">
					Find active hosts before port scanning.
				</p>
				<FormCheckboxGroup>
					{DISCOVERY_METHODS.map((method) => {
						const isSelected = discoveryMethods.has(method.value);
						const isDisabled = isDiscovering || isScanning;
						return (
							<FormCheckbox
								key={method.value}
								label={method.label}
								checked={isSelected}
								disabled={isDisabled}
								onCheckedChange={() => toggleDiscoveryMethod(method.value)}
							/>
						);
					})}
				</FormCheckboxGroup>

				{/* Name Resolution (collapsible) */}
				<Accordion type="multiple" defaultValue={['name-resolution']} className="mt-3">
					<AccordionItem value="name-resolution" className="rounded border border-border bg-card">
						<AccordionTrigger className="px-2 py-1.5 text-xs font-medium hover:no-underline [&>svg]:h-3.5 [&>svg]:w-3.5">
							<span>Name Resolution</span>
						</AccordionTrigger>
						<AccordionContent className="border-t border-border/30 px-2 pb-2">
							<FormCheckboxGroup className="pt-2">
								<FormCheckbox
									label="DNS PTR"
									checked={resolveDns}
									onCheckedChange={setResolveDns}
								/>
								<FormCheckbox
									label="mDNS (.local)"
									checked={resolveMdns}
									onCheckedChange={setResolveMdns}
								/>
								<FormCheckbox
									label="NetBIOS"
									checked={resolveNetbios}
									onCheckedChange={setResolveNetbios}
								/>
								{resolveHostname ? (
									<div className="mt-2 border-t border-border pt-2">
										<FormSlider
											label="Timeout"
											value={resolveTimeoutMs}
											onValueChange={setResolveTimeoutMs}
											min={500}
											max={5000}
											step={500}
											hint={`${resolveTimeoutMs}ms`}
										/>
									</div>
								) : null}
							</FormCheckboxGroup>
						</AccordionContent>
					</AccordionItem>
				</Accordion>

				{discoveryMethods.size > 0 ? (
					<div className="mt-3">
						{isDiscovering ? (
							<ActionButton
								label="Cancel Discovery"
								icon={Square}
								variant="destructive"
								onClick={() => {
									handleCancelDiscovery().catch(() => {});
								}}
							/>
						) : (
							<ActionButton
								label="Find Hosts"
								icon={Radar}
								disabled={!isValidTarget(target) || isScanning}
								variant="outline"
								onClick={() => {
									handleDiscovery().catch(() => {});
								}}
							/>
						)}
					</div>
				) : null}
				{discoveryResults.length > 0 ? (
					<Card density="compact" className="mt-2">
						<CardContent className="p-2">
							<p className="text-xs font-medium text-muted-foreground">Results:</p>
							<div className="mt-1 max-h-20 space-y-0.5 overflow-y-auto">
								{discoveryResults.map((result) => (
									<div key={result.method} className="text-xs">
										<span className="font-medium">
											{DISCOVERY_METHODS.find((m) => m.value === result.method)?.label ??
												result.method}
											:
										</span>{' '}
										{result.error ? (
											<span className="text-destructive">{result.error}</span>
										) : (
											<span className="text-muted-foreground">{result.hosts.length} host(s)</span>
										)}
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				) : null}
			</FormSection>

			{/* 3. Port Scan */}
			<FormSection title="Port Scan">
				<FormMode<ScanMode>
					label="Scan Mode"
					value={scanMode}
					layout="stacked"
					descriptionDisplay="selected"
					options={SCAN_MODES.map((m) => ({
						value: m.value,
						label: m.label,
						description: m.description,
					}))}
					onValueChange={(v) => setScanMode(v)}
				/>

				{/* Quick Scan Port Details */}
				{scanMode === 'quick' ? (
					<details className="mt-2 rounded border border-border bg-card">
						<summary className="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
							<ChevronRight className="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
							Target Ports ({QUICK_SCAN_PORTS.length})
						</summary>
						<div className="max-h-48 overflow-y-auto border-t border-border">
							<div className="grid grid-cols-2 gap-px bg-border">
								{QUICK_SCAN_PORTS.map((port) => (
									<div
										key={port}
										className="flex items-center justify-between bg-background px-2 py-1"
										title={WELL_KNOWN_SERVICES[port] ?? `Port ${port}`}
									>
										<span className="font-mono text-xs font-medium tabular-nums">{port}</span>
										<span className="truncate text-xs text-muted-foreground">
											{WELL_KNOWN_SERVICES[port] ?? ''}
										</span>
									</div>
								))}
							</div>
						</div>
					</details>
				) : null}

				{/* Port Selection (custom mode only) */}
				{scanMode === 'custom' ? (
					<div className="mt-3 border-t border-border pt-3">
						<FormMode<PortPreset>
							label="Port Selection"
							value={portPreset}
							layout="stacked"
							descriptionDisplay="selected"
							options={PORT_PRESETS.map((p) => ({
								value: p.value,
								label: p.label,
								description: p.description,
							}))}
							onValueChange={(v) => setPortPreset(v)}
						/>

						{portPreset === 'well_known' ? (
							<p className="mt-1.5 text-xs text-muted-foreground">
								Standard ports 1-1024 (1,024 ports)
							</p>
						) : portPreset === 'web' ? (
							<details className="mt-2 rounded border border-border bg-card">
								<summary className="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
									<ChevronRight className="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
									Web Ports ({WEB_PORTS.length})
								</summary>
								<div className="max-h-32 overflow-y-auto border-t border-border">
									<div className="grid grid-cols-2 gap-px bg-border">
										{WEB_PORTS.map((port) => (
											<div
												key={port}
												className="flex items-center justify-between bg-background px-2 py-1"
												title={WELL_KNOWN_SERVICES[port] ?? `Port ${port}`}
											>
												<span className="font-mono text-xs font-medium tabular-nums">{port}</span>
												<span className="truncate text-xs text-muted-foreground">
													{WELL_KNOWN_SERVICES[port] ?? ''}
												</span>
											</div>
										))}
									</div>
								</div>
							</details>
						) : portPreset === 'database' ? (
							<details className="mt-2 rounded border border-border bg-card">
								<summary className="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
									<ChevronRight className="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
									Database Ports ({DATABASE_PORTS.length})
								</summary>
								<div className="max-h-32 overflow-y-auto border-t border-border">
									<div className="grid grid-cols-2 gap-px bg-border">
										{DATABASE_PORTS.map((port) => (
											<div
												key={port}
												className="flex items-center justify-between bg-background px-2 py-1"
												title={WELL_KNOWN_SERVICES[port] ?? `Port ${port}`}
											>
												<span className="font-mono text-xs font-medium tabular-nums">{port}</span>
												<span className="truncate text-xs text-muted-foreground">
													{WELL_KNOWN_SERVICES[port] ?? ''}
												</span>
											</div>
										))}
									</div>
								</div>
							</details>
						) : portPreset === 'custom' ? (
							<div className="mt-2">
								<FormInput
									label="Port Range"
									value={portRange}
									onValueChange={setPortRange}
									placeholder="80,443,8080 or 1-1024"
									onBlur={() => setPortRangeTouched(true)}
								/>
								{portRangeTouched && portRange && !isValidPortRange(portRange) ? (
									<FormError className="mt-1" message="Invalid port range format" />
								) : (
									<p className="mt-1 text-xs text-muted-foreground">
										Examples: 80,443,8080 or 1-1024 or 22,80-100,443
									</p>
								)}
							</div>
						) : null}
					</div>
				) : null}

				{/* Scan Settings */}
				<div className="mt-3 border-t border-border/30 pt-3">
					<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/70">
						Scan Settings
					</p>
					<FormSlider
						label="Concurrency"
						value={concurrency}
						onValueChange={setConcurrency}
						min={MIN_CONCURRENCY}
						max={MAX_CONCURRENCY}
						step={10}
						hint={`${concurrency}`}
					/>
					<FormSlider
						label="Timeout"
						value={timeoutMs}
						onValueChange={setTimeoutMs}
						min={MIN_TIMEOUT_MS}
						max={MAX_TIMEOUT_MS}
						step={100}
						hint={`${timeoutMs}ms`}
					/>
				</div>

				{/* Action Button */}
				<div className="mt-3">
					{isScanning ? (
						<ActionButton
							label="Cancel Scan"
							icon={Square}
							variant="destructive"
							onClick={() => {
								handleCancel().catch(() => {});
							}}
						/>
					) : (
						<ActionButton
							label="Scan Ports"
							icon={Play}
							loading={isScanning}
							loadingLabel="Scanning..."
							disabled={!canScan || !isPortRangeValid}
							shortcut
							onClick={() => {
								handleScan().catch(() => {});
							}}
						/>
					)}
				</div>
			</FormSection>

			{/* 4. Results */}
			{results ? (
				<FormSection title="Results">
					<div className="space-y-2">
						<ActionButton label="Clear Results" variant="outline" onClick={handleClear} />
						<ActionButton
							label="Export JSON"
							icon={Download}
							variant="outline"
							onClick={handleExportJson}
						/>
						<ActionButton
							label="Export CSV"
							icon={Download}
							variant="outline"
							onClick={handleExportCsv}
						/>
					</div>
				</FormSection>
			) : null}
		</>
	);

	return (
		<ToolShell
			layout="master-detail"
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			valid={results ? true : null}
			statusContent={statusContent}
			rail={rail}
		>
			<div className="relative flex h-full flex-col overflow-hidden">
				{/* Discovery Progress Panel */}
				{isDiscovering ? (
					<div className="shrink-0 border-b bg-surface-2 px-4 py-3">
						<div className="mb-2 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin text-primary" />
								<span className="text-sm font-medium">Finding Hosts...</span>
								<span className="text-xs text-muted-foreground">
									Running {discoveryMethods.size} method
									{discoveryMethods.size > 1 ? 's' : ''} in parallel
								</span>
							</div>
							<ActionButton
								label="Cancel"
								variant="ghost"
								size="sm"
								className="w-auto text-muted-foreground hover:text-destructive"
								onClick={() => {
									handleCancelDiscovery().catch(() => {});
								}}
							/>
						</div>
						{/* Per-method progress */}
						<div
							className="grid gap-2"
							style={{
								gridTemplateColumns: `repeat(${Math.min(discoveryMethods.size, 5)}, 1fr)`,
							}}
						>
							{[...discoveryMethods].map((method) => {
								const methodProg = methodProgress.get(method);
								return (
									<div key={method} className="space-y-1">
										<div className="flex items-center justify-between text-xs">
											<span
												className="truncate font-medium"
												title={DISCOVERY_METHODS.find((m) => m.value === method)?.label ?? method}
											>
												{DISCOVERY_METHODS.find((m) => m.value === method)?.label ?? method}
											</span>
											{methodProg?.status === 'completed' ? (
												<Check className="h-3 w-3 shrink-0 text-success" />
											) : methodProg?.status === 'error' ? (
												<X className="h-3 w-3 shrink-0 text-destructive" />
											) : methodProg?.status === 'running' ? (
												<Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
											) : (
												<Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
											)}
										</div>
										<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
											<div
												className={cn(
													'h-full transition-all duration-300',
													methodProg?.status === 'running' && 'animate-pulse bg-primary',
													methodProg?.status === 'completed' && 'bg-success',
													methodProg?.status === 'error' && 'bg-destructive'
												)}
												style={{
													width: `${
														methodProg?.status === 'completed' || methodProg?.status === 'error'
															? 100
															: methodProg?.status === 'running'
																? 60
																: 0
													}%`,
												}}
											/>
										</div>
										<div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
											{methodProg?.hostsFound !== undefined && methodProg.hostsFound > 0 ? (
												<span className="text-success">{methodProg.hostsFound} hosts</span>
											) : (
												<span>&nbsp;</span>
											)}
											{methodProg?.durationMs !== undefined && methodProg?.durationMs !== null ? (
												<span>{(methodProg.durationMs / 1000).toFixed(1)}s</span>
											) : null}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				) : isScanning ? (
					<div
						className="shrink-0 border-b bg-surface-2 px-4 py-3"
						role="status"
						aria-live="polite"
						aria-atomic="false"
					>
						{/* Main progress info */}
						<div className="mb-2 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin text-primary" />
								<span className="text-sm font-medium">Scanning Ports...</span>
								<span className="text-xs text-muted-foreground">{progressText}</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-sm font-medium tabular-nums text-primary">
									{progressPercentage.toFixed(0)}%
								</span>
								<ActionButton
									label="Cancel"
									variant="ghost"
									size="sm"
									className="w-auto text-muted-foreground hover:text-destructive"
									onClick={() => {
										handleCancel().catch(() => {});
									}}
								/>
							</div>
						</div>

						{/* Progress bar */}
						<div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
							<div
								className="h-full bg-primary transition-all duration-300"
								style={{ width: `${progressPercentage}%` }}
							/>
						</div>

						{/* Detailed stats */}
						<div className="flex items-center justify-between text-xs">
							<div className="flex items-center gap-4">
								{progressCurrentIp ? (
									<span className="flex items-center gap-1 text-muted-foreground">
										<span>Next:</span>
										<span className="font-mono font-medium text-foreground">
											{progressCurrentIp}
										</span>
									</span>
								) : null}
							</div>
							<div className="flex items-center gap-4">
								{progressDiscoveredHosts > 0 ? (
									<span className="flex items-center gap-1 text-success">
										<Server className="h-3 w-3" />
										<span className="font-medium">{progressDiscoveredHosts}</span>
										<span>hosts found</span>
									</span>
								) : null}
								{progressDiscoveredPorts > 0 ? (
									<span className="flex items-center gap-1 text-success">
										<Network className="h-3 w-3" />
										<span className="font-medium">{progressDiscoveredPorts}</span>
										<span>ports open</span>
									</span>
								) : null}
							</div>
						</div>
					</div>
				) : null}

				{/* Main Content */}
				<div className="flex-1 overflow-hidden">
					{(isDiscovering || isScanning) && unifiedHosts.length === 0 && !error ? (
						<div
							className="space-y-1.5 p-2"
							role="status"
							aria-busy="true"
							aria-label="Loading hosts"
						>
							{Array.from({ length: 6 }, (_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
								<div key={i} className="flex items-center gap-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="ml-auto h-4 w-12" />
								</div>
							))}
						</div>
					) : unifiedHosts.length > 0 ? (
						<ResizablePanelGroup orientation="horizontal" className="h-full">
							{/* Left Pane: Host List */}
							<ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
								<div className="flex h-full flex-col border-r">
									<div
										className="flex h-9 shrink-0 items-center justify-between border-b bg-surface-3 px-3"
										role="status"
										aria-live="polite"
										aria-atomic="true"
									>
										<span className="text-xs font-medium text-muted-foreground">
											Hosts ({unifiedHosts.length})
										</span>
										{totalOpenPorts > 0 ? (
											<span className="text-xs text-success">{totalOpenPorts} open ports</span>
										) : null}
									</div>
									{/* Host List */}
									<div
										className="flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
										role="listbox"
										tabIndex={0}
										aria-label="Discovered hosts"
										onKeyDown={handleHostListKeydown}
									>
										{unifiedHosts.map((host) => {
											const displayHostname = getDisplayHostname(host);
											return (
												<UnifiedHostListItem
													key={host.id}
													hostId={host.id}
													ips={host.ips}
													hostname={displayHostname?.name ?? null}
													hostnameSource={displayHostname?.source ?? null}
													macAddress={host.macAddress}
													vendor={host.vendor}
													openPortCount={host.ports.filter((p) => p.state === 'open').length}
													discoveryMethodCount={host.discoveryMethods.length}
													mdnsServiceCount={host.mdnsServices.length}
													selected={selectedHostId === host.id}
													isNew={recentlyDiscoveredIds.has(host.id)}
													deviceCategory={hostClassifications.get(host.id)?.category}
													hasPortScan={host.ports.length > 0}
													onClick={() => selectHost(host.id)}
												/>
											);
										})}
									</div>
									{/* Scan All Button (only if we have hosts without port scans) */}
									{hostsWithoutScans.length > 0 ? (
										<div className="shrink-0 border-t bg-surface-3 p-2">
											<ActionButton
												label={`Scan ${hostsWithoutScans.length} Unscanned Hosts`}
												icon={Play}
												size="sm"
												variant="outline"
												disabled={isScanning}
												onClick={() => {
													setTarget(hostsWithoutScans.flatMap((h) => h.ips).join(','));
													handleScan().catch(() => {});
												}}
											/>
										</div>
									) : null}
								</div>
							</ResizablePanel>

							<ResizableHandle withHandle />

							{/* Right Pane: Host Detail */}
							<ResizablePanel defaultSize={65} minSize={40}>
								{selectedHost ? (
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
										snmpInfo={selectedHost.snmpInfo}
										tlsNames={selectedHost.tlsNames}
										serviceBanners={selectedHost.serviceBanners}
										classification={hostClassifications.get(selectedHost.id) ?? null}
										discoveryMethods={selectedHost.discoveryMethods}
										discoveries={selectedHost.discoveries}
										ports={selectedHost.ports}
										scanDurationMs={selectedHost.scanDurationMs}
										onScan={handleScanDiscoveredHost}
										onCancel={() => {
											handleCancel().catch(() => {});
										}}
										scanDisabled={isScanning}
										scanProgress={isScanning ? progress : null}
									/>
								) : (
									<EmptyState icon={Server} title="Select a host to view details" />
								)}
							</ResizablePanel>
						</ResizablePanelGroup>
					) : error ? (
						<ErrorDisplay variant="centered" message={error} />
					) : (
						<EmptyState
							icon={Radar}
							title="Enter a target and start scanning"
							description="IP address, hostname, or CIDR notation"
						/>
					)}
				</div>

				{/* Summary Footer */}
				{results ? (
					<div className="shrink-0 border-t bg-surface-3 px-4 py-2">
						<div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
							<div className="flex items-center gap-4">
								<span className="flex items-center gap-1">
									<Server className="h-3 w-3" />
									{results.totalHostsScanned} hosts scanned
								</span>
								<span className="flex items-center gap-1">
									<CheckCircle2 className="h-3 w-3 text-success" />
									{results.hostsWithOpenPorts} with open ports
								</span>
								<span className="flex items-center gap-1">
									<Network className="h-3 w-3" />
									{results.totalOpenPorts} ports open
								</span>
							</div>
							<span className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								{formatDuration(results.scanDurationMs)}
							</span>
						</div>
					</div>
				) : null}
			</div>
		</ToolShell>
	);
}
