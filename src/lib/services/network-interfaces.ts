/**
 * Network interface information service.
 *
 * Provides comprehensive network interface data via the netdev crate.
 */

import { invoke } from '@tauri-apps/api/core';

// =============================================================================
// Types
// =============================================================================

export interface Ipv4AddressInfo {
	readonly address: string;
	readonly prefixLen: number;
	readonly network: string;
}

export interface Ipv6AddressInfo {
	readonly address: string;
	readonly prefixLen: number;
	readonly scopeId: number;
}

export interface GatewayInfo {
	readonly macAddress: string | null;
	readonly ipv4Addresses: readonly string[];
	readonly ipv6Addresses: readonly string[];
}

export interface DetailedNetworkInterface {
	readonly index: number;
	readonly name: string;
	readonly friendlyName: string | null;
	readonly description: string | null;
	readonly interfaceType: string;
	readonly macAddress: string | null;
	readonly ipv4Addresses: readonly Ipv4AddressInfo[];
	readonly ipv6Addresses: readonly Ipv6AddressInfo[];
	readonly mtu: number | null;
	readonly isUp: boolean;
	readonly isRunning: boolean;
	readonly isLoopback: boolean;
	readonly isBroadcast: boolean;
	readonly isMulticast: boolean;
	readonly isPointToPoint: boolean;
	readonly isPhysical: boolean;
	readonly isDefault: boolean;
	readonly operState: string;
	readonly transmitSpeedBps: number | null;
	readonly receiveSpeedBps: number | null;
	readonly rxBytes: number | null;
	readonly txBytes: number | null;
	readonly gateway: GatewayInfo | null;
	readonly dnsServers: readonly string[];
}

// =============================================================================
// API
// =============================================================================

export const getDetailedNetworkInterfaces = (): Promise<DetailedNetworkInterface[]> =>
	invoke<DetailedNetworkInterface[]>('get_detailed_network_interfaces');

// =============================================================================
// Formatting Utilities
// =============================================================================

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/** Format byte count to human-readable string (e.g., "1.23 GB") */
export const formatBytes = (bytes: number): string => {
	if (bytes === 0) return '0 B';
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const idx = Math.min(i, BYTE_UNITS.length - 1);
	const value = bytes / 1024 ** idx;
	return `${value < 10 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : Math.round(value)} ${BYTE_UNITS[idx]}`;
};

const SPEED_UNITS = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'] as const;

/** Format speed in bps to human-readable string (e.g., "866 Mbps") */
export const formatSpeed = (bps: number): string => {
	if (bps === 0) return '0 bps';
	const i = Math.floor(Math.log(bps) / Math.log(1000));
	const idx = Math.min(i, SPEED_UNITS.length - 1);
	const value = bps / 1000 ** idx;
	return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${SPEED_UNITS[idx]}`;
};

// =============================================================================
// IPv6 Address Classification
// =============================================================================

/** Classify an IPv6 address type for display */
export const classifyIpv6Address = (address: string): string => {
	const lower = address.toLowerCase();
	if (lower.startsWith('fe80:')) return 'Link-Local';
	if (lower.startsWith('::1')) return 'Loopback';
	if (lower.startsWith('fc') || lower.startsWith('fd')) return 'ULA';
	if (lower.startsWith('ff')) return 'Multicast';
	if (lower === '::') return 'Unspecified';
	return 'Global';
};

/** Build a scope ID → interface name lookup map */
export const buildScopeIdMap = (
	interfaces: readonly DetailedNetworkInterface[]
): ReadonlyMap<number, string> => new Map(interfaces.map((iface) => [iface.index, iface.name]));

// =============================================================================
// Sorting & Filtering
// =============================================================================

export type SortField = 'name' | 'status' | 'type' | 'index';

export const sortInterfaces = (
	interfaces: readonly DetailedNetworkInterface[],
	field: SortField
): DetailedNetworkInterface[] => {
	const sorted = [...interfaces];
	switch (field) {
		case 'name':
			return sorted.sort((a, b) => a.name.localeCompare(b.name));
		case 'status':
			return sorted.sort((a, b) => {
				if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
				if (a.isUp !== b.isUp) return a.isUp ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
		case 'type':
			return sorted.sort((a, b) => a.interfaceType.localeCompare(b.interfaceType));
		case 'index':
			return sorted.sort((a, b) => a.index - b.index);
	}
};

export interface FilterOptions {
	readonly showActive: boolean;
	readonly showInactive: boolean;
	readonly showLoopback: boolean;
}

export const filterInterfaces = (
	interfaces: readonly DetailedNetworkInterface[],
	filters: FilterOptions
): DetailedNetworkInterface[] =>
	interfaces.filter((iface) => {
		if (iface.isLoopback) return filters.showLoopback;
		return iface.isUp ? filters.showActive : filters.showInactive;
	});
