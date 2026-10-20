import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

interface LiveStatusRegionProps extends ComponentProps<'output'> {
	// `aria-atomic` mode. `"false"` (default) announces only the diff inside the
	// region — appropriate for multi-row outputs (generator lists, key-pair
	// sections) where re-announcing the entire region would be noisy. Pass
	// `"true"` for single-cell status that should always be read in full
	// (cron-expression-builder schedule lines, regex match summary).
	readonly atomic?: 'true' | 'false';
}

// Polite live region for tool output. Renders <output>, whose implicit role
// is `status`, and bakes in the `aria-live="polite" aria-atomic="..."` pair used across
// every tool route that announces a freshly produced result. Single source of
// truth for the screen-reader contract; callers only need to bring the
// className / children, and pick `atomic` if the default `"false"` is not
// what they want.
export function LiveStatusRegion({
	className,
	atomic = 'false',
	children,
	...props
}: LiveStatusRegionProps) {
	return (
		<output aria-live="polite" aria-atomic={atomic} className={cn('block', className)} {...props}>
			{children}
		</output>
	);
}

export type { LiveStatusRegionProps };
