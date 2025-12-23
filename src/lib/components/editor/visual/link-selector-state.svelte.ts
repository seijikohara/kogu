/**
 * Global state for managing link selector popup outside ProseMirror context.
 *
 * This approach solves the bits-ui context issue by keeping the popover
 * in normal Svelte context while communicating with the editor via state.
 */

import type { Editor } from '@tiptap/core';

// Validate URL format
export const isValidUrl = (url: string): boolean => {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
};

// Get URL from string - auto-prepend https:// for domain-like strings
export const getUrlFromString = (str: string): string | null => {
	if (isValidUrl(str)) return str;
	// Check if it looks like a domain (contains a dot, no spaces)
	if (str.includes('.') && !str.includes(' ')) {
		const urlWithProtocol = `https://${str}`;
		if (isValidUrl(urlWithProtocol)) return urlWithProtocol;
	}
	return null;
};

// State for the link selector
class LinkSelectorStore {
	isOpen = $state(false);
	anchorRect = $state<DOMRect | null>(null);
	currentUrl = $state('');
	private editorInstance: Editor | null = null;

	open(anchorElement: HTMLElement, editor: Editor): void {
		// Get current link URL from editor
		const attrs = editor.getAttributes('link');
		const href = attrs['href'] as string | undefined;
		this.anchorRect = anchorElement.getBoundingClientRect();
		this.currentUrl = href ?? '';
		this.editorInstance = editor;
		this.isOpen = true;
	}

	close(): void {
		this.isOpen = false;
		this.anchorRect = null;
		this.editorInstance = null;
	}

	setLink(url: string): void {
		if (!this.editorInstance) return;

		const validUrl = getUrlFromString(url);
		if (validUrl) {
			this.editorInstance.chain().focus().setLink({ href: validUrl }).run();
		}
		this.close();
	}

	removeLink(): void {
		if (!this.editorInstance) return;
		this.editorInstance.chain().focus().unsetLink().run();
		this.close();
	}

	openLink(): void {
		if (this.currentUrl) {
			window.open(this.currentUrl, '_blank', 'noopener,noreferrer');
		}
	}
}

// Singleton store instance
export const linkSelectorStore = new LinkSelectorStore();

/**
 * Open the link selector popup.
 * Called when user clicks on a link in the editor.
 */
export const openLinkSelector = (anchorElement: HTMLElement, editor: Editor): void => {
	linkSelectorStore.open(anchorElement, editor);
};

/**
 * Close the link selector popup.
 */
export const closeLinkSelector = (): void => {
	linkSelectorStore.close();
};

/**
 * Set a link URL.
 */
export const setLink = (url: string): void => {
	linkSelectorStore.setLink(url);
};

/**
 * Remove the link.
 */
export const removeLink = (): void => {
	linkSelectorStore.removeLink();
};

/**
 * Open the current link in a new tab.
 */
export const openCurrentLink = (): void => {
	linkSelectorStore.openLink();
};
