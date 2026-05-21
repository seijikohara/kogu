import {
	Camera,
	CheckCircle2,
	CircleDot,
	Cpu,
	HardDrive,
	Laptop,
	Monitor,
	Printer,
	Radar,
	Radio,
	Router,
	Server,
	Smartphone,
	Speaker,
	Tablet,
	Tv,
	Wifi,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import { ListItemButton } from '@/lib/components/ui/list-item-button';
import type { DeviceCategory } from '@/lib/services/device-classifier';
import { cn } from '@/lib/utils';

interface UnifiedHostListItemProps {
	readonly hostId: string;
	readonly ips: readonly string[];
	readonly hostname: string | null;
	readonly hostnameSource?: string | null;
	readonly macAddress?: string | null;
	readonly vendor: string | null;
	readonly openPortCount: number;
	readonly discoveryMethodCount: number;
	readonly mdnsServiceCount: number;
	readonly selected: boolean;
	readonly isNew?: boolean;
	readonly deviceCategory?: DeviceCategory;
	readonly hasPortScan?: boolean;
	readonly onClick: () => void;
}

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

const isIPv6 = (ip: string): boolean => ip.includes(':');

export function UnifiedHostListItem({
	hostId,
	ips,
	hostname,
	hostnameSource = null,
	macAddress = null,
	vendor,
	openPortCount,
	discoveryMethodCount,
	mdnsServiceCount,
	selected,
	isNew = false,
	deviceCategory = 'unknown',
	hasPortScan = false,
	onClick,
}: UnifiedHostListItemProps) {
	const DeviceIcon = DEVICE_ICONS[deviceCategory] ?? CircleDot;

	const primaryIp = ips[0] ?? '';
	const additionalIpv4s = ips.slice(1).filter((ip) => !isIPv6(ip));
	const ipv6Addresses = ips.filter(isIPv6);
	const ipv6Count = ipv6Addresses.length;

	// Supplementary line: always show vendor and/or MAC when available
	const macDisplay = macAddress ? macAddress.toUpperCase() : null;
	const supplementaryText =
		vendor && macDisplay ? `${vendor} · ${macDisplay}` : (vendor ?? macDisplay);
	const supplementaryIsMono = !vendor && !!macDisplay;

	return (
		<ListItemButton
			variant="option"
			role="option"
			selected={selected}
			data-host-id={hostId}
			className={cn('items-start', isNew && 'animate-highlight-new')}
			onClick={onClick}
		>
			{/* Device icon */}
			<div className="mt-0.5 flex w-8 shrink-0 items-center justify-center">
				<DeviceIcon
					className={cn('h-4 w-4', openPortCount > 0 ? 'text-success' : 'text-muted-foreground')}
				/>
			</div>
			<div className="min-w-0 flex-1">
				{/* Primary IP + IPv6 badge + status dot + badges */}
				<div className="flex items-center gap-2">
					<span className="font-mono text-sm font-medium tabular-nums">{primaryIp}</span>
					{ipv6Count > 0 ? (
						<span
							className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
							title={ipv6Addresses.join('\n')}
						>
							IPv6
							{ipv6Count > 1 ? ` ×${ipv6Count}` : ''}
						</span>
					) : null}
					{hasPortScan ? (
						<span
							className={cn(
								'h-1.5 w-1.5 shrink-0 rounded-full',
								openPortCount > 0 ? 'bg-success' : 'bg-muted-foreground/50'
							)}
							title={openPortCount > 0 ? `${openPortCount} open ports` : 'No open ports'}
						/>
					) : null}
					{/* Badges */}
					<div className="flex items-center gap-1">
						{openPortCount > 0 ? (
							<span
								className="flex items-center gap-0.5 rounded bg-success/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-success"
								title={`${openPortCount} open ports`}
							>
								<CheckCircle2 className="h-2.5 w-2.5" />
								{openPortCount}
							</span>
						) : null}
						{discoveryMethodCount > 1 ? (
							<span
								className="flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-primary"
								title={`${discoveryMethodCount} discovery methods`}
							>
								<Radar className="h-2.5 w-2.5" />
								{discoveryMethodCount}
							</span>
						) : null}
						{mdnsServiceCount > 0 ? (
							<span
								className="flex items-center gap-0.5 rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-info"
								title={`${mdnsServiceCount} mDNS services`}
							>
								<Radio className="h-2.5 w-2.5" />
								{mdnsServiceCount}
							</span>
						) : null}
					</div>
				</div>

				{/* Hostname + source badge */}
				{hostname ? (
					<div className="flex items-center gap-1.5">
						<p className="truncate text-xs text-muted-foreground" title={hostname}>
							{hostname}
						</p>
						{hostnameSource ? (
							<span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase text-muted-foreground">
								{hostnameSource}
							</span>
						) : null}
					</div>
				) : null}

				{/* Supplementary info: vendor and/or MAC address */}
				{supplementaryText ? (
					<p
						className={cn(
							'truncate text-xs text-muted-foreground/70',
							supplementaryIsMono && 'font-mono'
						)}
						title={supplementaryText}
					>
						{supplementaryText}
					</p>
				) : null}

				{/* Additional IPv4 addresses */}
				{additionalIpv4s.length > 0 ? (
					<div className="mt-0.5 flex flex-wrap gap-1">
						{additionalIpv4s.map((ip) => (
							<span
								key={ip}
								className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground"
								title={ip}
							>
								{ip}
							</span>
						))}
					</div>
				) : null}
			</div>
		</ListItemButton>
	);
}

export type { UnifiedHostListItemProps };
