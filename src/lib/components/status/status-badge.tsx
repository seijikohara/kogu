import { AlertTriangle, Check, Info, type LucideIcon, X } from 'lucide-react';

import { cn } from '@/lib/utils';

type StatusBadgeStatus = 'success' | 'warning' | 'error' | 'info';

interface StatusBadgeProps {
	readonly status: StatusBadgeStatus;
	readonly label: string;
	readonly icon?: LucideIcon;
	readonly size?: 'sm' | 'md';
}

const statusConfig: Record<StatusBadgeStatus, { defaultIcon: LucideIcon; className: string }> = {
	success: { defaultIcon: Check, className: 'text-success' },
	warning: { defaultIcon: AlertTriangle, className: 'text-warning' },
	error: { defaultIcon: X, className: 'text-destructive' },
	info: { defaultIcon: Info, className: 'text-info' },
};

export function StatusBadge({ status, label, icon, size = 'sm' }: StatusBadgeProps) {
	const config = statusConfig[status];
	const Icon = icon ?? config.defaultIcon;
	const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
	const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

	return (
		<span className={cn('flex items-center gap-1', textSize, config.className)}>
			<Icon className={iconSize} />
			<span className="font-medium">{label}</span>
		</span>
	);
}

export type { StatusBadgeProps, StatusBadgeStatus };
