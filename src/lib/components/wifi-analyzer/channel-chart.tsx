/**
 * Wi-Fi channel occupancy chart.
 *
 * Renders each detected access point as a quadratic Bezier bell curve
 * peaked at its RSSI on its center channel and spread across the
 * channel width. Built on visx primitives so the X / Y scales and axes
 * stay correct under band switches and panel resizes.
 */
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { scaleLinear } from '@visx/scale';

import {
	BAND_CHANNELS_24,
	BAND_CHANNELS_5,
	BAND_CHANNELS_6,
	BAND_X_DOMAIN,
	BASELINE_DBM,
	RSSI_DOMAIN,
	RSSI_TICKS,
	type WifiBand,
	type WifiNetwork,
	bssidColor,
	displaySsid,
} from '@/lib/services/wifi';

interface WifiChannelChartProps {
	readonly networks: readonly WifiNetwork[];
	readonly band: WifiBand;
	readonly hoveredBssid: string | null;
	readonly onHover?: (bssid: string | null) => void;
}

const MARGIN = { top: 16, right: 16, bottom: 32, left: 56 } as const;

export function WifiChannelChart({ networks, band, hoveredBssid, onHover }: WifiChannelChartProps) {
	return (
		<ParentSize>
			{({ width, height }) =>
				width === 0 || height === 0 ? null : (
					<ChannelChartInner
						width={width}
						height={height}
						networks={networks}
						band={band}
						hoveredBssid={hoveredBssid}
						onHover={onHover}
					/>
				)
			}
		</ParentSize>
	);
}

interface ChannelChartInnerProps extends WifiChannelChartProps {
	readonly width: number;
	readonly height: number;
}

function ChannelChartInner({
	width,
	height,
	networks,
	band,
	hoveredBssid,
	onHover,
}: ChannelChartInnerProps) {
	const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
	const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

	const xScale = scaleLinear<number>({
		domain: [...BAND_X_DOMAIN[band]],
		range: [0, innerWidth],
	});
	const yScale = scaleLinear<number>({
		domain: [...RSSI_DOMAIN],
		range: [innerHeight, 0],
	});

	const xTicks =
		band === 'band24' ? BAND_CHANNELS_24 : band === 'band5' ? BAND_CHANNELS_5 : BAND_CHANNELS_6;

	const visibleNetworks = networks.filter((n) => n.band === band);
	// Sort by RSSI descending so stronger APs render last (on top) and
	// the label-collision pass keeps stronger labels.
	const sortedByRssi = [...visibleNetworks].sort((a, b) => a.rssiDbm - b.rssiDbm);

	return (
		<svg width={width} height={height} role="img" aria-label={`Wi-Fi channel chart for ${band}`}>
			<Group left={MARGIN.left} top={MARGIN.top}>
				<GridRows
					scale={yScale}
					width={innerWidth}
					tickValues={[...RSSI_TICKS]}
					stroke="currentColor"
					strokeOpacity={0.1}
				/>
				{sortedByRssi.map((network) => (
					<ApCurve
						key={network.bssid}
						network={network}
						xScale={xScale}
						yScale={yScale}
						hovered={hoveredBssid === network.bssid}
						dimmed={hoveredBssid !== null && hoveredBssid !== network.bssid}
						onHover={onHover}
					/>
				))}
				<ApLabels
					networks={[...visibleNetworks].sort((a, b) => b.rssiDbm - a.rssiDbm)}
					xScale={xScale}
					yScale={yScale}
					hoveredBssid={hoveredBssid}
				/>
				<AxisBottom
					top={innerHeight}
					scale={xScale}
					tickValues={[...xTicks]}
					stroke="currentColor"
					tickStroke="currentColor"
					axisClassName="opacity-40"
					tickLabelProps={() => ({
						fill: 'currentColor',
						fontSize: 10,
						textAnchor: 'middle',
						dy: '0.5em',
					})}
				/>
				<AxisLeft
					scale={yScale}
					tickValues={[...RSSI_TICKS]}
					tickFormat={(v) => `${v as number} dBm`}
					stroke="currentColor"
					tickStroke="currentColor"
					axisClassName="opacity-40"
					tickLabelProps={() => ({
						fill: 'currentColor',
						fontSize: 10,
						textAnchor: 'end',
						dx: '-0.25em',
						dy: '0.32em',
					})}
				/>
			</Group>
		</svg>
	);
}

