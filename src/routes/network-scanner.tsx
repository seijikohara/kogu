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
import { classifyHosts, type DeviceClassification } from '@/lib/services/device-classifier';
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

interface StatusContentArgs {
	readonly results: ScanResults | null;
	readonly isScanning: boolean;
	readonly progress: ScanProgress | null;
	readonly unifiedHostCount: number;
}

const renderStatusContent = ({
	results,
	isScanning,
	progress,
	unifiedHostCount,
}: StatusContentArgs): React.ReactNode => {
	if (results) {
		return (
			<>
				<StatItem label="Hosts" value={results.hostsWithOpenPorts} />
				<StatItem label="Ports" value={results.totalOpenPorts} />
				<StatItem label="Duration" value={formatDuration(results.scanDurationMs)} />
			</>
		);
	}
	if (isScanning && progress?.type === 'progress') {
		return <StatItem label="Progress" value={`${progress.percentage.toFixed(0)}%`} />;
	}
	if (unifiedHostCount > 0) {
		return <StatItem label="Hosts" value={unifiedHostCount} />;
	}
	return null;
};

const pickAutoFillInterface = (info: LocalNetworkInfo): NetworkInterface | null => {
	if (info.primaryIpv4?.suggestedCidr) return info.primaryIpv4;
	if (info.interfaces.length === 0) return null;
	return info.interfaces.find((i) => !i.isLoopback && i.suggestedCidr) ?? null;
};

const formatProgressText = (progress: ScanProgress | null): string => {
	if (progress?.type === 'progress') {
		return `${progress.scanned_hosts} / ${progress.total_hosts} hosts`;
	}
	if (progress?.type === 'started') {
		return `Scanning ${progress.total_hosts} hosts, ${progress.total_ports} ports each`;
	}
	return '';
};

const resolveKeydownIndex = (
	key: string,
	currentIdx: number,
	listLength: number
): number | null => {
	switch (key) {
		case 'ArrowDown':
			return currentIdx < 0 ? 0 : Math.min(currentIdx + 1, listLength - 1);
		case 'ArrowUp':
			return currentIdx < 0 ? 0 : Math.max(currentIdx - 1, 0);
		case 'Home':
			return 0;
		case 'End':
			return listLength - 1;
		default:
			return null;
	}
};

const reportDiscoverySuccess = (hostsFound: number) => {
	if (hostsFound > 0) {
		toast.success('Discovery completed', {
			description: `Found ${hostsFound} hosts`,
		});
		return;
	}
	toast.info('Discovery completed', { description: 'No hosts found' });
};

const reportDiscoveryError = (e: unknown) => {
	const msg = e instanceof Error ? e.message : String(e);
	if (!msg.includes('cancelled')) {
		toast.error('Discovery failed', { description: msg });
	}
};

interface DiscoveryChannelHandlerDeps {
	readonly currentDiscoveryIdRef: React.RefObject<string | null>;
	readonly discoveryId: string;
	readonly setMethodProgress: React.Dispatch<React.SetStateAction<Map<string, DiscoveryProgress>>>;
	readonly setDiscoveryResults: React.Dispatch<React.SetStateAction<DiscoveryResult[]>>;
	readonly autoSelectFirstHost: (hosts: readonly string[]) => void;
}

const createDiscoveryChannelHandler =
	({
		currentDiscoveryIdRef,
		discoveryId,
		setMethodProgress,
		setDiscoveryResults,
		autoSelectFirstHost,
	}: DiscoveryChannelHandlerDeps) =>
	(message: DiscoveryEvent) => {
		// Ignore events from a stale discovery (cancelled and replaced).
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
				return;
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
				setDiscoveryResults((prev) => [...prev, result]);
				autoSelectFirstHost(result.hosts);
				return;
			}
			case 'completed':
				setDiscoveryResults((prev) => replaceWithResolvedResults(prev, message.data.results));
				return;
			case 'resolvingHostnames':
			case 'cancelled':
				return;
		}
	};

interface PortListDetailsProps {
	readonly label: string;
	readonly ports: readonly number[];
	readonly maxHeight?: string;
}

