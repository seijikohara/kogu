import { Link } from '@tanstack/react-router';

import { getPageById } from '@/lib/services/pages';
import { cn } from '@/lib/utils';

interface RelatedToolItem {
	readonly id: string;
	readonly reason?: string;
}

interface RelatedToolsProps {
	readonly items: readonly RelatedToolItem[];
}

export function RelatedTools({ items }: RelatedToolsProps) {
	return (
		<div className="flex flex-col gap-1.5">
			{items.map((item) => {
				const page = getPageById(item.id);
				if (!page) return null;
				const Icon = page.icon;
				return (
					<Link
						key={item.id}
						to={page.url}
						className={cn(
							'group flex items-start gap-2 rounded-md border border-border bg-background p-2 text-xs transition-colors',
							'hover:bg-muted/40 hover:border-border'
						)}
					>
						<Icon
							className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', page.color ?? 'text-muted-foreground')}
						/>
						<div className="min-w-0 flex-1">
							<div className="truncate font-medium text-foreground">{page.title}</div>
							{item.reason ? (
								<div className="line-clamp-2 text-2xs leading-snug text-muted-foreground">
									{item.reason}
								</div>
							) : null}
						</div>
					</Link>
				);
			})}
		</div>
	);
}

export type { RelatedToolItem, RelatedToolsProps };
