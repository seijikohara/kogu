import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { ValidityBadge } from '@/lib/components/status';

interface StatusBarProps {
	readonly valid?: boolean | null;
	readonly error?: string;
	readonly children?: ReactNode;
}

export function StatusBar({ valid, error, children }: StatusBarProps) {
	const hasContent = Boolean(children) || valid !== undefined || Boolean(error);

	if (!hasContent) return null;

	return (
		<footer className="flex h-7 shrink-0 items-center justify-between border-t border-border/60 bg-surface-2 px-3">
			<div className="flex items-center gap-2 text-xs">
				{error ? (
					<>
						<AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
						<span className="max-w-md truncate text-destructive" title={error}>
							{error}
						</span>
					</>
				) : (
					children
				)}
			</div>
			{valid !== undefined ? <ValidityBadge valid={valid ?? null} /> : null}
		</footer>
	);
}

export type { StatusBarProps };
