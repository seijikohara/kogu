/**
 * Add block button state management using Svelte 5 runes.
 *
 * Provides reactive state that can be shared between the TipTap extension
 * and Svelte components.
 */

import type { Editor } from '@tiptap/core';

// Reactive state using Svelte 5 runes
let isVisible = $state(false);
let position = $state<{ x: number; y: number }>({ x: 0, y: 0 });
let currentNodePos = $state<number | null>(null);
let editorRef = $state<Editor | null>(null);

/**
 * Update the add block button state
 */
export const updateAddBlockButtonState = (newState: {
	visible?: boolean;
	position?: { x: number; y: number };
	nodePos?: number | null;
	editor?: Editor | null;
}) => {
	if (newState.visible !== undefined) isVisible = newState.visible;
	if (newState.position !== undefined) position = newState.position;
	if (newState.nodePos !== undefined) currentNodePos = newState.nodePos;
	if (newState.editor !== undefined) editorRef = newState.editor;
};

/**
 * Reset the add block button state
 */
export const resetAddBlockButtonState = () => {
	isVisible = false;
	position = { x: 0, y: 0 };
	currentNodePos = null;
	editorRef = null;
};

/**
 * Handle add block button click - insert paragraph with "/" and trigger slash command
 */
export const handleAddBlockClick = () => {
	if (currentNodePos === null || !editorRef) return;

	const { doc } = editorRef.state;
	const resolvedPos = doc.resolve(currentNodePos);
	const node = resolvedPos.nodeAfter;

	if (!node) return;

	// Calculate position after the current node
	const insertPos = currentNodePos + node.nodeSize;

	// Insert a new paragraph with "/" and place cursor after it
	editorRef
		.chain()
		.focus()
		.insertContentAt(insertPos, {
			type: 'paragraph',
			content: [{ type: 'text', text: '/' }],
		})
		.setTextSelection(insertPos + 2) // Position after the "/"
		.run();
};

/**
 * Get the current add block button state (reactive getters)
 */
export const getAddBlockButtonState = () => ({
	get isVisible() {
		return isVisible;
	},
	get position() {
		return position;
	},
	get currentNodePos() {
		return currentNodePos;
	},
	get editor() {
		return editorRef;
	},
});
