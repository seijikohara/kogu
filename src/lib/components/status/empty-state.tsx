import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
	readonly icon: LucideIcon;
	readonly title: string;
	readonly description?: string;
	readonly children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
	return (
		<div className="flex h-full animate-fade-in items-center justify-center text-muted-foreground">
			<div className="text-center">
				<div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 shadow-sm">
					<Icon className="h-8 w-8 opacity-50" />
				</div>
				<p className="text-base font-semibold text-foreground/80">{title}</p>
				{description ? (
					<p className="mt-2 max-w-xs text-sm text-muted-foreground/80">{description}</p>
				) : null}
				{children ? <div className="mt-5">{children}</div> : null}
			</div>
		</div>
	);
}

export type { EmptyStateProps };
