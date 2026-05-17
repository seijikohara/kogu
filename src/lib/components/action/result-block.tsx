import { Copy, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { Button } from '@/lib/components/ui/button';
import { cn } from '@/lib/utils';

interface ResultBlockProps {
	readonly title: string;
	readonly content: string;
	readonly icon?: LucideIcon;
	readonly copyable?: boolean;
	readonly copyLabel?: string;
	readonly variant?: 'default' | 'success' | 'warning' | 'error';
	readonly size?: 'default' | 'compact';
	readonly mono?: boolean;
	readonly maxHeight?: string;
	readonly children?: ReactNode;
}

const VARIANT_STYLES = {
	default: 'border bg-muted/30',
	success: 'border-success/30 bg-success/10',
	warning: 'border-warning/30 bg-warning/10',
	error: 'border-destructive/50 bg-destructive/10',
} as const satisfies Record<NonNullable<ResultBlockProps['variant']>, string>;

export function ResultBlock({
	title,
	content,
	icon: Icon,
	copyable = true,
	copyLabel,
	variant = 'default',
	size = 'default',
	mono = true,
	maxHeight,
	children,
}: ResultBlockProps) {
	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(content);
			toast.success(`${copyLabel ?? title} copied to clipboard`);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	return (
		<div className={cn('rounded-lg', size === 'compact' ? 'p-3' : 'p-4', VARIANT_STYLES[variant])}>
			<div
				className={cn('flex items-center justify-between', size === 'compact' ? 'mb-1.5' : 'mb-2')}
			>
				<div className="flex items-center gap-2">
					{Icon ? <Icon className="h-4 w-4" /> : null}
					<span className="text-sm font-medium">{title}</span>
				</div>
				{copyable && content ? (
					<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={handleCopy}>
						<Copy className="h-3 w-3" />
						Copy
					</Button>
				) : null}
			</div>
			{children ?? (
				<code
					className={cn(
						'block break-all rounded bg-muted p-3 text-sm',
						mono && 'font-mono',
						maxHeight && 'overflow-auto'
					)}
					style={maxHeight ? { maxHeight } : undefined}
				>
					{content}
				</code>
			)}
		</div>
	);
}

export type { ResultBlockProps };
