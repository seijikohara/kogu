<script lang="ts">
	import { Pencil } from '@lucide/svelte';
	import { Editor, Extension } from '@tiptap/core';
	import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
	import { Link } from '@tiptap/extension-link';
	import { Mathematics } from '@tiptap/extension-mathematics';
	import { Placeholder } from '@tiptap/extension-placeholder';
	import { Table } from '@tiptap/extension-table';
	import { TableCell } from '@tiptap/extension-table-cell';
	import { TableHeader } from '@tiptap/extension-table-header';
	import { TableRow } from '@tiptap/extension-table-row';
	import { TaskItem } from '@tiptap/extension-task-item';
	import { TaskList } from '@tiptap/extension-task-list';
	import { StarterKit } from '@tiptap/starter-kit';
	import katex from 'katex';
	import { common, createLowlight } from 'lowlight';
	import type MarkdownIt from 'markdown-it';
	import texmath from 'markdown-it-texmath';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { Markdown } from 'tiptap-markdown';

	// ProseMirror Node type (simplified interface for type checking)
	interface PMNode {
		type: { name: string };
		attrs: Record<string, unknown>;
		isBlock: boolean;
	}

	// Helper function to escape HTML attributes
	const escapeHtml = (text: string): string =>
		text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');

	// Custom extension to integrate markdown-it-texmath with tiptap-markdown
	// Use WeakSet to track initialized markdown-it instances (avoid repeated initialization)
	const initializedMd = new WeakSet<MarkdownIt>();

	const MathematicsMarkdown = Extension.create({
		name: 'mathematicsMarkdown',
		addStorage() {
			return {
				markdown: {
					parse: {
						setup(md: MarkdownIt) {
							// Prevent repeated initialization
							if (initializedMd.has(md)) return;
							initializedMd.add(md);

							// Configure markdown-it-texmath to output HTML compatible with Mathematics extension
							md.use(texmath, {
								engine: katex,
								delimiters: 'dollars',
								katexOptions: { throwOnError: false },
							});

							// Override the renderer to output Mathematics-compatible HTML
							// Single $ inline math
							md.renderer.rules['math_inline'] = (tokens, idx) => {
								const latex = tokens[idx]?.content ?? '';
								return `<span data-type="inline-math" data-latex="${escapeHtml(latex)}"></span>`;
							};

							// $$ inline math (displayMode) - render as block
							md.renderer.rules['math_inline_double'] = (tokens, idx) => {
								const latex = tokens[idx]?.content ?? '';
								return `<div data-type="block-math" data-latex="${escapeHtml(latex)}"></div>`;
							};

							// Block math
							md.renderer.rules['math_block'] = (tokens, idx) => {
								const latex = tokens[idx]?.content ?? '';
								return `<div data-type="block-math" data-latex="${escapeHtml(latex)}"></div>`;
							};

							// Block math with equation number
							md.renderer.rules['math_block_eqno'] = (tokens, idx) => {
								const latex = tokens[idx]?.content ?? '';
								return `<div data-type="block-math" data-latex="${escapeHtml(latex)}"></div>`;
							};
						},
					},
				},
			};
		},
	});

	// Create lowlight instance with common languages
	const lowlight = createLowlight(common);

	// Available languages for syntax highlighting (from lowlight common)
	const LANGUAGES = [
		{ value: '', label: 'Plain Text' },
		{ value: 'bash', label: 'Bash' },
		{ value: 'c', label: 'C' },
		{ value: 'cpp', label: 'C++' },
		{ value: 'csharp', label: 'C#' },
		{ value: 'css', label: 'CSS' },
		{ value: 'diff', label: 'Diff' },
		{ value: 'dot', label: 'GraphViz (DOT)' },
		{ value: 'go', label: 'Go' },
		{ value: 'graphql', label: 'GraphQL' },
		{ value: 'graphviz', label: 'GraphViz' },
		{ value: 'ini', label: 'INI' },
		{ value: 'java', label: 'Java' },
		{ value: 'javascript', label: 'JavaScript' },
		{ value: 'json', label: 'JSON' },
		{ value: 'kotlin', label: 'Kotlin' },
		{ value: 'less', label: 'Less' },
		{ value: 'lua', label: 'Lua' },
		{ value: 'makefile', label: 'Makefile' },
		{ value: 'markdown', label: 'Markdown' },
		{ value: 'mermaid', label: 'Mermaid' },
		{ value: 'objectivec', label: 'Objective-C' },
		{ value: 'perl', label: 'Perl' },
		{ value: 'php', label: 'PHP' },
		{ value: 'plantuml', label: 'PlantUML' },
		{ value: 'python', label: 'Python' },
		{ value: 'r', label: 'R' },
		{ value: 'ruby', label: 'Ruby' },
		{ value: 'rust', label: 'Rust' },
		{ value: 'scss', label: 'SCSS' },
		{ value: 'shell', label: 'Shell' },
		{ value: 'sql', label: 'SQL' },
		{ value: 'swift', label: 'Swift' },
		{ value: 'typescript', label: 'TypeScript' },
		{ value: 'wasm', label: 'WebAssembly' },
		{ value: 'xml', label: 'XML' },
		{ value: 'yaml', label: 'YAML' },
	] as const;

	// Custom CodeBlock extension with language selector
	const CodeBlockWithLanguageSelector = CodeBlockLowlight.extend({
		addNodeView() {
			return ({ node, getPos, editor }) => {
				const pmNode = node as PMNode;
				const container = document.createElement('div');
				container.className = 'code-block-wrapper';

				// Language selector header
				const header = document.createElement('div');
				header.className = 'code-block-header';

				const select = document.createElement('select');
				select.className = 'code-block-language-select';
				select.setAttribute('aria-label', 'Select language');

				LANGUAGES.forEach(({ value, label }) => {
					const option = document.createElement('option');
					option.value = value;
					option.textContent = label;
					select.appendChild(option);
				});

				const language = pmNode.attrs['language'] as string | null;
				select.value = language ?? '';

				header.appendChild(select);
				container.appendChild(header);

				// Code content
				const pre = document.createElement('pre');
				const code = document.createElement('code');
				pre.appendChild(code);
				container.appendChild(pre);

				select.addEventListener('change', (e) => {
					const target = e.target as HTMLSelectElement;
					const pos = getPos();
					if (typeof pos === 'number') {
						editor.view.dispatch(
							editor.view.state.tr.setNodeMarkup(pos, undefined, {
								...pmNode.attrs,
								language: target.value || null,
							})
						);
					}
				});

				return {
					dom: container,
					contentDOM: code,
					update: (updatedNode: PMNode) => {
						if (updatedNode.type.name !== 'codeBlock') {
							return false;
						}
						const updatedLanguage = updatedNode.attrs['language'] as string | null;
						select.value = updatedLanguage ?? '';
						return true;
					},
				};
			};
		},
	});

	interface MarkdownStorage {
		getMarkdown: () => string;
	}

	export type FormatCommand =
		| 'bold'
		| 'italic'
		| 'strikethrough'
		| 'code'
		| 'link'
		| 'image'
		| 'heading1'
		| 'heading2'
		| 'heading3'
		| 'heading4'
		| 'heading5'
		| 'heading6'
		| 'quote'
		| 'bullet'
		| 'numbered'
		| 'task'
		| 'hr'
		| 'codeblock'
		| 'table'
		| 'clearFormat';

	interface Props {
		readonly content: string;
		readonly placeholder?: string;
		onchange?: (markdown: string) => void;
		oncursorchange?: (line: number) => void;
		onfocus?: () => void;
		onblur?: () => void;
	}

	let {
		content,
		placeholder = 'Start writing...',
		onchange,
		oncursorchange,
		onfocus,
		onblur,
	}: Props = $props();

	let element = $state<HTMLDivElement | null>(null);
	let editor = $state<Editor | null>(null);

	// Track the last content that was synced to prevent redundant updates
	let lastSyncedContent = '';
	// Flag to ignore onUpdate calls triggered by setContent
	let isExternalUpdate = false;

	const getMarkdownFromEditor = (ed: Editor): string => {
		const storage = ed.storage as { markdown?: MarkdownStorage };
		return storage.markdown?.getMarkdown() ?? '';
	};

	// Sync content prop to editor (external → editor)
	// Only track `content` prop changes, not editor state
	$effect(() => {
		// Capture content in reactive scope
		const newContent = content;

		// Use untrack to prevent editor reads from creating dependencies
		untrack(() => {
			if (!editor) return;

			// Skip if content hasn't changed since last sync
			if (newContent === lastSyncedContent) return;

			// Mark as external update to skip onUpdate callback
			isExternalUpdate = true;
			lastSyncedContent = newContent;
			editor.commands.setContent(newContent);

			// Reset flag after microtask to ensure onUpdate has been processed
			queueMicrotask(() => {
				isExternalUpdate = false;
			});
		});
	});

	onMount(() => {
		if (!element) return;

		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: { levels: [1, 2, 3, 4, 5, 6] },
					// Disable codeBlock from StarterKit to use CodeBlockLowlight instead
					codeBlock: false,
				}),
				Placeholder.configure({
					placeholder,
				}),
				Link.configure({
					openOnClick: false,
					HTMLAttributes: {
						class: 'cursor-pointer',
					},
				}),
				Table.configure({
					resizable: true,
				}),
				TableRow,
				TableHeader,
				TableCell,
				TaskList,
				TaskItem.configure({
					nested: true,
				}),
				CodeBlockWithLanguageSelector.configure({
					lowlight,
				}),
				Markdown.configure({
					html: true,
					tightLists: true,
					transformPastedText: true,
					transformCopiedText: true,
				}),
				MathematicsMarkdown,
				Mathematics,
			],
			content,
			onUpdate: ({ editor }) => {
				// Skip if this update was triggered by external setContent call
				if (isExternalUpdate) return;

				const markdown = getMarkdownFromEditor(editor);
				// Update lastSyncedContent to prevent $effect from re-syncing
				lastSyncedContent = markdown;
				onchange?.(markdown);
			},
			onSelectionUpdate: ({ editor }) => {
				if (!oncursorchange) return;
				const { from } = editor.state.selection;
				let lineNumber = 1;
				editor.state.doc.nodesBetween(0, from, (node: PMNode, pos: number) => {
					if (node.isBlock && pos < from) {
						lineNumber++;
					}
				});
				oncursorchange(lineNumber);
			},
			onFocus: () => {
				onfocus?.();
			},
			onBlur: () => {
				onblur?.();
			},
		});
	});

	onDestroy(() => {
		editor?.destroy();
	});

	// Expose method to execute format commands
	export const executeFormat = (command: FormatCommand, url?: string) => {
		if (!editor) return;

		editor.chain().focus();

		switch (command) {
			case 'bold':
				editor.chain().focus().toggleBold().run();
				break;
			case 'italic':
				editor.chain().focus().toggleItalic().run();
				break;
			case 'strikethrough':
				editor.chain().focus().toggleStrike().run();
				break;
			case 'code':
				editor.chain().focus().toggleCode().run();
				break;
			case 'link':
				if (url) {
					editor.chain().focus().setLink({ href: url }).run();
				} else {
					editor.chain().focus().unsetLink().run();
				}
				break;
			case 'image':
				if (url) {
					editor.chain().focus().insertContent(`![image](${url})`).run();
				}
				break;
			case 'heading1':
				editor.chain().focus().toggleHeading({ level: 1 }).run();
				break;
			case 'heading2':
				editor.chain().focus().toggleHeading({ level: 2 }).run();
				break;
			case 'heading3':
				editor.chain().focus().toggleHeading({ level: 3 }).run();
				break;
			case 'heading4':
				editor.chain().focus().toggleHeading({ level: 4 }).run();
				break;
			case 'heading5':
				editor.chain().focus().toggleHeading({ level: 5 }).run();
				break;
			case 'heading6':
				editor.chain().focus().toggleHeading({ level: 6 }).run();
				break;
			case 'quote':
				editor.chain().focus().toggleBlockquote().run();
				break;
			case 'bullet':
				editor.chain().focus().toggleBulletList().run();
				break;
			case 'numbered':
				editor.chain().focus().toggleOrderedList().run();
				break;
			case 'task':
				editor.chain().focus().toggleTaskList().run();
				break;
			case 'hr':
				editor.chain().focus().setHorizontalRule().run();
				break;
			case 'codeblock':
				editor.chain().focus().toggleCodeBlock().run();
				break;
			case 'table':
				editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
				break;
			case 'clearFormat':
				editor.chain().focus().unsetAllMarks().clearNodes().run();
				break;
		}
	};

	// Expose method to focus the editor
	export const focus = () => {
		editor?.chain().focus().run();
	};

	// Expose method to check if editor is focused
	export const isFocused = (): boolean => {
		return editor?.isFocused ?? false;
	};

	// Expose method to set cursor position by line number (without stealing focus)
	export const setCursorLine = (line: number) => {
		if (!editor || editor.isFocused) return; // Don't interfere if editor is focused
		let pos = 0;
		let currentLine = 1;
		editor.state.doc.descendants((node: PMNode, nodePos: number) => {
			if (currentLine === line && pos === 0) {
				pos = nodePos + 1;
				return false;
			}
			if (node.isBlock) {
				currentLine++;
			}
			return true;
		});
		if (pos > 0) {
			editor.commands.setTextSelection(pos);
		}
	};
