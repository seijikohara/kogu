import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type EmbeddedEmptyStateTone = 'default' | 'success' | 'destructive';

interface EmbeddedEmptyStateProps {
	readonly icon: LucideIcon;
	readonly title: string;
	readonly description: string;
	readonly fillHeight?: boolean;
	readonly tone?: EmbeddedEmptyStateTone;
}

const TONE_CLASSES: Readonly<
	Record<
		EmbeddedEmptyStateTone,
		{ readonly chip: string; readonly icon: string; readonly title: string }
	>
> = {
	default: {
		chip: 'bg-muted',
		icon: 'text-muted-foreground',
		title: 'text-foreground',
	},
	success: {
		chip: 'bg-success/15',
		icon: 'text-success',
		title: 'text-success',
	},
	destructive: {
		chip: 'bg-destructive/15',
		icon: 'text-destructive',
		title: 'text-destructive',
	},
};

export function EmbeddedEmptyState({
	icon: Icon,
	title,
	description,
	fillHeight = false,
	tone = 'default',
}: EmbeddedEmptyStateProps) {
	const toneClass = TONE_CLASSES[tone];
	return (
		<div className={cn('flex items-center justify-center', fillHeight ? 'h-full' : 'py-8')}>
			<div className="max-w-xs text-center">
				<div className={cn('mx-auto mb-3 inline-flex rounded-2xl p-3', toneClass.chip)}>
					<Icon className={cn('h-8 w-8', toneClass.icon)} />
				</div>
				<h3 className={cn('mb-1 text-sm font-semibold', toneClass.title)}>{title}</h3>
				<p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
			</div>
		</div>
	);
}

export type { EmbeddedEmptyStateProps, EmbeddedEmptyStateTone };
