/**
 * Network scanner services for port scanning and host discovery.
 * These are TypeScript wrappers around Tauri backend commands.
 */

import { invoke } from '@tauri-apps/api/core';
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
	| 'icmp_ping'
	| 'arp_scan'
	| 'tcp_syn'
	| 'tcp_connect'
	| 'mdns'
	| 'ssdp'
	| 'udp_scan'
	| 'icmpv6_ping'
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

/** Host metadata collected during discovery */
export interface HostMetadata {
	/** Hostname (from mDNS, DNS reverse lookup, NetBIOS, etc.) */
	readonly hostname?: string;
	/** Source of the hostname resolution (dns, mdns, netbios) */
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
		value: 'icmp_ping' as const,
		label: 'ICMP Ping',
		description: 'Standard ping, requires elevated privileges',
		requiresPrivileges: true,
	},
	{
		value: 'arp_scan' as const,
		label: 'ARP Scan',
		description: 'Local network only, requires libpcap',
		requiresPrivileges: true,
	},
	{
		value: 'tcp_syn' as const,
		label: 'TCP SYN',
		description: 'Stealth scan, requires raw sockets',
		requiresPrivileges: true,
	},
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
		value: 'icmpv6_ping' as const,
		label: 'ICMPv6 Ping',
		description: 'IPv6 Echo Request for remote host discovery',
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
 * Start a network scan.
 */
export const startNetworkScan = async (request: ScanRequest): Promise<ScanResults> =>
	invoke<ScanResults>('start_network_scan', { request });

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

/**
 * Discover hosts using specified methods (ICMP, ARP, TCP SYN, mDNS).
 */
export const discoverHosts = async (
	targets: readonly string[],
	options: DiscoveryOptions
): Promise<readonly DiscoveryResult[]> =>
	invoke<DiscoveryResult[]>('discover_hosts', { targets: [...targets], options });

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
// Net-Scanner Privilege Management
// =============================================================================

/** Privilege status of the net-scanner sidecar */
export interface PrivilegeStatus {
	/** Whether TCP SYN scanning is available */
	readonly tcpSyn: boolean;
	/** Whether privilege setup has been completed */
	readonly setupCompleted: boolean;
	/** Whether privilege setup is available on this platform */
	readonly setupAvailable: boolean;
	/** Human-readable status message */
	readonly message: string;
}

/**
 * Check the current privilege status of the net-scanner sidecar.
 * Returns whether raw socket operations are available.
 */
export const checkNetScannerPrivileges = async (): Promise<PrivilegeStatus> =>
	invoke<PrivilegeStatus>('check_net_scanner_privileges');

/**
 * Set up persistent privileges for the net-scanner sidecar.
 * Triggers a platform-specific admin password dialog:
 * - macOS: osascript → admin dialog → chown root + chmod u+s
 * - Linux: pkexec → setcap cap_net_raw,cap_net_admin+ep
 */
export const setupNetScannerPrivileges = async (): Promise<PrivilegeStatus> =>
	invoke<PrivilegeStatus>('setup_net_scanner_privileges');

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

/**
 * Listen to discovery progress events for parallel execution.
 * Each discovery method emits 'running' when started and 'completed'/'error' when done.
 */
