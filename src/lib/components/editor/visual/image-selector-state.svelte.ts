/**
 * Global state for managing image selector popup outside ProseMirror context.
 *
 * This approach solves the bits-ui context issue by keeping the popover
 * in normal Svelte context while communicating with the editor via state.
 */

import type { Editor } from '@tiptap/core';

// Image attributes
export interface ImageAttributes {
	readonly src: string;
	readonly alt: string;
	readonly title?: string;
}

// State for the image selector
class ImageSelectorStore {
	isOpen = $state(false);
	anchorRect = $state<DOMRect | null>(null);
	currentSrc = $state('');
	currentAlt = $state('');
	private editorInstance: Editor | null = null;

	open(anchorElement: HTMLElement, editor: Editor): void {
		// Get current image attributes from editor
		const attrs = editor.getAttributes('image');
		const src = attrs['src'] as string | undefined;
		const alt = attrs['alt'] as string | undefined;

		this.anchorRect = anchorElement.getBoundingClientRect();
		this.currentSrc = src ?? '';
		this.currentAlt = alt ?? '';
		this.editorInstance = editor;
		this.isOpen = true;
	}

	close(): void {
		this.isOpen = false;
		this.anchorRect = null;
		this.editorInstance = null;
	}

	updateImage(attrs: Partial<ImageAttributes>): void {
		if (!this.editorInstance) return;

		// Update image attributes
		this.editorInstance.chain().focus().updateAttributes('image', attrs).run();
		this.close();
	}

	removeImage(): void {
		if (!this.editorInstance) return;
		this.editorInstance.chain().focus().deleteSelection().run();
		this.close();
	}

	openImage(): void {
		if (this.currentSrc) {
			window.open(this.currentSrc, '_blank', 'noopener,noreferrer');
		}
	}
}

// Singleton store instance
export const imageSelectorStore = new ImageSelectorStore();

/**
 * Open the image selector popup.
 * Called when user clicks on an image in the editor.
 */
export const openImageSelector = (anchorElement: HTMLElement, editor: Editor): void => {
	imageSelectorStore.open(anchorElement, editor);
};

/**
 * Close the image selector popup.
 */
export const closeImageSelector = (): void => {
	imageSelectorStore.close();
};

/**
 * Update image attributes.
 */
export const updateImage = (attrs: Partial<ImageAttributes>): void => {
	imageSelectorStore.updateImage(attrs);
};

/**
 * Remove the image.
 */
export const removeImage = (): void => {
	imageSelectorStore.removeImage();
};

/**
 * Open the current image in a new tab.
 */
export const openCurrentImage = (): void => {
	imageSelectorStore.openImage();
};
