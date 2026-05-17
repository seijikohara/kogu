import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Divergence from registry: cursor-pointer / cursor-not-allowed are added on the base so
// every list row shows a proper click affordance (Tailwind v4 Preflight resets the native
// <button> cursor to default).
const listItemButtonVariants = cva(
	"focus-visible:border-ring focus-visible:ring-ring/50 inline-flex w-full shrink-0 cursor-pointer items-center gap-2 text-left outline-none transition-colors focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					'border-l-2 border-l-transparent px-3 py-2 hover:bg-interactive-hover data-[selected=true]:border-l-primary data-[selected=true]:bg-primary/10',
				option:
					'border-b border-border border-l-2 border-l-transparent px-3 py-2.5 last:border-b-0 hover:bg-interactive-hover data-[selected=true]:border-l-primary data-[selected=true]:bg-primary/10',
				card: 'border-input bg-background rounded border px-2 py-1 hover:bg-interactive-hover data-[selected=true]:border-primary data-[selected=true]:bg-primary/10',
				// `tree-node` selection uses bg + a thin border-l accent (consistent with
				// `default` / `option`). Rings are reserved for keyboard focus state and
				// are emitted by the `focus-visible:` rules on the shared base.
				'tree-node':
					'gap-1 rounded-md border-l-2 border-l-transparent px-1 py-0.5 hover:bg-muted/60 data-[selected=true]:border-l-primary data-[selected=true]:bg-primary/10',
				toc: 'rounded-sm px-1 hover:text-primary hover:underline',
			},
			size: {
				default: 'text-sm',
				sm: 'text-xs',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);

interface ListItemButtonProps
	extends React.ComponentProps<'button'>, VariantProps<typeof listItemButtonVariants> {
	readonly selected?: boolean;
	readonly depth?: number;
	readonly leading?: React.ReactNode;
	readonly trailing?: React.ReactNode;
}

export function ListItemButton({
	className,
	variant,
	size,
	selected = false,
	depth = 0,
	leading,
	trailing,
	type = 'button',
	role,
	children,
	style,
	...rest
}: ListItemButtonProps) {
	const indentStyle =
		variant === 'tree-node' && depth > 0 ? { paddingLeft: `${depth * 12}px`, ...style } : style;

	// aria-selected only applies to roles that support it (option, treeitem, etc.).
	const ariaSelected = role === 'option' || role === 'treeitem' ? selected : undefined;

	return (
		<button
			type={type}
			role={role}
			data-slot="list-item-button"
			data-selected={selected}
			aria-selected={ariaSelected}
			className={cn(listItemButtonVariants({ variant, size }), className)}
			style={indentStyle}
			{...rest}
		>
			{leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
			<span className="min-w-0 flex-1 truncate">{children}</span>
			{trailing ? <span className="ml-auto flex shrink-0 items-center">{trailing}</span> : null}
		</button>
	);
}

export { listItemButtonVariants, type ListItemButtonProps };
