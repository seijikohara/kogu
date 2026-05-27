import type { KeyboardEvent, ReactNode } from 'react';

import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/lib/components/ui/resizable';
import { cn } from '@/lib/utils';

import { SectionHeader } from './section-header';

interface MasterDetailLayoutProps {
	readonly listTitle: string;
	readonly listCount?: number;
	readonly listTrailing?: ReactNode;
	readonly list: ReactNode;
	readonly detail: ReactNode;
	readonly listAriaLabel?: string;
	readonly listAriaActiveDescendant?: string;
	readonly onListKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
	// String values are percentages in react-resizable-panels v4;
	// numbers would be interpreted as pixels.
	readonly defaultListSize?: string;
	readonly minListSize?: string;
	readonly maxListSize?: string;
	readonly listClassName?: string;
}

/**
 * Two-pane "browse list + detail panel" layout used by tools whose
 * job is to let the user select an item and inspect it. Standardizes
 * the resizable split, the list-section header, and the keyboard
 * `listbox` semantics so every master-detail page in the app looks
 * and behaves the same way.
 *
 * Pair with `<ToolShell layout="master-detail" />` for the outer
 * chrome.
 */
export function MasterDetailLayout({
	listTitle,
	listCount,
	listTrailing,
	list,
	detail,
	listAriaLabel,
	listAriaActiveDescendant,
	onListKeyDown,
	defaultListSize = '42',
	minListSize = '20',
	maxListSize = '60',
	listClassName,
}: MasterDetailLayoutProps) {
	const detailDefault = String(100 - Number(defaultListSize));
	const detailMin = String(Math.max(0, 100 - Number(maxListSize)));
	return (
		<ResizablePanelGroup orientation="horizontal" className="h-full">
			<ResizablePanel
				defaultSize={defaultListSize as unknown as number}
				minSize={minListSize as unknown as number}
				maxSize={maxListSize as unknown as number}
			>
				<div className="flex h-full flex-col border-r">
					<SectionHeader title={listTitle} count={listCount} trailing={listTrailing} />
					<div
						className={cn(
							'flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
							listClassName
						)}
						role="listbox"
						aria-label={listAriaLabel ?? listTitle}
						aria-activedescendant={listAriaActiveDescendant}
						tabIndex={onListKeyDown ? 0 : -1}
						onKeyDown={onListKeyDown}
					>
						{list}
					</div>
				</div>
			</ResizablePanel>
			<ResizableHandle withHandle />
			<ResizablePanel
				defaultSize={detailDefault as unknown as number}
				minSize={detailMin as unknown as number}
			>
				<div className="flex h-full flex-col overflow-hidden">{detail}</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}

export type { MasterDetailLayoutProps };
