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
	Loader2,
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
	Square,
	Tablet,
	Terminal,
	Tv,
	Wifi,
	XCircle,
} from 'lucide-react';
import { useState, type ComponentType, type SVGProps } from 'react';
import { toast } from 'sonner';

import { SectionLabel } from '@/lib/components/layout';
import { EmbeddedEmptyState } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/lib/components/ui/select';
import { Skeleton } from '@/lib/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';
import {
	DEVICE_CATEGORIES,
	type DeviceCategory,
	type DeviceClassification,
} from '@/lib/services/device-classifier';
import {
	formatDuration,
	type MdnsServiceInfo,
	type PortInfo,
	SCAN_MODES,
	type ScanMode,
	type ScanProgress,
	type ServiceBanner,
	type SnmpDeviceInfo,
	type SsdpDeviceInfo,
	WELL_KNOWN_SERVICES,
	type WsDiscoveryInfo,
} from '@/lib/services/network-scanner';
import { cn } from '@/lib/utils';

interface DiscoveryInfo {
	readonly method: string;
	readonly durationMs: number;
	readonly error: string | null;
}

interface UnifiedHostDetailPanelProps {
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
	readonly serviceBanners?: readonly ServiceBanner[];
	readonly classification?: DeviceClassification | null;
	readonly discoveryMethods: readonly string[];
	readonly discoveries: readonly DiscoveryInfo[];
	readonly ports: readonly PortInfo[];
	readonly scanDurationMs: number | null;
	readonly onScan?: (ip: string, scanMode: ScanMode) => void;
	readonly onCancel?: () => void;
	readonly scanDisabled?: boolean;
	readonly scanProgress?: ScanProgress | null;
}

type Tab = 'overview' | 'ports' | 'discovery' | 'services';

