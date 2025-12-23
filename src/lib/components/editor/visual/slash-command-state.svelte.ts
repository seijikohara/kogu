/**
 * Slash command state management using Svelte 5 runes.
 *
 * Provides reactive state that can be shared between the TipTap extension
 * and Svelte components.
 */

import type { SlashCommandItem } from './slash-command-extension.js';

// Reactive state using Svelte 5 runes
let items = $state<readonly SlashCommandItem[]>([]);
let selectedIndex = $state(0);
let query = $state('');
let selectHandler = $state<((item: SlashCommandItem) => void) | null>(null);
let isVisible = $state(false);

/**
 * Update the slash command state
 */
export const updateSlashCommandState = (newState: {
	items?: readonly SlashCommandItem[];
	selectedIndex?: number;
	query?: string;
	onSelect?: (item: SlashCommandItem) => void;
	visible?: boolean;
}) => {
	if (newState.items !== undefined) items = newState.items;
	if (newState.selectedIndex !== undefined) selectedIndex = newState.selectedIndex;
	if (newState.query !== undefined) query = newState.query;
	if (newState.onSelect !== undefined) selectHandler = newState.onSelect;
	if (newState.visible !== undefined) isVisible = newState.visible;
};

/**
 * Reset the slash command state
 */
export const resetSlashCommandState = () => {
	items = [];
	selectedIndex = 0;
	query = '';
	selectHandler = null;
	isVisible = false;
};

/**
 * Move selection down
 */
export const selectNext = () => {
	const maxIndex = items.length - 1;
	if (maxIndex >= 0) {
		selectedIndex = Math.min(selectedIndex + 1, maxIndex);
	}
};

/**
 * Move selection up
 */
export const selectPrevious = () => {
	selectedIndex = Math.max(selectedIndex - 1, 0);
};

/**
 * Execute the currently selected item
 */
export const executeSelected = () => {
	const item = items[selectedIndex];
	if (item && selectHandler) {
		selectHandler(item);
	}
};

/**
 * Get the current slash command state (reactive getters)
 */
export const getSlashCommandState = () => ({
	get items() {
		return items;
	},
	get selectedIndex() {
		return selectedIndex;
	},
	get query() {
		return query;
	},
	get isVisible() {
		return isVisible;
	},
	get onSelect() {
		return selectHandler;
	},
});
