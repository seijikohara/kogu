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

export interface PortInfo {
	readonly port: number;
	readonly state: PortState;
	readonly service?: string;
	readonly banner?: string;
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
