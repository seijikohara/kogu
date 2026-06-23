/**
 * Selection bubble menu for the Vizel editor.
 *
 * Vizel ships no React binding and the editor factory has no bubble-menu hook,
 * so this component registers Tiptap's `BubbleMenuPlugin` (re-exported by
 * `@vizel/core`) after the editor exists and renders a formatting toolbar from
 * Vizel's bubble-menu action helpers. The plugin owns positioning and
 * show/hide; this component owns the toolbar DOM and per-action wiring.
 */
import { useEffect, useMemo, useReducer, useRef } from 'react';
import {
	BubbleMenuPlugin,
	createVizelBubbleMenuActions,
	createVizelBubbleMenuEscapeController,
	type Editor as VizelEditor,
	filterVizelBubbleMenuActions,
	formatVizelTooltip,
	groupVizelBubbleMenuActions,
} from '@vizel/core';
import { cn } from '@/lib/utils';
import { VizelMenuIcon } from './vizel-icon';

const BUBBLE_MENU_PLUGIN_KEY = 'vizelBubbleMenu';

interface VizelBubbleMenuProps {
	readonly editor: VizelEditor;
}

export function VizelBubbleMenu({ editor }: VizelBubbleMenuProps) {
	const elementRef = useRef<HTMLDivElement>(null);
	// Active-state flags are read from the editor at render time; bump a counter
	// on every transaction so the toolbar reflects the current selection.
	const [, forceRender] = useReducer((count: number) => count + 1, 0);

	// Filtering drops actions whose required extension is not registered; the set
	// is stable for an editor instance, so memoize on the editor.
	const actionGroups = useMemo(
		() =>
			groupVizelBubbleMenuActions(
				filterVizelBubbleMenuActions(createVizelBubbleMenuActions(), editor)
			),
		[editor]
	);

	useEffect(() => {
		const element = elementRef.current;
		if (!element) return;
		editor.registerPlugin(
			BubbleMenuPlugin({
				pluginKey: BUBBLE_MENU_PLUGIN_KEY,
				editor,
				element,
				updateDelay: 100,
				options: { placement: 'top' },
			})
		);
		return () => {
			editor.unregisterPlugin(BUBBLE_MENU_PLUGIN_KEY);
		};
	}, [editor]);

	useEffect(() => {
		const controller = createVizelBubbleMenuEscapeController({ getEditor: () => editor });
		controller.mount();
		return () => controller.unmount();
	}, [editor]);

	useEffect(() => {
		editor.on('transaction', forceRender);
		editor.on('selectionUpdate', forceRender);
		return () => {
			editor.off('transaction', forceRender);
			editor.off('selectionUpdate', forceRender);
		};
	}, [editor]);

	return (
		// `absolute` keeps the toolbar out of the editor's flow — without it the
		// hidden element reserves vertical space at the top of the scroll
		// container, shifting the content down and throwing the drag handle off the
		// cursor. The plugin toggles visibility and positions it via top/left;
		// start hidden so it does not flash at the origin before the first update.
		<div
			ref={elementRef}
			role="toolbar"
			aria-label="Text formatting"
			style={{ visibility: 'hidden' }}
			className="absolute flex items-center gap-0.5 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
		>
			{actionGroups.map((group, groupIndex) => (
				<div key={group[0]?.id ?? groupIndex} className="flex items-center gap-0.5">
					{groupIndex > 0 ? <div className="mx-0.5 h-5 w-px bg-border" /> : null}
					{group.map((action) => {
						const active = action.isActive(editor);
						return (
							<button
								key={action.id}
								type="button"
								aria-pressed={active}
								title={formatVizelTooltip(action.label, action.shortcut)}
								className={cn(
									'flex h-7 w-7 items-center justify-center rounded-sm',
									active
										? 'bg-accent text-accent-foreground'
										: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
								)}
								onMouseDown={(event) => {
									// Keep the editor selection while running the command.
									event.preventDefault();
									action.run(editor);
									forceRender();
								}}
							>
								<VizelMenuIcon name={action.icon} className="h-4 w-4" />
								<span className="sr-only">{action.label}</span>
							</button>
						);
					})}
				</div>
			))}
		</div>
	);
}
