/**
 * /wifi-analyzer route.
 *
 * Visualizes nearby Wi-Fi access points on a band-specific channel
 * chart with a placeholder table. PR 3 will replace the table with a
 * sortable network table and add hover wiring + OUI vendor display.
 */
import { createFileRoute } from '@tanstack/react-router';
import { Channel } from '@tauri-apps/api/core';
import { Loader2, Play, Square, Wifi } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ActionButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormInfo,
	FormInput,
	FormMode,
	FormSection,
	FormSlider,
} from '@/lib/components/form';
import { WifiChannelChart } from '@/lib/components/wifi-analyzer';
import { ToolShell } from '@/lib/components/shell';
import { EmptyState, ErrorDisplay, StatItem } from '@/lib/components/status';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/lib/components/ui/resizable';
import { useDocumentTitle } from '@/lib/hooks';
import {
	type WifiBand,
	type WifiNetwork,
	type WifiScanEvent,
	bandLabel,
	cancelWifiScan,
	displaySsid,
	securityLabel,
	startWifiScan,
} from '@/lib/services/wifi';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';

export const Route = createFileRoute('/wifi-analyzer')({
	component: WifiAnalyzerPage,
});

type WifiSortKey = 'rssi' | 'ssid' | 'channel';

interface WifiAnalyzerOptions {
	readonly band: WifiBand;
	readonly sort: WifiSortKey;
	readonly filter: string;
	readonly hideHidden: boolean;
	readonly highlightConnected: boolean;
	readonly autoRefreshSec: number;
}

const DEFAULT_OPTIONS: WifiAnalyzerOptions = {
	band: 'band24',
	sort: 'rssi',
	filter: '',
	hideHidden: false,
	highlightConnected: true,
	autoRefreshSec: 0,
};

const useWifiAnalyzerPrefs = createToolOptionsStore<WifiAnalyzerOptions>(
	'wifi-analyzer',
	DEFAULT_OPTIONS
);

const AUTO_REFRESH_STEPS = [0, 5, 10, 30] as const;

const BAND_OPTIONS = [
	{ value: 'band24', label: '2.4 GHz', description: 'Channels 1–14, 20 MHz primary' },
	{ value: 'band5', label: '5 GHz', description: 'Channels 36–165' },
	{ value: 'band6', label: '6 GHz', description: 'Wi-Fi 6E, channels 1–233' },
] as const;

const SORT_OPTIONS = [
	{ value: 'rssi', label: 'Signal' },
	{ value: 'ssid', label: 'SSID' },
	{ value: 'channel', label: 'Channel' },
] as const;

function WifiAnalyzerPage() {
	useDocumentTitle('Wi-Fi Analyzer');

	const { value: prefs, patch } = useWifiAnalyzerPrefs();
	const [showRail, setShowRail] = usePersistedRail('wifi-analyzer');

	const [networks, setNetworks] = useState<readonly WifiNetwork[]>([]);
	const [scanning, setScanning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [hoveredBssid, setHoveredBssid] = useState<string | null>(null);

	const scanIdRef = useRef<string | null>(null);

	const runScan = useCallback(async () => {
		if (scanning) return;
		setScanning(true);
		setError(null);
		const scanId = `wifi-${Date.now()}`;
		scanIdRef.current = scanId;
		const channel = new Channel<WifiScanEvent>();
		channel.onmessage = (event) => {
			if (event.event === 'error') {
				setError(event.data.message);
			}
		};
		try {
			const result = await startWifiScan(scanId, channel);
			setNetworks(result);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message);
		} finally {
			setScanning(false);
			scanIdRef.current = null;
		}
	}, [scanning]);

	const stopScan = useCallback(async () => {
		const id = scanIdRef.current;
		if (!id) return;
		const cancelled = await cancelWifiScan(id);
		if (cancelled) toast.message('Scan cancelled');
	}, []);

	// Auto-refresh loop. Disabled when autoRefreshSec === 0.
	useEffect(() => {
		if (prefs.autoRefreshSec <= 0 || scanning) return;
		const handle = setTimeout(() => {
			runScan().catch(() => undefined);
		}, prefs.autoRefreshSec * 1000);
		return () => clearTimeout(handle);
	}, [prefs.autoRefreshSec, scanning, networks, runScan]);

	const filtered = applyFilters(networks, prefs);

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			error={error ?? undefined}
			statusContent={
				<>
					<StatItem label="Networks" value={filtered.length.toLocaleString()} />
					<StatItem label="Band" value={bandLabel(prefs.band)} />
					{scanning ? <StatItem label="Status" value="Scanning" /> : null}
				</>
			}
			rail={
				<>
					<FormSection title="Band">
						<FormMode<WifiBand>
							layout="stacked"
							value={prefs.band}
							onValueChange={(v) => patch({ band: v })}
							options={[...BAND_OPTIONS]}
						/>
					</FormSection>

					<FormSection title="Scan">
						<div className="flex flex-col gap-2">
							<ActionButton
								label={scanning ? 'Scanning…' : 'Scan'}
								icon={scanning ? Loader2 : Play}
								loading={scanning}
								loadingLabel="Scanning…"
								onClick={() => {
									runScan().catch(() => undefined);
								}}
							/>
							{scanning ? (
								<ActionButton
									label="Cancel"
									icon={Square}
									variant="outline"
									onClick={() => {
										stopScan().catch(() => undefined);
									}}
								/>
							) : null}
							<FormSlider
								label="Auto-refresh"
								value={AUTO_REFRESH_STEPS.indexOf(
									prefs.autoRefreshSec as (typeof AUTO_REFRESH_STEPS)[number]
								)}
								min={0}
								max={AUTO_REFRESH_STEPS.length - 1}
								step={1}
								valueLabel={prefs.autoRefreshSec === 0 ? 'Off' : `${prefs.autoRefreshSec} s`}
								onValueChange={(idx) =>
									patch({
										autoRefreshSec: AUTO_REFRESH_STEPS[idx] ?? 0,
									})
								}
							/>
						</div>
					</FormSection>

					<FormSection title="Filter">
						<FormInput
							label="SSID contains"
							value={prefs.filter}
							onValueChange={(v) => patch({ filter: v })}
							placeholder="substring match"
						/>
						<FormCheckbox
							label="Hide hidden SSIDs"
							checked={prefs.hideHidden}
							onCheckedChange={(c) => patch({ hideHidden: c })}
						/>
						<FormCheckbox
							label="Highlight connected AP"
							checked={prefs.highlightConnected}
							onCheckedChange={(c) => patch({ highlightConnected: c })}
						/>
					</FormSection>

					<FormSection title="Sort">
						<FormMode<WifiSortKey>
							layout="stacked"
							value={prefs.sort}
							onValueChange={(v) => patch({ sort: v })}
							options={[...SORT_OPTIONS]}
						/>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							Reads the OS Wi-Fi cache via CoreWLAN (macOS), NetworkManager DBus (Linux), or the
							Native Wi-Fi API (Windows). No admin or root required. On macOS, the first scan asks
							for Location Services access; granting once persists across launches. Set{' '}
							<code>KOGU_WIFI_FIXTURES=1</code> in the launch environment to render a hand-crafted
							demo network list when no radio is available.
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<ResizablePanelGroup orientation="vertical" className="h-full">
				<ResizablePanel defaultSize={60} minSize={20}>
					{error ? (
						<div className="flex h-full items-center justify-center p-4">
							<ErrorDisplay title="Wi-Fi scan failed" message={error} />
						</div>
					) : filtered.length === 0 && !scanning ? (
						<div className="flex h-full items-center justify-center p-4">
							<EmptyState
								icon={Wifi}
								title="No Wi-Fi networks yet"
								description="Click Scan to detect nearby access points."
							/>
						</div>
					) : (
						<div className="h-full p-3 text-foreground">
							<WifiChannelChart
								networks={filtered}
								band={prefs.band}
								hoveredBssid={hoveredBssid}
								onHover={setHoveredBssid}
							/>
						</div>
					)}
				</ResizablePanel>
				<ResizableHandle />
				<ResizablePanel defaultSize={40} minSize={20}>
					<PlaceholderTable
						networks={filtered}
						hoveredBssid={hoveredBssid}
						onHover={setHoveredBssid}
					/>
				</ResizablePanel>
			</ResizablePanelGroup>
		</ToolShell>
	);
}

