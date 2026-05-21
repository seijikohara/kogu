import type { ComponentType, ReactNode, SVGProps } from 'react';

import { cn } from '@/lib/utils';

export function SectionLabel({
	title,
	icon: Icon,
	iconClass = 'h-4 w-4 text-muted-foreground',
	className,
	children,
}: SectionLabelProps) {
	return (
		<h3 className={cn('mb-2 flex items-center gap-2 text-sm font-medium', className)}>
			{Icon ? <Icon className={iconClass} /> : null}
			{title}
			{children}
		</h3>
	);
}

export type SectionLabelProps = {
	readonly title?: string;
	readonly icon?: ComponentType<SVGProps<SVGSVGElement>>;
	readonly iconClass?: string;
	readonly className?: string;
	readonly children?: ReactNode;
};
