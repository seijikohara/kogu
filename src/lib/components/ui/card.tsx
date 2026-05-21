import * as React from 'react';

import { cn } from '@/lib/utils';

type CardDensity = 'default' | 'compact';
// Tonal variants apply a semantic border/40 + bg/5 pair on top of the base
// Card surface. `default` keeps the neutral surface (no tinting).
type CardVariant = 'default' | 'destructive' | 'warning' | 'info' | 'success';

interface CardProps extends React.ComponentProps<'div'> {
	readonly density?: CardDensity;
	readonly variant?: CardVariant;
}

const cardVariantClasses: Record<CardVariant, string> = {
	default: '',
	destructive: 'border border-destructive/40 bg-destructive/5',
	warning: 'border border-warning/40 bg-warning/5',
	info: 'border border-info/40 bg-info/5',
	success: 'border border-success/40 bg-success/5',
};

function Card({ className, density = 'default', variant = 'default', ...props }: CardProps) {
	// Map Kogu's `density` API to shadcn Nova's `data-size` token.
	// default -> default (gap-4, py-4, px-4)
	// compact -> sm      (gap-3, py-3, px-3)
	const size = density === 'compact' ? 'sm' : 'default';

	return (
		<div
			data-slot="card"
			data-size={size}
			data-density={density}
			data-variant={variant}
			className={cn(
				'group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
				cardVariantClasses[variant],
				className
			)}
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3',
				className
			)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-title"
			className={cn(
				'text-base leading-snug font-medium group-data-[size=sm]/card:text-sm',
				className
			)}
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-description"
			className={cn('text-sm text-muted-foreground', className)}
			{...props}
		/>
	);
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-action"
			className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-content"
			className={cn('px-4 group-data-[size=sm]/card:px-3', className)}
			{...props}
		/>
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-footer"
			className={cn(
				'flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3',
				className
			)}
			{...props}
		/>
	);
}

export {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	type CardProps,
};
