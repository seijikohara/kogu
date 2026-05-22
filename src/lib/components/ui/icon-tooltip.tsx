import type { ReactNode } from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';

interface IconTooltipProps {
	/**
	 * Tooltip body — typically a short label like `"Copy"`, `"Go back"`,
	 * `"Toggle sidebar"`. Use a `ReactNode` to allow inline `<kbd>` shortcut
	 * hints, but keep the content concise (the design budget is one line).
	 */
	readonly label: ReactNode;

	/** Forwarded to Radix `TooltipContent`. Default `'top'`. */
	readonly side?: TooltipPrimitive.TooltipContentProps['side'];

	/**
	 * Disable to skip the tooltip wrapper entirely — useful when the trigger
	 * is its own visible label and the tooltip would be redundant. Renders
	 * `children` directly without Tooltip context overhead.
	 */
	readonly disabled?: boolean;

	/**
	 * The trigger element (typically a `<Button>` or an icon-only control).
	 * Forwarded via Radix's `asChild` slot so the trigger keeps its own
	 * tag / styles / focus behavior.
	 */
	readonly children: ReactNode;
}

/**
 * Standard icon-button tooltip wrapper.
 *
 * Replaces the inline `<Tooltip><TooltipTrigger asChild>{button}
 * </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>`
 * triplet that appears across the app. All call sites get the same
 * delay (provided by the app-level `TooltipProvider` at the layout
 * root, see `feedback_tooltip_provider_explicit.md`), the same default
 * side (`top`), and the same `asChild` handling — so the visual /
 * interaction behavior is consistent everywhere.
 *
 * Usage:
 * ```tsx
 * <IconTooltip label="Go back">
 *   <Button variant="ghost" size="icon" onClick={...}>
 *     <ChevronLeft />
 *   </Button>
 * </IconTooltip>
 * ```
 */
export function IconTooltip({ label, side = 'top', disabled, children }: IconTooltipProps) {
	if (disabled) return <>{children}</>;
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side={side}>{label}</TooltipContent>
		</Tooltip>
	);
}

export type { IconTooltipProps };