</script>

<div class="flex h-full flex-col">
	<div class="flex h-9 shrink-0 items-center border-b bg-muted/30 px-3">
		<Pencil class="mr-2 h-3.5 w-3.5 text-muted-foreground" />
		<span class="text-xs font-medium text-muted-foreground">Visual Editor</span>
	</div>
	<div class="tiptap-container flex-1 overflow-auto p-4">
		<div
			bind:this={element}
			class="tiptap-editor prose prose-sm dark:prose-invert max-w-none h-full"
		></div>
	</div>
</div>

<style>
	/* ========================================
	   Base Editor Styles (shadcn-consistent)
	   ======================================== */
	.tiptap-container :global(.tiptap) {
		outline: none;
		min-height: 100%;
	}

	/* Placeholder - matches shadcn input placeholder */
	.tiptap-container :global(.tiptap p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: hsl(var(--muted-foreground));
		pointer-events: none;
		height: 0;
	}

	/* ========================================
	   List Styles
	   ======================================== */
	.tiptap-container :global(.tiptap ul:not([data-type='taskList']) li > p),
	.tiptap-container :global(.tiptap ol li > p) {
		margin: 0;
		line-height: 1.5rem;
	}

	/* Task list - shadcn checkbox pattern */
	.tiptap-container :global(.tiptap ul[data-type='taskList']) {
		list-style-type: none;
		padding-left: 0;
		margin-left: 0;
	}

	.tiptap-container :global(.tiptap ul[data-type='taskList'] li) {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.tiptap-container :global(.tiptap ul[data-type='taskList'] li > label) {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		height: 1.5rem;
		user-select: none;
	}

	/* Checkbox - matches shadcn checkbox component */
	.tiptap-container :global(.tiptap ul[data-type='taskList'] li > label input[type='checkbox']) {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
		border: 1px solid hsl(var(--input));
		border-radius: 4px;
		background: transparent;
		appearance: none;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: box-shadow 0.15s ease;
		box-shadow:
			0 1px 2px 0 rgb(0 0 0 / 0.05),
			0 1px 1px 0 rgb(0 0 0 / 0.03);
	}

	.tiptap-container
		:global(.tiptap ul[data-type='taskList'] li > label input[type='checkbox']:checked) {
		background: hsl(var(--primary));
		border-color: hsl(var(--primary));
	}

	.tiptap-container
		:global(.tiptap ul[data-type='taskList'] li > label input[type='checkbox']:checked::after) {
		content: '';
		display: block;
		width: 0.5rem;
		height: 0.25rem;
		border-left: 2px solid hsl(var(--primary-foreground));
		border-bottom: 2px solid hsl(var(--primary-foreground));
		transform: rotate(-45deg) translateY(-1px);
	}

	.tiptap-container
		:global(.tiptap ul[data-type='taskList'] li > label input[type='checkbox']:focus-visible) {
		border-color: hsl(var(--ring));
		box-shadow: 0 0 0 3px hsl(var(--ring) / 0.5);
	}

	:global(.dark)
		.tiptap-container
		:global(.tiptap ul[data-type='taskList'] li > label input[type='checkbox']) {
		background: hsl(var(--input) / 0.3);
	}

	.tiptap-container :global(.tiptap ul[data-type='taskList'] li > div) {
		flex: 1;
	}

	.tiptap-container :global(.tiptap ul[data-type='taskList'] li > div > p) {
		margin: 0;
		line-height: 1.5rem;
	}

	.tiptap-container :global(.tiptap ul[data-type='taskList'] li[data-checked='true'] > div) {
		text-decoration: line-through;
		color: hsl(var(--muted-foreground));
	}

	/* ========================================
	   Table Styles
	   ======================================== */
	.tiptap-container :global(.tiptap .selectedCell:after) {
		background: hsl(var(--primary) / 0.1);
		content: '';
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		pointer-events: none;
		position: absolute;
		z-index: 2;
	}

	.tiptap-container :global(.tiptap .column-resize-handle) {
		background-color: hsl(var(--ring));
		bottom: -2px;
		pointer-events: none;
		position: absolute;
		right: -2px;
		top: 0;
		width: 3px;
		border-radius: 1.5px;
	}

	.tiptap-container :global(.tiptap .tableWrapper) {
		overflow-x: auto;
		margin: 0.75rem 0;
	}

	.tiptap-container :global(.tiptap .resize-cursor) {
		cursor: col-resize;
	}

	/* Table cells - shadcn border pattern */
	.tiptap-container :global(.tiptap table) {
		border-collapse: collapse;
		width: 100%;
	}

	.tiptap-container :global(.tiptap th),
	.tiptap-container :global(.tiptap td) {
		border: 1px solid hsl(var(--border));
		padding: 0.5rem 0.75rem;
		position: relative;
		vertical-align: top;
	}

	.tiptap-container :global(.tiptap th) {
		background: hsl(var(--muted) / 0.5);
		font-weight: 500;
		text-align: left;
	}

	:global(.dark) .tiptap-container :global(.tiptap th) {
		background: hsl(var(--muted) / 0.3);
	}

	/* ========================================
	   Code Block - shadcn card/input pattern
	   ======================================== */
	.tiptap-container :global(.code-block-wrapper) {
		position: relative;
		margin: 1rem 0;
		border-radius: var(--radius);
		border: 1px solid hsl(var(--border));
		background: hsl(var(--muted) / 0.3);
		overflow: hidden;
		box-shadow:
			0 1px 2px 0 rgb(0 0 0 / 0.05),
			0 1px 1px 0 rgb(0 0 0 / 0.03);
	}

	:global(.dark) .tiptap-container :global(.code-block-wrapper) {
		background: hsl(var(--input) / 0.3);
	}

	.tiptap-container :global(.code-block-header) {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 0.5rem 0.75rem;
		background: hsl(var(--muted) / 0.5);
		border-bottom: 1px solid hsl(var(--border));
	}

	:global(.dark) .tiptap-container :global(.code-block-header) {
		background: hsl(var(--muted) / 0.3);
	}

	/* Language select - matches shadcn select-trigger */
	.tiptap-container :global(.code-block-language-select) {
		font-size: 0.75rem;
		line-height: 1rem;
		height: 1.75rem;
		padding: 0.25rem 1.5rem 0.25rem 0.5rem;
		border-radius: calc(var(--radius) - 2px);
		background: hsl(var(--background));
		border: 1px solid hsl(var(--input));
		color: hsl(var(--foreground));
		cursor: pointer;
		outline: none;
		transition: box-shadow 0.15s ease;
		appearance: none;
		background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
		background-position: right 0.25rem center;
		background-repeat: no-repeat;
		background-size: 1rem;
		box-shadow:
			0 1px 2px 0 rgb(0 0 0 / 0.05),
			0 1px 1px 0 rgb(0 0 0 / 0.03);
	}

	:global(.dark) .tiptap-container :global(.code-block-language-select) {
		background: hsl(var(--input) / 0.3);
	}

	.tiptap-container :global(.code-block-language-select:hover) {
		background: hsl(var(--accent));
	}

	:global(.dark) .tiptap-container :global(.code-block-language-select:hover) {
		background: hsl(var(--input) / 0.5);
	}

	.tiptap-container :global(.code-block-language-select:focus) {
		border-color: hsl(var(--ring));
		box-shadow: 0 0 0 3px hsl(var(--ring) / 0.5);
	}

	.tiptap-container :global(.code-block-wrapper pre) {
		margin: 0;
		padding: 1rem;
		overflow-x: auto;
		background: transparent;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	/* ========================================
	   Code Syntax Highlighting
	   ======================================== */
	.tiptap-container :global(.tiptap pre code),
	.tiptap-container :global(.code-block-wrapper pre code) {
		display: block;
		white-space: pre;
		color: inherit;
		background: transparent;
		padding: 0;
	}

	.tiptap-container :global(.hljs-comment),
	.tiptap-container :global(.hljs-quote) {
		color: hsl(var(--muted-foreground));
		font-style: italic;
	}

	.tiptap-container :global(.hljs-keyword),
	.tiptap-container :global(.hljs-selector-tag),
	.tiptap-container :global(.hljs-addition) {
		color: oklch(0.65 0.2 330);
	}

	.tiptap-container :global(.hljs-number),
	.tiptap-container :global(.hljs-string),
	.tiptap-container :global(.hljs-meta .hljs-meta-string),
	.tiptap-container :global(.hljs-literal),
	.tiptap-container :global(.hljs-doctag),
	.tiptap-container :global(.hljs-regexp) {
		color: oklch(0.7 0.15 150);
	}

	.tiptap-container :global(.hljs-title),
	.tiptap-container :global(.hljs-section),
	.tiptap-container :global(.hljs-name),
	.tiptap-container :global(.hljs-selector-id),
	.tiptap-container :global(.hljs-selector-class) {
		color: oklch(0.7 0.18 250);
	}

	.tiptap-container :global(.hljs-attribute),
	.tiptap-container :global(.hljs-attr),
	.tiptap-container :global(.hljs-variable),
	.tiptap-container :global(.hljs-template-variable),
	.tiptap-container :global(.hljs-class .hljs-title),
	.tiptap-container :global(.hljs-type) {
		color: oklch(0.75 0.15 60);
	}

	.tiptap-container :global(.hljs-symbol),
	.tiptap-container :global(.hljs-bullet),
	.tiptap-container :global(.hljs-subst),
	.tiptap-container :global(.hljs-meta),
	.tiptap-container :global(.hljs-meta .hljs-keyword),
	.tiptap-container :global(.hljs-selector-attr),
	.tiptap-container :global(.hljs-selector-pseudo),
	.tiptap-container :global(.hljs-link) {
		color: oklch(0.7 0.18 200);
	}

	.tiptap-container :global(.hljs-built_in),
	.tiptap-container :global(.hljs-deletion) {
		color: oklch(0.65 0.2 25);
	}

	.tiptap-container :global(.hljs-formula) {
		background: hsl(var(--muted) / 0.5);
	}

	.tiptap-container :global(.hljs-emphasis) {
		font-style: italic;
	}

	.tiptap-container :global(.hljs-strong) {
		font-weight: bold;
	}

	/* ========================================
	   Mathematics (TeX/LaTeX) - shadcn patterns
	   ======================================== */
	.tiptap-container :global(.tiptap-mathematics-render) {
		padding: 0.125rem 0.375rem;
		cursor: pointer;
		border-radius: calc(var(--radius) - 2px);
		transition: background-color 0.15s ease;
	}

	.tiptap-container :global(.tiptap-mathematics-render:hover) {
		background: hsl(var(--accent));
	}

	:global(.dark) .tiptap-container :global(.tiptap-mathematics-render:hover) {
		background: hsl(var(--accent) / 0.5);
	}

	.tiptap-container :global(.tiptap-mathematics-render--editable) {
		cursor: pointer;
	}

	/* Block math - centered display */
	.tiptap-container :global(div.tiptap-mathematics-render) {
		display: block;
		text-align: center;
		margin: 1rem 0;
		padding: 0.75rem 1rem;
		background: hsl(var(--muted) / 0.3);
		border-radius: var(--radius);
	}

	:global(.dark) .tiptap-container :global(div.tiptap-mathematics-render) {
		background: hsl(var(--muted) / 0.2);
	}

	/* Inline math */
	.tiptap-container :global(span.tiptap-mathematics-render) {
		display: inline;
		vertical-align: baseline;
	}

	/* Math error states */
	.tiptap-container :global(.block-math-error),
	.tiptap-container :global(.inline-math-error) {
		color: hsl(var(--destructive));
		font-family: ui-monospace, monospace;
		font-size: 0.875rem;
		background: hsl(var(--destructive) / 0.1);
		padding: 0.25rem 0.5rem;
		border-radius: calc(var(--radius) - 2px);
	}

	/* ========================================
	   Links - matches shadcn link pattern
	   ======================================== */
	.tiptap-container :global(.tiptap a) {
		color: hsl(var(--primary));
		text-decoration: underline;
		text-underline-offset: 4px;
		transition: color 0.15s ease;
	}

	.tiptap-container :global(.tiptap a:hover) {
		color: hsl(var(--primary) / 0.8);
	}

	/* ========================================
	   Blockquote - shadcn border-l pattern
	   ======================================== */
	.tiptap-container :global(.tiptap blockquote) {
		border-left: 3px solid hsl(var(--border));
		padding-left: 1rem;
		margin-left: 0;
		color: hsl(var(--muted-foreground));
	}

	/* ========================================
	   Horizontal Rule
	   ======================================== */
	.tiptap-container :global(.tiptap hr) {
		border: none;
		border-top: 1px solid hsl(var(--border));
		margin: 1.5rem 0;
	}

	/* ========================================
	   Inline Code - matches shadcn kbd/code pattern
	   ======================================== */
	.tiptap-container :global(.tiptap :not(pre) > code) {
		background: hsl(var(--muted));
		padding: 0.125rem 0.375rem;
		border-radius: calc(var(--radius) - 2px);
		font-size: 0.875em;
		font-weight: 500;
	}

	:global(.dark) .tiptap-container :global(.tiptap :not(pre) > code) {
		background: hsl(var(--muted) / 0.5);
	}
</style>