const DEVICE_ICONS: Record<DeviceCategory, ComponentType<SVGProps<SVGSVGElement>>> = {
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

const isIPv6 = (ip: string): boolean => ip.includes(':');

const METHOD_LABELS: Record<string, string> = {
	tcp_connect: 'TCP Connect',
	mdns: 'mDNS/Bonjour',
	ssdp: 'SSDP/UPnP',
	udp_scan: 'UDP Scan',
	ws_discovery: 'WS-Discovery',
	arp_cache: 'ARP Cache',
	snmp: 'SNMP Broadcast',
	llmnr: 'LLMNR',
	local: 'Local',
};

const formatMethodName = (method: string): string => METHOD_LABELS[method] ?? method;

const getMethodDescription = (method: string): string => {
	switch (method) {
		case 'tcp_connect':
			return 'TCP Connect (full handshake)';
		case 'mdns':
			return 'mDNS/Bonjour Discovery';
		case 'ssdp':
			return 'SSDP/UPnP Discovery';
		case 'udp_scan':
			return 'UDP Probe (DNS, NetBIOS, SNMP)';
		case 'ws_discovery':
			return 'WS-Discovery (SOAP/UDP)';
		case 'arp_cache':
			return 'OS ARP Cache';
		case 'snmp':
			return 'SNMP sysName broadcast';
		case 'llmnr':
			return 'LLMNR multicast PTR resolution';
		case 'local':
			return 'Local Interface';
		default:
			return method;
	}
};

const getPortIcon = (port: number): ComponentType<SVGProps<SVGSVGElement>> => {
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

const getServiceName = (port: PortInfo): string => {
	if (port.service) return port.service;
	return WELL_KNOWN_SERVICES[port.port] ?? '';
};

const copyToClipboard = async (text: string, label: string) => {
	await navigator.clipboard.writeText(text);
	toast.success(`${label} copied`);
};

export function UnifiedHostDetailPanel({
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
	serviceBanners = [],
	classification = null,
	discoveries,
	ports,
	scanDurationMs,
	onScan,
	onCancel,
	scanDisabled = false,
	scanProgress = null,
}: UnifiedHostDetailPanelProps) {
	const [activeTab, setActiveTab] = useState<Tab>('overview');
	const [localScanMode, setLocalScanMode] = useState<ScanMode>('quick');

	const deviceCategory: DeviceCategory = classification?.category ?? 'unknown';
	const HeaderIcon = DEVICE_ICONS[deviceCategory] ?? CircleDot;

	const confidenceLabel = ((): string | null => {
		if (!classification || classification.confidence === 0) return null;
		if (classification.confidence >= 0.7) return 'High';
		if (classification.confidence >= 0.4) return 'Medium';
		return 'Low';
	})();

	const confidenceColor = ((): string => {
		if (!classification || classification.confidence === 0) return '';
		if (classification.confidence >= 0.7) return 'text-success';
		if (classification.confidence >= 0.4) return 'text-warning';
		return 'text-muted-foreground';
	})();

	const primaryIp = ips[0] ?? '';
	const ipv4Addresses = ips.filter((ip) => !isIPv6(ip));
	const ipv6Addresses = ips.filter(isIPv6);

	const openPorts = ports.filter((p) => p.state === 'open');
	const closedPorts = ports.filter((p) => p.state === 'closed');
	const filteredPorts = ports.filter((p) => p.state === 'filtered');

	// Scan progress derived values
	const scanPercentage = scanProgress?.type === 'progress' ? scanProgress.percentage : 0;
	const scanStatusText = ((): string => {
		if (!scanProgress) return '';
		if (scanProgress.type === 'started') {
			return `Scanning ${scanProgress.total_hosts} hosts, ${scanProgress.total_ports} ports each`;
		}
		if (scanProgress.type === 'progress') {
			return `${scanProgress.scanned_hosts} / ${scanProgress.total_hosts} hosts`;
		}
		return '';
	})();
	const scanCurrentIp = scanProgress?.type === 'progress' ? scanProgress.current_ip : null;
	const scanDiscoveredHosts = scanProgress?.type === 'progress' ? scanProgress.discovered_hosts : 0;
	const scanDiscoveredPorts = scanProgress?.type === 'progress' ? scanProgress.discovered_ports : 0;

	// Quick actions
	const hasWebPort = ports.some(
		(p) => p.state === 'open' && [80, 443, 8080, 8443].includes(p.port)
	);
	const hasSshPort = ports.some((p) => p.state === 'open' && p.port === 22);

	const openInBrowser = async () => {
		const webPort = ports.find((p) => p.state === 'open' && [443, 8443, 80, 8080].includes(p.port));
		if (!webPort) return;
		const protocol = [443, 8443].includes(webPort.port) ? 'https' : 'http';
		const url =
			webPort.port === 80 || webPort.port === 443
				? `${protocol}://${primaryIp}`
				: `${protocol}://${primaryIp}:${webPort.port}`;
		const { openUrl } = await import('@tauri-apps/plugin-opener');
		openUrl(url).catch(() => {});
	};

	const copySshCommand = () => {
		copyToClipboard(`ssh ${hostname ?? primaryIp}`, 'SSH command').catch(() => {});
	};

	const tabs = [
		{ id: 'overview' as const, label: 'Overview', icon: Info, count: null as number | null },
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
		{
			id: 'ports' as const,
			label: 'Ports',
			icon: Network,
			count: openPorts.length > 0 ? openPorts.length : null,
		},
	];

	const hasSsdpInfo = Boolean(
		ssdpDevice &&
		(ssdpDevice.friendlyName ||
			ssdpDevice.manufacturer ||
			ssdpDevice.modelName ||
			ssdpDevice.deviceType ||
			ssdpDevice.server)
	);

	const displayName = isUsefulHostname(hostname)
		? hostname
		: isUsefulHostname(netbiosName)
			? netbiosName
			: isUsefulHostname(ssdpDevice?.friendlyName)
				? (ssdpDevice?.friendlyName ?? null)
				: null;
	const displaySource = isUsefulHostname(hostname)
		? hostnameSource
		: isUsefulHostname(netbiosName)
			? 'netbios'
			: isUsefulHostname(ssdpDevice?.friendlyName)
				? 'ssdp'
				: null;

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Header */}
			<div className="shrink-0 border-b bg-surface-3 px-4 py-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div className="rounded-lg bg-primary/10 p-2">
							<HeaderIcon className="h-5 w-5 text-primary" />
						</div>
						<div>
							{displayName ? (
								<>
									<div className="flex items-center gap-2">
										<h2 className="text-lg font-semibold">{displayName}</h2>
										{displaySource ? (
											<span
												className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
												title={`Resolved via ${displaySource.toUpperCase()}`}
											>
												{displaySource.toUpperCase()}
											</span>
										) : null}
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon-sm"
													className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
													onClick={() => {
														copyToClipboard(displayName, 'Hostname').catch(() => {});
													}}
												>
													<Copy className="h-3.5 w-3.5" />
													<span className="sr-only">Copy hostname</span>
												</Button>
											</TooltipTrigger>
											<TooltipContent>Copy hostname</TooltipContent>
										</Tooltip>
									</div>
									<div className="flex items-center gap-2">
										<span className="font-mono text-sm tabular-nums text-muted-foreground">
											{primaryIp}
										</span>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon-sm"
													className="h-5 w-5 text-muted-foreground hover:bg-muted hover:text-foreground"
													onClick={() => {
														copyToClipboard(primaryIp, 'IP address').catch(() => {});
													}}
												>
													<Copy className="h-3 w-3" />
													<span className="sr-only">Copy IP</span>
												</Button>
											</TooltipTrigger>
											<TooltipContent>Copy IP</TooltipContent>
										</Tooltip>
									</div>
								</>
							) : (
								<>
									<div className="flex items-center gap-2">
										<h2 className="font-mono text-lg font-semibold tabular-nums">{primaryIp}</h2>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon-sm"
													className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
													onClick={() => {
														copyToClipboard(primaryIp, 'IP address').catch(() => {});
													}}
												>
													<Copy className="h-3.5 w-3.5" />
													<span className="sr-only">Copy IP</span>
												</Button>
											</TooltipTrigger>
											<TooltipContent>Copy IP</TooltipContent>
										</Tooltip>
									</div>
									<p className="text-xs text-muted-foreground">Hostname not resolved</p>
								</>
							)}
							{classification && classification.category !== 'unknown' ? (
								<div className="mt-1 flex items-center gap-2">
									<span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
										{DEVICE_CATEGORIES[classification.category].label}
									</span>
									{confidenceLabel ? (
										<span className={cn('text-xs', confidenceColor)}>
											{confidenceLabel} confidence
										</span>
									) : null}
								</div>
							) : null}
						</div>
					</div>
					{/* Quick actions */}
					<div className="flex items-center gap-1">
						{hasWebPort ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-sm"
										className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
										onClick={() => {
											openInBrowser().catch(() => {});
										}}
									>
										<Globe className="h-3.5 w-3.5" />
										<span className="sr-only">Open in browser</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent>Open in browser</TooltipContent>
							</Tooltip>
						) : null}
						{hasSshPort ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-sm"
										className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
										onClick={copySshCommand}
									>
										<Terminal className="h-3.5 w-3.5" />
										<span className="sr-only">Copy SSH command</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent>Copy SSH command</TooltipContent>
							</Tooltip>
						) : null}
						{scanDurationMs ? (
							<div className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
								<Clock className="h-3 w-3" />
								<span>{formatDuration(scanDurationMs)}</span>
							</div>
						) : null}
					</div>
				</div>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={(v) => setActiveTab(v as Tab)}
				className="flex min-h-0 flex-1 flex-col"
			>
				<TabsList className="mx-4 mt-3">
					{tabs.map((tab) => {
						const TabIcon = tab.icon;
						return (
							<TabsTrigger key={tab.id} value={tab.id}>
								<TabIcon />
								{tab.label}
								{tab.count !== null ? (
									<Badge variant="outline" className="font-mono text-2xs tabular-nums">
										{tab.count}
									</Badge>
								) : null}
							</TabsTrigger>
						);
					})}
				</TabsList>

				{/* Tab Content */}
				<div className="flex-1 overflow-auto p-4">
					<TabsContent value="overview" className="mt-0 animate-fade-in outline-none">
						{/* Summary Stats */}
						<div className="mb-4 grid grid-cols-2 gap-2">
							<div className="rounded-lg border bg-card p-2.5">
								<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Hash className="h-3 w-3" />
									IPs
								</div>
								<div className="mt-0.5 text-base font-semibold tabular-nums">{ips.length}</div>
							</div>
							<div className="rounded-lg border bg-card p-2.5">
								<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<CheckCircle2 className="h-3 w-3 text-success" />
									Open Ports
								</div>
								<div className="mt-0.5 text-base font-semibold tabular-nums">
									{openPorts.length}
								</div>
							</div>
							<div className="rounded-lg border bg-card p-2.5">
								<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Radar className="h-3 w-3 text-primary" />
									Discovery
								</div>
								<div className="mt-0.5 text-base font-semibold tabular-nums">
									{discoveries.length}
								</div>
							</div>
							<div className="rounded-lg border bg-card p-2.5">
								<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Radio className="h-3 w-3 text-info" />
									Services
								</div>
								<div className="mt-0.5 text-base font-semibold tabular-nums">
									{mdnsServices.length}
								</div>
							</div>
						</div>

						{/* IP Addresses Section */}
						{ips.length > 1 || ipv6Addresses.length > 0 ? (
							<div className="mb-4">
								<SectionLabel icon={Hash} title="IP Addresses" />
								<div className="space-y-2">
									{ipv4Addresses.length > 0 ? (
										<div className="rounded-lg border bg-card p-3">
											<div className="mb-1.5 text-xs font-medium text-muted-foreground">IPv4</div>
											<div className="flex flex-wrap gap-2">
												{ipv4Addresses.map((ip) => (
													<Button
														key={ip}
														variant="ghost"
														size="sm"
														className="h-auto gap-1.5 rounded bg-muted px-2 py-1 font-mono text-xs hover:bg-muted/80"
														title={`Copy ${ip}`}
														onClick={() => {
															copyToClipboard(ip, 'IP address').catch(() => {});
														}}
													>
														{ip}
														<Copy className="h-3 w-3 text-muted-foreground" />
													</Button>
												))}
											</div>
										</div>
									) : null}
									{ipv6Addresses.length > 0 ? (
										<div className="rounded-lg border bg-card p-3">
											<div className="mb-1.5 text-xs font-medium text-muted-foreground">IPv6</div>
											<div className="space-y-1">
												{ipv6Addresses.map((ip) => (
													<Button
														key={ip}
														variant="ghost"
														size="sm"
														className="h-auto w-full justify-between gap-2 rounded bg-muted px-2 py-1 font-mono text-xs hover:bg-muted/80"
														title={`Copy ${ip}`}
														onClick={() => {
															copyToClipboard(ip, 'IP address').catch(() => {});
														}}
													>
														<span className="truncate">{ip}</span>
														<Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
													</Button>
												))}
											</div>
										</div>
									) : null}
								</div>
							</div>
						) : null}

						{/* Device Classification */}
						{classification && classification.category !== 'unknown' ? (
							<div className="mb-4">
								<SectionLabel icon={HeaderIcon} title="Device Type" />
								<div className="rounded-lg border bg-card p-3">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium">
												{DEVICE_CATEGORIES[classification.category].label}
											</span>
											{confidenceLabel ? (
												<span
													className={cn(
														'rounded bg-muted px-1.5 py-0.5 text-xs font-medium',
														confidenceColor
													)}
												>
													{confidenceLabel}
												</span>
											) : null}
										</div>
										<span className="text-xs text-muted-foreground">
											{(classification.confidence * 100).toFixed(0)}%
										</span>
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										{DEVICE_CATEGORIES[classification.category].description}
									</p>
									{classification.evidence.length > 0 ? (
										<div className="mt-2 border-t pt-2">
											<div className="text-xs text-muted-foreground">
												{classification.evidence.map((evidence) => (
													<div key={evidence} className="flex items-center gap-1">
														<span className="text-[8px]">-</span>
														<span>{evidence}</span>
													</div>
												))}
											</div>
										</div>
									) : null}
								</div>
							</div>
						) : null}

						{/* Device Info */}
						{macAddress || vendor || netbiosName ? (
							<div className="mb-4">
								<SectionLabel icon={Cpu} title="Device Info" />
								<div className="grid grid-cols-2 gap-2">
									{netbiosName ? (
										<div className="rounded-lg border bg-card p-2.5">
											<div className="text-xs text-muted-foreground">NetBIOS Name</div>
											<div className="mt-0.5 flex items-center gap-1.5 font-mono text-sm font-medium">
												{netbiosName}
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon-sm"
															className="h-5 w-5 text-muted-foreground hover:bg-muted hover:text-foreground"
															onClick={() => {
																copyToClipboard(netbiosName, 'NetBIOS name').catch(() => {});
															}}
														>
															<Copy className="h-3 w-3" />
															<span className="sr-only">Copy NetBIOS name</span>
														</Button>
													</TooltipTrigger>
													<TooltipContent>Copy NetBIOS name</TooltipContent>
												</Tooltip>
											</div>
										</div>
									) : null}
									{macAddress ? (
										<div className="rounded-lg border bg-card p-2.5">
											<div className="text-xs text-muted-foreground">MAC Address</div>
											<div className="mt-0.5 flex items-center gap-1.5 font-mono text-sm font-medium">
												{macAddress}
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon-sm"
															className="h-5 w-5 text-muted-foreground hover:bg-muted hover:text-foreground"
															onClick={() => {
																copyToClipboard(macAddress, 'MAC address').catch(() => {});
															}}
														>
															<Copy className="h-3 w-3" />
															<span className="sr-only">Copy MAC address</span>
														</Button>
													</TooltipTrigger>
													<TooltipContent>Copy MAC address</TooltipContent>
												</Tooltip>
											</div>
										</div>
									) : null}
									{vendor ? (
										<div
											className={cn(
												'rounded-lg border bg-card p-2.5',
												netbiosName && macAddress && 'col-span-2'
											)}
										>
											<div className="text-xs text-muted-foreground">Vendor</div>
											<div className="mt-0.5 text-sm">{vendor}</div>
										</div>
									) : null}
								</div>
							</div>
						) : null}

						{/* SSDP/UPnP Device Info */}
						{hasSsdpInfo && ssdpDevice ? (
							<div className="mb-4">
								<SectionLabel icon={Wifi} title="SSDP/UPnP Device" />
								<div className="rounded-lg border bg-card p-3">
									{ssdpDevice.friendlyName ? (
										<div>
											<div className="text-xs font-medium text-muted-foreground">Friendly Name</div>
											<div className="text-sm font-medium">{ssdpDevice.friendlyName}</div>
										</div>
									) : null}
									{ssdpDevice.manufacturer || ssdpDevice.modelName ? (
										<div className={ssdpDevice.friendlyName ? 'mt-2 border-t pt-2' : ''}>
											<div className="text-xs font-medium text-muted-foreground">
												{ssdpDevice.manufacturer && ssdpDevice.modelName
													? 'Manufacturer / Model'
													: ssdpDevice.manufacturer
														? 'Manufacturer'
														: 'Model'}
											</div>
											<div className="text-sm">
												{[ssdpDevice.manufacturer, ssdpDevice.modelName].filter(Boolean).join(' ')}
												{ssdpDevice.modelNumber ? (
													<span className="text-muted-foreground"> ({ssdpDevice.modelNumber})</span>
												) : null}
											</div>
										</div>
									) : null}
									{ssdpDevice.deviceType ? (
										<div
											className={
												ssdpDevice.friendlyName || ssdpDevice.manufacturer || ssdpDevice.modelName
													? 'mt-2 border-t pt-2'
													: ''
											}
										>
											<div className="text-xs font-medium text-muted-foreground">Device Type</div>
											<div className="font-mono text-xs text-muted-foreground">
												{ssdpDevice.deviceType}
											</div>
										</div>
									) : null}
									{ssdpDevice.server ? (
										<div className="mt-2 border-t pt-2">
											<div className="text-xs font-medium text-muted-foreground">Server</div>
											<div className="font-mono text-xs text-muted-foreground">
												{ssdpDevice.server}
											</div>
										</div>
									) : null}
								</div>
							</div>
						) : null}

						{/* WS-Discovery Info */}
						{wsDiscovery &&
						(wsDiscovery.deviceTypes.length > 0 || wsDiscovery.scopes.length > 0) ? (
							<div className="mb-4">
								<SectionLabel icon={Globe} title="WS-Discovery" />
								<div className="rounded-lg border bg-card p-3">
									{wsDiscovery.deviceTypes.length > 0 ? (
										<div>
											<div className="text-xs font-medium text-muted-foreground">Device Types</div>
											<div className="mt-1 space-y-0.5">
												{wsDiscovery.deviceTypes.map((dtype) => (
													<div key={dtype} className="font-mono text-xs text-muted-foreground">
														{dtype}
													</div>
												))}
											</div>
										</div>
									) : null}
									{wsDiscovery.scopes.length > 0 ? (
										<div className={wsDiscovery.deviceTypes.length > 0 ? 'mt-2 border-t pt-2' : ''}>
											<div className="text-xs font-medium text-muted-foreground">Scopes</div>
											<div className="mt-1 max-h-20 space-y-0.5 overflow-y-auto">
												{wsDiscovery.scopes.map((scope) => (
													<div
														key={scope}
														className="break-all font-mono text-xs text-muted-foreground"
													>
														{scope}
													</div>
												))}
											</div>
										</div>
									) : null}
								</div>
							</div>
						) : null}

						{/* SNMP Info */}
						{snmpInfo &&
						(snmpInfo.sysName ||
							snmpInfo.sysDescr ||
							snmpInfo.sysLocation ||
							snmpInfo.sysContact) ? (
							<div className="mb-4">
								<SectionLabel icon={Server} title="SNMP" />
								<div className="space-y-2 rounded-lg border bg-card p-3">
									{snmpInfo.sysName ? (
										<div>
											<div className="text-xs font-medium text-muted-foreground">System Name</div>
											<div className="text-sm">{snmpInfo.sysName}</div>
										</div>
									) : null}
									{snmpInfo.sysDescr ? (
										<div>
											<div className="text-xs font-medium text-muted-foreground">Description</div>
											<div className="break-words text-xs text-muted-foreground">
												{snmpInfo.sysDescr}
											</div>
										</div>
									) : null}
									{snmpInfo.sysLocation ? (
										<div>
											<div className="text-xs font-medium text-muted-foreground">Location</div>
											<div className="text-sm">{snmpInfo.sysLocation}</div>
										</div>
									) : null}
									{snmpInfo.sysContact ? (
										<div>
											<div className="text-xs font-medium text-muted-foreground">Contact</div>
											<div className="text-sm">{snmpInfo.sysContact}</div>
										</div>
									) : null}
								</div>
							</div>
						) : null}

						{/* Service Banners */}
						{serviceBanners && serviceBanners.length > 0 ? (
							<div className="mb-4">
								<SectionLabel icon={Terminal} title="Service Banners" />
								<div className="rounded-lg border bg-card p-3">
									<div className="flex flex-wrap gap-1.5">
										{serviceBanners.map((banner) => (
											<span
												key={`${banner.protocol}-${banner.version ?? ''}-${banner.raw}`}
												className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
												title={banner.raw}
											>
												<span className="font-medium text-foreground">{banner.protocol}</span>
												{banner.version ? (
													<span className="text-muted-foreground"> {banner.version}</span>
												) : null}
											</span>
										))}
									</div>
								</div>
							</div>
						) : null}

						{/* TLS Certificate Names */}
						{tlsNames && tlsNames.length > 0 ? (
							<div className="mb-4">
								<SectionLabel icon={Shield} title="TLS Certificate" />
								<div className="rounded-lg border bg-card p-3">
									<div className="text-xs font-medium text-muted-foreground">
										Subject Alternative Names
									</div>
									<div className="mt-1 space-y-0.5">
										{tlsNames.map((name) => (
											<div key={name} className="font-mono text-sm">
												{name}
											</div>
										))}
									</div>
								</div>
							</div>
						) : null}
					</TabsContent>

					<TabsContent value="ports" className="mt-0 animate-fade-in outline-none">
						{/* Scan controls / progress */}
						{scanDisabled && scanProgress ? (
							<div className="mb-4 rounded-lg border bg-card p-3">
								<div className="mb-2 flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin text-primary" />
										<span className="text-sm font-medium">Scanning Ports...</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium text-primary">
											{scanPercentage.toFixed(0)}%
										</span>
										{onCancel ? (
											<Button
												variant="ghost"
												size="sm"
												className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
												onClick={onCancel}
											>
												<Square className="h-3 w-3" />
												Cancel
											</Button>
										) : null}
									</div>
								</div>
								<div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
									<div
										className="h-full bg-primary transition-all duration-300"
										style={{ width: `${scanPercentage}%` }}
									/>
								</div>
								<div className="flex items-center justify-between text-xs text-muted-foreground">
									<span>{scanStatusText}</span>
									<div className="flex items-center gap-3">
										{scanCurrentIp ? <span className="font-mono">{scanCurrentIp}</span> : null}
										{scanDiscoveredHosts > 0 ? (
											<span className="text-success">{scanDiscoveredHosts} hosts</span>
										) : null}
										{scanDiscoveredPorts > 0 ? (
											<span className="text-success">{scanDiscoveredPorts} ports</span>
										) : null}
									</div>
								</div>
							</div>
						) : onScan ? (
							<div className="mb-4 rounded-lg border bg-card p-3">
								<div className="flex items-center gap-2">
									<Select
										value={localScanMode}
										onValueChange={(v) => setLocalScanMode(v as ScanMode)}
									>
										<SelectTrigger size="sm" className="flex-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{SCAN_MODES.map((mode) => (
												<SelectItem key={mode.value} value={mode.value}>
													{mode.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Button
										variant="default"
										size="sm"
										className="h-8 shrink-0 gap-1.5 px-3 text-xs"
										disabled={scanDisabled}
										onClick={() => onScan(primaryIp, localScanMode)}
									>
										<Play className="h-3.5 w-3.5" />
										{ports.length > 0 ? 'Re-scan' : 'Scan'}
									</Button>
								</div>
								<p className="mt-1.5 text-xs text-muted-foreground">
									{SCAN_MODES.find((m) => m.value === localScanMode)?.description ?? ''}
								</p>
							</div>
						) : null}

						{ports.length === 0 && scanDisabled && scanProgress ? (
							<div
								className="space-y-1.5"
								role="status"
								aria-busy="true"
								aria-label="Loading ports"
							>
								{Array.from({ length: 5 }, (_, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
									<div key={i} className="flex items-center gap-2">
										<Skeleton className="h-4 w-24" />
										<Skeleton className="ml-auto h-4 w-12" />
									</div>
								))}
							</div>
						) : ports.length === 0 ? (
							<EmbeddedEmptyState
								icon={Network}
								title="No Port Scan Data"
								description="Select a scan mode and run a port scan to detect open services."
							/>
						) : (
							<>
								<div className="mb-4 rounded-lg border bg-card p-3">
									<div className="flex items-center justify-between text-sm">
										<span className="font-medium">Port Summary</span>
										<span className="text-xs text-muted-foreground">{ports.length} scanned</span>
									</div>
									<div className="mt-2 flex gap-4 text-xs">
										<span className="flex items-center gap-1.5 text-success">
											<CheckCircle2 className="h-3 w-3" aria-hidden="true" />
											{openPorts.length} open
										</span>
										<span className="flex items-center gap-1.5 text-warning">
											<Shield className="h-3 w-3" aria-hidden="true" />
											{filteredPorts.length} filtered
										</span>
										<span className="flex items-center gap-1.5 text-destructive">
											<XCircle className="h-3 w-3" aria-hidden="true" />
											{closedPorts.length} closed
										</span>
									</div>
									<div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
										{openPorts.length > 0 ? (
											<div
												className="bg-success"
												style={{ width: `${(openPorts.length / ports.length) * 100}%` }}
											/>
										) : null}
										{filteredPorts.length > 0 ? (
											<div
												className="bg-warning"
												style={{ width: `${(filteredPorts.length / ports.length) * 100}%` }}
											/>
										) : null}
										{closedPorts.length > 0 ? (
											<div
												className="bg-destructive"
												style={{ width: `${(closedPorts.length / ports.length) * 100}%` }}
											/>
										) : null}
									</div>
								</div>

								{/* Open Ports */}
								{openPorts.length > 0 ? (
									<div className="mb-4">
										<SectionLabel
											icon={CheckCircle2}
											iconClass="h-4 w-4 text-success"
											title={`Open Ports (${openPorts.length})`}
										/>
										<div className="space-y-2">
											{openPorts.map((port) => {
												const PortIcon = getPortIcon(port.port);
												const serviceName = getServiceName(port);
												return (
													<div
														key={port.port}
														className="rounded-lg border bg-card p-3 transition-colors hover:border-border/80"
													>
														<div className="flex items-start justify-between">
															<div className="flex items-start gap-3">
																<div className="rounded bg-success/10 p-1.5">
																	<PortIcon className="h-4 w-4 text-success" />
																</div>
																<div className="min-w-0 flex-1">
																	<div className="flex items-center gap-2">
																		<span className="font-mono text-base font-semibold tabular-nums">
																			{port.port}
																		</span>
																		{serviceName ? (
																			<span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
																				{serviceName}
																			</span>
																		) : null}
																	</div>
																	{port.banner ? (
																		<details className="mt-2">
																			<summary className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
																				<ChevronRight className="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
																				Banner / Version Info
																			</summary>
																			<div className="mt-1.5 rounded bg-muted/50 p-2 font-mono text-xs leading-relaxed text-muted-foreground">
																				{port.banner}
																			</div>
																		</details>
																	) : null}
																	{port.tlsCert ? (
																		<details className="mt-2">
																			<summary className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
																				<ChevronRight className="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
																				<Lock className="h-3 w-3" />
																				TLS Certificate
																				{port.tlsCert.isSelfSigned ? (
																					<span className="rounded bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">
																						Self-signed
																					</span>
																				) : null}
																			</summary>
																			<div className="mt-1.5 space-y-1.5 rounded bg-muted/50 p-2 text-xs">
																				{port.tlsCert.commonName ? (
																					<div className="flex gap-1">
																						<span className="shrink-0 font-medium text-muted-foreground">
																							CN:
																						</span>
																						<span className="break-all font-mono">
																							{port.tlsCert.commonName}
																						</span>
																					</div>
																				) : null}
																				{port.tlsCert.issuer ? (
																					<div className="flex gap-1">
																						<span className="shrink-0 font-medium text-muted-foreground">
																							Issuer:
																						</span>
																						<span className="break-all font-mono">
																							{port.tlsCert.issuer}
																						</span>
																					</div>
																				) : null}
																				{port.tlsCert.subjectAltNames &&
																				port.tlsCert.subjectAltNames.length > 0 ? (
																					<div>
																						<span className="font-medium text-muted-foreground">
																							SAN:
																						</span>
																						<div className="ml-3 mt-0.5 space-y-0.5">
																							{port.tlsCert.subjectAltNames.map((san) => (
																								<div key={san} className="break-all font-mono">
																									{san}
																								</div>
																							))}
																						</div>
																					</div>
																				) : null}
																			</div>
																		</details>
																	) : null}
																</div>
															</div>
															<Tooltip>
																<TooltipTrigger asChild>
																	<Button
																		variant="ghost"
																		size="icon-sm"
																		className="h-6 w-6 text-muted-foreground hover:bg-muted hover:text-foreground"
																		onClick={() => {
																			copyToClipboard(String(port.port), 'Port number').catch(
																				() => {}
																			);
																		}}
																	>
																		<Copy className="h-3 w-3" />
																		<span className="sr-only">Copy port</span>
																	</Button>
																</TooltipTrigger>
																<TooltipContent>Copy port</TooltipContent>
															</Tooltip>
														</div>
													</div>
												);
											})}
										</div>
									</div>
								) : null}

								{/* Filtered Ports */}
								{filteredPorts.length > 0 ? (
									<div className="mb-4">
										<SectionLabel
											icon={Shield}
											iconClass="h-4 w-4 text-warning"
											title={`Filtered Ports (${filteredPorts.length})`}
										/>
										<div className="flex flex-wrap gap-2">
											{filteredPorts.map((port) => {
												const serviceName = getServiceName(port);
												return (
													<div
														key={port.port}
														className="flex items-center gap-1.5 rounded border bg-warning/5 px-2 py-1 text-xs"
														title={
															serviceName
																? `${port.port}/${serviceName} - Firewall or security software blocking`
																: `Port ${port.port} - Firewall or security software blocking`
														}
													>
														<span className="font-mono font-medium">{port.port}</span>
														{serviceName ? (
															<span className="text-muted-foreground">/{serviceName}</span>
														) : null}
													</div>
												);
											})}
										</div>
									</div>
								) : null}

								{/* Closed Ports */}
								{closedPorts.length > 0 ? (
									<div className="mb-4">
										<SectionLabel
											icon={XCircle}
											iconClass="h-4 w-4 text-destructive"
											title={`Closed Ports (${closedPorts.length})`}
										/>
										<div className="flex flex-wrap gap-2">
											{closedPorts.map((port) => {
												const serviceName = getServiceName(port);
												return (
													<div
														key={port.port}
														className="flex items-center gap-1.5 rounded border bg-destructive/5 px-2 py-1 text-xs"
														title={
															serviceName
																? `${port.port}/${serviceName} - No service listening`
																: `Port ${port.port} - No service listening`
														}
													>
														<span className="font-mono font-medium">{port.port}</span>
														{serviceName ? (
															<span className="text-muted-foreground">/{serviceName}</span>
														) : null}
													</div>
												);
											})}
										</div>
									</div>
								) : null}
							</>
						)}
					</TabsContent>

					<TabsContent value="discovery" className="mt-0 animate-fade-in outline-none">
						{discoveries.length === 0 ? (
							<EmbeddedEmptyState
								icon={Radar}
								title="No Discovery Data"
								description="Run host discovery to detect this device using various network protocols."
								fillHeight
							/>
						) : (
							<div className="space-y-2">
								{discoveries.map((discovery) => (
									<div
										key={discovery.method}
										className="rounded-lg border bg-card p-3 transition-colors hover:border-border/80"
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div
													className={cn(
														'rounded p-1.5',
														discovery.error ? 'bg-destructive/10' : 'bg-success/10'
													)}
												>
													{discovery.error ? (
														<XCircle className="h-4 w-4 text-destructive" />
													) : (
														<CheckCircle2 className="h-4 w-4 text-success" />
													)}
												</div>
												<div>
													<span className="font-medium">{formatMethodName(discovery.method)}</span>
													<p className="text-xs text-muted-foreground">
														{getMethodDescription(discovery.method)}
													</p>
													{discovery.error ? (
														<p className="mt-0.5 text-xs text-destructive">{discovery.error}</p>
													) : null}
												</div>
											</div>
											<div className="flex items-center gap-1 text-xs text-muted-foreground">
												<Clock className="h-3 w-3" />
												<span>{formatDuration(discovery.durationMs)}</span>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</TabsContent>

					<TabsContent value="services" className="mt-0 animate-fade-in outline-none">
						{!mdnsServices || mdnsServices.length === 0 ? (
							<EmbeddedEmptyState
								icon={Radio}
								title="No mDNS Services"
								description="This host is not advertising any services via mDNS/Bonjour."
								fillHeight
							/>
						) : (
							<div className="space-y-2">
								{mdnsServices.map((service) => (
									<div
										key={`${service.instanceName}-${service.serviceType}`}
										className="rounded-lg border bg-card p-3 transition-colors hover:border-border/80"
									>
										<div className="flex items-start justify-between">
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<span className="truncate font-medium">{service.instanceName}</span>
													<span className="shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info">
														{service.serviceType.replace(/\._tcp\.local\.$/, '').replace(/^_/, '')}
													</span>
												</div>
												<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
													<span className="font-mono">Port {service.port}</span>
												</div>
												{service.properties.length > 0 ? (
													<details className="mt-2">
														<summary className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
															<ChevronRight className="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
															TXT Properties ({service.properties.length})
														</summary>
														<div className="mt-1.5 max-h-24 overflow-y-auto rounded bg-muted/50 p-2 text-xs">
															{service.properties.map(([key, value]) => (
																<div key={`${key}-${value}`} className="flex gap-2">
																	<span className="font-medium text-muted-foreground">{key}:</span>
																	<span className="break-all font-mono">{value || '(empty)'}</span>
																</div>
															))}
														</div>
													</details>
												) : null}
											</div>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant="ghost"
														size="icon-sm"
														className="h-6 w-6 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
														onClick={() => {
															copyToClipboard(
																`${service.instanceName} (${service.serviceType}:${service.port})`,
																'Service info'
															).catch(() => {});
														}}
													>
														<Copy className="h-3 w-3" />
														<span className="sr-only">Copy service info</span>
													</Button>
												</TooltipTrigger>
												<TooltipContent>Copy service info</TooltipContent>
											</Tooltip>
										</div>
									</div>
								))}
							</div>
						)}
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}

export type { UnifiedHostDetailPanelProps };
