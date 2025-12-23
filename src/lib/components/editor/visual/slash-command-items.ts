/**
 * Slash command items for TipTap editor.
 */

import type { Editor, Range } from '@tiptap/core';

import type { SlashCommandItem } from './slash-command-extension.js';

// Command configuration with icon names (mapped to Lucide components in slash-command-menu.svelte)
export const suggestionItems: SlashCommandItem[] = [
	// Basic text
	{
		title: 'Text',
		description: 'Plain text paragraph.',
		searchTerms: ['p', 'paragraph'],
		icon: 'text',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).toggleNode('paragraph', 'paragraph').run();
		},
	},

	// Headings
	{
		title: 'Heading 1',
		description: 'Large section heading.',
		searchTerms: ['title', 'big', 'large', 'h1'],
		icon: 'heading1',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
		},
	},
	{
		title: 'Heading 2',
		description: 'Medium section heading.',
		searchTerms: ['subtitle', 'medium', 'h2'],
		icon: 'heading2',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
		},
	},
	{
		title: 'Heading 3',
		description: 'Small section heading.',
		searchTerms: ['subtitle', 'small', 'h3'],
		icon: 'heading3',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
		},
	},
	{
		title: 'Heading 4',
		description: 'Smaller heading.',
		searchTerms: ['h4'],
		icon: 'heading4',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run();
		},
	},
	{
		title: 'Heading 5',
		description: 'Minor heading.',
		searchTerms: ['h5'],
		icon: 'heading5',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).setNode('heading', { level: 5 }).run();
		},
	},
	{
		title: 'Heading 6',
		description: 'Smallest heading.',
		searchTerms: ['h6'],
		icon: 'heading6',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).setNode('heading', { level: 6 }).run();
		},
	},

	// Lists
	{
		title: 'Bullet List',
		description: 'Unordered list with bullets.',
		searchTerms: ['unordered', 'point', 'ul'],
		icon: 'bulletList',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run();
		},
	},
	{
		title: 'Numbered List',
		description: 'Ordered list with numbers.',
		searchTerms: ['ordered', 'ol'],
		icon: 'numberedList',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run();
		},
	},
	{
		title: 'Task List',
		description: 'Checklist with checkboxes.',
		searchTerms: ['todo', 'task', 'check', 'checkbox'],
		icon: 'taskList',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).toggleTaskList().run();
		},
	},

	// Blocks
	{
		title: 'Quote',
		description: 'Blockquote for citations.',
		searchTerms: ['blockquote', 'quotation', 'cite'],
		icon: 'quote',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.toggleNode('paragraph', 'paragraph')
				.toggleBlockquote()
				.run();
		},
	},
	{
		title: 'Code Block',
		description: 'Fenced code with syntax highlighting.',
		searchTerms: ['codeblock', 'programming', 'pre', 'fenced'],
		icon: 'codeBlock',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
		},
	},
	{
		title: 'Divider',
		description: 'Horizontal rule separator.',
		searchTerms: ['hr', 'horizontal', 'rule', 'line', 'separator'],
		icon: 'divider',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor.chain().focus().deleteRange(range).setHorizontalRule().run();
		},
	},
	{
		title: 'Table',
		description: 'Insert a 3x3 table.',
		searchTerms: ['grid', 'rows', 'columns', 'spreadsheet'],
		icon: 'table',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
				.run();
		},
	},

	// Media
	{
		title: 'Image',
		description: 'Insert an image from URL.',
		searchTerms: ['picture', 'photo', 'img'],
		icon: 'image',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			const url = window.prompt('Enter image URL:');
			if (url) {
				editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
			}
		},
	},
	{
		title: 'Link',
		description: 'Insert a hyperlink.',
		searchTerms: ['url', 'href', 'anchor'],
		icon: 'link',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			const url = window.prompt('Enter URL:');
			if (url) {
				editor
					.chain()
					.focus()
					.deleteRange(range)
					.insertContent({
						type: 'text',
						text: url,
						marks: [{ type: 'link', attrs: { href: url } }],
					})
					.run();
			}
		},
	},

	// Diagrams
	{
		title: 'Mermaid Diagram',
		description: 'Flowcharts, sequence diagrams, etc.',
		searchTerms: ['diagram', 'flowchart', 'sequence', 'gantt', 'chart'],
		icon: 'mermaid',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setCodeBlock({ language: 'mermaid' })
				.insertContent(
					`graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]`
				)
				.run();
		},
	},
	{
		title: 'PlantUML Diagram',
		description: 'UML class, sequence diagrams.',
		searchTerms: ['diagram', 'uml', 'class', 'sequence'],
		icon: 'plantuml',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setCodeBlock({ language: 'plantuml' })
				.insertContent(
					`@startuml
class User {
  +id: number
  +name: string
}
@enduml`
				)
				.run();
		},
	},
	{
		title: 'GraphViz Diagram',
		description: 'DOT language graphs.',
		searchTerms: ['diagram', 'dot', 'graph', 'graphviz'],
		icon: 'graphviz',
		command: ({ editor, range }: { editor: Editor; range: Range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setCodeBlock({ language: 'graphviz' })
				.insertContent(
					`digraph G {
    A -> B
    B -> C
}`
				)
				.run();
		},
	},
];

// Filter items by query
export const filterSuggestionItems = (
	items: readonly SlashCommandItem[],
	query: string
): SlashCommandItem[] => {
	const lowerQuery = query.toLowerCase();
	return items.filter((item) => {
		const titleMatch = item.title.toLowerCase().includes(lowerQuery);
		const descMatch = item.description.toLowerCase().includes(lowerQuery);
		const searchMatch = item.searchTerms?.some((term) => term.toLowerCase().includes(lowerQuery));
		return titleMatch || descMatch || searchMatch;
	});
};
