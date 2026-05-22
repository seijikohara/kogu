import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { ValidityBadge } from '@/lib/components/status';

interface StatusBarProps {
	readonly valid?: boolean | null;
	readonly error?: string;
	readonly children?: ReactNode;
}

/**
 * Tool-level status bar anchored at the bottom of every `ToolShell`.
 *
 * Three slots:
 * - **Left**: error message (when `error` is set) OR `children` (stats /
 *   microcopy supplied by the route). Mutually exclusive — an error
 *   takes precedence so callers don't have to hide their stats manually.
 * - **Right**: validity badge driven by the `valid` tri-state
 *   (`true` / `false` / `null` for "unevaluated").
 *
 * Accessibility:
 * - `role="status"` + `aria-live="polite"` so screen readers announce
 *   parse errors, validation flips, and counter updates without
 *   interrupting the user.
 * - `aria-label="Tool status"` separates this bar from the editor's
 *   own footer (cursor position / byte count) in the AT tree.
 *
 * Stat separation:
 * - The children wrapper uses `[&>*+*]:border-l [&>*+*]:border-border/40
 *   [&>*+*]:pl-2` so consecutive child elements grow a 1px hairline
 *   between them — turning a row of `<StatItem>`s into a readable
 *   segmented readout instead of a flat list. A single child has no
 *   leading divider.
 */
export function StatusBar({ valid, error, children }: StatusBarProps) {
	const hasContent = Boolean(children) || valid !== undefined || Boolean(error);

	if (!hasContent) return null;

	return (
		<footer
			role="status"
			aria-live="polite"
			aria-label="Tool status"
			className="flex h-7 shrink-0 items-center justify-between border-t border-border/60 bg-surface-2 px-3"
		>
			<div className="flex items-center gap-2 text-xs [&>*+*]:border-l [&>*+*]:border-border/40 [&>*+*]:pl-2">
				{error ? (
					<span className="flex items-center gap-1.5 text-destructive" title={error}>
						<AlertTriangle className="h-3 w-3 shrink-0" />
						<span className="max-w-md truncate">{error}</span>
					</span>
				) : (
					children
				)}
			</div>
			{valid !== undefined ? <ValidityBadge valid={valid ?? null} /> : null}
		</footer>
	);
}

export type { StatusBarProps };
