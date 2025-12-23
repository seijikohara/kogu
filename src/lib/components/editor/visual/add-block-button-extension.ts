/**
 * Add Block Button Extension
 *
 * Displays a "+" button next to the drag handle that opens the slash command menu.
 * Works alongside tiptap-extension-global-drag-handle.
 * UI is rendered using Svelte component (add-block-button.svelte).
 * State is managed via add-block-button-state.svelte.ts for reactivity.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { mount, unmount } from 'svelte';

import AddBlockButton from './add-block-button.svelte';
import {
	resetAddBlockButtonState,
	updateAddBlockButtonState,
} from './add-block-button-state.svelte.js';

export interface AddBlockButtonOptions {
	/**
	 * Offset from the drag handle in pixels
	 * @default 24
	 */
	readonly offsetFromHandle: number;
}

export const AddBlockButtonExtension = Extension.create<AddBlockButtonOptions>({
	name: 'addBlockButton',

	addOptions() {
		return {
			offsetFromHandle: 24,
		};
	},

	addProseMirrorPlugins() {
		const options = this.options;
		const editor = this.editor;

		return [
			new Plugin({
				key: new PluginKey('addBlockButton'),
				view: () => {
					// Create container for Svelte component
					const container = document.createElement('div');
					container.id = 'add-block-button-container';
					document.body.appendChild(container);

					// Initialize state with editor reference
					updateAddBlockButtonState({
						editor,
						visible: false,
					});

					// Mount Svelte component
					const svelteComponent = mount(AddBlockButton, {
						target: container,
					});

					// Track last known handle position for smooth transitions
					let lastHandleRect: DOMRect | null = null;

					const updateButtonPosition = () => {
						const handle = document.querySelector('.drag-handle') as HTMLElement | null;

						// If handle exists and is visible, update position
						if (handle && handle.style.display !== 'none') {
							const handleRect = handle.getBoundingClientRect();
							// Only update if handle is in viewport
							if (handleRect.top > 0 && handleRect.top < window.innerHeight) {
								lastHandleRect = handleRect;
							}
						}

						// Use last known position if we have one
						if (!lastHandleRect) {
							updateAddBlockButtonState({ visible: false });
							return;
						}

						// Position button to the left of the drag handle
						updateAddBlockButtonState({
							visible: true,
							position: {
								x: lastHandleRect.left - options.offsetFromHandle,
								y: lastHandleRect.top,
							},
						});
					};

					// Update node position when drag handle moves
					const updateNodePosition = () => {
						const handle = document.querySelector('.drag-handle') as HTMLElement | null;
						if (!handle) return;

						// Get the handle's vertical position to find the corresponding node
						const handleRect = handle.getBoundingClientRect();
						const editorElement = editor.view.dom;
						const editorRect = editorElement.getBoundingClientRect();

						// Find the node at the handle's position
						const pos = editor.view.posAtCoords({
							left: editorRect.left + 50,
							top: handleRect.top + handleRect.height / 2,
						});

						if (pos) {
							// Resolve to get the node's start position
							const resolvedPos = editor.state.doc.resolve(pos.pos);
							const depth = resolvedPos.depth;

							// Find the top-level block node
							for (let d = depth; d > 0; d--) {
								const nodeStart = resolvedPos.before(d);
								const node = resolvedPos.node(d);
								if (node.isBlock) {
									updateAddBlockButtonState({ nodePos: nodeStart });
									break;
								}
							}
						}
					};

					// Use interval to check position (more reliable than MutationObserver for transforms)
					let intervalId: ReturnType<typeof setInterval> | null = null;

					const startTracking = () => {
						if (intervalId) return;
						intervalId = setInterval(() => {
							updateButtonPosition();
							updateNodePosition();
						}, 50);
					};

					const stopTracking = () => {
						if (intervalId) {
							clearInterval(intervalId);
							intervalId = null;
						}
						updateAddBlockButtonState({ visible: false });
					};

					// Start tracking when editor is focused or mouse enters
					const editorElement = editor.view.dom;

					// Check if any relevant element is being hovered
					const isAnyElementHovered = () => {
						const handle = document.querySelector('.drag-handle') as HTMLElement | null;
						const buttonElement = container.querySelector('button');
						return (
							editorElement.matches(':hover') ||
							buttonElement?.matches(':hover') ||
							handle?.matches(':hover')
						);
					};

					// Delayed stop with hover check
					const delayedStop = () => {
						setTimeout(() => {
							if (!isAnyElementHovered()) {
								lastHandleRect = null;
								stopTracking();
							}
						}, 150);
					};

					editorElement.addEventListener('mouseenter', startTracking);
					editorElement.addEventListener('mouseleave', delayedStop);

					container.addEventListener('mouseenter', startTracking);
					container.addEventListener('mouseleave', delayedStop);

					// Also track drag handle hover
					const setupDragHandleTracking = () => {
						const handle = document.querySelector('.drag-handle') as HTMLElement | null;
						if (handle && !handle.dataset['addBlockTracking']) {
							handle.dataset['addBlockTracking'] = 'true';
							handle.addEventListener('mouseenter', startTracking);
							handle.addEventListener('mouseleave', delayedStop);
						}
					};

					// Setup drag handle tracking with retry (handle may not exist immediately)
					setupDragHandleTracking();
					setTimeout(setupDragHandleTracking, 500);

					return {
						destroy: () => {
							stopTracking();
							unmount(svelteComponent);
							container.remove();
							resetAddBlockButtonState();
						},
					};
				},
			}),
		];
	},
});

export default AddBlockButtonExtension;
