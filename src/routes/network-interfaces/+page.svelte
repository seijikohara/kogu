<script lang="ts">
	import {
		RefreshCw,
		ArrowDown,
		ArrowUp,
		Wifi,
		Cable,
		Router,
		Server,
		Globe,
		Network,
		Activity,
		Flag,
		Circle,
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ToolShell } from '$lib/components/shell';
	import { StatItem, EmptyState } from '$lib/components/status';
	import { SectionHeader } from '$lib/components/layout';
	import { FormSection, FormCheckbox, FormSelect } from '$lib/components/form';
	import { CopyButton } from '$lib/components/action';
	import { Button } from '$lib/components/ui/button';
	import * as Resizable from '$lib/components/ui/resizable';
	import { cn } from '$lib/utils';
	import {
		type DetailedNetworkInterface,
		type SortField,
		type FilterOptions,
		getDetailedNetworkInterfaces,
		formatBytes,
		formatSpeed,
		sortInterfaces,
		filterInterfaces,
		classifyIpv6Address,
		buildScopeIdMap,
	} from '$lib/services/network-interfaces';

	// State
	let interfaces = $state<DetailedNetworkInterface[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let showOptions = $state(true);

	// Selection state
	let selectedIndex = $state<number | null>(null);

	// Filter state
	let showActive = $state(true);
	let showInactive = $state(true);
	let showLoopback = $state(false);

	// Sort state
	let sortField = $state<SortField>('status');

	// Derived
	const filters = $derived<FilterOptions>({
		showActive,
		showInactive,
		showLoopback,
	});

	const filteredInterfaces = $derived.by(() => {
		const filtered = filterInterfaces(interfaces, filters);
		return sortInterfaces(filtered, sortField);
	});

	const selectedInterface = $derived(
		filteredInterfaces.find((iface) => iface.index === selectedIndex) ?? null
	);

	const activeCount = $derived(interfaces.filter((iface) => iface.isUp).length);

	const defaultInterface = $derived(interfaces.find((iface) => iface.isDefault));

	const scopeIdMap = $derived(buildScopeIdMap(interfaces));

	// Data fetching
	const fetchInterfaces = async () => {
		loading = true;
		error = null;
		try {
			interfaces = await getDetailedNetworkInterfaces();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			toast.error('Failed to fetch network interfaces', { description: error });
		} finally {
			loading = false;
		}
	};

	// Auto-fetch on mount
	$effect(() => {
		fetchInterfaces();
	});

	// Auto-select default interface
	$effect(() => {
		if (selectedIndex !== null || filteredInterfaces.length === 0) return;
		const def = filteredInterfaces.find((iface) => iface.isDefault);
		if (def) {
			selectedIndex = def.index;
		} else {
			const first = filteredInterfaces[0];
			if (first) selectedIndex = first.index;
		}
	});

	// Handlers
	const handleRefresh = () => {
		fetchInterfaces();
	};

	const handleSelect = (index: number) => {
		selectedIndex = index;
	};

	// Keyboard navigation
	const handleListKeydown = (e: KeyboardEvent) => {
		if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
		if (filteredInterfaces.length === 0) return;
		e.preventDefault();
		const currentIdx = filteredInterfaces.findIndex((iface) => iface.index === selectedIndex);

		let nextIdx: number;
		switch (e.key) {
			case 'ArrowDown':
				nextIdx = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, filteredInterfaces.length - 1);
				break;
			case 'ArrowUp':
				nextIdx = currentIdx < 0 ? 0 : Math.max(currentIdx - 1, 0);
				break;
			case 'Home':
				nextIdx = 0;
				break;
			case 'End':
				nextIdx = filteredInterfaces.length - 1;
				break;
			default:
				return;
		}
		const next = filteredInterfaces[nextIdx];
		if (!next) return;
		selectedIndex = next.index;
		const el = document.querySelector(`[data-iface-index="${selectedIndex}"]`);
		el?.scrollIntoView({ block: 'nearest' });
	};

	// Helpers
	const getStatusColor = (iface: DetailedNetworkInterface): string => {
		if (iface.isUp) return 'bg-success';
		if (iface.operState === 'Down') return 'bg-destructive';
		return 'bg-muted-foreground/50';
	};

	const getInterfaceTypeLabel = (type: string): string => {
		switch (type) {
			case 'Ethernet':
				return 'Ethernet';
			case 'WiFi':
				return 'Wi-Fi';
			case 'Loopback':
				return 'Loopback';
			case 'Tun':
				return 'TUN';
			case 'Tap':
				return 'TAP';
			case 'Bridge':
				return 'Bridge';
			default:
				return type;
		}
	};

	const getInterfaceTypeIcon = (type: string) => {
		switch (type) {
			case 'WiFi':
				return Wifi;
			case 'Loopback':
				return Router;
			case 'Ethernet':
				return Cable;
			default:
				return Server;
		}
	};

	const getOperStateBadgeClass = (state: string): string => {
		switch (state) {
			case 'Up':
				return 'bg-success/10 text-success';
			case 'Down':
				return 'bg-destructive/10 text-destructive';
			default:
				return 'bg-muted text-muted-foreground';
		}
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
		switch (type) {
			case 'Link-Local':
				return 'text-muted-foreground';
			case 'Global':
				return 'text-success';
			case 'ULA':
				return 'text-info';
			case 'Multicast':
				return 'text-warning';
			default:
				return 'text-muted-foreground';
		}
	};

	const hasNetworkInfo = (iface: DetailedNetworkInterface): boolean =>
		iface.mtu !== null ||
		iface.transmitSpeedBps !== null ||
		iface.receiveSpeedBps !== null ||
		iface.gateway !== null ||
		iface.dnsServers.length > 0;

	const hasStats = (iface: DetailedNetworkInterface): boolean =>
		iface.rxBytes !== null || iface.txBytes !== null;

	const sortOptions = [
		{ value: 'name', label: 'Name' },
		{ value: 'status', label: 'Status' },
		{ value: 'type', label: 'Type' },
		{ value: 'index', label: 'Index' },
	];
