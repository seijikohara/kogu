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
import { Card, CardContent } from '@/lib/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/lib/components/ui/select';
import { Skeleton } from '@/lib/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import { IconTooltip } from '@/lib/components/ui/icon-tooltip';
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

const getConfidenceLabel = (classification: DeviceClassification | null): string | null => {
	if (!classification || classification.confidence === 0) return null;
	if (classification.confidence >= 0.7) return 'High';
	if (classification.confidence >= 0.4) return 'Medium';
	return 'Low';
};

const getConfidenceColor = (classification: DeviceClassification | null): string => {
	if (!classification || classification.confidence === 0) return '';
	if (classification.confidence >= 0.7) return 'text-success';
	if (classification.confidence >= 0.4) return 'text-warning';
	return 'text-muted-foreground';
};

const getScanStatusText = (scanProgress: ScanProgress | null): string => {
	if (!scanProgress) return '';
	if (scanProgress.type === 'started') {
		return `Scanning ${scanProgress.total_hosts} hosts, ${scanProgress.total_ports} ports each`;
	}
	if (scanProgress.type === 'progress') {
		return `${scanProgress.scanned_hosts} / ${scanProgress.total_hosts} hosts`;
	}
	return '';
};

interface DisplayIdentity {
	readonly name: string | null;
	readonly source: string | null;
}

const resolveDisplayIdentity = (
	hostname: string | null,
	hostnameSource: string | null,
	netbiosName: string | null,
	ssdpDevice: SsdpDeviceInfo | null
): DisplayIdentity => {
	if (isUsefulHostname(hostname)) {
		return { name: hostname, source: hostnameSource };
	}
	if (isUsefulHostname(netbiosName)) {
		return { name: netbiosName, source: 'netbios' };
	}
	if (isUsefulHostname(ssdpDevice?.friendlyName)) {
		return { name: ssdpDevice?.friendlyName ?? null, source: 'ssdp' };
	}
	return { name: null, source: null };
};

