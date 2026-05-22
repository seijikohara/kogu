import type { LucideIcon } from 'lucide-react';

import { CopyButton } from '@/lib/components/action';
import { SectionHeader } from '@/lib/components/layout';
import { EmbeddedEmptyState, LiveStatusRegion } from '@/lib/components/status';
import { Card, CardContent } from '@/lib/components/ui/card';

interface GeneratedListPanelProps {
	// Header title (e.g. "Generated UUIDs", "Generated Passwords").
	readonly title: string;
	// Per-item copy toast label (e.g. "UUID", "Password").
	readonly itemToastLabel: string;
	// Copy-all toast label, called with the result count
	// (e.g. `(n) => \`${n} UUID${n > 1 ? 's' : ''}\``).
	readonly copyAllToastLabel: (count: number) => string;
	// Empty-state slot.
	readonly emptyIcon: LucideIcon;
	readonly emptyTitle: string;
	readonly emptyDescription: string;
	// Data + the flash counter used to key the wrapper for
	// `animate-flash-success` re-mount after each regeneration.
	readonly results: readonly string[];
	readonly flashCounter: number;
}

// Right-pane panel used by the simple list-of-strings generators (UUID,
// password). Mirrors the exact JSX skeleton that was duplicated across
// the two routes: `<SectionHeader>` with a Copy-All trailing slot, then
// a `<LiveStatusRegion>` that renders either an `EmbeddedEmptyState`
// (no results yet) or the keyed `animate-flash-success` list of
// per-value cards with their own `<CopyButton>`. Per-route variation
// is funneled through `title`, `itemToastLabel`, `copyAllToastLabel`,
// and the three empty-state strings.
export function GeneratedListPanel({
	title,
	itemToastLabel,
	copyAllToastLabel,
	emptyIcon,
	emptyTitle,
	emptyDescription,
	results,
	flashCounter,
}: GeneratedListPanelProps) {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<SectionHeader
				title={title}
				count={results.length || undefined}
				trailing={
					results.length > 0 ? (
						<CopyButton
							text={results.join('\n')}
							label="Copy All"
							toastLabel={copyAllToastLabel(results.length)}
							size="sm"
							// SectionHeader is bg-surface-2; restore visible hover affordance.
							className="h-7 hover:bg-interactive-hover"
						/>
					) : null
				}
			/>
			<LiveStatusRegion className="flex-1 overflow-auto p-4">
				{results.length > 0 ? (
					<div key={flashCounter} className="animate-flash-success space-y-2 rounded-md">
						{results.map((value) => (
							<Card key={value} density="compact">
								<CardContent className="flex items-center gap-2">
									<code className="flex-1 break-all font-mono text-sm">{value}</code>
									<CopyButton
										text={value}
										toastLabel={itemToastLabel}
										size="sm"
										showLabel={false}
									/>
								</CardContent>
							</Card>
						))}
					</div>
				) : (
					<EmbeddedEmptyState
						icon={emptyIcon}
						title={emptyTitle}
						description={emptyDescription}
						fillHeight
					/>
				)}
			</LiveStatusRegion>
		</div>
	);
}

export type { GeneratedListPanelProps };
