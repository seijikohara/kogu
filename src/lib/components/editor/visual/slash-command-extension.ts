/**
 * Slash command extension for TipTap editor.
 *
 * Uses @tiptap/suggestion with tippy.js for positioning.
 * Menu UI is rendered using Svelte component (slash-command-menu.svelte).
 * State is managed via slash-command-state.svelte.ts for reactivity.
 */

import type { Editor, Range } from '@tiptap/core';
import { Extension } from '@tiptap/core';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import Suggestion from '@tiptap/suggestion';
import { mount, unmount } from 'svelte';
import type { Instance as TippyInstance, Props as TippyProps } from 'tippy.js';
import tippy from 'tippy.js';

import SlashCommandMenu from './slash-command-menu.svelte';
import {
	executeSelected,
	resetSlashCommandState,
	selectNext,
	selectPrevious,
	updateSlashCommandState,
} from './slash-command-state.svelte.js';

export interface SlashCommandItem {
	readonly title: string;
	readonly description: string;
	readonly icon: string; // Icon name (mapped to Lucide component in slash-command-menu.svelte)
	readonly searchTerms?: readonly string[];
	readonly command: (props: { editor: Editor; range: Range }) => void;
}

export interface SlashCommandProps {
	readonly items: readonly SlashCommandItem[];
	readonly command: (item: SlashCommandItem) => void;
	readonly query: string;
}

// Suggestion render function
export const renderItems = (elementRef?: HTMLElement | null) => {
	let popup: TippyInstance<TippyProps>[] | null = null;
	let container: HTMLDivElement | null = null;
	let svelteComponent: Record<string, unknown> | null = null;

	return {
		onStart: (props: SuggestionProps<SlashCommandItem>): void => {
			const { selection } = props.editor.state;
			const parentNode = selection.$from.node(selection.$from.depth);
			const blockType = parentNode.type.name;

			// Don't show in code blocks
			if (blockType === 'codeBlock') {
				return;
			}

			// Create container element
			container = document.createElement('div');
			container.id = 'slash-command-container';

			// Initialize reactive state
			updateSlashCommandState({
				items: props.items ?? [],
				selectedIndex: 0,
				query: props.query,
				onSelect: (item) => props.command(item),
				visible: true,
			});

			// Mount Svelte component (it reads state from slash-command-state.svelte.ts)
			svelteComponent = mount(SlashCommandMenu, {
				target: container,
			});

			popup = tippy('body', {
				getReferenceClientRect: props.clientRect as () => DOMRect,
				appendTo: () => elementRef ?? document.body,
				content: container,
				showOnCreate: true,
				interactive: true,
				trigger: 'manual',
				placement: 'bottom-start',
			});
		},

		onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
			if (!container || !svelteComponent) return;

			// Update reactive state (component will automatically re-render)
			updateSlashCommandState({
				items: props.items ?? [],
				query: props.query,
				selectedIndex: 0,
			});

			popup?.[0]?.setProps({
				getReferenceClientRect: props.clientRect as () => DOMRect,
			});
		},

		onKeyDown: (props: { event: KeyboardEvent }): boolean => {
			if (!container || !svelteComponent) return false;

			if (props.event.key === 'Escape') {
				popup?.[0]?.hide();
				return true;
			}

			if (props.event.key === 'ArrowDown') {
				props.event.preventDefault();
				selectNext();
				return true;
			}

			if (props.event.key === 'ArrowUp') {
				props.event.preventDefault();
				selectPrevious();
				return true;
			}

			if (props.event.key === 'Enter') {
				props.event.preventDefault();
				executeSelected();
				return true;
			}

			return false;
		},

		onExit: () => {
			popup?.[0]?.destroy();
			if (svelteComponent) {
				unmount(svelteComponent);
				svelteComponent = null;
			}
			container?.remove();
			container = null;
			resetSlashCommandState();
		},
	};
};

// Extension options
export interface SlashCommandOptions {
	readonly suggestion: Partial<SuggestionOptions<SlashCommandItem>>;
}

// The extension
export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
	name: 'slashCommand',

	addOptions() {
		return {
			suggestion: {
				char: '/',
				command: ({ editor, range, props }) => {
					props.command({ editor, range });
				},
			},
		};
	},

	addProseMirrorPlugins() {
		return [
			Suggestion({
				editor: this.editor,
				...this.options.suggestion,
			}),
		];
	},
});

export default SlashCommandExtension;