export const listenToDiscoveryProgress = async (
	callback: (progress: DiscoveryProgress) => void
): Promise<UnlistenFn> =>
	listen<DiscoveryProgress>('discovery-progress', (event) => {
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
	/** SSDP/UPnP device information */
	ssdpDevice: SsdpDeviceInfo | null;
	/** WS-Discovery device information */
	wsDiscovery: WsDiscoveryInfo | null;
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

/** Get merge key for a host (hostname if available, otherwise IP) */
export const getMergeKey = (ip: string, hostname: string | null): string => {
	if (hostname) return `host:${hostname.toLowerCase()}`;
	return `ip:${ip}`;
};

/** Sort IPs: IPv4 first (numerically), then IPv6 */
const sortIps = (ips: string[]): string[] => [...ips].sort(compareIpAddresses);

/** Compare hosts by their primary IP address (numerically) */
const compareByIp = (a: UnifiedHost, b: UnifiedHost): number => {
	const aIp = a.ips[0] ?? '';
	const bIp = b.ips[0] ?? '';
	return compareIpAddresses(aIp, bIp);
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
	if (!host.hostnameSource && metadata.hostnameSource)
		host.hostnameSource = metadata.hostnameSource;
	if (!host.netbiosName && metadata.netbiosName) host.netbiosName = metadata.netbiosName;
	if (!host.macAddress && metadata.macAddress) host.macAddress = metadata.macAddress;
	if (!host.vendor && metadata.vendor) host.vendor = metadata.vendor;
	if (!host.wsDiscovery && metadata.wsDiscovery) host.wsDiscovery = metadata.wsDiscovery;
};

/** Merge SSDP device info (field-level merge, preferring existing non-null values) */
const mergeSsdpDevice = (host: UnifiedHost, ssdpDevice: SsdpDeviceInfo): void => {
	if (!host.ssdpDevice) {
		host.ssdpDevice = ssdpDevice;
	} else {
		host.ssdpDevice = {
			friendlyName: host.ssdpDevice.friendlyName ?? ssdpDevice.friendlyName,
			manufacturer: host.ssdpDevice.manufacturer ?? ssdpDevice.manufacturer,
			modelName: host.ssdpDevice.modelName ?? ssdpDevice.modelName,
			modelNumber: host.ssdpDevice.modelNumber ?? ssdpDevice.modelNumber,
			deviceType: host.ssdpDevice.deviceType ?? ssdpDevice.deviceType,
			location: host.ssdpDevice.location ?? ssdpDevice.location,
			server: host.ssdpDevice.server ?? ssdpDevice.server,
		};
	}
};

/** Apply all metadata fields from HostMetadata to a UnifiedHost */
const applyMetadata = (host: UnifiedHost, metadata: HostMetadata | undefined): void => {
	if (!metadata) return;
	mergeScalarMetadata(host, metadata);
	if (metadata.ssdpDevice) mergeSsdpDevice(host, metadata.ssdpDevice);
	if (metadata.mdnsServices) {
		for (const service of metadata.mdnsServices) addMdnsServiceIfNew(host, service);
	}
};

/** Absorb all data from source host into target, then delete source from maps */
const absorbHost = (
	target: UnifiedHost,
	source: UnifiedHost,
	hostMap: Map<string, UnifiedHost>,
	ipToKey: Map<string, string>,
	targetKey: string
): void => {
	for (const ip of source.ips) {
		if (!target.ips.includes(ip)) target.ips.push(ip);
		ipToKey.set(ip, targetKey);
	}
	target.ips = sortIps(target.ips);
	for (const method of source.discoveryMethods) {
		if (!target.discoveryMethods.includes(method)) target.discoveryMethods.push(method);
	}
	for (const discovery of source.discoveries) target.discoveries.push(discovery);
	if (!target.macAddress && source.macAddress) target.macAddress = source.macAddress;
	if (!target.vendor && source.vendor) target.vendor = source.vendor;
	if (!target.netbiosName && source.netbiosName) target.netbiosName = source.netbiosName;
	if (!target.ssdpDevice && source.ssdpDevice) target.ssdpDevice = source.ssdpDevice;
	if (!target.wsDiscovery && source.wsDiscovery) target.wsDiscovery = source.wsDiscovery;
	for (const service of source.mdnsServices) addMdnsServiceIfNew(target, service);
	hostMap.delete(source.id);
};

/** Handle hostname update for an existing host, potentially re-keying or merging */
const handleHostnameUpdate = (
	host: UnifiedHost,
	ip: string,
	hostname: string,
	metadata: HostMetadata | undefined,
	hostMap: Map<string, UnifiedHost>,
	ipToKey: Map<string, string>
): UnifiedHost => {
	host.hostname = hostname;
	host.hostnameSource = metadata?.hostnameSource ?? null;
	const newKey = getMergeKey(ip, hostname);
	if (newKey === host.id) return host;

	const existingHostAtNewKey = hostMap.get(newKey);
	if (existingHostAtNewKey && existingHostAtNewKey !== host) {
		absorbHost(existingHostAtNewKey, host, hostMap, ipToKey, newKey);
		return existingHostAtNewKey;
	}
	// Re-key the host
	hostMap.delete(host.id);
	host.id = newKey;
	hostMap.set(newKey, host);
	for (const hostIp of host.ips) ipToKey.set(hostIp, newKey);
	return host;
};

/** Create a new UnifiedHost */
const createHost = (
	key: string,
	ip: string,
	hostname: string | null,
	metadata: HostMetadata | undefined
): UnifiedHost => ({
	id: key,
	ips: [ip],
	hostname: hostname ?? metadata?.hostname ?? null,
	hostnameSource: metadata?.hostnameSource ?? null,
	netbiosName: metadata?.netbiosName ?? null,
	macAddress: metadata?.macAddress ?? null,
	vendor: metadata?.vendor ?? null,
	mdnsServices: metadata?.mdnsServices ? [...metadata.mdnsServices] : [],
	ssdpDevice: metadata?.ssdpDevice ?? null,
	wsDiscovery: metadata?.wsDiscovery ?? null,
	discoveryMethods: [],
	discoveries: [],
	ports: [],
	scanDurationMs: null,
});

/**
 * Merge discovery and scan results into a unified host list.
 * Uses O(n) algorithm with IP-to-key index for fast lookups.
 */
export const mergeHosts = (
	discoveryResults: readonly DiscoveryResult[],
	scanHosts: readonly HostResult[]
): UnifiedHost[] => {
	const hostMap = new Map<string, UnifiedHost>();
	const ipToKey = new Map<string, string>();

	const getOrCreateHost = (
		ip: string,
		hostname: string | null,
		metadata?: HostMetadata
	): UnifiedHost => {
		// Check if IP already indexed
		const existingKey = ipToKey.get(ip);
		if (existingKey) {
			const host = hostMap.get(existingKey);
			if (host) {
				const result =
					hostname && !host.hostname
						? handleHostnameUpdate(host, ip, hostname, metadata, hostMap, ipToKey)
						: host;
				applyMetadata(result, metadata);
				return result;
			}
		}

		// Check if hostname matches an existing host
		if (hostname) {
			const hostnameKey = getMergeKey(ip, hostname);
			const hostByHostname = hostMap.get(hostnameKey);
			if (hostByHostname) {
				if (!hostByHostname.ips.includes(ip)) {
					hostByHostname.ips.push(ip);
					hostByHostname.ips = sortIps(hostByHostname.ips);
					ipToKey.set(ip, hostnameKey);
				}
				return hostByHostname;
			}
		}

		// Create new host
		const key = getMergeKey(ip, hostname);
		const host = createHost(key, ip, hostname, metadata);
		hostMap.set(key, host);
		ipToKey.set(ip, key);
		return host;
	};

	// 1. Add hosts from discovery results
	for (const result of discoveryResults) {
		for (const ip of result.hosts) {
			const host = getOrCreateHost(ip, result.hostnames[ip] ?? null, result.hostMetadata?.[ip]);
			if (!host.discoveryMethods.includes(result.method)) host.discoveryMethods.push(result.method);
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
	for (const scanHost of scanHosts) {
		const host = getOrCreateHost(scanHost.ip, scanHost.hostname ?? null);
		for (const port of scanHost.ports) {
			const existingIdx = host.ports.findIndex((p) => p.port === port.port);
			if (existingIdx === -1) {
				host.ports.push(port);
			} else {
				const existingPort = host.ports[existingIdx];
				if (existingPort && port.state === 'open' && existingPort.state !== 'open') {
					host.ports[existingIdx] = port;
				}
			}
		}
		host.ports.sort((a, b) => a.port - b.port);
		if (scanHost.scanDurationMs)
			host.scanDurationMs = (host.scanDurationMs ?? 0) + scanHost.scanDurationMs;
	}

	return [...hostMap.values()].sort(compareByIp);
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
