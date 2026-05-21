'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils/index';
import { Separator } from '@/lib/components/ui/separator';

// Ported from the shadcn/ui radix-nova registry:
// https://ui.shadcn.com/r/styles/radix-nova/button-group.json
// Adapted to the Kogu React port: `forwardRef`, local cn/Separator imports,
// TypeScript 7 Ready (no enum / namespace / parameter properties).
const buttonGroupVariants = cva(
	"group/button-group flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 has-[>[data-slot=button-group]]:gap-2 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-lg [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
	{
		variants: {
			orientation: {
				horizontal:
					'[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-lg!',
				vertical:
					'flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-lg!',
			},
		},
		defaultVariants: {
			orientation: 'horizontal',
		},
	}
);

type ButtonGroupProps = React.ComponentPropsWithoutRef<'div'> &
	VariantProps<typeof buttonGroupVariants>;

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
	({ className, orientation, ...props }, ref) => (
		<div
			ref={ref}
			role="group"
			data-slot="button-group"
			data-orientation={orientation}
			className={cn(buttonGroupVariants({ orientation }), className)}
			{...props}
		/>
	)
);
ButtonGroup.displayName = 'ButtonGroup';

type ButtonGroupTextProps = React.ComponentPropsWithoutRef<'div'> & {
	asChild?: boolean;
};

const ButtonGroupText = React.forwardRef<HTMLDivElement, ButtonGroupTextProps>(
	({ className, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot.Root : 'div';

		return (
			<Comp
				ref={ref}
				data-slot="button-group-text"
				className={cn(
					"flex items-center gap-2 rounded-lg border bg-muted px-2.5 text-sm font-medium [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
					className
				)}
				{...props}
			/>
		);
	}
);
ButtonGroupText.displayName = 'ButtonGroupText';

type ButtonGroupSeparatorProps = React.ComponentPropsWithoutRef<typeof Separator>;

const ButtonGroupSeparator = React.forwardRef<
	React.ElementRef<typeof Separator>,
	ButtonGroupSeparatorProps
>(({ className, orientation = 'vertical', ...props }, ref) => (
	<Separator
		ref={ref}
		data-slot="button-group-separator"
		orientation={orientation}
		className={cn(
			'relative self-stretch bg-input data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto',
			className
		)}
		{...props}
	/>
));
ButtonGroupSeparator.displayName = 'ButtonGroupSeparator';

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants };
