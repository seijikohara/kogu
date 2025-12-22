<script lang="ts">
	import { ChevronsUpDown, Pencil } from '@lucide/svelte';
	import { Editor, Extension } from '@tiptap/core';
	import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
	import { Image } from '@tiptap/extension-image';
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
	import 'katex/dist/katex.min.css';
	import { common, createLowlight } from 'lowlight';
	import MarkdownIt from 'markdown-it';
	import texmath from 'markdown-it-texmath';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { Markdown } from 'tiptap-markdown';
	import { detectDiagramType, renderDiagram } from '$lib/services/diagram.js';
	import FloatingLanguageCombobox from './floating-language-combobox.svelte';
	import { LANGUAGES, openLanguageCombobox } from './language-combobox-state.svelte.js';

	// ProseMirror Node type (simplified interface for type checking)
	interface PMNode {
		type: { name: string };
		attrs: Record<string, unknown>;
		isBlock: boolean;
		textContent: string;
		nodeSize: number;
	}

	// markdown-it Token type (simplified for our use)
	interface MdToken {
		type: string;
		tag: string;
		map: [number, number] | null;
		content: string;
		children: MdToken[] | null;
		block: boolean;
		nesting: -1 | 0 | 1;
	}

	// Helper function to escape HTML attributes
	const escapeHtml = (text: string): string =>
		text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');

	// Create a markdown-it instance for source map parsing
	const mdParser = new MarkdownIt();

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

							// GitHub-compatible ```math code block syntax
							const defaultFence =
								md.renderer.rules['fence'] ??
								((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

							md.renderer.rules['fence'] = (tokens, idx, options, env, self) => {
								const token = tokens[idx];
								const info = token?.info?.trim().toLowerCase() ?? '';

								// Handle ```math code blocks
								if (info === 'math') {
									const latex = token?.content?.trim() ?? '';
									return `<div data-type="block-math" data-latex="${escapeHtml(latex)}"></div>`;
								}

								// Default fence rendering for other languages
								return defaultFence(tokens, idx, options, env, self);
							};
						},
					},
				},
			};
		},
	});

	// Create lowlight instance with common languages
	const lowlight = createLowlight(common);

	// Custom CodeBlock extension with language selector and diagram rendering
	const CodeBlockWithLanguageSelector = CodeBlockLowlight.extend({
		addNodeView() {
			return ({ node, getPos, editor }) => {
				const pmNode = node as PMNode;
				const language = pmNode.attrs['language'] as string | null;
				const diagramType = language ? detectDiagramType(language) : null;

				// For diagram languages, render the diagram
				if (diagramType) {
					return createDiagramNodeView(pmNode, getPos, editor, diagramType);
				}

				// For regular code blocks, use standard code editor view
				return createCodeBlockNodeView(pmNode, getPos, editor);
			};
		},
	});

	// Create node view for diagram code blocks (read-only rendering)
	// Key design decisions:
	// 1. No contentDOM: Diagrams are read-only, ProseMirror doesn't need to sync content
	// 2. Version tracking: Each render has a version to detect superseded renders
	// 3. DOM validity check: Verify element is still connected before updating
	// 4. Sequential rendering: Use setTimeout to avoid blocking UI
	const createDiagramNodeView = (
		pmNode: PMNode,
		_getPos: () => number | undefined,
		_editor: Editor,
		initialDiagramType: ReturnType<typeof detectDiagramType>
	) => {
		// Capture initial content at creation time (immutable for this instance)
		const initialContent = pmNode.textContent;

		const container = document.createElement('div');
		container.className = 'diagram-block-wrapper';

		// Header with diagram type label
		const header = document.createElement('div');
		header.className = 'diagram-block-header';

		const label = document.createElement('span');
		label.className = 'diagram-block-label';
		label.textContent = getDiagramLabel(initialDiagramType);
		header.appendChild(label);
		container.appendChild(header);

		// Diagram render area
		const diagramContainer = document.createElement('div');
		diagramContainer.className = 'diagram-render-area';
		diagramContainer.innerHTML = '<div class="diagram-loading">Loading...</div>';
		container.appendChild(diagramContainer);

		// State for this NodeView instance
		let currentVersion = 0;
		let lastRenderedContent = '';
		let lastRenderedType: ReturnType<typeof detectDiagramType> = null;
		let isDestroyed = false;

		// Render diagram with version tracking
		const renderWithVersion = (
			content: string,
			type: ReturnType<typeof detectDiagramType>,
			version: number
		) => {
			if (!type) {
				diagramContainer.innerHTML = '<div class="diagram-error">Unknown diagram type</div>';
				return;
			}

			// Use setTimeout to yield to the event loop and prevent UI blocking
			setTimeout(async () => {
				// Validate before rendering
				if (isDestroyed || version !== currentVersion || !container.isConnected) {
					return;
				}

				try {
					const result = await renderDiagram(type, content);

					// Validate after async operation
					if (isDestroyed || version !== currentVersion || !container.isConnected) {
						return;
					}

					if (result.success) {
						diagramContainer.innerHTML = result.html;
					} else {
						diagramContainer.innerHTML = `<div class="diagram-error">${result.error ?? 'Render failed'}</div>`;
					}

					lastRenderedContent = content;
					lastRenderedType = type;
				} catch (error) {
					// Validate before error display
					if (isDestroyed || version !== currentVersion || !container.isConnected) {
						return;
					}
					const message = error instanceof Error ? error.message : String(error);
					diagramContainer.innerHTML = `<div class="diagram-error">${message}</div>`;
				}
			}, 0);
		};

		// Schedule a render (increments version to cancel pending renders)
		const scheduleRender = (content: string, type: ReturnType<typeof detectDiagramType>) => {
			// Skip if already rendered with same content and type
			if (content === lastRenderedContent && type === lastRenderedType) {
				return;
			}

			// Increment version to invalidate any pending renders
			currentVersion++;
			const version = currentVersion;

			diagramContainer.innerHTML = '<div class="diagram-loading">Rendering...</div>';
			renderWithVersion(content, type, version);
		};

		// Initial render
		scheduleRender(initialContent, initialDiagramType);

		return {
			dom: container,
			// No contentDOM: Diagram blocks are read-only, no need for ProseMirror content sync
			// This is intentional - prevents issues with ProseMirror trying to manage hidden content
			update: (updatedNode: PMNode) => {
				if (updatedNode.type.name !== 'codeBlock') {
					return false;
				}
				const updatedLanguage = updatedNode.attrs['language'] as string | null;
				const updatedDiagramType = updatedLanguage ? detectDiagramType(updatedLanguage) : null;

				// If language changed to non-diagram, reject update (will recreate node view)
				if (!updatedDiagramType) {
					return false;
				}

				// Update label if diagram type changed
				if (updatedDiagramType !== lastRenderedType) {
					label.textContent = getDiagramLabel(updatedDiagramType);
				}

				// Re-render if content or type changed
				const newContent = updatedNode.textContent;
				if (newContent !== lastRenderedContent || updatedDiagramType !== lastRenderedType) {
					scheduleRender(newContent, updatedDiagramType);
				}

				return true;
			},
			destroy: () => {
				isDestroyed = true;
			},
		};
	};

	// Get human-readable diagram type label
	const getDiagramLabel = (type: ReturnType<typeof detectDiagramType>): string => {
		switch (type) {
			case 'mermaid':
				return 'Mermaid';
			case 'plantuml':
				return 'PlantUML';
			case 'graphviz':
				return 'GraphViz';
			default:
				return 'Diagram';
		}
	};

	// Get display label for a language value
	const getLanguageLabel = (value: string): string => {
		const found = LANGUAGES.find((lang) => lang.value === value);
		return found?.label ?? value ?? 'Plain Text';
	};

	// Create a trigger button for language selection that opens the external combobox
	const createLanguageTrigger = (
		currentLanguage: string,
		onchange: (newLanguage: string) => void
	): HTMLButtonElement => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className =
			'inline-flex h-7 w-[140px] items-center justify-between rounded-md border border-input bg-background px-2 text-xs hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1';

		// Create span for label
		const labelSpan = document.createElement('span');
		labelSpan.className = 'truncate';
		labelSpan.textContent = getLanguageLabel(currentLanguage);
		button.appendChild(labelSpan);

		// Create icon container
		const iconSpan = document.createElement('span');
		iconSpan.className = 'ml-1 h-4 w-4 shrink-0 opacity-50';
		iconSpan.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>';
		button.appendChild(iconSpan);

		// Store current language in data attribute
		button.dataset['language'] = currentLanguage;

		// Handle click - open the external combobox
		button.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			openLanguageCombobox(button, button.dataset['language'] ?? '', onchange);
		});

		return button;
	};

	// Update trigger button label
	const updateLanguageTrigger = (button: HTMLButtonElement, newLanguage: string): void => {
		button.dataset['language'] = newLanguage;
		const labelSpan = button.querySelector('span.truncate');
		if (labelSpan) {
			labelSpan.textContent = getLanguageLabel(newLanguage);
		}
	};

	// Create node view for regular code blocks
	const createCodeBlockNodeView = (
		pmNode: PMNode,
		getPos: () => number | undefined,
		editor: Editor
	) => {
		const container = document.createElement('div');
		container.className = 'code-block-wrapper';

		// Language selector header
		const header = document.createElement('div');
		header.className = 'code-block-header';
		container.appendChild(header);

		// Code content
		const pre = document.createElement('pre');
		const code = document.createElement('code');
		pre.appendChild(code);
		container.appendChild(pre);

		// Current language state
		let currentLanguage = (pmNode.attrs['language'] as string | null) ?? '';

		// Handle language change from combobox
		const handleLanguageChange = (newLanguage: string) => {
			const pos = getPos();
			if (typeof pos === 'number') {
				// Update local state first
				currentLanguage = newLanguage;
				updateLanguageTrigger(triggerButton, newLanguage);

				// Dispatch to ProseMirror
				editor.view.dispatch(
					editor.view.state.tr.setNodeMarkup(pos, undefined, {
						...pmNode.attrs,
						language: newLanguage || null,
					})
				);
			}
		};

		// Create and append trigger button for combobox
		const triggerButton = createLanguageTrigger(currentLanguage, handleLanguageChange);
		header.appendChild(triggerButton);

		return {
			dom: container,
			contentDOM: code,
			// Allow events in the header (button) to pass through
			stopEvent: (event: Event) => {
				const target = event.target as HTMLElement;
				// Stop ProseMirror from handling events in the header area
				if (header.contains(target)) {
					return true;
				}
				return false;
			},
			update: (updatedNode: PMNode) => {
				if (updatedNode.type.name !== 'codeBlock') {
					return false;
				}
				const updatedLanguage = updatedNode.attrs['language'] as string | null;

				// If language changed to a diagram type, reject update (will recreate node view)
				if (updatedLanguage && detectDiagramType(updatedLanguage)) {
					return false;
				}

				// Update trigger button if language changed
				if (currentLanguage !== (updatedLanguage ?? '')) {
					currentLanguage = updatedLanguage ?? '';
					updateLanguageTrigger(triggerButton, currentLanguage);
				}
				return true;
			},
			destroy: () => {
				// Clean up by removing element
				triggerButton.remove();
			},
		};
	};

	interface MarkdownStorage {
		readonly getMarkdown: () => string;
	}

	// Source map entry: maps a block to its source line range
	interface SourceMapEntry {
		readonly startLine: number; // 1-indexed
		readonly endLine: number; // 1-indexed
		readonly type: string; // Token type (heading_open, paragraph_open, etc.)
		readonly content: string; // Text content for matching
	}

	// Leaf block types in ProseMirror - these are the actual content blocks
	// Container types (table, tableRow, bulletList, etc.) are NOT leaf blocks
	const LEAF_BLOCK_TYPES = new Set(['heading', 'paragraph', 'codeBlock', 'horizontalRule']);

	// Token types that represent leaf-level content (not containers)
	// These correspond to ProseMirror's leaf block types
	const LEAF_TOKEN_TYPES = new Set([
		'heading_open', // Corresponds to 'heading' in PM
		'paragraph_open', // Corresponds to 'paragraph' in PM
		'fence', // Corresponds to 'codeBlock' in PM
		'code_block', // Corresponds to 'codeBlock' in PM
		'hr', // Corresponds to 'horizontalRule' in PM
	]);

	// Table cell tokens (each cell contains a paragraph in ProseMirror)
	const TABLE_CELL_TYPES = new Set(['th_open', 'td_open']);

	// Accumulator state for source map building
	interface SourceMapState {
		readonly entries: readonly SourceMapEntry[];
		readonly inTable: boolean;
	}

	// Process a single token and return updated state
	const processToken = (
		state: SourceMapState,
		token: MdToken,
		nextToken: MdToken | undefined
	): SourceMapState => {
		// Track table state
		if (token.type === 'table_open') {
			return { ...state, inTable: true };
		}
		if (token.type === 'table_close') {
			return { ...state, inTable: false };
		}

		// Skip tokens without source map
		if (!token.map) return state;

		// Handle table cells (each cell = one paragraph in ProseMirror)
		if (state.inTable && TABLE_CELL_TYPES.has(token.type)) {
			const content = nextToken?.type === 'inline' ? nextToken.content : '';
			return {
				...state,
				entries: [
					...state.entries,
					{
						startLine: token.map[0] + 1,
						endLine: token.map[1],
						type: token.type,
						content: content.slice(0, 100),
					},
				],
			};
		}

		// Skip paragraphs inside tables (they're handled by cell tokens)
		if (state.inTable && token.type === 'paragraph_open') {
			return state;
		}

		// Process leaf token types
		if (LEAF_TOKEN_TYPES.has(token.type)) {
			const content =
				token.type === 'fence' || token.type === 'code_block'
					? token.content
					: nextToken?.type === 'inline'
						? nextToken.content
						: '';

			return {
				...state,
				entries: [
					...state.entries,
					{
						startLine: token.map[0] + 1,
						endLine: token.map[1],
						type: token.type,
						content: content.slice(0, 100),
					},
				],
			};
		}

		return state;
	};

	// Build source map from markdown using markdown-it tokens
	// Only captures leaf-level content tokens that correspond to ProseMirror leaf blocks
	const buildSourceMap = (markdown: string): readonly SourceMapEntry[] => {
		const tokens = mdParser.parse(markdown, {}) as MdToken[];
		const initialState: SourceMapState = { entries: [], inTable: false };

		const finalState = tokens.reduce(
			(state, token, index) => processToken(state, token, tokens[index + 1]),
			initialState
		);

		return finalState.entries;
	};

	// Check if a ProseMirror node is a leaf block (content-bearing, not a container)
	const isLeafBlock = (node: PMNode): boolean => LEAF_BLOCK_TYPES.has(node.type.name);

	// Get the leaf block index at cursor position in ProseMirror document
	// Note: Uses mutable variables due to ProseMirror's callback-based descendants API
	const getBlockIndexAtCursor = (editor: Editor): number => {
		const { from } = editor.state.selection;
		let blockIndex = 0;
		let cursorBlockIndex = 0;

		editor.state.doc.descendants((node: PMNode, pos: number) => {
			if (!isLeafBlock(node)) return true;

			if (pos <= from && from <= pos + node.nodeSize) {
				cursorBlockIndex = blockIndex;
			}
			blockIndex++;
			return true;
		});

		return cursorBlockIndex;
	};

	// Get the ProseMirror position at a given leaf block index
	// Note: Uses mutable variables due to ProseMirror's callback-based descendants API
	const getBlockPositionByIndex = (editor: Editor, targetIndex: number): number => {
		let blockIndex = 0;
		let targetPos = 1;

		editor.state.doc.descendants((node: PMNode, pos: number) => {
			if (targetPos > 1 && blockIndex > targetIndex) return false;
			if (!isLeafBlock(node)) return true;

			if (blockIndex === targetIndex) {
				targetPos = pos + 1;
				return false;
			}
			blockIndex++;
			return true;
		});

		return targetPos;
	};

	// Map ProseMirror cursor position to Markdown line number using source map
	const getMarkdownLineFromCursor = (editor: Editor, markdown: string): number => {
		const { from } = editor.state.selection;

		// Edge case: empty or minimal document
		if (editor.state.doc.content.size <= 1 || from <= 1) return 1;

		// Build source map from markdown
		const sourceMap = buildSourceMap(markdown);
		if (sourceMap.length === 0) return 1;

		// Get block index at cursor
		const blockIndex = getBlockIndexAtCursor(editor);

		// Find the corresponding source map entry
		// Use min to handle edge cases where ProseMirror has more blocks
		const entryIndex = Math.min(blockIndex, sourceMap.length - 1);
		const entry = sourceMap[entryIndex];

		return entry?.startLine ?? 1;
	};

	// Find the block index that contains or is closest to the target line
	const findBlockIndexForLine = (
		sourceMap: readonly SourceMapEntry[],
		targetLine: number
	): number => {
		// Find exact match: block that contains the target line
		const exactMatchIndex = sourceMap.findIndex(
			(entry) => targetLine >= entry.startLine && targetLine < entry.endLine
		);
		if (exactMatchIndex !== -1) return exactMatchIndex;

		// Find the first block that starts after target line, then use previous block
		const nextBlockIndex = sourceMap.findIndex((entry) => entry.startLine > targetLine);
		if (nextBlockIndex > 0) return nextBlockIndex - 1;
		if (nextBlockIndex === 0) return 0;

		// Target line is after all blocks, use last block
		return sourceMap.length - 1;
	};

	// Map Markdown line number to ProseMirror position using source map
	const getProseMirrorPosFromLine = (
		editor: Editor,
		markdown: string,
		targetLine: number
	): number => {
		// Edge case
		if (targetLine <= 1) return 1;

		// Build source map from markdown
		const sourceMap = buildSourceMap(markdown);
		if (sourceMap.length === 0) return 1;

		// Find which block contains this line
		const targetBlockIndex = findBlockIndexForLine(sourceMap, targetLine);

		// Get the ProseMirror position at that block index
		return getBlockPositionByIndex(editor, targetBlockIndex);
	};

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
					// Disable link from StarterKit to use custom Link configuration
					link: false,
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
				Image.configure({
					inline: false,
					allowBase64: true,
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

				// Get current markdown source from editor
				const markdown = getMarkdownFromEditor(editor);

				// Map cursor position to markdown line using block-based mapping
				const lineNumber = getMarkdownLineFromCursor(editor, markdown);
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

		// Get markdown source
		const markdown = getMarkdownFromEditor(editor);

		// Map markdown line to ProseMirror position using block-based mapping
		const pos = getProseMirrorPosFromLine(editor, markdown, line);

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
		<div bind:this={element} class="tiptap-editor h-full max-w-none"></div>
	</div>
</div>

<!-- Floating language combobox - lives outside NodeView to avoid bits-ui context issue -->
<FloatingLanguageCombobox />

<style>
	/* ========================================
	   Base Editor Styles (shadcn-consistent)
	   ======================================== */
	.tiptap-container :global(.tiptap) {
		outline: none;
		min-height: 100%;
		color: var(--foreground);
		font-size: 0.875rem;
		line-height: 1.625;
	}

	/* Text Selection */
	.tiptap-container :global(.tiptap ::selection) {
		background: color-mix(in oklch, var(--primary) 30%, transparent);
		color: inherit;
	}

	.tiptap-container :global(.tiptap *::selection) {
		background: color-mix(in oklch, var(--primary) 30%, transparent);
		color: inherit;
	}

	/* Placeholder - matches shadcn input placeholder */
	.tiptap-container :global(.tiptap p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: var(--muted-foreground);
		pointer-events: none;
		height: 0;
	}

	/* ========================================
	   Typography - Headings
	   ======================================== */
	.tiptap-container :global(.tiptap h1) {
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.2;
		margin-top: 1.5rem;
		margin-bottom: 1rem;
		color: var(--foreground);
		letter-spacing: -0.025em;
	}

	.tiptap-container :global(.tiptap h2) {
		font-size: 1.5rem;
		font-weight: 600;
		line-height: 1.25;
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		color: var(--foreground);
		letter-spacing: -0.02em;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.5rem;
	}

	.tiptap-container :global(.tiptap h3) {
		font-size: 1.25rem;
		font-weight: 600;
		line-height: 1.3;
		margin-top: 1.25rem;
		margin-bottom: 0.5rem;
		color: var(--foreground);
		letter-spacing: -0.015em;
	}

	.tiptap-container :global(.tiptap h4) {
		font-size: 1.125rem;
		font-weight: 600;
		line-height: 1.4;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
		color: var(--foreground);
	}

	.tiptap-container :global(.tiptap h5) {
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.5;
		margin-top: 1rem;
		margin-bottom: 0.25rem;
		color: var(--foreground);
	}

	.tiptap-container :global(.tiptap h6) {
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.5;
		margin-top: 1rem;
		margin-bottom: 0.25rem;
		color: var(--muted-foreground);
	}

	/* First child headings - no top margin */
	.tiptap-container :global(.tiptap > h1:first-child),
	.tiptap-container :global(.tiptap > h2:first-child),
	.tiptap-container :global(.tiptap > h3:first-child),
	.tiptap-container :global(.tiptap > h4:first-child),
	.tiptap-container :global(.tiptap > h5:first-child),
	.tiptap-container :global(.tiptap > h6:first-child) {
		margin-top: 0;
	}

	/* ========================================
	   Typography - Paragraphs
	   ======================================== */
	.tiptap-container :global(.tiptap p) {
		margin-top: 0;
		margin-bottom: 0.75rem;
		line-height: 1.625;
	}

	.tiptap-container :global(.tiptap p:last-child) {
		margin-bottom: 0;
	}

	/* ========================================
	   Typography - Inline Formatting
	   ======================================== */
	.tiptap-container :global(.tiptap strong) {
		font-weight: 600;
		color: var(--foreground);
	}

	.tiptap-container :global(.tiptap em) {
		font-style: italic;
	}

	.tiptap-container :global(.tiptap s),
	.tiptap-container :global(.tiptap del) {
		text-decoration: line-through;
		color: var(--muted-foreground);
	}

	.tiptap-container :global(.tiptap u) {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* ========================================
	   List Styles - Unordered List
	   ======================================== */
	.tiptap-container :global(.tiptap ul:not([data-type='taskList'])) {
		list-style-type: disc;
		padding-left: 1.5rem;
		margin-top: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.tiptap-container :global(.tiptap ul:not([data-type='taskList']) ul) {
		list-style-type: circle;
		margin-top: 0.25rem;
		margin-bottom: 0.25rem;
	}

	.tiptap-container :global(.tiptap ul:not([data-type='taskList']) ul ul) {
		list-style-type: square;
	}

	/* ========================================
	   List Styles - Ordered List
	   ======================================== */
	.tiptap-container :global(.tiptap ol) {
		list-style-type: decimal;
		padding-left: 1.5rem;
		margin-top: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.tiptap-container :global(.tiptap ol ol) {
		list-style-type: lower-alpha;
		margin-top: 0.25rem;
		margin-bottom: 0.25rem;
	}

	.tiptap-container :global(.tiptap ol ol ol) {
		list-style-type: lower-roman;
	}

	/* ========================================
	   List Styles - Common
	   ======================================== */
	.tiptap-container :global(.tiptap ul:not([data-type='taskList']) li),
	.tiptap-container :global(.tiptap ol li) {
		margin-bottom: 0.25rem;
	}

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
		border: 1px solid var(--input);
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
		background: var(--primary);
		border-color: var(--primary);
	}

	.tiptap-container
		:global(.tiptap ul[data-type='taskList'] li > label input[type='checkbox']:checked::after) {
		content: '';
		display: block;
		width: 0.5rem;
		height: 0.25rem;
		border-left: 2px solid var(--primary-foreground);
		border-bottom: 2px solid var(--primary-foreground);
		transform: rotate(-45deg) translateY(-1px);
	}

	.tiptap-container
		:global(.tiptap ul[data-type='taskList'] li > label input[type='checkbox']:focus-visible) {
		border-color: var(--ring);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 50%, transparent);
	}

	:global(.dark .tiptap ul[data-type='taskList'] li > label input[type='checkbox']) {
		background: color-mix(in oklch, var(--input) 30%, transparent);
		border-color: color-mix(in oklch, var(--muted-foreground) 50%, transparent);
	}

	:global(.dark .tiptap ul[data-type='taskList'] li > label input[type='checkbox']:checked) {
		background: var(--primary);
		border-color: var(--primary);
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
		color: var(--muted-foreground);
	}

	/* ========================================
	   Table Styles
	   ======================================== */
	.tiptap-container :global(.tiptap .selectedCell:after) {
		background: color-mix(in oklch, var(--primary) 10%, transparent);
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
		background-color: var(--ring);
		bottom: 0;
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
		margin: 1rem 0;
	}

	.tiptap-container :global(.tiptap th),
	.tiptap-container :global(.tiptap td) {
		border: 1px solid var(--border);
		padding: 0.5rem 0.75rem;
		position: relative;
		vertical-align: top;
	}

	/* Remove paragraph margin in table cells to prevent height jump when resize handles appear */
	.tiptap-container :global(.tiptap th p),
	.tiptap-container :global(.tiptap td p) {
		margin: 0;
	}

	:global(.dark .tiptap th),
	:global(.dark .tiptap td) {
		border-color: color-mix(in oklch, var(--muted-foreground) 30%, transparent);
	}

	.tiptap-container :global(.tiptap th) {
		background: color-mix(in oklch, var(--muted) 50%, transparent);
		font-weight: 500;
		text-align: left;
	}

	:global(.dark .tiptap th) {
		background: color-mix(in oklch, var(--muted) 30%, transparent);
	}

	/* ========================================
	   Code Block - shadcn card/input pattern
	   ======================================== */
	.tiptap-container :global(.code-block-wrapper) {
		position: relative;
		margin: 1rem 0;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: color-mix(in oklch, var(--muted) 30%, transparent);
		overflow: hidden;
		box-shadow:
			0 1px 2px 0 rgb(0 0 0 / 0.05),
			0 1px 1px 0 rgb(0 0 0 / 0.03);
	}

	:global(.dark .code-block-wrapper) {
		background: color-mix(in oklch, var(--input) 30%, transparent);
	}

	.tiptap-container :global(.code-block-header) {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 0.5rem 0.75rem;
		background: color-mix(in oklch, var(--muted) 50%, transparent);
		border-bottom: 1px solid var(--border);
	}

	:global(.dark .code-block-header) {
		background: color-mix(in oklch, var(--muted) 30%, transparent);
	}

	/* Language combobox container */
	.tiptap-container :global(.code-block-language-combobox) {
		display: flex;
		align-items: center;
	}

	/* Select arrow for language dropdown */
	.tiptap-container :global(.select-arrow) {
		background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
		background-position: right 0.25rem center;
		background-repeat: no-repeat;
		background-size: 1.25em 1.25em;
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
		color: var(--muted-foreground);
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
		background: color-mix(in oklch, var(--muted) 50%, transparent);
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
		background: var(--accent);
	}

	:global(.dark .tiptap-mathematics-render:hover) {
		background: color-mix(in oklch, var(--accent) 50%, transparent);
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
		background: color-mix(in oklch, var(--muted) 30%, transparent);
		border-radius: var(--radius);
	}

	:global(.dark div.tiptap-mathematics-render) {
		background: color-mix(in oklch, var(--muted) 20%, transparent);
	}

	/* Inline math */
	.tiptap-container :global(span.tiptap-mathematics-render) {
		display: inline;
		vertical-align: baseline;
	}

	/* Math error states */
	.tiptap-container :global(.block-math-error),
	.tiptap-container :global(.inline-math-error) {
		color: var(--destructive);
		font-family: ui-monospace, monospace;
		font-size: 0.875rem;
		background: color-mix(in oklch, var(--destructive) 10%, transparent);
		padding: 0.25rem 0.5rem;
		border-radius: calc(var(--radius) - 2px);
	}

	/* ========================================
	   Images
	   ======================================== */
	.tiptap-container :global(.tiptap img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius);
		margin: 0.5rem 0;
	}

	.tiptap-container :global(.tiptap img.ProseMirror-selectednode) {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	/* ========================================
	   Links - matches shadcn link pattern
	   ======================================== */
	.tiptap-container :global(.tiptap a) {
		color: var(--primary);
		text-decoration: underline;
		text-underline-offset: 4px;
		transition: color 0.15s ease;
	}

	.tiptap-container :global(.tiptap a:hover) {
		color: color-mix(in oklch, var(--primary) 80%, transparent);
	}

	/* ========================================
	   Blockquote - shadcn border-l pattern
	   ======================================== */
	.tiptap-container :global(.tiptap blockquote) {
		border-left: 3px solid color-mix(in oklch, var(--muted-foreground) 50%, transparent);
		padding-left: 1rem;
		margin: 1rem 0;
		margin-left: 0;
		color: var(--muted-foreground);
		font-style: italic;
	}

	.tiptap-container :global(.tiptap blockquote p) {
		margin: 0;
	}

	:global(.dark .tiptap blockquote) {
		border-left-color: color-mix(in oklch, var(--muted-foreground) 40%, transparent);
	}

	/* ========================================
	   Horizontal Rule
	   ======================================== */
	.tiptap-container :global(.tiptap hr) {
		border: none;
		border-top: 2px solid var(--muted-foreground);
		margin: 1.5rem 0;
	}

	/* ========================================
	   Inline Code - matches shadcn kbd/code pattern
	   ======================================== */
	.tiptap-container :global(.tiptap :not(pre) > code) {
		background: var(--muted);
		padding: 0.125rem 0.375rem;
		border-radius: calc(var(--radius) - 2px);
		font-size: 0.875em;
		font-weight: 500;
	}

	:global(.dark .tiptap :not(pre) > code) {
		background: color-mix(in oklch, var(--muted) 50%, transparent);
	}

	/* ========================================
	   Diagram Blocks (Mermaid, PlantUML, GraphViz)
	   ======================================== */
	.tiptap-container :global(.diagram-block-wrapper) {
		position: relative;
		margin: 1rem 0;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: color-mix(in oklch, var(--muted) 20%, transparent);
		overflow: hidden;
		box-shadow:
			0 1px 2px 0 rgb(0 0 0 / 0.05),
			0 1px 1px 0 rgb(0 0 0 / 0.03);
	}

	:global(.dark .diagram-block-wrapper) {
		background: color-mix(in oklch, var(--input) 20%, transparent);
	}

	.tiptap-container :global(.diagram-block-header) {
		display: flex;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: color-mix(in oklch, var(--muted) 50%, transparent);
		border-bottom: 1px solid var(--border);
	}

	:global(.dark .diagram-block-header) {
		background: color-mix(in oklch, var(--muted) 30%, transparent);
	}

	.tiptap-container :global(.diagram-block-label) {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.tiptap-container :global(.diagram-render-area) {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		min-height: 100px;
		background: var(--background);
	}

	:global(.dark .diagram-render-area) {
		background: color-mix(in oklch, var(--background) 50%, transparent);
	}

	/* SVG diagrams (Mermaid, GraphViz) */
	.tiptap-container :global(.diagram-render-area svg) {
		max-width: 100%;
		height: auto;
	}

	/* PlantUML images */
	.tiptap-container :global(.diagram-render-area img.plantuml-diagram) {
		max-width: 100%;
		height: auto;
	}

	/* Loading state */
	.tiptap-container :global(.diagram-loading) {
		color: var(--muted-foreground);
		font-size: 0.875rem;
		font-style: italic;
	}

	/* Error state */
	.tiptap-container :global(.diagram-error) {
		color: var(--destructive);
		font-size: 0.875rem;
		font-family: ui-monospace, monospace;
		background: color-mix(in oklch, var(--destructive) 10%, transparent);
		padding: 0.75rem 1rem;
		border-radius: calc(var(--radius) - 2px);
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* Selection state */
	.tiptap-container :global(.diagram-block-wrapper.ProseMirror-selectednode) {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}
</style>
