import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface SubsectionLabelProps {
	readonly size?: 'xs' | '2xs';
	readonly tone?: 'default' | 'warning';
	readonly className?: string;
	readonly children: ReactNode;
}

export function SubsectionLabel({
	size = 'xs',
	tone = 'default',
	className,
	children,
}: SubsectionLabelProps) {
	return (
		<h3
			className={cn(
				'font-semibold uppercase tracking-wide',
				size === 'xs' ? 'text-xs' : 'text-2xs',
				tone === 'warning' ? 'text-warning' : 'text-muted-foreground',
				className
			)}
		>
			{children}
		</h3>
	);
}

export type { SubsectionLabelProps };
