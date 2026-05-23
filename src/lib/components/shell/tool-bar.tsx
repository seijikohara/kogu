import type { ReactNode } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Pin } from 'lucide-react';

import { Button } from '@/lib/components/ui/button';
import { IconTooltip } from '@/lib/components/ui/icon-tooltip';
import { getPageByUrl } from '@/lib/services/pages';
import { useToolPinsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface ToolBarProps {
	readonly title?: string;
	readonly leading?: ReactNode;
	readonly center?: ReactNode;
	readonly trailing?: ReactNode;
}

export function ToolBar({ title: titleOverride, leading, center, trailing }: ToolBarProps) {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const pageDefinition = getPageByUrl(pathname);
	const title = titleOverride ?? pageDefinition?.title ?? 'Untitled';
	const PageIcon = pageDefinition?.icon;

	const pinned = useToolPinsStore((s) => s.pinned);
	const togglePin = useToolPinsStore((s) => s.togglePin);

	const isToolPage =
		pageDefinition !== undefined &&
		pageDefinition.id !== 'dashboard' &&
		pageDefinition.id !== 'settings';
	const isPinned = isToolPage && pinned.includes(pageDefinition.id);

	return (
		<header className="grid h-12 shrink-0 grid-cols-[auto_1fr_auto] items-center border-b bg-surface-1 px-4">
			<div className="flex min-w-0 shrink-0 items-center gap-2">
				{PageIcon ? <PageIcon className="h-4 w-4 shrink-0 opacity-80" /> : null}
				<h1 className="truncate text-sm font-bold tracking-tight">{title}</h1>
				{isToolPage ? (
					<IconTooltip label={isPinned ? 'Unpin from sidebar' : 'Pin to sidebar'}>
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={() => togglePin(pageDefinition.id)}
							aria-pressed={isPinned}
							className="h-7 w-7 hover:bg-interactive-hover"
						>
							<Pin className={cn('h-3.5 w-3.5', isPinned && 'fill-current')} />
							<span className="sr-only">{isPinned ? 'Unpin from sidebar' : 'Pin to sidebar'}</span>
						</Button>
					</IconTooltip>
				) : null}
				{leading}
			</div>

			<div className="flex min-w-0 items-center justify-center">{center}</div>

			<div className="flex shrink-0 items-center justify-end gap-1">{trailing}</div>
		</header>
	);
}

export type { ToolBarProps };
