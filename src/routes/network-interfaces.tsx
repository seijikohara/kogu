import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import {
	Activity,
	ArrowDown,
	ArrowUp,
	Cable,
	Flag,
	Globe,
	Network,
	RefreshCw,
	Router,
	Server,
	Wifi,
} from 'lucide-react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import { FormCheckbox, FormCheckboxGroup, FormSection, FormSelect } from '@/lib/components/form';
import { SectionHeader, SectionLabel } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmptyState, ErrorDisplay, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent } from '@/lib/components/ui/card';
import { ListItemButton } from '@/lib/components/ui/list-item-button';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/lib/components/ui/resizable';
import { Skeleton } from '@/lib/components/ui/skeleton';
import {
	buildScopeIdMap,
	classifyIpv6Address,
	type DetailedNetworkInterface,
	type FilterOptions,
	filterInterfaces,
	formatBytes,
	formatSpeed,
	getDetailedNetworkInterfaces,
	type SortField,
	sortInterfaces,
} from '@/lib/services/network-interfaces';
import { cn } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/hooks';

const getInterfaceTypeIcon = (type: string) => {
	if (type === 'WiFi') return Wifi;
	if (type === 'Loopback') return Router;
	if (type === 'Ethernet') return Cable;
	return Server;
};

const getInterfaceTypeLabel = (type: string): string => {
	if (type === 'Ethernet') return 'Ethernet';
	if (type === 'WiFi') return 'Wi-Fi';
	if (type === 'Loopback') return 'Loopback';
	if (type === 'Tun') return 'TUN';
	if (type === 'Tap') return 'TAP';
	if (type === 'Bridge') return 'Bridge';
	return type;
};

const getStatusColor = (iface: DetailedNetworkInterface): string => {
	if (iface.isUp) return 'bg-success';
	if (iface.operState === 'Down') return 'bg-destructive';
	return 'bg-muted-foreground/50';
};

const getOperStateBadgeClass = (state: string): string => {
	if (state === 'Up') return 'bg-success/10 text-success';
	if (state === 'Down') return 'bg-destructive/10 text-destructive';
	return 'bg-muted text-muted-foreground';
};

const getActiveFlags = (iface: DetailedNetworkInterface): string[] => {
	const flags: string[] = [];
	if (iface.isUp) flags.push('UP');
	if (iface.isRunning) flags.push('RUNNING');
	if (iface.isBroadcast) flags.push('BROADCAST');
	if (iface.isMulticast) flags.push('MULTICAST');
	if (iface.isPointToPoint) flags.push('P2P');
	if (iface.isPhysical) flags.push('PHYSICAL');
	return flags;
};

const getIpv6TypeClass = (type: string): string => {
	if (type === 'Link-Local') return 'text-muted-foreground';
	if (type === 'Global') return 'text-success';
	if (type === 'ULA') return 'text-info';
	if (type === 'Multicast') return 'text-warning';
	return 'text-muted-foreground';
};

const hasNetworkInfo = (iface: DetailedNetworkInterface): boolean =>
	iface.mtu !== null ||
	iface.transmitSpeedBps !== null ||
	iface.receiveSpeedBps !== null ||
	iface.gateway !== null ||
	iface.dnsServers.length > 0;

const hasStats = (iface: DetailedNetworkInterface): boolean =>
	iface.rxBytes !== null || iface.txBytes !== null;

const SORT_OPTIONS = [
	{ value: 'name', label: 'Name' },
	{ value: 'status', label: 'Status' },
	{ value: 'type', label: 'Type' },
	{ value: 'index', label: 'Index' },
];

export const Route = createFileRoute('/network-interfaces')({
	component: NetworkInterfacesPage,
});

