/**
 * Network scanner services for port scanning and host discovery.
 * These are TypeScript wrappers around Tauri backend commands.
 */

import { type Channel, invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// =============================================================================
// Network Interface Types
// =============================================================================

export interface NetworkInterface {
	readonly name: string;
	readonly ip: string;
	readonly isIpv6: boolean;
	readonly isLoopback: boolean;
	readonly suggestedCidr: string | null;
	readonly prefixLen: number;
}

export interface LocalNetworkInfo {
	readonly interfaces: readonly NetworkInterface[];
	readonly primaryIpv4: NetworkInterface | null;
	readonly primaryIpv6: NetworkInterface | null;
}

// =============================================================================
// mDNS/Bonjour Types
// =============================================================================

export interface MdnsService {
	readonly instanceName: string;
	readonly serviceType: string;
	readonly hostname: string;
	readonly addresses: readonly string[];
	readonly port: number;
	readonly properties: readonly [string, string][];
}

export interface MdnsDiscoveryRequest {
	readonly serviceTypes: readonly string[];
	readonly durationMs: number;
}

export interface MdnsDiscoveryResults {
	readonly services: readonly MdnsService[];
	readonly durationMs: number;
}

// =============================================================================
// Scan Mode Types
// =============================================================================

export type ScanMode = 'quick' | 'full' | 'custom';
export type PortPreset = 'well_known' | 'web' | 'database' | 'custom';
export type PortState = 'open' | 'closed' | 'filtered';

// =============================================================================
// Request/Response Types
// =============================================================================

/** Hostname resolution options */
export interface HostnameResolutionOptions {
	/** Enable DNS reverse lookup (PTR records) */
	readonly dns: boolean;
	/** Enable mDNS/Bonjour resolution (.local) */
	readonly mdns: boolean;
	/** Enable NetBIOS name resolution (Windows) */
	readonly netbios: boolean;
	/** Resolution timeout in milliseconds */
	readonly timeoutMs: number;
}

export interface ScanRequest {
	readonly target: string;
	readonly mode: ScanMode;
	readonly portPreset: PortPreset;
	readonly portRange?: string;
	readonly concurrency: number;
	readonly timeoutMs: number;
	readonly resolveHostname: boolean;
	/** Hostname resolution options */
	readonly resolution?: HostnameResolutionOptions;
}

/** TLS certificate information extracted from HTTPS ports */
export interface TlsCertInfo {
	/** Common Name (CN) from the certificate subject */
	readonly commonName?: string;
	/** Subject Alternative Names (SAN) */
	readonly subjectAltNames?: readonly string[];
	/** Certificate issuer (CN or Organization) */
	readonly issuer?: string;
	/** Whether the certificate is self-signed */
	readonly isSelfSigned: boolean;
}

export interface PortInfo {
	readonly port: number;
	readonly state: PortState;
	readonly service?: string;
	readonly banner?: string;
	/** TLS certificate info (for HTTPS ports) */
	readonly tlsCert?: TlsCertInfo;
}

export interface HostResult {
	readonly ip: string;
	readonly hostname?: string;
	readonly ports: readonly PortInfo[];
	readonly scanDurationMs: number;
}

export interface ScanResults {
	readonly hosts: readonly HostResult[];
	readonly totalHostsScanned: number;
	readonly hostsWithOpenPorts: number;
	readonly totalOpenPorts: number;
	readonly scanDurationMs: number;
	readonly startTime: string;
	readonly endTime: string;
}

// =============================================================================
// Progress Event Types
// =============================================================================

export type ScanProgress =
	| { type: 'started'; total_hosts: number; total_ports: number }
	| { type: 'host_discovered'; host: HostResult }
	| {
			type: 'progress';
			scanned_hosts: number;
			total_hosts: number;
			percentage: number;
			current_ip: string | null;
			discovered_hosts: number;
			discovered_ports: number;
	  }
	| { type: 'completed'; results: ScanResults }
	| { type: 'error'; message: string };

// =============================================================================
// Constants
// =============================================================================

// Quick Scan ports - common services (25 ports)
export const QUICK_SCAN_PORTS = [
	21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995, 1433, 1521, 3306, 3389, 5432,
	5900, 6379, 8080, 8443, 27017,
] as const;

// Web service ports
export const WEB_PORTS = [80, 443, 3000, 5000, 8000, 8080, 8443, 8888] as const;

// Database ports
export const DATABASE_PORTS = [
	1433, // MS SQL Server
	1521, // Oracle
	3306, // MySQL / MariaDB
	5432, // PostgreSQL
	5984, // CouchDB
	6379, // Redis
	9200, // Elasticsearch
	11211, // Memcached
	27017, // MongoDB
] as const;

// Well-known service names
export const WELL_KNOWN_SERVICES: Record<number, string> = {
	21: 'FTP',
	22: 'SSH',
	23: 'Telnet',
	25: 'SMTP',
	53: 'DNS',
	80: 'HTTP',
	110: 'POP3',
	111: 'RPC',
	135: 'MSRPC',
	139: 'NetBIOS',
	143: 'IMAP',
	443: 'HTTPS',
	445: 'SMB',
	993: 'IMAPS',
	995: 'POP3S',
	1433: 'MSSQL',
	1521: 'Oracle',
	3306: 'MySQL',
	3389: 'RDP',
	5432: 'PostgreSQL',
	5900: 'VNC',
	6379: 'Redis',
	8080: 'HTTP-Alt',
	8443: 'HTTPS-Alt',
	27017: 'MongoDB',
};

export const SCAN_MODES = [
	{
		value: 'quick' as const,
		label: 'Quick Scan',
		description: `${QUICK_SCAN_PORTS.length} common ports`,
		ports: QUICK_SCAN_PORTS,
	},
	{
		value: 'full' as const,
		label: 'Full Scan',
		description: 'All ports (1-65535)',
		ports: null,
	},
	{
		value: 'custom' as const,
		label: 'Custom',
		description: 'Specify port range or preset',
		ports: null,
	},
] as const;

export const PORT_PRESETS = [
	{
		value: 'well_known' as const,
		label: 'Standard',
		description: 'Ports 1-1024',
		ports: null as readonly number[] | null,
		count: 1024,
	},
	{
		value: 'web' as const,
		label: 'Web',
		description: `${WEB_PORTS.length} ports`,
		ports: WEB_PORTS,
		count: WEB_PORTS.length,
	},
	{
		value: 'database' as const,
		label: 'Database',
		description: `${DATABASE_PORTS.length} ports`,
		ports: DATABASE_PORTS,
		count: DATABASE_PORTS.length,
	},
	{
		value: 'custom' as const,
		label: 'Custom',
		description: 'User-defined',
		ports: null as readonly number[] | null,
		count: null,
	},
] as const;

export const DEFAULT_CONCURRENCY = 100;
export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 500;

export const DEFAULT_TIMEOUT_MS = 1000;
export const MIN_TIMEOUT_MS = 100;
export const MAX_TIMEOUT_MS = 10000;

// =============================================================================
// Host Discovery Types
// =============================================================================

export type DiscoveryMethod =
	| 'tcp_connect'
	| 'mdns'
	| 'ssdp'
	| 'udp_scan'
	| 'ws_discovery'
	| 'arp_cache'
	| 'none';

export interface DiscoveryOptions {
	readonly methods: readonly DiscoveryMethod[];
	readonly timeoutMs: number;
	readonly concurrency: number;
	readonly synPorts?: readonly number[];
	readonly mdnsServices?: readonly string[];
	/** Resolve NetBIOS names for discovered hosts */
	readonly resolveNetbios?: boolean;
}

/** mDNS service information for a host */
export interface MdnsServiceInfo {
	/** Service instance name */
	readonly instanceName: string;
	/** Service type (e.g., "_http._tcp") */
	readonly serviceType: string;
	/** Port number */
	readonly port: number;
	/** TXT record properties as key-value pairs */
	readonly properties: readonly [string, string][];
}

/** SSDP/UPnP device information fetched from device description XML */
export interface SsdpDeviceInfo {
	/** User-friendly device name (e.g., "Living Room Router") */
	readonly friendlyName?: string;
	/** Device manufacturer (e.g., "NETGEAR") */
	readonly manufacturer?: string;
	/** Device model name (e.g., "Nighthawk R7000") */
	readonly modelName?: string;
	/** Device model number */
	readonly modelNumber?: string;
	/** UPnP device type URN */
	readonly deviceType?: string;
	/** UPnP LOCATION URL */
	readonly location?: string;
	/** SERVER header value from SSDP response */
	readonly server?: string;
}

/** WS-Discovery device information */
export interface WsDiscoveryInfo {
	/** Device types (e.g., "wsdp:Device", "print:PrintDeviceType") */
	readonly deviceTypes: readonly string[];
	/** XAddrs - endpoint URLs for the device */
	readonly xaddrs: readonly string[];
	/** Scopes - URIs describing device capabilities */
	readonly scopes: readonly string[];
}

/** SNMP device information (sysName, sysDescr, etc.) */
export interface SnmpDeviceInfo {
	/** System name (sysName.0) */
	readonly sysName?: string;
	/** System description (sysDescr.0) */
	readonly sysDescr?: string;
	/** System location (sysLocation.0) */
	readonly sysLocation?: string;
	/** System contact (sysContact.0) */
	readonly sysContact?: string;
}

/** Host metadata collected during discovery */
export interface HostMetadata {
	/** Hostname (from mDNS, DNS reverse lookup, NetBIOS, SNMP, TLS, etc.) */
	readonly hostname?: string;
	/** Source of the hostname resolution (dns, mdns, netbios, snmp, tls) */
	readonly hostnameSource?: string;
	/** NetBIOS name (from NetBIOS Node Status query) */
	readonly netbiosName?: string;
	/** MAC address (from ARP scan) */
	readonly macAddress?: string;
	/** Vendor name (from OUI lookup) */
	readonly vendor?: string;
	/** mDNS services advertised by this host */
	readonly mdnsServices: readonly MdnsServiceInfo[];
	/** SSDP/UPnP device information */
	readonly ssdpDevice?: SsdpDeviceInfo;
	/** WS-Discovery device information */
	readonly wsDiscovery?: WsDiscoveryInfo;
	/** SNMP device information (sysName, sysDescr, etc.) */
	readonly snmpInfo?: SnmpDeviceInfo;
	/** TLS certificate Subject Alternative Names (dNSName) */
	readonly tlsNames: readonly string[];
}

export interface DiscoveryResult {
	readonly method: string;
	readonly hosts: readonly string[];
	/** Hostname mapping: IP address -> hostname (populated by mDNS discovery) */
	readonly hostnames: Readonly<Record<string, string>>;
	/** Extended host metadata (MAC addresses, vendors, mDNS services) */
	readonly hostMetadata: Readonly<Record<string, HostMetadata>>;
	readonly unreachable: readonly string[];
	readonly durationMs: number;
	readonly error: string | null;
	readonly requiresPrivileges: boolean;
}

// =============================================================================
// Discovery Progress Types (for parallel execution)
// =============================================================================

export type ProgressStatus = 'running' | 'completed' | 'error';

/** Real-time progress information for a discovery method */
export interface DiscoveryProgress {
	/** Discovery method name */
	readonly method: string;
	/** Current status of the method */
	readonly status: ProgressStatus;
	/** Number of hosts found so far */
	readonly hostsFound: number;
	/** Duration in milliseconds (only set when completed) */
	readonly durationMs: number | null;
	/** Error message (only set when status is Error) */
	readonly error: string | null;
}

export const DISCOVERY_METHODS = [
	{
		value: 'tcp_connect' as const,
		label: 'TCP Connect',
		description: 'Connect to common ports, no privileges needed',
		requiresPrivileges: false,
	},
	{
		value: 'mdns' as const,
		label: 'mDNS/Bonjour',
		description: 'Discover advertised services, no privileges needed',
		requiresPrivileges: false,
	},
	{
		value: 'ssdp' as const,
		label: 'SSDP/UPnP',
		description: 'Discover UPnP devices (routers, media servers)',
		requiresPrivileges: false,
	},
	{
		value: 'udp_scan' as const,
		label: 'UDP Scan',
		description: 'Probe common UDP ports (DNS, NetBIOS, SNMP)',
		requiresPrivileges: false,
	},
	{
		value: 'ws_discovery' as const,
		label: 'WS-Discovery',
		description: 'Discover Windows devices and printers (SOAP/UDP)',
		requiresPrivileges: false,
	},
	{
		value: 'arp_cache' as const,
		label: 'ARP Cache',
		description: 'Read OS ARP cache for MAC addresses (no scan)',
		requiresPrivileges: false,
	},
] as const;

export const DEFAULT_SYN_PORTS = [22, 80, 443, 445, 3389] as const;

// =============================================================================
// Scanner Functions
// =============================================================================

/**
 * Start a network scan with a caller-provided scan ID for cancellation support.
 */
export const startNetworkScan = async (
	request: ScanRequest,
	scanId: string
): Promise<ScanResults> => invoke<ScanResults>('start_network_scan', { request, scanId });

/**
 * Cancel a running network scan.
 */
export const cancelNetworkScan = async (scanId: string): Promise<boolean> =>
	invoke<boolean>('cancel_network_scan', { scanId });

/**
 * Get local network interfaces.
 */
export const getLocalNetworkInterfaces = async (): Promise<LocalNetworkInfo> =>
	invoke<LocalNetworkInfo>('get_local_network_interfaces');

/**
 * Discover mDNS/Bonjour services on the local network.
 */
export const discoverMdnsServices = async (
	request: MdnsDiscoveryRequest
): Promise<MdnsDiscoveryResults> =>
	invoke<MdnsDiscoveryResults>('discover_mdns_services', { request });

// =============================================================================
// Discovery Channel Event Types (for streaming results)
// =============================================================================

/** Channel event types streamed from backend during host discovery */
export type DiscoveryEvent =
	| { event: 'methodStarted'; data: { method: string } }
	| { event: 'methodCompleted'; data: { result: DiscoveryResult } }
	| { event: 'resolvingHostnames'; data: null }
	| { event: 'completed'; data: { results: DiscoveryResult[] } }
	| { event: 'cancelled'; data: null };

/**
 * Discover hosts using specified methods with streaming results via Channel API.
 * Each method's result is streamed to the frontend as it completes.
 */
export const discoverHosts = async (
	targets: readonly string[],
	options: DiscoveryOptions,
	onEvent: Channel<DiscoveryEvent>,
	discoveryId: string
): Promise<readonly DiscoveryResult[]> =>
	invoke<DiscoveryResult[]>('discover_hosts', {
		targets: [...targets],
		options,
		onEvent,
		discoveryId,
	});

/**
 * Cancel a running host discovery.
 */
export const cancelDiscovery = async (discoveryId: string): Promise<boolean> =>
	invoke<boolean>('cancel_discovery', { discoveryId });

/**
 * Get available discovery methods and their privilege status.
 * Returns an array of [method_name, is_available] pairs.
 */
export const getDiscoveryMethods = async (): Promise<readonly [string, boolean][]> =>
	invoke<[string, boolean][]>('get_discovery_methods');

/**
 * Check if a specific discovery method is available (has required privileges).
 */
export const checkDiscoveryPrivilege = async (method: DiscoveryMethod): Promise<boolean> =>
	invoke<boolean>('check_discovery_privilege', { method });

// =============================================================================
// mDNS Service Types
// =============================================================================

export const COMMON_MDNS_SERVICES = [
	{ type: '_http._tcp.local.', label: 'HTTP Web Servers' },
	{ type: '_https._tcp.local.', label: 'HTTPS Web Servers' },
	{ type: '_ssh._tcp.local.', label: 'SSH Servers' },
	{ type: '_sftp-ssh._tcp.local.', label: 'SFTP Servers' },
	{ type: '_smb._tcp.local.', label: 'SMB/Samba Shares' },
	{ type: '_afpovertcp._tcp.local.', label: 'AFP (Apple File Sharing)' },
	{ type: '_nfs._tcp.local.', label: 'NFS Shares' },
	{ type: '_ftp._tcp.local.', label: 'FTP Servers' },
	{ type: '_printer._tcp.local.', label: 'Printers' },
	{ type: '_ipp._tcp.local.', label: 'IPP Printers' },
	{ type: '_airplay._tcp.local.', label: 'AirPlay Devices' },
	{ type: '_raop._tcp.local.', label: 'AirPlay Audio' },
	{ type: '_spotify-connect._tcp.local.', label: 'Spotify Connect' },
	{ type: '_googlecast._tcp.local.', label: 'Google Cast Devices' },
	{ type: '_homekit._tcp.local.', label: 'HomeKit Devices' },
	{ type: '_hap._tcp.local.', label: 'HomeKit Accessories' },
	{ type: '_mqtt._tcp.local.', label: 'MQTT Brokers' },
	{ type: '_postgresql._tcp.local.', label: 'PostgreSQL' },
	{ type: '_mysql._tcp.local.', label: 'MySQL' },
	{ type: '_mongodb._tcp.local.', label: 'MongoDB' },
	{ type: '_redis._tcp.local.', label: 'Redis' },
	{ type: '_elasticsearch._tcp.local.', label: 'Elasticsearch' },
] as const;

// =============================================================================
// Event Listener
// =============================================================================

/**
 * Listen to network scan progress events.
 * Returns an unlisten function to stop listening.
 */
export const listenToScanProgress = async (
	callback: (progress: ScanProgress) => void
): Promise<UnlistenFn> =>
	listen<ScanProgress>('network-scan-progress', (event) => {
		callback(event.payload);
	});

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate target string (IP, hostname, or CIDR).
 */
export const isValidTarget = (target: string): boolean => {
	const trimmed = target.trim();
	if (!trimmed) return false;

	// Simple validation: not empty and doesn't contain obviously invalid characters
	// Full validation happens on the backend
	return !/[<>\\"|]/.test(trimmed);
};

/**
 * Validate port range string.
 */
export const isValidPortRange = (range: string): boolean => {
	const trimmed = range.trim();
	if (!trimmed) return false;

	// Pattern: single port, range (1-1024), or comma-separated
	const pattern = /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/;
	return pattern.test(trimmed);
};

// =============================================================================
// Unified Host Types (for UI layer)
// =============================================================================

/** Discovery information for a single method */
export interface DiscoveryInfo {
	method: string;
	durationMs: number;
	error: string | null;
}

/**
 * Unified host structure combining discovery and scan results.
 * Note: This interface is mutable for internal state management.
 * Phase 3.1 will introduce a pure mergeHosts function for better immutability.
 */
export interface UnifiedHost {
	/** Unique identifier for UI key */
	id: string;
	/** All IP addresses (IPv4/IPv6) */
	ips: string[];
	/** Resolved hostname */
	hostname: string | null;
	/** Source of hostname resolution (dns, mdns, netbios, snmp, tls) */
	hostnameSource: string | null;
	/** NetBIOS name */
	netbiosName: string | null;
	/** MAC address (from ARP scan) */
	macAddress: string | null;
	/** Vendor name (from OUI lookup) */
	vendor: string | null;
	/** mDNS services advertised by this host */
	mdnsServices: MdnsServiceInfo[];
	/** SSDP/UPnP device information */
	ssdpDevice: SsdpDeviceInfo | null;
	/** WS-Discovery device information */
	wsDiscovery: WsDiscoveryInfo | null;
	/** SNMP device information */
	snmpInfo: SnmpDeviceInfo | null;
	/** TLS certificate Subject Alternative Names */
	tlsNames: string[];
	/** Discovery methods that found this host */
	discoveryMethods: string[];
	/** Discovery details */
	discoveries: DiscoveryInfo[];
	/** Port scan results */
	ports: PortInfo[];
	/** Port scan duration */
	scanDurationMs: number | null;
}

// =============================================================================
// Host Merging Utilities
// =============================================================================

/** Check if IP is IPv6 */
const isIPv6 = (ip: string): boolean => ip.includes(':');

/** Parse IPv4 address into a numeric value for comparison */
const ipv4ToNumber = (ip: string): number => {
	const parts = ip.split('.');
	if (parts.length !== 4) return 0;
	return parts.reduce((acc, octet) => acc * 256 + (Number.parseInt(octet, 10) || 0), 0);
};

/** Compare two IP addresses numerically (IPv4 before IPv6, then by numeric value) */
const compareIpAddresses = (a: string, b: string): number => {
	const aIsV6 = isIPv6(a);
	const bIsV6 = isIPv6(b);
	if (aIsV6 !== bIsV6) return aIsV6 ? 1 : -1;
	if (!aIsV6) return ipv4ToNumber(a) - ipv4ToNumber(b);
	return a.localeCompare(b);
};

/**
 * Get merge key for a host (hostname if available, otherwise IP).
 *
 * Note: Retained as a public export for backward compatibility with existing
 * callers. The internal merging algorithm now uses Union-Find on a richer
 * signal set (IP, MAC, normalized hostname) rather than a single string key.
 */
export const getMergeKey = (ip: string, hostname: string | null): string => {
	if (hostname) return `host:${hostname.toLowerCase()}`;
	return `ip:${ip}`;
};

/** Sort IPs: IPv4 first (numerically), then IPv6 */
const sortIps = (ips: readonly string[]): string[] => [...ips].sort(compareIpAddresses);

/** Compare hosts by their primary IP address (numerically) */
const compareByIp = (a: UnifiedHost, b: UnifiedHost): number => {
	const aIp = a.ips[0] ?? '';
	const bIp = b.ips[0] ?? '';
	return compareIpAddresses(aIp, bIp);
};

/** Suffixes stripped during hostname normalization (case-insensitive). */
const HOSTNAME_STRIP_SUFFIXES = ['.local', '.lan', '.home.arpa'] as const;

/**
 * Normalize a hostname for cross-source equality comparison.
 *
 * Steps: lowercase, strip a trailing `.`, then strip a single trailing
 * `.local` / `.lan` / `.home.arpa` suffix. Returns `null` for empty input
 * so callers can treat "no hostname" uniformly.
 */
const normalizeHostname = (hostname: string | null | undefined): string | null => {
	if (!hostname) return null;
	const lowered = hostname.toLowerCase().replace(/\.$/, '');
	if (!lowered) return null;
	const stripped = HOSTNAME_STRIP_SUFFIXES.reduce(
		(acc, suffix) => (acc.endsWith(suffix) ? acc.slice(0, -suffix.length) : acc),
		lowered
	);
	const trimmed = stripped.length > 0 ? stripped : lowered;
	return trimmed || null;
};

/** Normalize a MAC address: lowercase, use `:` separators. Empty input returns null. */
const normalizeMac = (mac: string | null | undefined): string | null => {
	if (!mac) return null;
	const normalized = mac.toLowerCase().replace(/-/g, ':').trim();
	return normalized || null;
};

/** Priority ordering for hostname sources when multiple are reported per host. */
const HOSTNAME_SOURCE_PRIORITY: Record<string, number> = {
	mdns: 0,
	dns: 1,
	llmnr: 2,
	netbios: 3,
	snmp: 4,
	tls: 5,
	ssdp: 6,
};

const hostnameSourceRank = (source: string | null | undefined): number => {
	if (!source) return Number.POSITIVE_INFINITY;
	const rank = HOSTNAME_SOURCE_PRIORITY[source.toLowerCase()];
	return rank ?? Number.POSITIVE_INFINITY;
};

/** Disjoint-set / Union-Find over string keys (IP strings here). */
class DisjointSet {
	private readonly parent = new Map<string, string>();
	private readonly rank = new Map<string, number>();

	add(key: string): void {
		if (this.parent.has(key)) return;
		this.parent.set(key, key);
		this.rank.set(key, 0);
	}

	find(key: string): string {
		const parent = this.parent.get(key);
		if (parent === undefined) {
			// Auto-add to keep find total — caller errors should be impossible here.
			this.add(key);
			return key;
		}
		if (parent === key) return key;
		const root = this.find(parent);
		this.parent.set(key, root);
		return root;
	}

	union(a: string, b: string): void {
		const rootA = this.find(a);
		const rootB = this.find(b);
		if (rootA === rootB) return;
		const rankA = this.rank.get(rootA) ?? 0;
		const rankB = this.rank.get(rootB) ?? 0;
		if (rankA < rankB) {
			this.parent.set(rootA, rootB);
		} else if (rankA > rankB) {
			this.parent.set(rootB, rootA);
		} else {
			this.parent.set(rootB, rootA);
			this.rank.set(rootA, rankA + 1);
		}
	}

	keys(): readonly string[] {
		return [...this.parent.keys()];
	}
}

/** Per-IP record describing what each source contributed about this IP. */
interface IpObservation {
	readonly ip: string;
	readonly hostnames: { value: string; source: string | null }[];
	readonly macs: string[];
	readonly metadatas: HostMetadata[];
	readonly discoveries: DiscoveryResult[];
	readonly ports: PortInfo[];
	scanDurationMs: number;
}

const getOrCreateObservation = (
	observations: Map<string, IpObservation>,
	ip: string
): IpObservation => {
	const existing = observations.get(ip);
	if (existing) return existing;
	const created: IpObservation = {
		ip,
		hostnames: [],
		macs: [],
		metadatas: [],
		discoveries: [],
		ports: [],
		scanDurationMs: 0,
	};
	observations.set(ip, created);
	return created;
};

/** Record a hostname/source pair on an observation if non-empty and not duplicate. */
const recordHostname = (
	observation: IpObservation,
	hostname: string | null | undefined,
	source: string | null | undefined
): void => {
	if (!hostname) return;
	const trimmed = hostname.trim();
	if (!trimmed) return;
	const alreadyPresent = observation.hostnames.some(
		(entry) => entry.value === trimmed && (entry.source ?? null) === (source ?? null)
	);
	if (alreadyPresent) return;
	observation.hostnames.push({ value: trimmed, source: source ?? null });
};

const recordMac = (observation: IpObservation, mac: string | null | undefined): void => {
	const normalized = normalizeMac(mac);
	if (!normalized) return;
	if (!observation.macs.includes(normalized)) observation.macs.push(normalized);
};

/** Add an mDNS service to a host if not already present */
const addMdnsServiceIfNew = (host: UnifiedHost, service: MdnsServiceInfo): void => {
	const exists = host.mdnsServices.some(
		(s) => s.instanceName === service.instanceName && s.serviceType === service.serviceType
	);
	if (!exists) host.mdnsServices.push(service);
};

/** Merge scalar metadata fields from source into target (target wins if non-null) */
const mergeScalarMetadata = (host: UnifiedHost, metadata: HostMetadata): void => {
	if (!host.netbiosName && metadata.netbiosName) host.netbiosName = metadata.netbiosName;
	if (!host.macAddress && metadata.macAddress) host.macAddress = metadata.macAddress;
	if (!host.vendor && metadata.vendor) host.vendor = metadata.vendor;
	if (!host.wsDiscovery && metadata.wsDiscovery) host.wsDiscovery = metadata.wsDiscovery;
	if (!host.snmpInfo && metadata.snmpInfo) host.snmpInfo = metadata.snmpInfo;
	if (metadata.tlsNames && metadata.tlsNames.length > 0) {
		for (const name of metadata.tlsNames) {
			if (!host.tlsNames.includes(name)) host.tlsNames.push(name);
		}
	}
};

/** Merge SSDP device info (field-level merge, preferring existing non-null values) */
const mergeSsdpDevice = (host: UnifiedHost, ssdpDevice: SsdpDeviceInfo): void => {
	if (!host.ssdpDevice) {
		host.ssdpDevice = ssdpDevice;
		return;
	}
	host.ssdpDevice = {
		friendlyName: host.ssdpDevice.friendlyName ?? ssdpDevice.friendlyName,
		manufacturer: host.ssdpDevice.manufacturer ?? ssdpDevice.manufacturer,
		modelName: host.ssdpDevice.modelName ?? ssdpDevice.modelName,
		modelNumber: host.ssdpDevice.modelNumber ?? ssdpDevice.modelNumber,
		deviceType: host.ssdpDevice.deviceType ?? ssdpDevice.deviceType,
		location: host.ssdpDevice.location ?? ssdpDevice.location,
		server: host.ssdpDevice.server ?? ssdpDevice.server,
	};
};

/** Apply non-hostname metadata fields onto a UnifiedHost. */
const applyMetadata = (host: UnifiedHost, metadata: HostMetadata): void => {
	mergeScalarMetadata(host, metadata);
	if (metadata.ssdpDevice) mergeSsdpDevice(host, metadata.ssdpDevice);
	if (metadata.mdnsServices) {
		for (const service of metadata.mdnsServices) addMdnsServiceIfNew(host, service);
	}
};

/** Merge a single port into host's port list, preferring open state. */
const mergePort = (host: UnifiedHost, port: PortInfo): void => {
	const existingIdx = host.ports.findIndex((p) => p.port === port.port);
	if (existingIdx === -1) {
		host.ports.push(port);
		return;
	}
	const existingPort = host.ports[existingIdx];
	if (existingPort && port.state === 'open' && existingPort.state !== 'open') {
		host.ports[existingIdx] = port;
	}
};

const addDiscoveryToHost = (host: UnifiedHost, result: DiscoveryResult): void => {
	if (!host.discoveryMethods.includes(result.method)) {
		host.discoveryMethods.push(result.method);
	}
	const hasDiscovery = host.discoveries.some(
		(d) => d.method === result.method && d.durationMs === result.durationMs
	);
	if (hasDiscovery) return;
	host.discoveries.push({
		method: result.method,
		durationMs: result.durationMs,
		error: result.error,
	});
};

/**
 * Collect per-IP observations from discovery and scan inputs. This is the
 * "signal gathering" pass: every IP gets one IpObservation, with hostnames,
 * MACs, raw metadata, discoveries and ports attached in input order.
 */
const collectObservations = (
	discoveryResults: readonly DiscoveryResult[],
	scanHosts: readonly HostResult[]
): Map<string, IpObservation> => {
	const observations = new Map<string, IpObservation>();

	for (const result of discoveryResults) {
		for (const ip of result.hosts) {
			const observation = getOrCreateObservation(observations, ip);
			observation.discoveries.push(result);
			const metadata = result.hostMetadata?.[ip];
			const hostnamesMapEntry = result.hostnames?.[ip];
			// Top-level hostnames map has no explicit source — attribute it to
			// the discovery method that reported it.
			recordHostname(observation, hostnamesMapEntry, result.method);
			if (metadata) {
				observation.metadatas.push(metadata);
				recordHostname(observation, metadata.hostname, metadata.hostnameSource);
				// NetBIOS name lives on metadata.netbiosName, not metadata.hostname.
				// Treat it as a separate hostname signal for merging purposes.
				recordHostname(observation, metadata.netbiosName, 'netbios');
				recordMac(observation, metadata.macAddress);
			}
		}
	}

	for (const scanHost of scanHosts) {
		const observation = getOrCreateObservation(observations, scanHost.ip);
		recordHostname(observation, scanHost.hostname, null);
		for (const port of scanHost.ports) observation.ports.push(port);
		observation.scanDurationMs += scanHost.scanDurationMs ?? 0;
	}

	return observations;
};

/** Build the Union-Find by linking IPs that share any normalized signal. */
const buildDisjointSet = (observations: ReadonlyMap<string, IpObservation>): DisjointSet => {
	const dsu = new DisjointSet();
	for (const ip of observations.keys()) dsu.add(ip);

	// Signal → first IP that emitted it; subsequent IPs union with that anchor.
	const signalToIp = new Map<string, string>();
	const linkSignal = (signal: string, ip: string): void => {
		const anchor = signalToIp.get(signal);
		if (anchor === undefined) {
			signalToIp.set(signal, ip);
			return;
		}
		dsu.union(anchor, ip);
	};

	for (const [ip, observation] of observations) {
		for (const mac of observation.macs) linkSignal(`mac:${mac}`, ip);
		for (const entry of observation.hostnames) {
			const normalized = normalizeHostname(entry.value);
			if (normalized) linkSignal(`hostname:${normalized}`, ip);
		}
	}

	return dsu;
};

/**
 * Pick the best hostname for a group based on source priority. Returns the
 * original (un-normalized) hostname string and the source it came from.
 */
const selectHostname = (
	entries: readonly { value: string; source: string | null }[]
): { hostname: string | null; source: string | null } => {
	if (entries.length === 0) return { hostname: null, source: null };
	let bestRank = Number.POSITIVE_INFINITY;
	let best: { value: string; source: string | null } | null = null;
	for (const entry of entries) {
		const rank = hostnameSourceRank(entry.source);
		if (rank < bestRank) {
			bestRank = rank;
			best = entry;
		}
	}
	const fallback = best ?? entries[0] ?? null;
	return fallback
		? { hostname: fallback.value, source: fallback.source }
		: { hostname: null, source: null };
};

/** Build a single UnifiedHost from a group of merged IP observations. */
const buildUnifiedHost = (group: readonly IpObservation[]): UnifiedHost => {
	const ips = sortIps(group.map((obs) => obs.ip));
	const primaryIp = ips[0] ?? '';

	const allHostnames = group.flatMap((obs) => obs.hostnames);
	const { hostname, source } = selectHostname(allHostnames);
	const macFromObservations = group.flatMap((obs) => obs.macs)[0] ?? null;

	const host: UnifiedHost = {
		// Preserve historical id shape (`host:<lowercased hostname>` or `ip:<ip>`)
		// so external callers that key off `id` continue to work.
		id: getMergeKey(primaryIp, hostname),
		ips,
		hostname,
		hostnameSource: source,
		netbiosName: null,
		macAddress: macFromObservations,
		vendor: null,
		mdnsServices: [],
		ssdpDevice: null,
		wsDiscovery: null,
		snmpInfo: null,
		tlsNames: [],
		discoveryMethods: [],
		discoveries: [],
		ports: [],
		scanDurationMs: null,
	};

	for (const observation of group) {
		for (const metadata of observation.metadatas) applyMetadata(host, metadata);
		for (const discovery of observation.discoveries) addDiscoveryToHost(host, discovery);
		for (const port of observation.ports) mergePort(host, port);
		if (observation.scanDurationMs > 0) {
			host.scanDurationMs = (host.scanDurationMs ?? 0) + observation.scanDurationMs;
		}
	}

	host.ports.sort((a, b) => a.port - b.port);
	return host;
};

/**
 * Merge discovery and scan results into a unified host list.
 *
 * Uses Union-Find over per-IP identity signals (IP itself, normalized MAC,
 * and normalized hostname) so that two records describing the same physical
 * host get merged regardless of which discovery method first reported them.
 * This addresses the v4-from-ARP / v6-from-mDNS split case in particular.
 */
export const mergeHosts = (
	discoveryResults: readonly DiscoveryResult[],
	scanHosts: readonly HostResult[]
): UnifiedHost[] => {
	const observations = collectObservations(discoveryResults, scanHosts);
	if (observations.size === 0) return [];

	const dsu = buildDisjointSet(observations);

	const groups = new Map<string, IpObservation[]>();
	for (const [ip, observation] of observations) {
		const root = dsu.find(ip);
		const bucket = groups.get(root) ?? [];
		bucket.push(observation);
		groups.set(root, bucket);
	}

	return [...groups.values()].map(buildUnifiedHost).sort(compareByIp);
};

// =============================================================================
// Export Helpers
// =============================================================================

/**
 * Export scan results to JSON.
 */
export const exportToJson = (results: ScanResults): string => JSON.stringify(results, null, 2);

/**
 * Export scan results to CSV.
 */
export const exportToCsv = (results: ScanResults): string => {
	const headers = ['IP', 'Hostname', 'Port', 'State', 'Service', 'Banner'];
	const rows = results.hosts.flatMap((host) =>
		host.ports.map((port) =>
			[
				host.ip,
				host.hostname ?? '',
				port.port.toString(),
				port.state,
				port.service ?? '',
				port.banner?.replace(/"/g, '""') ?? '',
			]
				.map((cell) => `"${cell}"`)
				.join(',')
		)
	);

	return [headers.join(','), ...rows].join('\n');
};

/**
 * Format duration in human-readable format.
 */
export const formatDuration = (ms: number): string => {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	const minutes = Math.floor(ms / 60000);
	const seconds = Math.floor((ms % 60000) / 1000);
	return `${minutes}m ${seconds}s`;
};