function PortListDetails({ label, ports, maxHeight = 'max-h-32' }: PortListDetailsProps) {
	return (
		<details className="mt-2 rounded border border-border bg-card">
			<summary className="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
				<ChevronRight className="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
				{label} ({ports.length})
			</summary>
			<div className={cn(maxHeight, 'overflow-y-auto border-t border-border')}>
				<div className="grid grid-cols-2 gap-px bg-border">
					{ports.map((port) => (
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
	);
}

interface TargetSectionProps {
	readonly target: string;
	readonly onTargetChange: (value: string) => void;
	readonly isScanning: boolean;
	readonly isLoadingInterfaces: boolean;
	readonly usableInterfaces: readonly NetworkInterface[] | undefined;
	readonly onLoadInterfaces: () => void;
	readonly onSelectInterface: (iface: NetworkInterface) => void;
}

function TargetSection({
	target,
	onTargetChange,
	isScanning,
	isLoadingInterfaces,
	usableInterfaces,
	onLoadInterfaces,
	onSelectInterface,
}: TargetSectionProps) {
	return (
		<FormSection title="Target">
			<div className="space-y-2">
				<FormInput
					label="Host / IP / CIDR"
					value={target}
					onValueChange={onTargetChange}
					placeholder="192.168.1.1 or 192.168.1.0/24"
					size="compact"
				/>
				{target && !isValidTarget(target) ? <FormError message="Invalid target format" /> : null}
				<ActionButton
					label="Detect Local Network"
					icon={RefreshCw}
					loading={isLoadingInterfaces}
					loadingLabel="Detecting..."
					disabled={isScanning}
					variant="outline"
					onClick={onLoadInterfaces}
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
								wrap
								onClick={() => onSelectInterface(iface)}
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
	);
}

interface HostDiscoverySectionProps {
	readonly discoveryMethods: ReadonlySet<DiscoveryMethod>;
	readonly toggleDiscoveryMethod: (method: DiscoveryMethod) => void;
	readonly isDiscovering: boolean;
	readonly isScanning: boolean;
	readonly resolveDns: boolean;
	readonly setResolveDns: (value: boolean) => void;
	readonly resolveMdns: boolean;
	readonly setResolveMdns: (value: boolean) => void;
	readonly resolveNetbios: boolean;
	readonly setResolveNetbios: (value: boolean) => void;
	readonly resolveHostname: boolean;
	readonly resolveTimeoutMs: number;
	readonly setResolveTimeoutMs: (value: number) => void;
	readonly target: string;
	readonly discoveryResults: readonly DiscoveryResult[];
	readonly onDiscover: () => void;
	readonly onCancelDiscovery: () => void;
}

function HostDiscoverySection({
	discoveryMethods,
	toggleDiscoveryMethod,
	isDiscovering,
	isScanning,
	resolveDns,
	setResolveDns,
	resolveMdns,
	setResolveMdns,
	resolveNetbios,
	setResolveNetbios,
	resolveHostname,
	resolveTimeoutMs,
	setResolveTimeoutMs,
	target,
	discoveryResults,
	onDiscover,
	onCancelDiscovery,
}: HostDiscoverySectionProps) {
	return (
		<FormSection title="Host Discovery">
			<p className="mb-2 text-xs leading-snug text-muted-foreground">
				Find active hosts before port scanning.
			</p>
			<FormCheckboxGroup>
				{DISCOVERY_METHODS.map((method) => (
					<FormCheckbox
						key={method.value}
						label={method.label}
						checked={discoveryMethods.has(method.value)}
						disabled={isDiscovering || isScanning}
						onCheckedChange={() => toggleDiscoveryMethod(method.value)}
						size="compact"
					/>
				))}
			</FormCheckboxGroup>

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
								size="compact"
							/>
							<FormCheckbox
								label="mDNS (.local)"
								checked={resolveMdns}
								onCheckedChange={setResolveMdns}
								size="compact"
							/>
							<FormCheckbox
								label="NetBIOS"
								checked={resolveNetbios}
								onCheckedChange={setResolveNetbios}
								size="compact"
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
										size="compact"
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
							onClick={onCancelDiscovery}
						/>
					) : (
						<ActionButton
							label="Find Hosts"
							icon={Radar}
							disabled={!isValidTarget(target) || isScanning}
							variant="outline"
							onClick={onDiscover}
						/>
					)}
				</div>
			) : null}
			{discoveryResults.length > 0 ? <DiscoveryResultsCard results={discoveryResults} /> : null}
		</FormSection>
	);
}

