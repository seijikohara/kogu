import { Fragment, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type DefinitionTone = 'default' | 'success' | 'warning' | 'destructive';

interface DefinitionItem {
	readonly key: string;
	readonly value: ReactNode;
	readonly tone?: DefinitionTone;
	readonly mono?: boolean;
	readonly break?: boolean;
}

interface DefinitionListProps {
	readonly items: readonly DefinitionItem[];
	readonly keyColumn?: string;
	readonly size?: '2xs' | 'xs' | 'sm';
	readonly density?: 'compact' | 'default';
	readonly className?: string;
}

const SIZE_CLASS: Record<NonNullable<DefinitionListProps['size']>, string> = {
	'2xs': 'text-2xs',
	xs: 'text-xs',
	sm: 'text-sm',
};

const TONE_CLASS: Record<DefinitionTone, string> = {
	default: '',
	success: 'text-success',
	warning: 'text-warning',
	destructive: 'text-destructive',
};

export function DefinitionList({
	items,
	keyColumn = '110px',
	size = 'xs',
	density = 'compact',
	className,
}: DefinitionListProps) {
	return (
		<dl
			style={{ gridTemplateColumns: `${keyColumn} 1fr` }}
			className={cn(
				'grid gap-x-3',
				SIZE_CLASS[size],
				density === 'compact' ? 'gap-y-1' : 'gap-y-2',
				className
			)}
		>
			{items.map((item) => (
				<Fragment key={item.key}>
					<dt className="text-muted-foreground">{item.key}</dt>
					<dd
						className={cn(
							'min-w-0',
							item.mono !== false && 'font-mono',
							item.break && 'break-all',
							item.tone && TONE_CLASS[item.tone]
						)}
					>
						{item.value}
					</dd>
				</Fragment>
			))}
		</dl>
	);
}

export type { DefinitionListProps, DefinitionItem, DefinitionTone };
