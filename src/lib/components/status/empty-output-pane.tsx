import type { LucideIcon } from 'lucide-react';

import { SectionHeader } from '@/lib/components/layout/section-header';

import { EmbeddedEmptyState } from './embedded-empty-state';

interface EmptyOutputPaneProps {
	// SectionHeader title rendered at the top of the pane.
	readonly headerTitle: string;
	// Lucide icon for the empty-state graphic.
	readonly icon: LucideIcon;
	// Empty-state title (e.g. "Enter JSON to format").
	readonly title: string;
	// Empty-state description (e.g. "The formatted document will appear here.").
	readonly description: string;
}

// Wraps `SectionHeader` + `EmbeddedEmptyState fillHeight` in the flex-col +
// `flex-1` shell that every "output pane is empty" branch of a formatter tab
// used to render inline. Single source of truth for the structural skeleton;
// the icon/title/description vary per tab and stay configurable.
export function EmptyOutputPane({ headerTitle, icon, title, description }: EmptyOutputPaneProps) {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<SectionHeader title={headerTitle} />
			<div className="flex-1">
				<EmbeddedEmptyState icon={icon} title={title} description={description} fillHeight />
			</div>
		</div>
	);
}

export type { EmptyOutputPaneProps };
