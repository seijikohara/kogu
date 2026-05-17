import type { ReactNode } from 'react';

import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/lib/components/ui/resizable';
import { cn } from '@/lib/utils';

type Direction = 'horizontal' | 'vertical';

export function SplitPane({
	direction = 'horizontal',
	defaultSizes = [50, 50],
	minSizes = [20, 20],
	className = '',
	left,
	right,
	top,
	bottom,
}: SplitPaneProps) {
	const isHorizontal = direction === 'horizontal';
	const firstSlot = isHorizontal ? left : top;
	const secondSlot = isHorizontal ? right : bottom;

	return (
		<ResizablePanelGroup orientation={direction} className={cn('h-full flex-1', className)}>
			<ResizablePanel
				defaultSize={defaultSizes[0]}
				minSize={minSizes[0]}
				className="flex h-full flex-col overflow-hidden"
			>
				{firstSlot}
			</ResizablePanel>
			<ResizableHandle withHandle />
			<ResizablePanel
				defaultSize={defaultSizes[1]}
				minSize={minSizes[1]}
				className="flex h-full flex-col overflow-hidden"
			>
				{secondSlot}
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}

export type SplitPaneProps = {
	readonly direction?: Direction;
	readonly defaultSizes?: readonly [number, number];
	readonly minSizes?: readonly [number, number];
	readonly className?: string;
	readonly left?: ReactNode;
	readonly right?: ReactNode;
	readonly top?: ReactNode;
	readonly bottom?: ReactNode;
};
