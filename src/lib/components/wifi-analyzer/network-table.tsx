/**
 * Wi-Fi network table — sortable, vendor-badged, RSSI-bar rows that
 * mirror the chart selection state.
 *
 * The table is fully keyboard-navigable: each row is a focusable
 * button-style cell that flips the hovered BSSID on focus, so the
 * chart curve highlight stays in sync without requiring a mouse.
 */
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Badge } from '@/lib/components/ui/badge';
import { cn } from '@/lib/utils';
import {
	type RssiBars,
	type WifiBand,
	type WifiNetwork,
	bandLabel,
	bssidColor,
	displaySsid,
	rssiToBars,
	securityLabel,
} from '@/lib/services/wifi';

export type SortKey = 'rssi' | 'ssid' | 'channel' | 'band' | 'security' | 'vendor';
export type SortDirection = 'asc' | 'desc';

interface WifiNetworkTableProps {
	readonly networks: readonly WifiNetwork[];
	readonly sortKey: SortKey;
	readonly sortDirection: SortDirection;
	readonly onSortChange: (key: SortKey) => void;
	readonly hoveredBssid: string | null;
	readonly onHover: (bssid: string | null) => void;
}

export function WifiNetworkTable({
	networks,
	sortKey,
	sortDirection,
	onSortChange,
	hoveredBssid,
	onHover,
}: WifiNetworkTableProps) {
	const sorted = sortNetworks(networks, sortKey, sortDirection);

	return (
		<div className="h-full overflow-auto">
			<table className="w-full text-sm">
				<thead className="sticky top-0 z-10 bg-background text-xs uppercase text-muted-foreground shadow-sm">
					<tr>
						<HeaderCell
							label="SSID"
							sortKey="ssid"
							currentKey={sortKey}
							direction={sortDirection}
							onSort={onSortChange}
						/>
						<HeaderCell
							label="BSSID"
							sortKey="vendor"
							currentKey={sortKey}
							direction={sortDirection}
							onSort={onSortChange}
						/>
						<HeaderCell
							label="Channel"
							sortKey="channel"
							currentKey={sortKey}
							direction={sortDirection}
							onSort={onSortChange}
						/>
						<HeaderCell
							label="Band"
							sortKey="band"
							currentKey={sortKey}
							direction={sortDirection}
							onSort={onSortChange}
						/>
						<HeaderCell
							label="Signal"
							sortKey="rssi"
							currentKey={sortKey}
							direction={sortDirection}
							onSort={onSortChange}
						/>
						<HeaderCell
							label="Security"
							sortKey="security"
							currentKey={sortKey}
							direction={sortDirection}
							onSort={onSortChange}
						/>
					</tr>
				</thead>
				<tbody>
					{sorted.map((network) => (
						<NetworkRow
							key={network.bssid}
							network={network}
							hovered={hoveredBssid === network.bssid}
							onHover={onHover}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}

interface HeaderCellProps {
	readonly label: string;
	readonly sortKey: SortKey;
	readonly currentKey: SortKey;
	readonly direction: SortDirection;
	readonly onSort: (key: SortKey) => void;
}

function HeaderCell({ label, sortKey, currentKey, direction, onSort }: HeaderCellProps) {
	const isActive = sortKey === currentKey;
	return (
		<th className="border-b border-border/40 px-3 py-2 text-left">
			<button
				type="button"
				className={cn(
					'inline-flex items-center gap-1 transition-colors',
					isActive ? 'text-foreground' : 'hover:text-foreground'
				)}
				onClick={() => onSort(sortKey)}
				aria-pressed={isActive}
			>
				{label}
				{isActive ? (
					direction === 'asc' ? (
						<ChevronUp className="h-3 w-3" />
					) : (
						<ChevronDown className="h-3 w-3" />
					)
				) : null}
			</button>
		</th>
	);
}

interface NetworkRowProps {
	readonly network: WifiNetwork;
	readonly hovered: boolean;
	readonly onHover: (bssid: string | null) => void;
}

function NetworkRow({ network, hovered, onHover }: NetworkRowProps) {
	const swatchColor = bssidColor(network.bssid);
	return (
		<tr
			className={cn(
				'border-b border-border/20 transition-colors',
				hovered ? 'bg-accent/30' : network.isConnected ? 'bg-info/10' : 'hover:bg-accent/10'
			)}
			onMouseEnter={() => onHover(network.bssid)}
			onMouseLeave={() => onHover(null)}
			onFocus={() => onHover(network.bssid)}
			onBlur={() => onHover(null)}
			tabIndex={0}
		>
			<td className="px-3 py-2">
				<div className="flex items-center gap-2">
					<span
						className="inline-block h-3 w-3 shrink-0 rounded-sm"
						style={{ backgroundColor: swatchColor }}
						aria-hidden
					/>
					<span className={cn('truncate', !network.ssid && 'italic text-muted-foreground')}>
						{displaySsid(network)}
					</span>
					{network.isConnected ? (
						<Badge variant="outline" className="border-info text-info">
							Connected
						</Badge>
					) : null}
				</div>
			</td>
			<td className="px-3 py-2 font-mono text-xs">
				<div className="flex flex-col gap-0.5">
					<span>{network.bssid}</span>
					{network.vendor ? <span className="text-muted-foreground">{network.vendor}</span> : null}
				</div>
			</td>
			<td className="px-3 py-2 tabular-nums">
				{network.channel}
				<span className="ml-1 text-xs text-muted-foreground">({network.channelWidthMhz} MHz)</span>
			</td>
			<td className="px-3 py-2 text-muted-foreground">{bandLabel(network.band)}</td>
			<td className="px-3 py-2 tabular-nums">
				<div className="flex items-center gap-2">
					<RssiBarsIndicator bars={rssiToBars(network.rssiDbm)} />
					<span>{network.rssiDbm} dBm</span>
				</div>
			</td>
			<td className="px-3 py-2 text-muted-foreground">{securityLabel(network.security)}</td>
		</tr>
	);
}

const BAR_HEIGHTS: Record<RssiBars, number> = {
	weak: 1,
	fair: 2,
	good: 3,
	excellent: 4,
};

const BAR_TONE: Record<RssiBars, string> = {
	weak: 'bg-destructive/70',
	fair: 'bg-warning/70',
	good: 'bg-info/70',
	excellent: 'bg-success',
};

function RssiBarsIndicator({ bars }: { readonly bars: RssiBars }) {
	const filledCount = BAR_HEIGHTS[bars];
	const tone = BAR_TONE[bars];
	return (
		<div
			className="flex items-end gap-0.5"
			role="img"
			aria-label={`Signal strength: ${bars}`}
			title={`Signal strength: ${bars}`}
		>
			{[1, 2, 3, 4].map((idx) => (
				<span
					key={idx}
					className={cn(
						'w-1 rounded-sm transition-colors',
						idx <= filledCount ? tone : 'bg-border/60',
						idx === 1 && 'h-1.5',
						idx === 2 && 'h-2',
						idx === 3 && 'h-2.5',
						idx === 4 && 'h-3'
					)}
				/>
			))}
		</div>
	);
}

function sortNetworks(
	networks: readonly WifiNetwork[],
	key: SortKey,
	direction: SortDirection
): readonly WifiNetwork[] {
	const dir = direction === 'asc' ? 1 : -1;
	return [...networks].sort((a, b) => {
		const cmp = compareByKey(a, b, key);
		return cmp * dir;
	});
}

function compareByKey(a: WifiNetwork, b: WifiNetwork, key: SortKey): number {
	switch (key) {
		case 'rssi':
			return a.rssiDbm - b.rssiDbm;
		case 'ssid':
			return (a.ssid ?? '').localeCompare(b.ssid ?? '');
		case 'channel':
			return a.channel - b.channel;
		case 'band':
			return compareBand(a.band, b.band);
		case 'security':
			return a.security.localeCompare(b.security);
		case 'vendor':
			return (a.vendor ?? '').localeCompare(b.vendor ?? '');
		default:
			return 0;
	}
}

const BAND_ORDER: Record<WifiBand, number> = {
	band24: 0,
	band5: 1,
	band6: 2,
};

function compareBand(a: WifiBand, b: WifiBand): number {
	return BAND_ORDER[a] - BAND_ORDER[b];
}