function NetworkInterfacesPage() {
	const [interfaces, setInterfaces] = useState<DetailedNetworkInterface[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showOptions, setShowOptions] = useState(true);
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
	const [showActive, setShowActive] = useState(true);
	const [showInactive, setShowInactive] = useState(true);
	const [showLoopback, setShowLoopback] = useState(false);
	const [sortField, setSortField] = useState<SortField>('status');

	useDocumentTitle('Network Interfaces');

	const fetchInterfaces = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await getDetailedNetworkInterfaces();
			setInterfaces(result);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message);
			toast.error('Failed to fetch network interfaces', { description: message });
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchInterfaces();
	}, [fetchInterfaces]);

	const filters: FilterOptions = { showActive, showInactive, showLoopback };
	const filteredInterfaces = sortInterfaces(filterInterfaces(interfaces, filters), sortField);
	const selectedInterface =
		filteredInterfaces.find((iface) => iface.index === selectedIndex) ?? null;
	const activeCount = interfaces.filter((iface) => iface.isUp).length;
	const defaultInterface = interfaces.find((iface) => iface.isDefault);
	const scopeIdMap = buildScopeIdMap(interfaces);

	useEffect(() => {
		if (selectedIndex !== null || filteredInterfaces.length === 0) return;
		const def = filteredInterfaces.find((iface) => iface.isDefault);
		setSelectedIndex(def?.index ?? filteredInterfaces[0]?.index ?? null);
	}, [filteredInterfaces, selectedIndex]);

	const handleListKeydown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
		if (filteredInterfaces.length === 0) return;
		e.preventDefault();
		const currentIdx = filteredInterfaces.findIndex((iface) => iface.index === selectedIndex);
		// Resolve the next index via a const IIFE switch; returns null when the
		// key isn't a navigation key so we can short-circuit afterwards.
		const nextIdx = ((): number | null => {
			switch (e.key) {
				case 'ArrowDown':
					return currentIdx < 0 ? 0 : Math.min(currentIdx + 1, filteredInterfaces.length - 1);
				case 'ArrowUp':
					return currentIdx < 0 ? 0 : Math.max(currentIdx - 1, 0);
				case 'Home':
					return 0;
				case 'End':
					return filteredInterfaces.length - 1;
				default:
					return null;
			}
		})();
		if (nextIdx === null) return;
		const next = filteredInterfaces[nextIdx];
		if (!next) return;
		setSelectedIndex(next.index);
		const el = document.querySelector(`[data-iface-index="${next.index}"]`);
		el?.scrollIntoView({ block: 'nearest' });
	};

	return (
		<ToolShell
			layout="master-detail"
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			toolbarTrailing={
				<Button
					variant="ghost"
					size="sm"
					className="h-8 gap-1.5 px-2.5 text-xs"
					onClick={fetchInterfaces}
					disabled={loading}
					aria-label="Refresh network interfaces"
				>
					<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
					Refresh
				</Button>
			}
			statusContent={
				<>
					<StatItem label="Total" value={filteredInterfaces.length} />
					<StatItem label="Active" value={activeCount} />
					{defaultInterface ? <StatItem label="Default" value={defaultInterface.name} /> : null}
				</>
			}
			rail={
				<>
					<FormSection title="Filter">
						<FormCheckboxGroup>
							<FormCheckbox
								label="Active"
								checked={showActive}
								onCheckedChange={setShowActive}
								size="compact"
							/>
							<FormCheckbox
								label="Inactive"
								checked={showInactive}
								onCheckedChange={setShowInactive}
								size="compact"
							/>
							<FormCheckbox
								label="Loopback"
								checked={showLoopback}
								onCheckedChange={setShowLoopback}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Sort">
						<FormSelect
							label="Sort by"
							value={sortField}
							onValueChange={(v) => setSortField(v as SortField)}
							options={SORT_OPTIONS}
							size="compact"
						/>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="flex-1 overflow-hidden">
					{filteredInterfaces.length > 0 ? (
						<ResizablePanelGroup orientation="horizontal" className="h-full">
							<ResizablePanel defaultSize="42" minSize="20" maxSize="60">
								<div className="flex h-full flex-col border-r">
									<SectionHeader title="Interfaces" count={filteredInterfaces.length} />
									<div
										className="flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
										role="listbox"
										tabIndex={0}
										aria-label="Network interfaces"
										onKeyDown={handleListKeydown}
									>
										{filteredInterfaces.map((iface) => {
											const TypeIcon = getInterfaceTypeIcon(iface.interfaceType);
											const isSelected = selectedIndex === iface.index;
											const primaryIpv4 = iface.ipv4Addresses[0]?.address ?? null;
											return (
												<ListItemButton
													key={iface.index}
													variant="option"
													role="option"
													selected={isSelected}
													data-iface-index={iface.index}
													className="items-start"
													onClick={() => setSelectedIndex(iface.index)}
												>
													<div className="mt-0.5 flex w-8 shrink-0 items-center justify-center">
														<TypeIcon
															className={cn(
																'h-4 w-4',
																iface.isUp ? 'text-foreground' : 'text-muted-foreground/50'
															)}
														/>
													</div>
													<div className="min-w-0 flex-1">
														<div className="flex items-center gap-2">
															<span className="text-sm font-medium">{iface.name}</span>
															<span
																className={cn(
																	'h-1.5 w-1.5 shrink-0 rounded-full',
																	getStatusColor(iface)
																)}
															/>
															{iface.isDefault ? (
																<span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
																	DEFAULT
																</span>
															) : null}
															<span
																className={cn(
																	'ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
																	getOperStateBadgeClass(iface.operState)
																)}
															>
																{iface.operState}
															</span>
														</div>
														<div className="flex items-center gap-2">
															{primaryIpv4 ? (
																<span className="font-mono text-xs text-muted-foreground">
																	{primaryIpv4}
																</span>
															) : (
																<span className="text-xs text-muted-foreground/50">
																	(no address)
																</span>
															)}
															{iface.ipv6Addresses.length > 0 ? (
																<span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
																	IPv6 ×{iface.ipv6Addresses.length}
																</span>
															) : null}
														</div>
														{iface.macAddress ? (
															<span className="truncate font-mono text-xs text-muted-foreground/70">
																{iface.macAddress}
															</span>
														) : null}
														{hasStats(iface) ? (
															<div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground/70">
																{iface.rxBytes !== null ? (
																	<span className="flex items-center gap-0.5">
																		<ArrowDown className="h-2.5 w-2.5 text-success" />
																		{formatBytes(iface.rxBytes)}
																	</span>
																) : null}
																{iface.txBytes !== null ? (
																	<span className="flex items-center gap-0.5">
																		<ArrowUp className="h-2.5 w-2.5 text-info" />
																		{formatBytes(iface.txBytes)}
																	</span>
																) : null}
															</div>
														) : null}
													</div>
												</ListItemButton>
											);
										})}
									</div>
								</div>
							</ResizablePanel>

							<ResizableHandle withHandle />

							<ResizablePanel defaultSize="58" minSize="40">
								{selectedInterface ? (
									(() => {
										const iface = selectedInterface;
										const TypeIcon = getInterfaceTypeIcon(iface.interfaceType);
										const flags = getActiveFlags(iface);
										return (
											<div className="flex h-full flex-col">
												<div className="shrink-0 border-b bg-surface-3 p-4">
													<div className="flex items-center gap-3">
														<div className="rounded-lg bg-primary/10 p-2">
															<TypeIcon className="h-5 w-5 text-primary" />
														</div>
														<div className="min-w-0 flex-1">
															<div className="flex items-center gap-2">
																<h2 className="text-base font-bold">{iface.name}</h2>
																{iface.friendlyName && iface.friendlyName !== iface.name ? (
																	<span className="text-sm text-muted-foreground">
																		({iface.friendlyName})
																	</span>
																) : null}
															</div>
															<div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
																<span>{getInterfaceTypeLabel(iface.interfaceType)}</span>
																<span>·</span>
																<span className="font-mono">#{iface.index}</span>
																{iface.isDefault ? (
																	<span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
																		DEFAULT
																	</span>
																) : null}
															</div>
														</div>
														<span
															className={cn(
																'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
																getOperStateBadgeClass(iface.operState)
															)}
														>
															{iface.operState}
														</span>
													</div>
													{iface.description ? (
														<p className="mt-1.5 text-xs text-muted-foreground">
															{iface.description}
														</p>
													) : null}
												</div>

												<div className="flex-1 space-y-4 overflow-auto p-4">
													<div>
														<SectionLabel icon={Globe}>Addresses</SectionLabel>
														<Card density="compact">
															<CardContent className="space-y-2">
																{iface.macAddress ? (
																	<div className="flex items-center gap-2">
																		<span className="w-10 shrink-0 text-xs text-muted-foreground">
																			MAC
																		</span>
																		<code className="font-mono text-xs">{iface.macAddress}</code>
																		<CopyButton
																			text={iface.macAddress}
																			toastLabel="MAC address"
																			size="icon"
																			showLabel={false}
																			className="h-5 w-5"
																		/>
																	</div>
																) : null}

																{iface.ipv4Addresses.map((addr) => (
																	<div
																		key={`v4-${addr.address}`}
																		className="flex items-center gap-2"
																	>
																		<span className="w-10 shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-center text-xs font-medium text-info">
																			IPv4
																		</span>
																		<code className="font-mono text-xs">
																			{addr.address}/{addr.prefixLen}
																		</code>
																		<CopyButton
																			text={addr.address}
																			toastLabel="IPv4 address"
																			size="icon"
																			showLabel={false}
																			className="h-5 w-5"
																		/>
																		<span className="font-mono text-xs text-muted-foreground">
																			{addr.network}
																		</span>
																	</div>
																))}

																{iface.ipv6Addresses.map((addr) => {
																	const addrType = classifyIpv6Address(addr.address);
																	const scopeName =
																		addr.scopeId !== 0 ? scopeIdMap.get(addr.scopeId) : null;
																	return (
																		<div
																			key={`v6-${addr.address}-${addr.scopeId}`}
																			className="flex items-center gap-2"
																		>
																			<span className="w-10 shrink-0 rounded bg-warning/10 px-1.5 py-0.5 text-center text-xs font-medium text-warning">
																				IPv6
																			</span>
																			<code className="font-mono text-xs">
																				{addr.address}/{addr.prefixLen}
																			</code>
																			{addr.scopeId !== 0 ? (
																				<span
																					className="font-mono text-xs text-muted-foreground"
																					title={`Scope ID: ${addr.scopeId}`}
																				>
																					%{scopeName ?? addr.scopeId}
																				</span>
																			) : null}
																			<CopyButton
																				text={addr.address}
																				toastLabel="IPv6 address"
																				size="icon"
																				showLabel={false}
																				className="h-5 w-5"
																			/>
																			<span className={cn('text-xs', getIpv6TypeClass(addrType))}>
																				{addrType}
																			</span>
																		</div>
																	);
																})}

																{!iface.macAddress &&
																iface.ipv4Addresses.length === 0 &&
																iface.ipv6Addresses.length === 0 ? (
																	<span className="text-xs text-muted-foreground/60">
																		No addresses
																	</span>
																) : null}
															</CardContent>
														</Card>
													</div>

													{hasNetworkInfo(iface) ? (
														<div>
															<SectionLabel icon={Network}>Network</SectionLabel>
															<Card density="compact">
																<CardContent>
																	<div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
																		{iface.mtu !== null ? (
																			<div className="flex justify-between">
																				<span className="text-muted-foreground">MTU</span>
																				<span className="font-mono">{iface.mtu}</span>
																			</div>
																		) : null}
																		{iface.transmitSpeedBps !== null &&
																		iface.receiveSpeedBps !== null &&
																		iface.transmitSpeedBps === iface.receiveSpeedBps ? (
																			<div className="flex justify-between">
																				<span className="text-muted-foreground">Link Speed</span>
																				<span className="font-mono">
																					{formatSpeed(iface.transmitSpeedBps)}
																				</span>
																			</div>
																		) : (
																			<>
																				{iface.transmitSpeedBps !== null ? (
																					<div className="flex justify-between">
																						<span className="text-muted-foreground">TX Speed</span>
																						<span className="font-mono">
																							{formatSpeed(iface.transmitSpeedBps)}
																						</span>
																					</div>
																				) : null}
																				{iface.receiveSpeedBps !== null ? (
																					<div className="flex justify-between">
																						<span className="text-muted-foreground">RX Speed</span>
																						<span className="font-mono">
																							{formatSpeed(iface.receiveSpeedBps)}
																						</span>
																					</div>
																				) : null}
																			</>
																		)}
																		{iface.gateway ? (
																			<>
																				{iface.gateway.ipv4Addresses.map((gw) => (
																					<div key={`gw4-${gw}`} className="flex justify-between">
																						<span className="text-muted-foreground">Gateway</span>
																						<span className="font-mono">{gw}</span>
																					</div>
																				))}
																				{iface.gateway.ipv6Addresses.map((gw) => (
																					<div key={`gw6-${gw}`} className="flex justify-between">
																						<span className="text-muted-foreground">
																							Gateway (v6)
																						</span>
																						<span className="font-mono text-xs">{gw}</span>
																					</div>
																				))}
																				{iface.gateway.macAddress ? (
																					<div className="flex justify-between">
																						<span className="text-muted-foreground">
																							Gateway MAC
																						</span>
																						<span className="font-mono text-xs">
																							{iface.gateway.macAddress}
																						</span>
																					</div>
																				) : null}
																			</>
																		) : null}
																		{iface.dnsServers.length > 0 ? (
																			<div className="col-span-2 flex flex-wrap items-center gap-1.5">
																				<span className="text-muted-foreground">DNS</span>
																				{iface.dnsServers.map((dns) => (
																					<span
																						key={dns}
																						className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
																					>
																						{dns}
																					</span>
																				))}
																			</div>
																		) : null}
																	</div>
																</CardContent>
															</Card>
														</div>
													) : null}

													{hasStats(iface) ? (
														<div>
															<SectionLabel icon={Activity}>Traffic</SectionLabel>
															<div className="flex gap-3">
																{iface.rxBytes !== null ? (
																	<Card density="compact" className="flex-1">
																		<CardContent>
																			<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
																				<ArrowDown className="h-3.5 w-3.5 text-success" />
																				RX (Received)
																			</div>
																			<div className="mt-1 font-mono text-lg font-semibold">
																				{formatBytes(iface.rxBytes)}
																			</div>
																		</CardContent>
																	</Card>
																) : null}
																{iface.txBytes !== null ? (
																	<Card density="compact" className="flex-1">
																		<CardContent>
																			<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
																				<ArrowUp className="h-3.5 w-3.5 text-info" />
																				TX (Transmitted)
																			</div>
																			<div className="mt-1 font-mono text-lg font-semibold">
																				{formatBytes(iface.txBytes)}
																			</div>
																		</CardContent>
																	</Card>
																) : null}
															</div>
														</div>
													) : null}

													{flags.length > 0 ? (
														<div>
															<SectionLabel icon={Flag}>Flags</SectionLabel>
															<div className="flex flex-wrap gap-1.5">
																{flags.map((flag) => (
																	<Badge
																		key={flag}
																		variant="outline"
																		className="text-2xs font-medium text-muted-foreground"
																	>
																		{flag}
																	</Badge>
																))}
															</div>
														</div>
													) : null}
												</div>
											</div>
										);
									})()
								) : (
									<EmptyState icon={Network} title="Select an interface to view details" />
								)}
							</ResizablePanel>
						</ResizablePanelGroup>
					) : loading ? (
						<div
							className="space-y-1.5 p-2"
							role="status"
							aria-busy="true"
							aria-label="Loading network interfaces"
						>
							{Array.from({ length: 5 }, (_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
								<div key={i} className="flex items-center gap-2">
									<Skeleton className="h-4 w-28" />
									<Skeleton className="ml-auto h-4 w-16" />
								</div>
							))}
						</div>
					) : error ? (
						<ErrorDisplay variant="centered" title="Failed to load interfaces" message={error} />
					) : (
						<EmptyState icon={Server} title="No interfaces match the current filters" />
					)}
				</div>
			</div>
		</ToolShell>
	);
}
