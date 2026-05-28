/**
 * Wi-Fi Analyzer service.
 *
 * Wraps the `start_wifi_scan` and `cancel_wifi_scan` Tauri commands
 * defined in `src-tauri/src/network/wifi/mod.rs`. The Rust side
 * dispatches to platform-native scanners (CoreWLAN on macOS,
 * NetworkManager DBus on Linux, WlanAPI on Windows). All scanning is
 * privilege-free; macOS prompts the user for Location Services on
 * first use.
 *
 * The frontend can either await the scan result directly (the
 * `WifiNetwork[]` resolved value of `startWifiScan`) or subscribe to
 * the `Channel<WifiScanEvent>` stream for incremental UI updates.
 */
import { type Channel, invoke } from '@tauri-apps/api/core';

// =============================================================================
// Types — keep aligned with src-tauri/src/network/wifi/types.rs
// =============================================================================

export type WifiBand = 'band24' | 'band5' | 'band6';

export type WifiSecurity =
	| 'open'
	| 'wep'
	| 'wpa'
	| 'wpa2'
	| 'wpa3'
	| 'wpa2Enterprise'
	| 'wpa3Enterprise'
	| 'unknown';

export interface WifiNetwork {
	readonly bssid: string;
	readonly ssid: string | null;
	readonly rssiDbm: number;
	readonly channel: number;
	readonly channelWidthMhz: number;
	readonly band: WifiBand;
	readonly security: WifiSecurity;
	readonly vendor: string | null;
	readonly isConnected: boolean;
}

export type WifiScanEvent =
	| { event: 'started'; data: null }
	| { event: 'networkFound'; data: { network: WifiNetwork } }
	| { event: 'completed'; data: { count: number } }
	| { event: 'cancelled'; data: null }
	| { event: 'error'; data: { message: string } };

// =============================================================================
// Commands
// =============================================================================

export const startWifiScan = (
	scanId: string,
	onEvent: Channel<WifiScanEvent>
): Promise<readonly WifiNetwork[]> => invoke<WifiNetwork[]>('start_wifi_scan', { scanId, onEvent });

export const cancelWifiScan = (scanId: string): Promise<boolean> =>
	invoke<boolean>('cancel_wifi_scan', { scanId });

// =============================================================================
// Channel axis tick values — used by both the chart and the band selector
// =============================================================================

/** Channel numbers visible on the 2.4 GHz X axis. Channel 14 is JP-only. */
export const BAND_CHANNELS_24: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/**
 * Standard primary 20 MHz channels on the 5 GHz band per IEEE
 * 802.11-2020 and the FCC / ETSI Wi-Fi allocations.
 */
export const BAND_CHANNELS_5: readonly number[] = [
	36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149,
	153, 157, 161, 165,
];

/**
 * Primary 6 GHz channels stepped every 16 numbers so X-axis labels stay
 * legible. The underlying scale still spans channel 1–233 so APs can
 * land at any primary.
 */
export const BAND_CHANNELS_6: readonly number[] = [
	1, 17, 33, 49, 65, 81, 97, 113, 129, 145, 161, 177, 193, 209, 225, 233,
];

/** Domain bounds used by the chart's X scale per band. */
export const BAND_X_DOMAIN: Record<WifiBand, readonly [number, number]> = {
	band24: [0.5, 14.5],
	band5: [34, 167],
	band6: [0, 234],
};

/** Domain bounds used by the chart's Y axis (RSSI in dBm). */
export const RSSI_DOMAIN: readonly [number, number] = [-100, -30];

/** Y-axis tick marks in dBm, top to bottom. */
export const RSSI_TICKS: readonly number[] = [-30, -40, -50, -60, -70, -80, -90, -100];

/**
 * Baseline value where the AP bell curve touches zero on the Y axis.
 * Slightly below the minimum tick so the curve visually closes.
 */
export const BASELINE_DBM = -95;

// =============================================================================
// Pure helpers
// =============================================================================

/**
 * Bucket an RSSI value into a four-tier strength label so the table can
 * render a uniform signal-strength badge across rows.
 */
export type RssiBars = 'excellent' | 'good' | 'fair' | 'weak';
export const rssiToBars = (rssiDbm: number): RssiBars => {
	if (rssiDbm >= -50) return 'excellent';
	if (rssiDbm >= -65) return 'good';
	if (rssiDbm >= -75) return 'fair';
	return 'weak';
};

/**
 * Deterministic HSL color for a BSSID so the same access point keeps
 * the same color across rescans. The hash uses every byte of the MAC
 * so neighboring BSSIDs (sequential vendor allocations) still resolve
 * to visibly different hues.
 */
export const bssidColor = (bssid: string): string => {
	let hash = 0;
	for (const ch of bssid) {
		hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	}
	const hue = hash % 360;
	return `hsl(${hue} 65% 55%)`;
};

const SECURITY_LABEL: Record<WifiSecurity, string> = {
	open: 'Open',
	wep: 'WEP',
	wpa: 'WPA',
	wpa2: 'WPA2',
	wpa3: 'WPA3',
	wpa2Enterprise: 'WPA2-Enterprise',
	wpa3Enterprise: 'WPA3-Enterprise',
	unknown: 'Unknown',
};

/** Human-readable security suite label for table / tooltip display. */
export const securityLabel = (security: WifiSecurity): string => SECURITY_LABEL[security];

const BAND_LABEL: Record<WifiBand, string> = {
	band24: '2.4 GHz',
	band5: '5 GHz',
	band6: '6 GHz',
};

/** Human-readable band label. */
export const bandLabel = (band: WifiBand): string => BAND_LABEL[band];

/** Format an SSID for display, falling back to a `<vendor> (hidden)` label. */
export const displaySsid = (network: WifiNetwork): string => {
	if (network.ssid && network.ssid.length > 0) return network.ssid;
	if (network.vendor) return `${network.vendor} (hidden)`;
	return '(hidden)';
};