function applyFilters(
	networks: readonly WifiNetwork[],
	prefs: WifiAnalyzerOptions
): readonly WifiNetwork[] {
	const needle = prefs.filter.trim().toLowerCase();
	const filtered = networks.filter((n) => {
		if (prefs.hideHidden && !n.ssid) return false;
		if (needle.length > 0) {
			const haystack = (n.ssid ?? '').toLowerCase();
			if (!haystack.includes(needle)) return false;
		}
		return true;
	});
	return [...filtered].sort((a, b) => {
		switch (prefs.sort) {
			case 'rssi':
				return b.rssiDbm - a.rssiDbm;
			case 'ssid':
				return (a.ssid ?? '').localeCompare(b.ssid ?? '');
			case 'channel':
				return a.channel - b.channel;
			default:
				return 0;
		}
	});
}

interface PlaceholderTableProps {
	readonly networks: readonly WifiNetwork[];
	readonly hoveredBssid: string | null;
	readonly onHover: (bssid: string | null) => void;
}

/**
 * Minimal raw-HTML table so PR 2 can ship without the polished sort
 * UI. PR 3 replaces this with `WifiNetworkTable` (sortable columns,
 * vendor badges, RSSI bars).
 */
function PlaceholderTable({ networks, hoveredBssid, onHover }: PlaceholderTableProps) {
	return (
		<div className="h-full overflow-auto p-3">
			<table className="w-full text-sm">
				<thead className="text-xs uppercase text-muted-foreground">
					<tr>
						<th className="px-2 py-1 text-left">SSID</th>
						<th className="px-2 py-1 text-left">BSSID</th>
						<th className="px-2 py-1 text-left">Channel</th>
						<th className="px-2 py-1 text-left">RSSI</th>
						<th className="px-2 py-1 text-left">Security</th>
						<th className="px-2 py-1 text-left">Vendor</th>
					</tr>
				</thead>
				<tbody>
					{networks.map((n) => (
						<tr
							key={n.bssid}
							className={
								hoveredBssid === n.bssid ? 'bg-accent/30' : n.isConnected ? 'bg-info/10' : ''
							}
							onMouseEnter={() => onHover(n.bssid)}
							onMouseLeave={() => onHover(null)}
						>
							<td className="px-2 py-1">{displaySsid(n)}</td>
							<td className="px-2 py-1 font-mono text-xs">{n.bssid}</td>
							<td className="px-2 py-1">
								{n.channel}
								<span className="ml-1 text-muted-foreground">({n.channelWidthMhz} MHz)</span>
							</td>
							<td className="px-2 py-1">{n.rssiDbm} dBm</td>
							<td className="px-2 py-1">{securityLabel(n.security)}</td>
							<td className="px-2 py-1 text-muted-foreground">{n.vendor ?? '—'}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
