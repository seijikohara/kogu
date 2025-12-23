/**
 * Custom TipTap extension to handle link and image bubble selectors.
 *
 * This extension adds click handlers for links and images to open
 * the corresponding floating selector popups.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { openImageSelector } from './image-selector-state.svelte.js';
import { openLinkSelector } from './link-selector-state.svelte.js';

export interface BubbleSelectorOptions {
	/**
	 * Whether link selector is enabled.
	 * @default true
	 */
	enableLinkSelector: boolean;
	/**
	 * Whether image selector is enabled.
	 * @default true
	 */
	enableImageSelector: boolean;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		bubbleSelector: {
			/**
			 * Open link selector for current link.
			 */
			openLinkSelector: () => ReturnType;
			/**
			 * Open image selector for current image.
			 */
			openImageSelector: () => ReturnType;
		};
	}
}

export const BubbleSelectorExtension = Extension.create<BubbleSelectorOptions>({
	name: 'bubbleSelector',

	addOptions() {
		return {
			enableLinkSelector: true,
			enableImageSelector: true,
		};
	},

	addCommands() {
		return {
			openLinkSelector:
				() =>
				({ editor }) => {
					// Find the link element at cursor
					const { from } = editor.state.selection;
					const coords = editor.view.coordsAtPos(from);

					// Create a virtual anchor element
					const anchor = document.createElement('span');
					anchor.style.position = 'fixed';
					anchor.style.left = `${coords.left}px`;
					anchor.style.top = `${coords.top}px`;
					anchor.style.width = '1px';
					anchor.style.height = '20px';
					document.body.appendChild(anchor);

					openLinkSelector(anchor, editor);

					// Clean up virtual anchor after popup opens
					setTimeout(() => anchor.remove(), 0);

					return true;
				},

			openImageSelector:
				() =>
				({ editor }) => {
					const { from } = editor.state.selection;
					const coords = editor.view.coordsAtPos(from);

					const anchor = document.createElement('span');
					anchor.style.position = 'fixed';
					anchor.style.left = `${coords.left}px`;
					anchor.style.top = `${coords.top}px`;
					anchor.style.width = '1px';
					anchor.style.height = '20px';
					document.body.appendChild(anchor);

					openImageSelector(anchor, editor);

					setTimeout(() => anchor.remove(), 0);

					return true;
				},
		};
	},

	addProseMirrorPlugins() {
		const { enableLinkSelector, enableImageSelector } = this.options;
		const editor = this.editor;

		return [
			new Plugin({
				key: new PluginKey('bubbleSelector'),
				props: {
					handleClick(_view: EditorView, _pos: number, event: MouseEvent) {
						const target = event.target as HTMLElement;

						// Handle link clicks
						if (enableLinkSelector) {
							const linkElement = target.closest('a');
							if (linkElement) {
								event.preventDefault();
								event.stopPropagation();
								openLinkSelector(linkElement, editor);
								return true;
							}
						}

						// Handle image clicks
						if (enableImageSelector) {
							const imageElement = target.closest('img');
							if (imageElement) {
								event.preventDefault();
								event.stopPropagation();
								openImageSelector(imageElement, editor);
								return true;
							}
						}

						return false;
					},
				},
			}),
		];
	},
});
