// Add block button (using Svelte component + reactive state)
export { AddBlockButtonExtension } from './add-block-button-extension.js';
export { default as AddBlockButton } from './add-block-button.svelte';
export {
	getAddBlockButtonState,
	handleAddBlockClick,
	resetAddBlockButtonState,
	updateAddBlockButtonState,
} from './add-block-button-state.svelte.js';

// Bubble selectors (link & image)
export { BubbleSelectorExtension } from './bubble-selector-extension.js';
export { default as FloatingImageSelector } from './floating-image-selector.svelte';
export { default as FloatingLinkSelector } from './floating-link-selector.svelte';
export type { ImageAttributes } from './image-selector-state.svelte.js';
export {
	closeImageSelector,
	imageSelectorStore,
	openCurrentImage,
	openImageSelector,
	removeImage,
	updateImage,
} from './image-selector-state.svelte.js';
export {
	closeLinkSelector,
	getUrlFromString,
	isValidUrl,
	linkSelectorStore,
	openCurrentLink,
	openLinkSelector,
	removeLink,
	setLink,
} from './link-selector-state.svelte.js';

// Language combobox
export { default as FloatingLanguageCombobox } from './floating-language-combobox.svelte';
export { default as LanguageCombobox } from './language-combobox.svelte';
export type { LanguageOption } from './language-combobox-state.svelte.js';
export {
	closeLanguageCombobox,
	LANGUAGES,
	languageComboboxStore,
	openLanguageCombobox,
	selectLanguage,
} from './language-combobox-state.svelte.js';

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

// TipTap editor
export type { FormatCommand } from './tiptap-editor.svelte';
export { default as TiptapEditor } from './tiptap-editor.svelte';