</script>

<svelte:head>
	<title>Network Interfaces - Kogu</title>
</svelte:head>

<ToolShell layout="master-detail" bind:showRail={showOptions}>
	{#snippet toolbarTrailing()}
		<Button
			variant="ghost"
			size="sm"
			class="h-8 gap-1.5 px-2.5 text-xs"
			onclick={handleRefresh}
			disabled={loading}
			aria-label="Refresh network interfaces"
		>
			<RefreshCw class={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
			Refresh
		</Button>
	{/snippet}

	{#snippet statusContent()}
		<StatItem label="Total" value={filteredInterfaces.length} />
		<StatItem label="Active" value={activeCount} />
		{#if defaultInterface}
			<StatItem label="Default" value={defaultInterface.name} />
		{/if}
	{/snippet}

	{#snippet rail()}
		<FormSection title="Filter">
			<FormCheckbox label="Active" bind:checked={showActive} />
			<FormCheckbox label="Inactive" bind:checked={showInactive} />
			<FormCheckbox label="Loopback" bind:checked={showLoopback} />
		</FormSection>

		<FormSection title="Sort">
			<FormSelect label="Sort by" bind:value={sortField} options={sortOptions} />
		</FormSection>
	{/snippet}

	<!-- Main Content: Master-Detail -->
	<div class="flex h-full flex-col overflow-hidden">
		<div class="flex-1 overflow-hidden">
			{#if filteredInterfaces.length > 0}
				<Resizable.PaneGroup direction="horizontal" class="h-full">
					<!-- Left Pane: Interface List -->
					<Resizable.Pane defaultSize={35} minSize={20} maxSize={50}>
						<div class="flex h-full flex-col border-r">
							<SectionHeader title="Interfaces" count={filteredInterfaces.length} />
							<div
								class="flex-1 overflow-auto"
								role="listbox"
								tabindex="0"
								aria-label="Network interfaces"
								onkeydown={handleListKeydown}
							>
								{#each filteredInterfaces as iface (iface.index)}
									{@const TypeIcon = getInterfaceTypeIcon(iface.interfaceType)}
									{@const isSelected = selectedIndex === iface.index}
									{@const primaryIpv4 = iface.ipv4Addresses[0]?.address ?? null}
									<button
										type="button"
										role="option"
										aria-selected={isSelected}
										data-iface-index={iface.index}
										class={cn(
											'flex w-full items-start gap-2 border-b border-border border-l-2 px-3 py-2.5 text-left transition-colors last:border-b-0',
											isSelected
												? 'border-l-primary bg-primary/10'
												: 'border-l-transparent hover:bg-interactive-hover'
										)}
										onclick={() => handleSelect(iface.index)}
									>
										<!-- Icon column -->
										<div class="mt-0.5 flex w-8 shrink-0 items-center justify-center">
											<TypeIcon
												class={cn(
													'h-4 w-4',
													iface.isUp ? 'text-foreground' : 'text-muted-foreground/50'
												)}
											/>
										</div>
										<!-- Content column -->
										<div class="min-w-0 flex-1">
											<!-- Line 1: Name + badges -->
											<div class="flex items-center gap-2">
												<span class="text-sm font-medium">{iface.name}</span>
												<span class={cn('h-1.5 w-1.5 shrink-0 rounded-full', getStatusColor(iface))}
												></span>
												{#if iface.isDefault}
													<span
														class="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
													>
														DEFAULT
													</span>
												{/if}
												<span
													class={cn(
														'ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
														getOperStateBadgeClass(iface.operState)
													)}
												>
													{iface.operState}
												</span>
											</div>
											<!-- Line 2: Primary IPv4 address + IPv6 count -->
											<div class="flex items-center gap-2">
												{#if primaryIpv4}
													<span class="font-mono text-xs text-muted-foreground">
														{primaryIpv4}
													</span>
												{:else}
													<span class="text-xs text-muted-foreground/50">(no address)</span>
												{/if}
												{#if iface.ipv6Addresses.length > 0}
													<span
														class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
													>
														IPv6 ×{iface.ipv6Addresses.length}
													</span>
												{/if}
											</div>
											<!-- Line 3: MAC address -->
											{#if iface.macAddress}
												<span class="truncate font-mono text-xs text-muted-foreground/70">
													{iface.macAddress}
												</span>
											{/if}
											<!-- Line 4: Traffic stats -->
											{#if hasStats(iface)}
												<div
													class="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground/70"
												>
													{#if iface.rxBytes !== null}
														<span class="flex items-center gap-0.5">
															<ArrowDown class="h-2.5 w-2.5 text-success" />
															{formatBytes(iface.rxBytes)}
														</span>
													{/if}
													{#if iface.txBytes !== null}
														<span class="flex items-center gap-0.5">
															<ArrowUp class="h-2.5 w-2.5 text-info" />
															{formatBytes(iface.txBytes)}
														</span>
													{/if}
												</div>
											{/if}
										</div>
									</button>
								{/each}
							</div>
						</div>
					</Resizable.Pane>

					<Resizable.Handle withHandle />

					<!-- Right Pane: Interface Detail -->
					<Resizable.Pane defaultSize={65} minSize={40}>
						{#if selectedInterface}
							{@const iface = selectedInterface}
							{@const TypeIcon = getInterfaceTypeIcon(iface.interfaceType)}
							{@const flags = getActiveFlags(iface)}
							<div class="flex h-full flex-col">
								<!-- Detail Header -->
								<div class="shrink-0 border-b bg-surface-3 p-4">
									<div class="flex items-center gap-3">
										<div class="rounded-lg bg-primary/10 p-2">
											<TypeIcon class="h-5 w-5 text-primary" />
										</div>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<h2 class="text-base font-bold">{iface.name}</h2>
												{#if iface.friendlyName && iface.friendlyName !== iface.name}
													<span class="text-sm text-muted-foreground">
														({iface.friendlyName})
													</span>
												{/if}
											</div>
											<div class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
												<span>{getInterfaceTypeLabel(iface.interfaceType)}</span>
												<span>·</span>
												<span class="font-mono">#{iface.index}</span>
												{#if iface.isDefault}
													<span
														class="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
													>
														DEFAULT
													</span>
												{/if}
											</div>
										</div>
										<span
											class={cn(
												'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
												getOperStateBadgeClass(iface.operState)
											)}
										>
											{iface.operState}
										</span>
									</div>
									{#if iface.description}
										<p class="mt-1.5 text-xs text-muted-foreground">{iface.description}</p>
									{/if}
								</div>

								<!-- Detail Content (scrollable) -->
								<div class="flex-1 overflow-auto p-4 space-y-4">
									<!-- ADDRESSES Section -->
									<div>
										<h3
											class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
										>
											<Globe class="h-3.5 w-3.5" />
											Addresses
										</h3>
										<div class="space-y-2 rounded-lg border bg-card p-3">
											{#if iface.macAddress}
												<div class="flex items-center gap-2">
													<span class="w-10 shrink-0 text-xs text-muted-foreground">MAC</span>
													<code class="font-mono text-xs">{iface.macAddress}</code>
													<CopyButton
														text={iface.macAddress}
														toastLabel="MAC address"
														size="icon"
														showLabel={false}
														class="h-5 w-5"
													/>
												</div>
											{/if}

											{#each iface.ipv4Addresses as addr}
												<div class="flex items-center gap-2">
													<span
														class="w-10 shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-center text-xs font-medium text-info"
													>
														IPv4
													</span>
													<code class="font-mono text-xs">{addr.address}/{addr.prefixLen}</code>
													<CopyButton
														text={addr.address}
														toastLabel="IPv4 address"
														size="icon"
														showLabel={false}
														class="h-5 w-5"
													/>
													<span class="font-mono text-xs text-muted-foreground">
														{addr.network}
													</span>
												</div>
											{/each}

											{#each iface.ipv6Addresses as addr}
												{@const addrType = classifyIpv6Address(addr.address)}
												<div class="flex items-center gap-2">
													<span
														class="w-10 shrink-0 rounded bg-warning/10 px-1.5 py-0.5 text-center text-xs font-medium text-warning"
													>
														IPv6
													</span>
													<code class="font-mono text-xs">{addr.address}/{addr.prefixLen}</code>
													{#if addr.scopeId !== 0}
														{@const scopeName = scopeIdMap.get(addr.scopeId)}
														<span
															class="font-mono text-xs text-muted-foreground"
															title="Scope ID: {addr.scopeId}"
														>
															%{scopeName ?? addr.scopeId}
														</span>
													{/if}
													<CopyButton
														text={addr.address}
														toastLabel="IPv6 address"
														size="icon"
														showLabel={false}
														class="h-5 w-5"
													/>
													<span class={cn('text-xs', getIpv6TypeClass(addrType))}>
														{addrType}
													</span>
												</div>
											{/each}

											{#if !iface.macAddress && iface.ipv4Addresses.length === 0 && iface.ipv6Addresses.length === 0}
												<span class="text-xs text-muted-foreground/60">No addresses</span>
											{/if}
										</div>
									</div>

									<!-- NETWORK Section -->
									{#if hasNetworkInfo(iface)}
										<div>
											<h3
												class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
											>
												<Network class="h-3.5 w-3.5" />
												Network
											</h3>
											<div class="rounded-lg border bg-card p-3">
												<div class="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
													{#if iface.mtu !== null}
														<div class="flex justify-between">
															<span class="text-muted-foreground">MTU</span>
															<span class="font-mono">{iface.mtu}</span>
														</div>
													{/if}
													{#if iface.transmitSpeedBps !== null && iface.receiveSpeedBps !== null && iface.transmitSpeedBps === iface.receiveSpeedBps}
														<div class="flex justify-between">
															<span class="text-muted-foreground">Link Speed</span>
															<span class="font-mono">{formatSpeed(iface.transmitSpeedBps)}</span>
														</div>
													{:else}
														{#if iface.transmitSpeedBps !== null}
															<div class="flex justify-between">
																<span class="text-muted-foreground">TX Speed</span>
																<span class="font-mono">{formatSpeed(iface.transmitSpeedBps)}</span>
															</div>
														{/if}
														{#if iface.receiveSpeedBps !== null}
															<div class="flex justify-between">
																<span class="text-muted-foreground">RX Speed</span>
																<span class="font-mono">{formatSpeed(iface.receiveSpeedBps)}</span>
															</div>
														{/if}
													{/if}
													{#if iface.gateway}
														{#each iface.gateway.ipv4Addresses as gw}
															<div class="flex justify-between">
																<span class="text-muted-foreground">Gateway</span>
																<span class="font-mono">{gw}</span>
															</div>
														{/each}
														{#each iface.gateway.ipv6Addresses as gw}
															<div class="flex justify-between">
																<span class="text-muted-foreground">Gateway (v6)</span>
																<span class="font-mono text-xs">{gw}</span>
															</div>
														{/each}
														{#if iface.gateway.macAddress}
															<div class="flex justify-between">
																<span class="text-muted-foreground">Gateway MAC</span>
																<span class="font-mono text-xs">{iface.gateway.macAddress}</span>
															</div>
														{/if}
													{/if}
													{#if iface.dnsServers.length > 0}
														<div class="col-span-2 flex flex-wrap items-center gap-1.5">
															<span class="text-muted-foreground">DNS</span>
															{#each iface.dnsServers as dns}
																<span class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
																	{dns}
																</span>
															{/each}
														</div>
													{/if}
												</div>
											</div>
										</div>
									{/if}

									<!-- TRAFFIC Section -->
									{#if hasStats(iface)}
										<div>
											<h3
												class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
											>
												<Activity class="h-3.5 w-3.5" />
												Traffic
											</h3>
											<div class="flex gap-3">
												{#if iface.rxBytes !== null}
													<div class="flex-1 rounded-lg border bg-card p-3">
														<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
															<ArrowDown class="h-3.5 w-3.5 text-success" />
															RX (Received)
														</div>
														<div class="mt-1 font-mono text-lg font-semibold">
															{formatBytes(iface.rxBytes)}
														</div>
													</div>
												{/if}
												{#if iface.txBytes !== null}
													<div class="flex-1 rounded-lg border bg-card p-3">
														<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
															<ArrowUp class="h-3.5 w-3.5 text-info" />
															TX (Transmitted)
														</div>
														<div class="mt-1 font-mono text-lg font-semibold">
															{formatBytes(iface.txBytes)}
														</div>
													</div>
												{/if}
											</div>
										</div>
									{/if}

									<!-- FLAGS Section -->
									{#if flags.length > 0}
										<div>
											<h3
												class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
											>
												<Flag class="h-3.5 w-3.5" />
												Flags
											</h3>
											<div class="flex flex-wrap gap-1.5">
												{#each flags as flag}
													<span
														class="rounded border border-border/40 bg-surface-3 px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
													>
														{flag}
													</span>
												{/each}
											</div>
										</div>
									{/if}
								</div>
							</div>
						{:else}
							<EmptyState icon={Network} title="Select an interface to view details" />
						{/if}
					</Resizable.Pane>
				</Resizable.PaneGroup>
			{:else if loading}
				<EmptyState icon={RefreshCw} title="Loading network interfaces..." />
			{:else if error}
				<EmptyState icon={Circle} title="Failed to load interfaces" description={error} />
			{:else}
				<EmptyState icon={Server} title="No interfaces match the current filters" />
			{/if}
		</div>
	</div>
</ToolShell>
