import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StatItemProps {
	readonly label: string;
	readonly value: string | number;
	readonly icon?: LucideIcon;
	readonly variant?: 'default' | 'success' | 'warning' | 'error';
}

const variantStyles = {
	default: 'text-foreground',
	success: 'text-success',
	warning: 'text-warning',
	error: 'text-destructive',
} as const;

export function StatItem({ label, value, icon: Icon, variant = 'default' }: StatItemProps) {
	return (
		<span className="stat-item flex items-center gap-1.5 text-muted-foreground/80">
			{Icon ? <Icon className="h-3.5 w-3.5" /> : null}
			<span className="text-xs">{label}:</span>
			<strong className={cn('font-semibold tabular-nums', variantStyles[variant])}>{value}</strong>
		</span>
	);
}

export type { StatItemProps };