interface DiscoveryResultsCardProps {
	readonly results: readonly DiscoveryResult[];
}

function DiscoveryResultsCard({ results }: DiscoveryResultsCardProps) {
	return (
		<Card density="compact" className="mt-2">
			<CardContent className="p-2">
				<p className="text-xs font-medium text-muted-foreground">Results:</p>
				<div className="mt-1 max-h-20 space-y-0.5 overflow-y-auto">
					{results.map((result) => (
						<div key={result.method} className="text-xs">
							<span className="font-medium">
								{DISCOVERY_METHODS.find((m) => m.value === result.method)?.label ?? result.method}:
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
	);
}

interface PortScanSectionProps {
	readonly scanMode: ScanMode;
	readonly setScanMode: (mode: ScanMode) => void;
	readonly portPreset: PortPreset;
	readonly setPortPreset: (preset: PortPreset) => void;
	readonly portRange: string;
	readonly setPortRange: (value: string) => void;
	readonly portRangeTouched: boolean;
	readonly setPortRangeTouched: (value: boolean) => void;
	readonly concurrency: number;
	readonly setConcurrency: (value: number) => void;
	readonly timeoutMs: number;
	readonly setTimeoutMs: (value: number) => void;
	readonly isScanning: boolean;
	readonly canScan: boolean;
	readonly isPortRangeValid: boolean;
	readonly onScan: () => void;
	readonly onCancelScan: () => void;
}

function PortScanSection({
	scanMode,
	setScanMode,
	portPreset,
	setPortPreset,
	portRange,
	setPortRange,
	portRangeTouched,
	setPortRangeTouched,
	concurrency,
	setConcurrency,
	timeoutMs,
	setTimeoutMs,
	isScanning,
	canScan,
	isPortRangeValid,
	onScan,
	onCancelScan,
}: PortScanSectionProps) {
	return (
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

			{scanMode === 'quick' ? (
				<PortListDetails label="Target Ports" ports={QUICK_SCAN_PORTS} maxHeight="max-h-48" />
			) : null}

			{scanMode === 'custom' ? (
				<CustomScanPortSelection
					portPreset={portPreset}
					setPortPreset={setPortPreset}
					portRange={portRange}
					setPortRange={setPortRange}
					portRangeTouched={portRangeTouched}
					setPortRangeTouched={setPortRangeTouched}
				/>
			) : null}

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
					size="compact"
				/>
				<FormSlider
					label="Timeout"
					value={timeoutMs}
					onValueChange={setTimeoutMs}
					min={MIN_TIMEOUT_MS}
					max={MAX_TIMEOUT_MS}
					step={100}
					hint={`${timeoutMs}ms`}
					size="compact"
				/>
			</div>

			<div className="mt-3">
				{isScanning ? (
					<ActionButton
						label="Cancel Scan"
						icon={Square}
						variant="destructive"
						onClick={onCancelScan}
					/>
				) : (
					<ActionButton
						label="Scan Ports"
						icon={Play}
						loading={isScanning}
						loadingLabel="Scanning..."
						disabled={!canScan || !isPortRangeValid}
						shortcut
						onClick={onScan}
					/>
				)}
			</div>
		</FormSection>
	);
}

interface CustomScanPortSelectionProps {
	readonly portPreset: PortPreset;
	readonly setPortPreset: (preset: PortPreset) => void;
	readonly portRange: string;
	readonly setPortRange: (value: string) => void;
	readonly portRangeTouched: boolean;
	readonly setPortRangeTouched: (value: boolean) => void;
}

function CustomScanPortSelection({
	portPreset,
	setPortPreset,
	portRange,
	setPortRange,
	portRangeTouched,
	setPortRangeTouched,
}: CustomScanPortSelectionProps) {
	return (
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
				<p className="mt-1.5 text-xs text-muted-foreground">Standard ports 1-1024 (1,024 ports)</p>
			) : portPreset === 'web' ? (
				<PortListDetails label="Web Ports" ports={WEB_PORTS} />
			) : portPreset === 'database' ? (
				<PortListDetails label="Database Ports" ports={DATABASE_PORTS} />
			) : portPreset === 'custom' ? (
				<div className="mt-2">
					<FormInput
						label="Port Range"
						value={portRange}
						onValueChange={setPortRange}
						placeholder="80,443,8080 or 1-1024"
						onBlur={() => setPortRangeTouched(true)}
						size="compact"
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
	);
}

interface ResultsExportSectionProps {
	readonly onClear: () => void;
	readonly onExportJson: () => void;
	readonly onExportCsv: () => void;
}

function ResultsExportSection({ onClear, onExportJson, onExportCsv }: ResultsExportSectionProps) {
	return (
		<FormSection title="Results">
			<div className="space-y-2">
				<ActionButton label="Clear Results" variant="outline" onClick={onClear} />
				<ActionButton
					label="Export JSON"
					icon={Download}
					variant="outline"
					onClick={onExportJson}
				/>
				<ActionButton label="Export CSV" icon={Download} variant="outline" onClick={onExportCsv} />
			</div>
		</FormSection>
	);
}

interface DiscoveryMethodChipProps {
	readonly method: DiscoveryMethod;
	readonly methodProg: DiscoveryProgress | undefined;
}

function DiscoveryMethodChip({ method, methodProg }: DiscoveryMethodChipProps) {
	const label = DISCOVERY_METHODS.find((m) => m.value === method)?.label ?? method;
	return (
		<div className="min-w-32 flex-1 space-y-1">
			<div className="flex items-center justify-between text-xs">
				<span className="truncate font-medium" title={label}>
					{label}
				</span>
				<DiscoveryMethodStatusIcon status={methodProg?.status} />
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
}

interface DiscoveryMethodStatusIconProps {
	readonly status: DiscoveryProgress['status'] | undefined;
}

function DiscoveryMethodStatusIcon({ status }: DiscoveryMethodStatusIconProps) {
	if (status === 'completed') return <Check className="h-3 w-3 shrink-0 text-success" />;
	if (status === 'error') return <X className="h-3 w-3 shrink-0 text-destructive" />;
	if (status === 'running')
		return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />;
	return <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />;
}

interface DiscoveryProgressPanelProps {
	readonly discoveryMethods: ReadonlySet<DiscoveryMethod>;
	readonly methodProgress: Map<string, DiscoveryProgress>;
	readonly onCancel: () => void;
}

function DiscoveryProgressPanel({
	discoveryMethods,
	methodProgress,
	onCancel,
}: DiscoveryProgressPanelProps) {
	return (
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
					className="w-auto text-muted-foreground hover:bg-interactive-hover hover:text-destructive"
					onClick={onCancel}
				/>
			</div>
			<div className="flex flex-wrap gap-2">
				{[...discoveryMethods].map((method) => (
					<DiscoveryMethodChip
						key={method}
						method={method}
						methodProg={methodProgress.get(method)}
					/>
				))}
			</div>
		</div>
	);
}

interface ScanProgressPanelProps {
	readonly progressText: string;
	readonly progressPercentage: number;
	readonly progressCurrentIp: string | null;
	readonly progressDiscoveredHosts: number;
	readonly progressDiscoveredPorts: number;
	readonly onCancel: () => void;
}

function ScanProgressPanel({
	progressText,
	progressPercentage,
	progressCurrentIp,
	progressDiscoveredHosts,
	progressDiscoveredPorts,
	onCancel,
}: ScanProgressPanelProps) {
	return (
		<div
			className="shrink-0 border-b bg-surface-2 px-4 py-3"
			role="status"
			aria-live="polite"
			aria-atomic="false"
		>
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
						className="w-auto text-muted-foreground hover:bg-interactive-hover hover:text-destructive"
						onClick={onCancel}
					/>
				</div>
			</div>
			<div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
				<div
					className="h-full bg-primary transition-all duration-300"
					style={{ width: `${progressPercentage}%` }}
				/>
			</div>
			<div className="flex items-center justify-between text-xs">
				<div className="flex items-center gap-4">
					{progressCurrentIp ? (
						<span className="flex items-center gap-1 text-muted-foreground">
							<span>Next:</span>
							<span className="font-mono font-medium text-foreground">{progressCurrentIp}</span>
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
	);
}

interface HostListPaneProps {
	readonly unifiedHosts: readonly UnifiedHost[];
	readonly totalOpenPorts: number;
	readonly selectedHostId: string | null;
	readonly recentlyDiscoveredIds: ReadonlySet<string>;
	readonly hostClassifications: ReadonlyMap<string, DeviceClassification>;
	readonly onSelectHost: (id: string) => void;
	readonly onListKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
	readonly hostsWithoutScans: readonly UnifiedHost[];
	readonly isScanning: boolean;
	readonly onScanAllUnscanned: () => void;
}

function HostListPane({
	unifiedHosts,
	totalOpenPorts,
	selectedHostId,
	recentlyDiscoveredIds,
	hostClassifications,
	onSelectHost,
	onListKeyDown,
	hostsWithoutScans,
	isScanning,
	onScanAllUnscanned,
}: HostListPaneProps) {
	return (
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
			<div
				className="flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
				role="listbox"
				tabIndex={0}
				aria-label="Discovered hosts"
				onKeyDown={onListKeyDown}
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
							onClick={() => onSelectHost(host.id)}
						/>
					);
				})}
			</div>
			{hostsWithoutScans.length > 0 ? (
				<div className="shrink-0 border-t bg-surface-3 p-2">
					<ActionButton
						label={`Scan ${hostsWithoutScans.length} Unscanned Hosts`}
						icon={Play}
						size="sm"
						variant="outline"
						disabled={isScanning}
						onClick={onScanAllUnscanned}
					/>
				</div>
			) : null}
		</div>
	);
}

function LoadingHostsSkeleton() {
	return (
		<div className="space-y-1.5 p-2" role="status" aria-busy="true" aria-label="Loading hosts">
			{Array.from({ length: 6 }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
				<div key={i} className="flex items-center gap-2">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="ml-auto h-4 w-12" />
				</div>
			))}
		</div>
	);
}

interface MainContentProps {
	readonly isDiscovering: boolean;
	readonly isScanning: boolean;
	readonly unifiedHosts: readonly UnifiedHost[];
	readonly error: string | null;
	readonly hostListPaneProps: HostListPaneProps;
	readonly hostDetailProps: HostDetailOrEmptyProps;
}

function MainContent({
	isDiscovering,
	isScanning,
	unifiedHosts,
	error,
	hostListPaneProps,
	hostDetailProps,
}: MainContentProps) {
	if ((isDiscovering || isScanning) && unifiedHosts.length === 0 && !error) {
		return <LoadingHostsSkeleton />;
	}
	if (unifiedHosts.length > 0) {
		return (
			<ResizablePanelGroup orientation="horizontal" className="h-full">
				<ResizablePanel defaultSize="42" minSize="20" maxSize="60">
					<HostListPane {...hostListPaneProps} />
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel defaultSize="58" minSize="40">
					<HostDetailOrEmpty {...hostDetailProps} />
				</ResizablePanel>
			</ResizablePanelGroup>
		);
	}
	if (error) {
		return <ErrorDisplay variant="centered" message={error} />;
	}
	return (
		<EmptyState
			icon={Radar}
			title="Enter a target and start scanning"
			description="IP address, hostname, or CIDR notation"
		/>
	);
}

interface HostDetailOrEmptyProps {
	readonly selectedHost: UnifiedHost | null;
	readonly hostClassifications: ReadonlyMap<string, DeviceClassification>;
	readonly isScanning: boolean;
	readonly progress: ScanProgress | null;
	readonly onScanDiscoveredHost: (ip: string, mode: ScanMode) => void;
	readonly onCancel: () => void;
}

function HostDetailOrEmpty({
	selectedHost,
	hostClassifications,
	isScanning,
	progress,
	onScanDiscoveredHost,
	onCancel,
}: HostDetailOrEmptyProps) {
	if (!selectedHost) {
		return <EmptyState icon={Server} title="Select a host to view details" />;
	}
	return (
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
			onScan={onScanDiscoveredHost}
			onCancel={onCancel}
			scanDisabled={isScanning}
			scanProgress={isScanning ? progress : null}
		/>
	);
}

interface ResultsFooterProps {
	readonly results: ScanResults;
}

function ResultsFooter({ results }: ResultsFooterProps) {
	return (
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
	);
}

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
	const progressText = formatProgressText(progress);

	const setTarget = useCallback((next: string) => patch({ target: next }), [patch]);
	const setScanMode = useCallback((next: ScanMode) => patch({ scanMode: next }), [patch]);
	const setDiscoveryMethodList = useCallback(
		(next: readonly DiscoveryMethod[]) => patch({ discoveryMethods: next }),
		[patch]
	);

	const onHostDiscovered = useCallback((host: HostResult) => {
		setDiscoveredHosts((prev) => [...prev, host]);
		const hostKey = getMergeKey(host.ip, host.hostname ?? null);

		setRecentlyDiscoveredIds((prev) => {
			const next = new Set(prev);
			next.add(hostKey);
			return next;
		});
		setTimeout(() => {
			setRecentlyDiscoveredIds((prev) => {
				const next = new Set(prev);
				next.delete(hostKey);
				return next;
			});
		}, 1500);

		if (!hasAutoSelectedRef.current) {
			setSelectedHostId((prev) => {
				if (prev !== null) return prev;
				hasAutoSelectedRef.current = true;
				return hostKey;
			});
		}
	}, []);

	const onScanCompleted = useCallback((results: ScanResults) => {
		setResults(results);
		setIsScanning(false);
		setRecentlyDiscoveredIds(new Set());
		toast.success('Scan completed', {
			description: `Found ${results.totalOpenPorts} open ports on ${results.hostsWithOpenPorts} hosts`,
		});
	}, []);

	const onScanError = useCallback((message: string) => {
		setError(message);
		setIsScanning(false);
		setRecentlyDiscoveredIds(new Set());
		toast.error('Scan failed', { description: message });
	}, []);

	const handleProgressEvent = useCallback(
		(event: ScanProgress) => {
			setProgress(event);
			if (event.type === 'host_discovered') {
				onHostDiscovered(event.host);
			} else if (event.type === 'completed') {
				onScanCompleted(event.results);
			} else if (event.type === 'error') {
				onScanError(event.message);
			}
		},
		[onHostDiscovered, onScanCompleted, onScanError]
	);

	const buildScanOptions = useCallback(
		() => ({
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
		}),
		[
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
		]
	);

	const finalizeScan = useCallback(
		(scanId: string) => {
			if (currentScanIdRef.current !== scanId) return;
			if (unlistenRef.current) {
				unlistenRef.current();
				unlistenRef.current = null;
			}
			stopTimer();
			setIsScanning(false);
			currentScanIdRef.current = null;
		},
		[stopTimer]
	);

	const reportScanError = useCallback((scanId: string, e: unknown) => {
		if (currentScanIdRef.current !== scanId) return;
		const message = e instanceof Error ? e.message : String(e);
		setError(message);
		if (!message.includes('cancelled')) {
			toast.error('Scan failed', { description: message });
		}
	}, []);

	const handleScan = useCallback(async () => {
		if (!canScan || !isPortRangeValid) return;

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
		setProgress(null);

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
			await startNetworkScan(buildScanOptions(), scanId);
		} catch (e) {
			reportScanError(scanId, e);
		} finally {
			finalizeScan(scanId);
		}
	}, [
		canScan,
		isPortRangeValid,
		buildScanOptions,
		startTimer,
		stopTimer,
		handleProgressEvent,
		finalizeScan,
		reportScanError,
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
			const pick = pickAutoFillInterface(info);
			if (pick?.suggestedCidr) {
				setTarget(pick.suggestedCidr);
				toast.success('Target auto-filled', {
					description: `Using ${pick.name} (${pick.ip})`,
				});
			} else if (info.interfaces.length > 0) {
				toast.warning('No suitable network interface found');
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
		const firstIp = hosts.toSorted()[0];
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
		channel.onmessage = createDiscoveryChannelHandler({
			currentDiscoveryIdRef,
			discoveryId,
			setMethodProgress,
			setDiscoveryResults,
			autoSelectFirstHost,
		});

		const discoveryOptions: DiscoveryOptions = {
			methods: [...discoveryMethods],
			timeoutMs,
			concurrency,
			synPorts: [...DEFAULT_SYN_PORTS],
			resolveNetbios,
		};

		try {
			await discoverHosts([target.trim()], discoveryOptions, channel, discoveryId);
			reportDiscoverySuccess(unifiedHosts.length);
		} catch (e) {
			reportDiscoveryError(e);
		} finally {
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
		if (unifiedHosts.length === 0) return;
		const currentIdx = unifiedHosts.findIndex((h) => h.id === selectedHostId);
		const nextIdx = resolveKeydownIndex(e.key, currentIdx, unifiedHosts.length);
		if (nextIdx === null) return;
		e.preventDefault();
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

	const statusContent = renderStatusContent({
		results,
		isScanning,
		progress,
		unifiedHostCount: unifiedHosts.length,
	});

	const usableInterfaces = networkInfo?.interfaces.filter((i) => !i.isLoopback && i.suggestedCidr);

	const rail = (
		<>
			<TargetSection
				target={target}
				onTargetChange={setTarget}
				isScanning={isScanning}
				isLoadingInterfaces={isLoadingInterfaces}
				usableInterfaces={usableInterfaces}
				onLoadInterfaces={() => {
					handleLoadInterfaces().catch(() => {});
				}}
				onSelectInterface={handleSelectInterface}
			/>

			<HostDiscoverySection
				discoveryMethods={discoveryMethods}
				toggleDiscoveryMethod={toggleDiscoveryMethod}
				isDiscovering={isDiscovering}
				isScanning={isScanning}
				resolveDns={resolveDns}
				setResolveDns={setResolveDns}
				resolveMdns={resolveMdns}
				setResolveMdns={setResolveMdns}
				resolveNetbios={resolveNetbios}
				setResolveNetbios={setResolveNetbios}
				resolveHostname={resolveHostname}
				resolveTimeoutMs={resolveTimeoutMs}
				setResolveTimeoutMs={setResolveTimeoutMs}
				target={target}
				discoveryResults={discoveryResults}
				onDiscover={() => {
					handleDiscovery().catch(() => {});
				}}
				onCancelDiscovery={() => {
					handleCancelDiscovery().catch(() => {});
				}}
			/>

			<PortScanSection
				scanMode={scanMode}
				setScanMode={setScanMode}
				portPreset={portPreset}
				setPortPreset={setPortPreset}
				portRange={portRange}
				setPortRange={setPortRange}
				portRangeTouched={portRangeTouched}
				setPortRangeTouched={setPortRangeTouched}
				concurrency={concurrency}
				setConcurrency={setConcurrency}
				timeoutMs={timeoutMs}
				setTimeoutMs={setTimeoutMs}
				isScanning={isScanning}
				canScan={canScan}
				isPortRangeValid={isPortRangeValid}
				onScan={() => {
					handleScan().catch(() => {});
				}}
				onCancelScan={() => {
					handleCancel().catch(() => {});
				}}
			/>

			{results ? (
				<ResultsExportSection
					onClear={handleClear}
					onExportJson={handleExportJson}
					onExportCsv={handleExportCsv}
				/>
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
				{/* Discovery / scan progress panels */}
				{isDiscovering ? (
					<DiscoveryProgressPanel
						discoveryMethods={discoveryMethods}
						methodProgress={methodProgress}
						onCancel={() => {
							handleCancelDiscovery().catch(() => {});
						}}
					/>
				) : isScanning ? (
					<ScanProgressPanel
						progressText={progressText}
						progressPercentage={progressPercentage}
						progressCurrentIp={progressCurrentIp}
						progressDiscoveredHosts={progressDiscoveredHosts}
						progressDiscoveredPorts={progressDiscoveredPorts}
						onCancel={() => {
							handleCancel().catch(() => {});
						}}
					/>
				) : null}

				<div className="flex-1 overflow-hidden">
					<MainContent
						isDiscovering={isDiscovering}
						isScanning={isScanning}
						unifiedHosts={unifiedHosts}
						error={error}
						hostListPaneProps={{
							unifiedHosts,
							totalOpenPorts,
							selectedHostId,
							recentlyDiscoveredIds,
							hostClassifications,
							onSelectHost: selectHost,
							onListKeyDown: handleHostListKeydown,
							hostsWithoutScans,
							isScanning,
							onScanAllUnscanned: () => {
								setTarget(hostsWithoutScans.flatMap((h) => h.ips).join(','));
								handleScan().catch(() => {});
							},
						}}
						hostDetailProps={{
							selectedHost,
							hostClassifications,
							isScanning,
							progress,
							onScanDiscoveredHost: handleScanDiscoveredHost,
							onCancel: () => {
								handleCancel().catch(() => {});
							},
						}}
					/>
				</div>

				{results ? <ResultsFooter results={results} /> : null}
			</div>
		</ToolShell>
	);
}