interface ApCurveProps {
	readonly network: WifiNetwork;
	readonly xScale: (v: number) => number;
	readonly yScale: (v: number) => number;
	readonly hovered: boolean;
	readonly dimmed: boolean;
	readonly onHover?: (bssid: string | null) => void;
}

function ApCurve({ network, xScale, yScale, hovered, dimmed, onHover }: ApCurveProps) {
	const halfSpanChannels = network.channelWidthMhz / 20 / 2;
	const x0 = xScale(network.channel - halfSpanChannels);
	const xc = xScale(network.channel);
	const x1 = xScale(network.channel + halfSpanChannels);
	const yBase = yScale(BASELINE_DBM);
	const yPeak = yScale(network.rssiDbm);
	// Quadratic Bezier `Q (xc, yControl) (x1, yBase)` reaches its visual
	// apex at t=0.5, where the y-coordinate is `0.5 * yBase + 0.5 *
	// yControl`. To make the curve's *visual* peak land at `yPeak`
	// (the actual RSSI), the control point must be set to
	// `2 * yPeak - yBase`. Without this compensation the peak appears
	// halfway between baseline and the intended RSSI value.
	const yControl = 2 * yPeak - yBase;
	const d = `M ${x0} ${yBase} Q ${xc} ${yControl} ${x1} ${yBase}`;
	const color = bssidColor(network.bssid);
	const fillOpacity = hovered ? 0.25 : dimmed ? 0.04 : 0.12;
	const strokeOpacity = hovered ? 1 : dimmed ? 0.3 : 0.7;
	const strokeWidth = network.isConnected ? 2.5 : 1.5;
	// Hover affordance on the chart curve is a supplementary visual hint;
	// the keyboard-navigable network table beneath the chart provides the
	// primary access path to the same data.
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: see comment above
		<path
			d={d}
			aria-label={`${network.bssid} signal curve`}
			fill={color}
			fillOpacity={fillOpacity}
			stroke={color}
			strokeOpacity={strokeOpacity}
			strokeWidth={strokeWidth}
			onMouseEnter={() => onHover?.(network.bssid)}
			onMouseLeave={() => onHover?.(null)}
			cursor="pointer"
		/>
	);
}

interface ApLabelsProps {
	readonly networks: readonly WifiNetwork[];
	readonly xScale: (v: number) => number;
	readonly yScale: (v: number) => number;
	readonly hoveredBssid: string | null;
}

/**
 * Greedy label placer. Walks the networks in RSSI-descending order
 * (strongest first) and skips labels whose anchor point falls within
 * the bounding box of an already-placed label.
 */
function ApLabels({ networks, xScale, yScale, hoveredBssid }: ApLabelsProps) {
	const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
	const labelW = 90;
	const labelH = 14;
	const elements: React.JSX.Element[] = [];
	for (const network of networks) {
		const x = xScale(network.channel);
		const y = yScale(network.rssiDbm) - 6;
		const box = { x: x - labelW / 2, y: y - labelH, w: labelW, h: labelH };
		const collides = placed.some(
			(p) => box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h && box.y + box.h > p.y
		);
		if (collides) continue;
		placed.push(box);
		const dimmed = hoveredBssid !== null && hoveredBssid !== network.bssid;
		elements.push(
			<text
				key={network.bssid}
				x={x}
				y={y}
				textAnchor="middle"
				fontSize={11}
				fill="currentColor"
				fillOpacity={dimmed ? 0.4 : 0.9}
				pointerEvents="none"
			>
				{displaySsid(network)}
			</text>
		);
	}
	return <>{elements}</>;
}
