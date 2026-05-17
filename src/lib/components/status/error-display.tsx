import { AlertTriangle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface ErrorDisplayProps {
	readonly message: string;
	readonly title?: string;
	readonly variant?: 'inline' | 'centered' | 'banner';
	readonly icon?: LucideIcon;
	readonly children?: ReactNode;
}

export function ErrorDisplay({
	message,
	title,
	variant = 'centered',
	icon: Icon = AlertTriangle,
	children,
}: ErrorDisplayProps) {
	if (variant === 'inline') {
		return <span className="max-w-md truncate text-destructive">{message}</span>;
	}

	if (variant === 'centered') {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
					<Icon className="mx-auto mb-3 h-10 w-10 text-destructive opacity-60" />
					{title ? <h3 className="mb-1 text-sm font-medium text-destructive">{title}</h3> : null}
					<p className="text-sm text-destructive">{message}</p>
					{children ? <div className="mt-3">{children}</div> : null}
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				'flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3'
			)}
		>
			<Icon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
			<div className="min-w-0 flex-1">
				{title ? <p className="text-sm font-medium text-destructive">{title}</p> : null}
				<p className="text-sm text-destructive">{message}</p>
				{children ? <div className="mt-2">{children}</div> : null}
			</div>
		</div>
	);
}

export type { ErrorDisplayProps };
