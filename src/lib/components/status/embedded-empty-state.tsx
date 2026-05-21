import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface EmbeddedEmptyStateProps {
	readonly icon: LucideIcon;
	readonly title: string;
	readonly description: string;
	readonly fillHeight?: boolean;
}

export function EmbeddedEmptyState({
	icon: Icon,
	title,
	description,
	fillHeight = false,
}: EmbeddedEmptyStateProps) {
	return (
		<div className={cn('flex items-center justify-center', fillHeight ? 'h-full' : 'py-8')}>
			<div className="max-w-xs text-center">
				<div className="mx-auto mb-3 inline-flex rounded-2xl bg-muted p-3">
					<Icon className="h-8 w-8 text-muted-foreground" />
				</div>
				<h3 className="mb-1 text-sm font-semibold">{title}</h3>
				<p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
			</div>
		</div>
	);
}

export type { EmbeddedEmptyStateProps };
