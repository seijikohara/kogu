export { default as AddBlockButton } from './add-block-button.svelte';
// Add block button (using Svelte component + reactive state)
export { AddBlockButtonExtension } from './add-block-button-extension.js';
export {
	getAddBlockButtonState,
	handleAddBlockClick,
	resetAddBlockButtonState,
	updateAddBlockButtonState,
} from './add-block-button-state.svelte.js';
export { default as CodeEditor } from './code-editor.svelte';
export type {
	ContextMenuItem,
	CursorPosition,
	EditorContext,
	EditorMode,
	HighlightLine,
} from './code-editor-wrapper.svelte';
export { default as CodeEditorWrapper } from './code-editor-wrapper.svelte';

// Slash command (using @tiptap/suggestion + tippy.js + Svelte component)
export type { SlashCommandItem } from './slash-command-extension.js';
export { renderItems, SlashCommandExtension } from './slash-command-extension.js';
export { filterSuggestionItems, suggestionItems } from './slash-command-items.js';
export { default as SlashCommandMenu } from './slash-command-menu.svelte';
export {
	executeSelected,
	getSlashCommandState,
	resetSlashCommandState,
	selectNext,
	selectPrevious,
	updateSlashCommandState,
} from './slash-command-state.svelte.js';

export type { FormatCommand } from './tiptap-editor.svelte';
export { default as TiptapEditor } from './tiptap-editor.svelte';
export { default as TreeView } from './tree-view.svelte';
