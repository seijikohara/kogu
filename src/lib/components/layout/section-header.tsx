import type { ReactNode } from 'react';

export function SectionHeader({ title, count, trailing }: SectionHeaderProps) {
	return (
		<div className="flex h-8 shrink-0 items-center justify-between border-b border-border/60 bg-surface-2 px-3">
			<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				{title}
				{count !== undefined && <span className="ml-1 tabular-nums">({count})</span>}
			</span>
			{trailing}
		</div>
	);
}

export type SectionHeaderProps = {
	readonly title: string;
	readonly count?: number;
	readonly trailing?: ReactNode;
};