const buildTabs = (
	discoveries: readonly DiscoveryInfo[],
	mdnsServices: readonly MdnsServiceInfo[],
	openPorts: readonly PortInfo[]
) => [
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

const computeSsdpHasInfo = (device: SsdpDeviceInfo | null): boolean =>
	Boolean(
		device &&
		(device.friendlyName ||
			device.manufacturer ||
			device.modelName ||
			device.deviceType ||
			device.server)
	);

interface BrowserPort {
	readonly protocol: 'http' | 'https';
	readonly port: number;
}

const findBrowserPort = (ports: readonly PortInfo[]): BrowserPort | null => {
	const webPort = ports.find((p) => p.state === 'open' && [443, 8443, 80, 8080].includes(p.port));
	if (!webPort) return null;
	const protocol: BrowserPort['protocol'] = [443, 8443].includes(webPort.port) ? 'https' : 'http';
	return { protocol, port: webPort.port };
};

interface OpenPortCardProps {
	readonly port: PortInfo;
}

function OpenPortCard({ port }: OpenPortCardProps) {
	const PortIcon = getPortIcon(port.port);
	const serviceName = getServiceName(port);
	return (
		<Card key={port.port} density="compact" className="transition-colors hover:border-border/80">
			<CardContent>
				<div className="flex items-start justify-between">
					<div className="flex items-start gap-3">
						<div className="rounded bg-success/10 p-1.5">
							<PortIcon className="h-4 w-4 text-success" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="font-mono text-base font-semibold tabular-nums">{port.port}</span>
								{serviceName ? (
									<span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
										{serviceName}
									</span>
								) : null}
							</div>
							{port.banner ? <PortBannerDetails banner={port.banner} /> : null}
							{port.tlsCert ? <PortTlsDetails cert={port.tlsCert} /> : null}
						</div>
					</div>
					<IconTooltip label="Copy port">
						<Button
							variant="ghost"
							size="icon-sm"
							className="h-6 w-6 text-muted-foreground hover:bg-muted hover:text-foreground"
							onClick={() => {
								copyToClipboard(String(port.port), 'Port number').catch(() => {});
							}}
						>
							<Copy className="h-3 w-3" />
							<span className="sr-only">Copy port</span>
						</Button>
					</IconTooltip>
				</div>
			</CardContent>
		</Card>
	);
}

interface PortBannerDetailsProps {
	readonly banner: string;
}

function PortBannerDetails({ banner }: PortBannerDetailsProps) {
	return (
		<details className="mt-2">
			<summary className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
				<ChevronRight className="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
				Banner / Version Info
			</summary>
			<div className="mt-1.5 rounded bg-muted/50 p-2 font-mono text-xs leading-relaxed text-muted-foreground">
				{banner}
			</div>
		</details>
	);
}

interface PortTlsDetailsProps {
	readonly cert: NonNullable<PortInfo['tlsCert']>;
}

function PortTlsDetails({ cert }: PortTlsDetailsProps) {
	return (
		<details className="mt-2">
			<summary className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
				<ChevronRight className="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
				<Lock className="h-3 w-3" />
				TLS Certificate
				{cert.isSelfSigned ? (
					<span className="rounded bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">
						Self-signed
					</span>
				) : null}
			</summary>
			<div className="mt-1.5 space-y-1.5 rounded bg-muted/50 p-2 text-xs">
				{cert.commonName ? (
					<div className="flex gap-1">
						<span className="shrink-0 font-medium text-muted-foreground">CN:</span>
						<span className="break-all font-mono">{cert.commonName}</span>
					</div>
				) : null}
				{cert.issuer ? (
					<div className="flex gap-1">
						<span className="shrink-0 font-medium text-muted-foreground">Issuer:</span>
						<span className="break-all font-mono">{cert.issuer}</span>
					</div>
				) : null}
				{cert.subjectAltNames && cert.subjectAltNames.length > 0 ? (
					<div>
						<span className="font-medium text-muted-foreground">SAN:</span>
						<div className="ml-3 mt-0.5 space-y-0.5">
							{cert.subjectAltNames.map((san) => (
								<div key={san} className="break-all font-mono">
									{san}
								</div>
							))}
						</div>
					</div>
				) : null}
			</div>
		</details>
	);
}

interface PortsTabProps {
	readonly ports: readonly PortInfo[];
	readonly openPorts: readonly PortInfo[];
	readonly filteredPorts: readonly PortInfo[];
	readonly closedPorts: readonly PortInfo[];
	readonly primaryIp: string;
	readonly scanDisabled: boolean;
	readonly scanProgress: ScanProgress | null;
	readonly scanPercentage: number;
	readonly scanStatusText: string;
	readonly scanCurrentIp: string | null;
	readonly scanDiscoveredHosts: number;
	readonly scanDiscoveredPorts: number;
	readonly localScanMode: ScanMode;
	readonly onLocalScanModeChange: (mode: ScanMode) => void;
	readonly onScan?: (ip: string, scanMode: ScanMode) => void;
	readonly onCancel?: () => void;
}

function PortsTab({
	ports,
	openPorts,
	filteredPorts,
	closedPorts,
	primaryIp,
	scanDisabled,
	scanProgress,
	scanPercentage,
	scanStatusText,
	scanCurrentIp,
	scanDiscoveredHosts,
	scanDiscoveredPorts,
	localScanMode,
	onLocalScanModeChange,
	onScan,
	onCancel,
}: PortsTabProps) {
	return (
		<>
			{scanDisabled && scanProgress ? (
				<PortsScanProgressCard
					scanPercentage={scanPercentage}
					scanStatusText={scanStatusText}
					scanCurrentIp={scanCurrentIp}
					scanDiscoveredHosts={scanDiscoveredHosts}
					scanDiscoveredPorts={scanDiscoveredPorts}
					onCancel={onCancel}
				/>
			) : onScan ? (
				<PortsScanControls
					primaryIp={primaryIp}
					hasPorts={ports.length > 0}
					localScanMode={localScanMode}
					onLocalScanModeChange={onLocalScanModeChange}
					scanDisabled={scanDisabled}
					onScan={onScan}
				/>
			) : null}

			{ports.length === 0 && scanDisabled && scanProgress ? (
				<div className="space-y-1.5" role="status" aria-busy="true" aria-label="Loading ports">
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
					<PortSummaryCard
						total={ports.length}
						openCount={openPorts.length}
						filteredCount={filteredPorts.length}
						closedCount={closedPorts.length}
					/>

					{openPorts.length > 0 ? (
						<div className="mb-4">
							<SectionLabel icon={CheckCircle2} iconClass="h-4 w-4 text-success">
								{`Open Ports (${openPorts.length})`}
							</SectionLabel>
							<div className="space-y-2">
								{openPorts.map((port) => (
									<OpenPortCard key={port.port} port={port} />
								))}
							</div>
						</div>
					) : null}

					{filteredPorts.length > 0 ? <FilteredPortsSection ports={filteredPorts} /> : null}

					{closedPorts.length > 0 ? <ClosedPortsSection ports={closedPorts} /> : null}
				</>
			)}
		</>
	);
}

interface PortsScanProgressCardProps {
	readonly scanPercentage: number;
	readonly scanStatusText: string;
	readonly scanCurrentIp: string | null;
	readonly scanDiscoveredHosts: number;
	readonly scanDiscoveredPorts: number;
	readonly onCancel?: () => void;
}

function PortsScanProgressCard({
	scanPercentage,
	scanStatusText,
	scanCurrentIp,
	scanDiscoveredHosts,
	scanDiscoveredPorts,
	onCancel,
}: PortsScanProgressCardProps) {
	return (
		<Card density="compact" className="mb-4">
			<CardContent>
				<div className="mb-2 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Loader2 className="h-4 w-4 animate-spin text-primary" />
						<span className="text-sm font-medium">Scanning Ports...</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-primary">{scanPercentage.toFixed(0)}%</span>
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
			</CardContent>
		</Card>
	);
}

interface PortsScanControlsProps {
	readonly primaryIp: string;
	readonly hasPorts: boolean;
	readonly localScanMode: ScanMode;
	readonly onLocalScanModeChange: (mode: ScanMode) => void;
	readonly scanDisabled: boolean;
	readonly onScan: (ip: string, scanMode: ScanMode) => void;
}

function PortsScanControls({
	primaryIp,
	hasPorts,
	localScanMode,
	onLocalScanModeChange,
	scanDisabled,
	onScan,
}: PortsScanControlsProps) {
	return (
		<Card density="compact" className="mb-4">
			<CardContent>
				<div className="flex items-center gap-2">
					<Select value={localScanMode} onValueChange={(v) => onLocalScanModeChange(v as ScanMode)}>
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
						{hasPorts ? 'Re-scan' : 'Scan'}
					</Button>
				</div>
				<p className="mt-1.5 text-xs text-muted-foreground">
					{SCAN_MODES.find((m) => m.value === localScanMode)?.description ?? ''}
				</p>
			</CardContent>
		</Card>
	);
}

interface PortSummaryCardProps {
	readonly total: number;
	readonly openCount: number;
	readonly filteredCount: number;
	readonly closedCount: number;
}

function PortSummaryCard({ total, openCount, filteredCount, closedCount }: PortSummaryCardProps) {
	return (
		<Card density="compact" className="mb-4">
			<CardContent>
				<div className="flex items-center justify-between text-sm">
					<span className="font-medium">Port Summary</span>
					<span className="text-xs text-muted-foreground">{total} scanned</span>
				</div>
				<div className="mt-2 flex gap-4 text-xs">
					<span className="flex items-center gap-1.5 text-success">
						<CheckCircle2 className="h-3 w-3" aria-hidden="true" />
						{openCount} open
					</span>
					<span className="flex items-center gap-1.5 text-warning">
						<Shield className="h-3 w-3" aria-hidden="true" />
						{filteredCount} filtered
					</span>
					<span className="flex items-center gap-1.5 text-destructive">
						<XCircle className="h-3 w-3" aria-hidden="true" />
						{closedCount} closed
					</span>
				</div>
				<div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
					{openCount > 0 ? (
						<div className="bg-success" style={{ width: `${(openCount / total) * 100}%` }} />
					) : null}
					{filteredCount > 0 ? (
						<div className="bg-warning" style={{ width: `${(filteredCount / total) * 100}%` }} />
					) : null}
					{closedCount > 0 ? (
						<div className="bg-destructive" style={{ width: `${(closedCount / total) * 100}%` }} />
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

interface FilteredPortsSectionProps {
	readonly ports: readonly PortInfo[];
}

function FilteredPortsSection({ ports }: FilteredPortsSectionProps) {
	return (
		<div className="mb-4">
			<SectionLabel icon={Shield} iconClass="h-4 w-4 text-warning">
				{`Filtered Ports (${ports.length})`}
			</SectionLabel>
			<div className="flex flex-wrap gap-2">
				{ports.map((port) => {
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
							{serviceName ? <span className="text-muted-foreground">/{serviceName}</span> : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}

interface ClosedPortsSectionProps {
	readonly ports: readonly PortInfo[];
}

function ClosedPortsSection({ ports }: ClosedPortsSectionProps) {
	return (
		<div className="mb-4">
			<SectionLabel icon={XCircle} iconClass="h-4 w-4 text-destructive">
				{`Closed Ports (${ports.length})`}
			</SectionLabel>
			<div className="flex flex-wrap gap-2">
				{ports.map((port) => {
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
							{serviceName ? <span className="text-muted-foreground">/{serviceName}</span> : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}

interface DiscoveryTabProps {
	readonly discoveries: readonly DiscoveryInfo[];
}

function DiscoveryTab({ discoveries }: DiscoveryTabProps) {
	if (discoveries.length === 0) {
		return (
			<EmbeddedEmptyState
				icon={Radar}
				title="No Discovery Data"
				description="Run host discovery to detect this device using various network protocols."
				fillHeight
			/>
		);
	}
	return (
		<div className="space-y-2">
			{discoveries.map((discovery) => (
				<Card
					key={discovery.method}
					density="compact"
					className="transition-colors hover:border-border/80"
				>
					<CardContent>
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
					</CardContent>
				</Card>
			))}
		</div>
	);
}

interface ServicesTabProps {
	readonly mdnsServices: readonly MdnsServiceInfo[];
}

function ServicesTab({ mdnsServices }: ServicesTabProps) {
	if (!mdnsServices || mdnsServices.length === 0) {
		return (
			<EmbeddedEmptyState
				icon={Radio}
				title="No mDNS Services"
				description="This host is not advertising any services via mDNS/Bonjour."
				fillHeight
			/>
		);
	}
	return (
		<div className="space-y-2">
			{mdnsServices.map((service) => (
				<MdnsServiceCard key={`${service.instanceName}-${service.serviceType}`} service={service} />
			))}
		</div>
	);
}

interface MdnsServiceCardProps {
	readonly service: MdnsServiceInfo;
}

function MdnsServiceCard({ service }: MdnsServiceCardProps) {
	return (
		<Card density="compact" className="transition-colors hover:border-border/80">
			<CardContent>
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
					<IconTooltip label="Copy service info">
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
					</IconTooltip>
				</div>
			</CardContent>
		</Card>
	);
}

interface OverviewTabProps {
	readonly ips: readonly string[];
	readonly ipv4Addresses: readonly string[];
	readonly ipv6Addresses: readonly string[];
	readonly openPorts: readonly PortInfo[];
	readonly discoveriesCount: number;
	readonly mdnsServicesCount: number;
	readonly classification: DeviceClassification | null;
	readonly HeaderIcon: ComponentType<SVGProps<SVGSVGElement>>;
	readonly confidenceLabel: string | null;
	readonly confidenceColor: string;
	readonly netbiosName: string | null;
	readonly macAddress: string | null;
	readonly vendor: string | null;
	readonly hasSsdpInfo: boolean;
	readonly ssdpDevice: SsdpDeviceInfo | null;
	readonly wsDiscovery: WsDiscoveryInfo | null;
	readonly snmpInfo: SnmpDeviceInfo | null;
	readonly tlsNames: readonly string[];
	readonly serviceBanners: readonly ServiceBanner[];
}

function OverviewTab({
	ips,
	ipv4Addresses,
	ipv6Addresses,
	openPorts,
	discoveriesCount,
	mdnsServicesCount,
	classification,
	HeaderIcon,
	confidenceLabel,
	confidenceColor,
	netbiosName,
	macAddress,
	vendor,
	hasSsdpInfo,
	ssdpDevice,
	wsDiscovery,
	snmpInfo,
	tlsNames,
	serviceBanners,
}: OverviewTabProps) {
	return (
		<>
			<div className="mb-4 grid grid-cols-2 gap-2">
				<OverviewStatCard icon={Hash} label="IPs" value={ips.length} />
				<OverviewStatCard
					icon={CheckCircle2}
					iconClass="h-3 w-3 text-success"
					label="Open Ports"
					value={openPorts.length}
				/>
				<OverviewStatCard
					icon={Radar}
					iconClass="h-3 w-3 text-primary"
					label="Discovery"
					value={discoveriesCount}
				/>
				<OverviewStatCard
					icon={Radio}
					iconClass="h-3 w-3 text-info"
					label="Services"
					value={mdnsServicesCount}
				/>
			</div>

			{ips.length > 1 || ipv6Addresses.length > 0 ? (
				<IpAddressesSection ipv4={ipv4Addresses} ipv6={ipv6Addresses} />
			) : null}

			{classification && classification.category !== 'unknown' ? (
				<DeviceTypeSection
					classification={classification}
					HeaderIcon={HeaderIcon}
					confidenceLabel={confidenceLabel}
					confidenceColor={confidenceColor}
				/>
			) : null}

			{macAddress || vendor || netbiosName ? (
				<DeviceInfoSection netbiosName={netbiosName} macAddress={macAddress} vendor={vendor} />
			) : null}

			{hasSsdpInfo && ssdpDevice ? <SsdpDeviceSection device={ssdpDevice} /> : null}

			{wsDiscovery && (wsDiscovery.deviceTypes.length > 0 || wsDiscovery.scopes.length > 0) ? (
				<WsDiscoverySection wsDiscovery={wsDiscovery} />
			) : null}

			{snmpInfo &&
			(snmpInfo.sysName || snmpInfo.sysDescr || snmpInfo.sysLocation || snmpInfo.sysContact) ? (
				<SnmpSection snmpInfo={snmpInfo} />
			) : null}

			{serviceBanners && serviceBanners.length > 0 ? (
				<ServiceBannersSection banners={serviceBanners} />
			) : null}

			{tlsNames && tlsNames.length > 0 ? <TlsCertificateSection names={tlsNames} /> : null}
		</>
	);
}

interface OverviewStatCardProps {
	readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
	readonly iconClass?: string;
	readonly label: string;
	readonly value: number;
}

function OverviewStatCard({
	icon: Icon,
	iconClass = 'h-3 w-3',
	label,
	value,
}: OverviewStatCardProps) {
	return (
		<Card density="compact">
			<CardContent>
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Icon className={iconClass} />
					{label}
				</div>
				<div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
			</CardContent>
		</Card>
	);
}

interface IpAddressesSectionProps {
	readonly ipv4: readonly string[];
	readonly ipv6: readonly string[];
}

function IpAddressesSection({ ipv4, ipv6 }: IpAddressesSectionProps) {
	return (
		<div className="mb-4">
			<SectionLabel icon={Hash}>IP Addresses</SectionLabel>
			<div className="space-y-2">
				{ipv4.length > 0 ? (
					<Card density="compact">
						<CardContent>
							<div className="mb-1.5 text-xs font-medium text-muted-foreground">IPv4</div>
							<div className="flex flex-wrap gap-2">
								{ipv4.map((ip) => (
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
						</CardContent>
					</Card>
				) : null}
				{ipv6.length > 0 ? (
					<Card density="compact">
						<CardContent>
							<div className="mb-1.5 text-xs font-medium text-muted-foreground">IPv6</div>
							<div className="space-y-1">
								{ipv6.map((ip) => (
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
						</CardContent>
					</Card>
				) : null}
			</div>
		</div>
	);
}

interface DeviceTypeSectionProps {
	readonly classification: DeviceClassification;
	readonly HeaderIcon: ComponentType<SVGProps<SVGSVGElement>>;
	readonly confidenceLabel: string | null;
	readonly confidenceColor: string;
}

function DeviceTypeSection({
	classification,
	HeaderIcon,
	confidenceLabel,
	confidenceColor,
}: DeviceTypeSectionProps) {
	return (
		<div className="mb-4">
			<SectionLabel icon={HeaderIcon}>Device Type</SectionLabel>
			<Card density="compact">
				<CardContent>
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
				</CardContent>
			</Card>
		</div>
	);
}

interface DeviceInfoSectionProps {
	readonly netbiosName: string | null;
	readonly macAddress: string | null;
	readonly vendor: string | null;
}

function DeviceInfoSection({ netbiosName, macAddress, vendor }: DeviceInfoSectionProps) {
	return (
		<div className="mb-4">
			<SectionLabel icon={Cpu}>Device Info</SectionLabel>
			<div className="grid grid-cols-2 gap-2">
				{netbiosName ? <NamedInfoCard label="NetBIOS Name" value={netbiosName} /> : null}
				{macAddress ? <NamedInfoCard label="MAC Address" value={macAddress} /> : null}
				{vendor ? (
					<Card density="compact" className={cn(netbiosName && macAddress && 'col-span-2')}>
						<CardContent>
							<div className="text-xs text-muted-foreground">Vendor</div>
							<div className="mt-0.5 text-sm">{vendor}</div>
						</CardContent>
					</Card>
				) : null}
			</div>
		</div>
	);
}

interface NamedInfoCardProps {
	readonly label: string;
	readonly value: string;
}

function NamedInfoCard({ label, value }: NamedInfoCardProps) {
	return (
		<Card density="compact">
			<CardContent>
				<div className="text-xs text-muted-foreground">{label}</div>
				<div className="mt-0.5 flex items-center gap-1.5 font-mono text-sm font-medium">
					{value}
					<IconTooltip label={`Copy ${label}`}>
						<Button
							variant="ghost"
							size="icon-sm"
							className="h-5 w-5 text-muted-foreground hover:bg-muted hover:text-foreground"
							onClick={() => {
								copyToClipboard(value, label).catch(() => {});
							}}
						>
							<Copy className="h-3 w-3" />
							<span className="sr-only">{`Copy ${label}`}</span>
						</Button>
					</IconTooltip>
				</div>
			</CardContent>
		</Card>
	);
}

interface SsdpDeviceSectionProps {
	readonly device: SsdpDeviceInfo;
}

function SsdpDeviceSection({ device }: SsdpDeviceSectionProps) {
	return (
		<div className="mb-4">
			<SectionLabel icon={Wifi}>SSDP/UPnP Device</SectionLabel>
			<Card density="compact">
				<CardContent>
					{device.friendlyName ? (
						<div>
							<div className="text-xs font-medium text-muted-foreground">Friendly Name</div>
							<div className="text-sm font-medium">{device.friendlyName}</div>
						</div>
					) : null}
					{device.manufacturer || device.modelName ? (
						<div className={device.friendlyName ? 'mt-2 border-t pt-2' : ''}>
							<div className="text-xs font-medium text-muted-foreground">
								{device.manufacturer && device.modelName
									? 'Manufacturer / Model'
									: device.manufacturer
										? 'Manufacturer'
										: 'Model'}
							</div>
							<div className="text-sm">
								{[device.manufacturer, device.modelName].filter(Boolean).join(' ')}
								{device.modelNumber ? (
									<span className="text-muted-foreground"> ({device.modelNumber})</span>
								) : null}
							</div>
						</div>
					) : null}
					{device.deviceType ? (
						<div
							className={
								device.friendlyName || device.manufacturer || device.modelName
									? 'mt-2 border-t pt-2'
									: ''
							}
						>
							<div className="text-xs font-medium text-muted-foreground">Device Type</div>
							<div className="font-mono text-xs text-muted-foreground">{device.deviceType}</div>
						</div>
					) : null}
					{device.server ? (
						<div className="mt-2 border-t pt-2">
							<div className="text-xs font-medium text-muted-foreground">Server</div>
							<div className="font-mono text-xs text-muted-foreground">{device.server}</div>
						</div>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}

interface WsDiscoverySectionProps {
	readonly wsDiscovery: WsDiscoveryInfo;
}

function WsDiscoverySection({ wsDiscovery }: WsDiscoverySectionProps) {
	return (
		<div className="mb-4">
			<SectionLabel icon={Globe}>WS-Discovery</SectionLabel>
			<Card density="compact">
				<CardContent>
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
									<div key={scope} className="break-all font-mono text-xs text-muted-foreground">
										{scope}
									</div>
								))}
							</div>
						</div>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}

interface SnmpSectionProps {
	readonly snmpInfo: SnmpDeviceInfo;
}

function SnmpSection({ snmpInfo }: SnmpSectionProps) {
	return (
		<div className="mb-4">
			<SectionLabel icon={Server}>SNMP</SectionLabel>
			<Card density="compact">
				<CardContent className="space-y-2">
					{snmpInfo.sysName ? (
						<div>
							<div className="text-xs font-medium text-muted-foreground">System Name</div>
							<div className="text-sm">{snmpInfo.sysName}</div>
						</div>
					) : null}
					{snmpInfo.sysDescr ? (
						<div>
							<div className="text-xs font-medium text-muted-foreground">Description</div>
							<div className="break-words text-xs text-muted-foreground">{snmpInfo.sysDescr}</div>
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
				</CardContent>
			</Card>
		</div>
	);
}

interface ServiceBannersSectionProps {
	readonly banners: readonly ServiceBanner[];
}

function ServiceBannersSection({ banners }: ServiceBannersSectionProps) {
	return (
		<div className="mb-4">
			<SectionLabel icon={Terminal}>Service Banners</SectionLabel>
			<Card density="compact">
				<CardContent>
					<div className="flex flex-wrap gap-1.5">
						{banners.map((banner) => (
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
				</CardContent>
			</Card>
		</div>
	);
}

interface TlsCertificateSectionProps {
	readonly names: readonly string[];
}

function TlsCertificateSection({ names }: TlsCertificateSectionProps) {
	return (
		<div className="mb-4">
			<SectionLabel icon={Shield}>TLS Certificate</SectionLabel>
			<Card density="compact">
				<CardContent>
					<div className="text-xs font-medium text-muted-foreground">Subject Alternative Names</div>
					<div className="mt-1 space-y-0.5">
						{names.map((name) => (
							<div key={name} className="font-mono text-sm">
								{name}
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

interface HostDetailHeaderProps {
	readonly HeaderIcon: ComponentType<SVGProps<SVGSVGElement>>;
	readonly displayName: string | null;
	readonly displaySource: string | null;
	readonly primaryIp: string;
	readonly classification: DeviceClassification | null;
	readonly confidenceLabel: string | null;
	readonly confidenceColor: string;
	readonly hasWebPort: boolean;
	readonly hasSshPort: boolean;
	readonly scanDurationMs: number | null;
	readonly onOpenInBrowser: () => void;
	readonly onCopySshCommand: () => void;
}

function HostDetailHeader({
	HeaderIcon,
	displayName,
	displaySource,
	primaryIp,
	classification,
	confidenceLabel,
	confidenceColor,
	hasWebPort,
	hasSshPort,
	scanDurationMs,
	onOpenInBrowser,
	onCopySshCommand,
}: HostDetailHeaderProps) {
	return (
		<div className="shrink-0 border-b bg-surface-3 px-4 py-3">
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-3">
					<div className="rounded-lg bg-primary/10 p-2">
						<HeaderIcon className="h-5 w-5 text-primary" />
					</div>
					<div>
						{displayName ? (
							<HeaderTitleWithName
								displayName={displayName}
								displaySource={displaySource}
								primaryIp={primaryIp}
							/>
						) : (
							<HeaderTitleIpOnly primaryIp={primaryIp} />
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
				<div className="flex items-center gap-1">
					{hasWebPort ? (
						<IconTooltip label="Open in browser">
							<Button
								variant="ghost"
								size="icon-sm"
								className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
								onClick={onOpenInBrowser}
							>
								<Globe className="h-3.5 w-3.5" />
								<span className="sr-only">Open in browser</span>
							</Button>
						</IconTooltip>
					) : null}
					{hasSshPort ? (
						<IconTooltip label="Copy SSH command">
							<Button
								variant="ghost"
								size="icon-sm"
								className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
								onClick={onCopySshCommand}
							>
								<Terminal className="h-3.5 w-3.5" />
								<span className="sr-only">Copy SSH command</span>
							</Button>
						</IconTooltip>
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
	);
}

interface HeaderTitleWithNameProps {
	readonly displayName: string;
	readonly displaySource: string | null;
	readonly primaryIp: string;
}

function HeaderTitleWithName({ displayName, displaySource, primaryIp }: HeaderTitleWithNameProps) {
	return (
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
				<CopyIconButton
					label="Copy hostname"
					iconClass="h-3.5 w-3.5"
					onClick={() => {
						copyToClipboard(displayName, 'Hostname').catch(() => {});
					}}
				/>
			</div>
			<div className="flex items-center gap-2">
				<span className="font-mono text-sm tabular-nums text-muted-foreground">{primaryIp}</span>
				<CopyIconButton
					label="Copy IP"
					iconClass="h-3 w-3"
					buttonClass="h-5 w-5"
					onClick={() => {
						copyToClipboard(primaryIp, 'IP address').catch(() => {});
					}}
				/>
			</div>
		</>
	);
}

interface HeaderTitleIpOnlyProps {
	readonly primaryIp: string;
}

function HeaderTitleIpOnly({ primaryIp }: HeaderTitleIpOnlyProps) {
	return (
		<>
			<div className="flex items-center gap-2">
				<h2 className="font-mono text-lg font-semibold tabular-nums">{primaryIp}</h2>
				<CopyIconButton
					label="Copy IP"
					iconClass="h-3.5 w-3.5"
					onClick={() => {
						copyToClipboard(primaryIp, 'IP address').catch(() => {});
					}}
				/>
			</div>
			<p className="text-xs text-muted-foreground">Hostname not resolved</p>
		</>
	);
}

interface CopyIconButtonProps {
	readonly label: string;
	readonly iconClass: string;
	readonly buttonClass?: string;
	readonly onClick: () => void;
}

function CopyIconButton({
	label,
	iconClass,
	buttonClass = 'h-7 w-7',
	onClick,
}: CopyIconButtonProps) {
	return (
		<IconTooltip label={label}>
			<Button
				variant="ghost"
				size="icon-sm"
				className={cn(buttonClass, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
				onClick={onClick}
			>
				<Copy className={iconClass} />
				<span className="sr-only">{label}</span>
			</Button>
		</IconTooltip>
	);
}

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

	const confidenceLabel = getConfidenceLabel(classification);
	const confidenceColor = getConfidenceColor(classification);

	const primaryIp = ips[0] ?? '';
	const ipv4Addresses = ips.filter((ip) => !isIPv6(ip));
	const ipv6Addresses = ips.filter(isIPv6);

	const openPorts = ports.filter((p) => p.state === 'open');
	const closedPorts = ports.filter((p) => p.state === 'closed');
	const filteredPorts = ports.filter((p) => p.state === 'filtered');

	// Scan progress derived values
	const scanPercentage = scanProgress?.type === 'progress' ? scanProgress.percentage : 0;
	const scanStatusText = getScanStatusText(scanProgress);
	const scanCurrentIp = scanProgress?.type === 'progress' ? scanProgress.current_ip : null;
	const scanDiscoveredHosts = scanProgress?.type === 'progress' ? scanProgress.discovered_hosts : 0;
	const scanDiscoveredPorts = scanProgress?.type === 'progress' ? scanProgress.discovered_ports : 0;

	// Quick actions
	const hasWebPort = ports.some(
		(p) => p.state === 'open' && [80, 443, 8080, 8443].includes(p.port)
	);
	const hasSshPort = ports.some((p) => p.state === 'open' && p.port === 22);

	const openInBrowser = async () => {
		const browserPort = findBrowserPort(ports);
		if (!browserPort) return;
		const url =
			browserPort.port === 80 || browserPort.port === 443
				? `${browserPort.protocol}://${primaryIp}`
				: `${browserPort.protocol}://${primaryIp}:${browserPort.port}`;
		const { openUrl } = await import('@tauri-apps/plugin-opener');
		openUrl(url).catch(() => {});
	};

	const copySshCommand = () => {
		copyToClipboard(`ssh ${hostname ?? primaryIp}`, 'SSH command').catch(() => {});
	};

	const tabs = buildTabs(discoveries, mdnsServices, openPorts);

	const hasSsdpInfo = computeSsdpHasInfo(ssdpDevice);

	const { name: displayName, source: displaySource } = resolveDisplayIdentity(
		hostname,
		hostnameSource,
		netbiosName,
		ssdpDevice
	);

	return (
		<div className="flex h-full flex-col overflow-hidden">
			<HostDetailHeader
				HeaderIcon={HeaderIcon}
				displayName={displayName}
				displaySource={displaySource}
				primaryIp={primaryIp}
				classification={classification}
				confidenceLabel={confidenceLabel}
				confidenceColor={confidenceColor}
				hasWebPort={hasWebPort}
				hasSshPort={hasSshPort}
				scanDurationMs={scanDurationMs}
				onOpenInBrowser={() => {
					openInBrowser().catch(() => {});
				}}
				onCopySshCommand={copySshCommand}
			/>

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
						<OverviewTab
							ips={ips}
							ipv4Addresses={ipv4Addresses}
							ipv6Addresses={ipv6Addresses}
							openPorts={openPorts}
							discoveriesCount={discoveries.length}
							mdnsServicesCount={mdnsServices.length}
							classification={classification}
							HeaderIcon={HeaderIcon}
							confidenceLabel={confidenceLabel}
							confidenceColor={confidenceColor}
							netbiosName={netbiosName}
							macAddress={macAddress}
							vendor={vendor}
							hasSsdpInfo={hasSsdpInfo}
							ssdpDevice={ssdpDevice}
							wsDiscovery={wsDiscovery}
							snmpInfo={snmpInfo}
							tlsNames={tlsNames}
							serviceBanners={serviceBanners}
						/>
					</TabsContent>

					<TabsContent value="ports" className="mt-0 animate-fade-in outline-none">
						<PortsTab
							ports={ports}
							openPorts={openPorts}
							filteredPorts={filteredPorts}
							closedPorts={closedPorts}
							primaryIp={primaryIp}
							scanDisabled={scanDisabled}
							scanProgress={scanProgress}
							scanPercentage={scanPercentage}
							scanStatusText={scanStatusText}
							scanCurrentIp={scanCurrentIp}
							scanDiscoveredHosts={scanDiscoveredHosts}
							scanDiscoveredPorts={scanDiscoveredPorts}
							localScanMode={localScanMode}
							onLocalScanModeChange={setLocalScanMode}
							onScan={onScan}
							onCancel={onCancel}
						/>
					</TabsContent>

					<TabsContent value="discovery" className="mt-0 animate-fade-in outline-none">
						<DiscoveryTab discoveries={discoveries} />
					</TabsContent>

					<TabsContent value="services" className="mt-0 animate-fade-in outline-none">
						<ServicesTab mdnsServices={mdnsServices} />
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}

export type { UnifiedHostDetailPanelProps };
