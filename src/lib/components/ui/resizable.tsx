import * as React from 'react';
import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '@/lib/utils/index';

// react-resizable-panels primitives expose the DOM ref via the `elementRef` prop
// rather than the standard `ref`. Adopt the forwardRef shape so consumers can use
// Tooltip.Trigger asChild and similar Slot-based wrappers; the ref is plumbed
// through to `elementRef` so it resolves to the underlying HTMLDivElement.
const ResizablePanelGroup = React.forwardRef<HTMLDivElement, ResizablePrimitive.GroupProps>(
	({ className, ...props }, ref) => (
		<ResizablePrimitive.Group
			elementRef={ref}
			data-slot="resizable-panel-group"
			className={cn('flex h-full w-full aria-[orientation=vertical]:flex-col', className)}
			{...props}
		/>
	)
);
ResizablePanelGroup.displayName = ResizablePrimitive.Group.displayName;

const ResizablePanel = React.forwardRef<HTMLDivElement, ResizablePrimitive.PanelProps>(
	({ ...props }, ref) => (
		<ResizablePrimitive.Panel elementRef={ref} data-slot="resizable-panel" {...props} />
	)
);
ResizablePanel.displayName = ResizablePrimitive.Panel.displayName;

const ResizableHandle = React.forwardRef<
	HTMLDivElement,
	ResizablePrimitive.SeparatorProps & { withHandle?: boolean }
>(({ withHandle, className, ...props }, ref) => (
	<ResizablePrimitive.Separator
		elementRef={ref}
		data-slot="resizable-handle"
		className={cn(
			'relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90',
			className
		)}
		{...props}
	>
		{withHandle && <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />}
	</ResizablePrimitive.Separator>
));
ResizableHandle.displayName = ResizablePrimitive.Separator.displayName;

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
