<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, placeholder as placeholderExtension, Decoration, type DecorationSet } from '@codemirror/view';
	import { EditorState, StateField, StateEffect } from '@codemirror/state';
	import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language';
	import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
	import { closeBrackets, closeBracketsKeymap, autocompletion } from '@codemirror/autocomplete';
	import { history, defaultKeymap, historyKeymap, undo, redo, selectAll } from '@codemirror/commands';
	import { keymap } from '@codemirror/view';
	import { linter, lintGutter } from '@codemirror/lint';
	import { json, jsonParseLinter } from '@codemirror/lang-json';
	import { xml } from '@codemirror/lang-xml';
	import { yaml } from '@codemirror/lang-yaml';
	import { sql } from '@codemirror/lang-sql';
	import { javascript } from '@codemirror/lang-javascript';
	import { python } from '@codemirror/lang-python';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
	import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

	export type EditorMode = 'json' | 'xml' | 'yaml' | 'sql' | 'javascript' | 'typescript' | 'python' | 'go' | 'rust' | 'java' | 'csharp' | 'kotlin' | 'swift' | 'php' | 'plain';
	export type EditorTheme = 'dark' | 'light';

	export interface CursorPosition {
		line: number;
		column: number;
		selection: number; // Number of selected characters
	}

	export interface HighlightLine {
		line: number;
		type: 'added' | 'removed' | 'changed';
	}

	interface Props {
		value?: string;
		mode?: EditorMode;
		theme?: EditorTheme;
		height?: string;
		readonly?: boolean;
		placeholder?: string;
		gotoLine?: number | null;
		gotoLineTrigger?: number;
		highlightLines?: HighlightLine[];
		onchange?: (value: string) => void;
		oncursorchange?: (position: CursorPosition) => void;
	}

	let {
		value = $bindable(''),
		mode = 'json',
		theme = 'dark',
		height = '300px',
		readonly = false,
		placeholder = '',
		gotoLine = null,
		gotoLineTrigger = 0,
		highlightLines = [],
		onchange,
		oncursorchange,
	}: Props = $props();

	// Line highlight effect and state field
	const setHighlightLinesEffect = StateEffect.define<HighlightLine[]>();

	const highlightLineDecoration = {
		added: Decoration.line({ class: 'cm-highlight-added' }),
		removed: Decoration.line({ class: 'cm-highlight-removed' }),
		changed: Decoration.line({ class: 'cm-highlight-changed' }),
	};

	const highlightLinesField = StateField.define<DecorationSet>({
		create() {
			return Decoration.none;
		},
		update(decorations, tr) {
			const highlightEffect = tr.effects.find((effect) => effect.is(setHighlightLinesEffect));
			if (!highlightEffect) return decorations.map(tr.changes);

			const lines = highlightEffect.value as HighlightLine[];
			if (lines.length === 0) return Decoration.none;

			const decos = lines
				.filter(({ line }) => line >= 1 && line <= tr.state.doc.lines)
				.map(({ line, type }) => {
					const lineInfo = tr.state.doc.line(line);
					return highlightLineDecoration[type].range(lineInfo.from);
				});

			return Decoration.set(decos);
		},
		provide: (f) => EditorView.decorations.from(f),
	});

	let container: HTMLDivElement;
	let view: EditorView | null = null;
	let isUpdatingFromProps = false;

	const languageExtensions: Record<EditorMode, ReturnType<typeof json>> = {
		json: json(),
		xml: xml(),
		yaml: yaml(),
		sql: sql(),
		javascript: javascript(),
		typescript: javascript({ typescript: true }),
		python: python(),
		go: javascript(), // Fallback to JavaScript highlighting for Go
		rust: javascript(), // Fallback to JavaScript highlighting for Rust
		java: javascript(), // Fallback to JavaScript highlighting for Java
		csharp: javascript(), // Fallback to JavaScript highlighting for C#
		kotlin: javascript(), // Fallback to JavaScript highlighting for Kotlin
		swift: javascript(), // Fallback to JavaScript highlighting for Swift
		php: javascript(), // Fallback to JavaScript highlighting for PHP
		plain: json(),
	};

	const lightTheme = EditorView.theme({
		'&': {
			backgroundColor: 'hsl(var(--background))',
			color: 'hsl(var(--foreground))',
		},
		'.cm-content': {
			caretColor: 'hsl(var(--foreground))',
		},
		'.cm-cursor': {
			borderLeftColor: 'hsl(var(--foreground))',
		},
		'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
			backgroundColor: 'hsl(var(--accent))',
		},
		'.cm-activeLine': {
			backgroundColor: 'hsl(var(--muted) / 0.5)',
		},
		'.cm-gutters': {
			backgroundColor: 'hsl(var(--muted))',
			color: 'hsl(var(--muted-foreground))',
			borderRight: '1px solid hsl(var(--border))',
		},
		'.cm-activeLineGutter': {
			backgroundColor: 'hsl(var(--accent))',
		},
	});

	const buildExtensions = () => {
		const extensions = [
			languageExtensions[mode] ?? json(),
			theme === 'dark' ? oneDark : lightTheme,
			EditorState.tabSize.of(2),
			lineNumbers(),
			EditorView.lineWrapping,
			highlightActiveLine(),
			highlightActiveLineGutter(),
			bracketMatching(),
			closeBrackets(),
			keymap.of(closeBracketsKeymap),
			foldGutter(),
			keymap.of(foldKeymap),
			keymap.of(searchKeymap),
			history(),
			keymap.of(historyKeymap),
			autocompletion(),
			EditorState.allowMultipleSelections.of(true),
			rectangularSelection(),
			crosshairCursor(),
			highlightSpecialChars(),
			highlightSelectionMatches(),
			indentOnInput(),
			dropCursor(),
			drawSelection(),
			keymap.of(defaultKeymap),
			lintGutter(),
			highlightLinesField,
			EditorView.updateListener.of((update) => {
				if (update.docChanged && !isUpdatingFromProps) {
					const newValue = update.state.doc.toString();
					value = newValue;
					onchange?.(newValue);
				}
				// Track cursor position changes
				if (update.selectionSet || update.docChanged) {
					const state = update.state;
					const selection = state.selection.main;
					const line = state.doc.lineAt(selection.head);
					oncursorchange?.({
						line: line.number,
						column: selection.head - line.from + 1,
						selection: Math.abs(selection.to - selection.from),
					});
				}
			}),
		];

		// Add syntax linting for JSON
		if (mode === 'json') {
			extensions.push(linter(jsonParseLinter()));
		}

		if (placeholder) {
			extensions.push(placeholderExtension(placeholder));
		}

		if (readonly) {
			extensions.push(EditorState.readOnly.of(true));
			extensions.push(EditorView.editable.of(false));
		}

		return extensions;
	};

	const createEditor = () => {
		if (!container) return;

		view = new EditorView({
			state: EditorState.create({
				doc: value,
				extensions: buildExtensions(),
			}),
			parent: container,
		});
	};

	const destroyEditor = () => {
		if (view) {
			view.destroy();
			view = null;
		}
	};

	// Sync value changes from props to editor
	// Note: We must access `value` at the top level of the effect to ensure it's tracked as a dependency
	$effect(() => {
		const newValue = value;
		if (view) {
			const currentValue = view.state.doc.toString();
			if (currentValue !== newValue) {
				isUpdatingFromProps = true;
				view.dispatch({
					changes: {
						from: 0,
						to: currentValue.length,
						insert: newValue,
					},
				});
				isUpdatingFromProps = false;
			}
		}
	});

	// Recreate editor when mode or theme changes
	$effect(() => {
		// Access reactive dependencies
		const _ = [mode, theme, readonly];
		if (view && container) {
			const currentValue = view.state.doc.toString();
			destroyEditor();
			value = currentValue;
			createEditor();
		}
	});

	// Go to line when gotoLine prop changes
	$effect(() => {
		// Include gotoLineTrigger as dependency to force re-trigger
		const _trigger = gotoLineTrigger;
		if (gotoLine && view) {
			const lineCount = view.state.doc.lines;
			const targetLine = Math.min(Math.max(1, gotoLine), lineCount);
			const line = view.state.doc.line(targetLine);

			view.dispatch({
				selection: { anchor: line.from },
				scrollIntoView: true,
			});

			// Focus the editor
			view.focus();
		}
	});

	// Update highlight lines when prop changes
	$effect(() => {
		const lines = highlightLines;
		if (view) {
			view.dispatch({
				effects: setHighlightLinesEffect.of(lines),
			});
		}
	});

	// Context menu actions
	const handleUndo = () => view && undo(view);
	const handleRedo = () => view && redo(view);
	const handleSelectAll = () => view && selectAll(view);

	const handleCopy = async () => {
		if (!view) return;
		const selection = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to);
		if (selection) await writeText(selection);
	};

	const handleCut = async () => {
		if (!view || readonly) return;
		await handleCopy();
		view.dispatch(view.state.replaceSelection(''));
	};

	const handlePaste = async () => {
		if (!view || readonly) return;
		const text = await readText();
		view.dispatch(view.state.replaceSelection(text));
	};

	// JSON Path calculation
	const getJsonPath = (): string | null => {
		if (!view || mode !== 'json') return null;
		try {
			const pos = view.state.selection.main.head;
			const text = view.state.doc.toString();
			const beforeCursor = text.slice(0, pos);

			const pathParts: string[] = ['$'];
			const stack: Array<{ type: 'object' | 'array'; key?: string; index: number }> = [];
			let inString = false;
			let stringChar = '';
			let currentKey = '';
			let collectingKey = false;

			for (let i = 0; i < beforeCursor.length; i++) {
				const char = beforeCursor[i];

				if (inString) {
					if (char === stringChar && beforeCursor[i - 1] !== '\\') {
						inString = false;
						if (collectingKey) {
							collectingKey = false;
						}
					} else if (collectingKey) {
						currentKey += char;
					}
					continue;
				}

				if (char === '"' || char === "'") {
					inString = true;
					stringChar = char;
					if (stack.length > 0 && stack[stack.length - 1].type === 'object') {
						const next = beforeCursor.slice(i + 1).match(/^[^"]*"\s*:/);
						if (next) {
							collectingKey = true;
							currentKey = '';
						}
					}
					continue;
				}

				if (char === '{') {
					stack.push({ type: 'object', key: currentKey, index: 0 });
					if (currentKey) {
						pathParts.push(currentKey);
						currentKey = '';
					}
				} else if (char === '[') {
					stack.push({ type: 'array', key: currentKey, index: 0 });
					if (currentKey) {
						pathParts.push(currentKey);
						currentKey = '';
					}
				} else if (char === '}' || char === ']') {
					if (stack.length > 0) {
						stack.pop();
						if (pathParts.length > 1) pathParts.pop();
					}
				} else if (char === ',') {
					if (stack.length > 0 && stack[stack.length - 1].type === 'array') {
						stack[stack.length - 1].index++;
					}
				} else if (char === ':' && currentKey && stack.length > 0) {
					pathParts.push(currentKey);
					currentKey = '';
				}
			}

			// Add array index if in array
			if (stack.length > 0 && stack[stack.length - 1].type === 'array') {
				return `${pathParts.join('.')}[${stack[stack.length - 1].index}]`;
			}

			return pathParts.join('.');
		} catch {
			return null;
		}
	};

	// YAML Path calculation
	const getYamlPath = (): string | null => {
		if (!view || mode !== 'yaml') return null;
		try {
			const pos = view.state.selection.main.head;
			const text = view.state.doc.toString();
			const lines = text.slice(0, pos).split('\n');

			const pathParts: string[] = [];
			const indentStack: number[] = [-1];

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith('#')) continue;

				const indent = line.search(/\S/);
				if (indent === -1) continue;

				// Pop stack for dedented lines
				while (indentStack.length > 1 && indent <= indentStack[indentStack.length - 1]) {
					indentStack.pop();
					pathParts.pop();
				}

				// Check for array item
				if (trimmed.startsWith('- ')) {
					const content = trimmed.slice(2);
					const keyMatch = content.match(/^([^:]+):/);
					if (keyMatch) {
						// Array item with key
						const lastIdx = pathParts.length - 1;
						if (lastIdx >= 0 && !pathParts[lastIdx].startsWith('[')) {
							// Find array index
							const arrayIndex = lines.filter(l => {
								const li = l.search(/\S/);
								return li === indent && l.trim().startsWith('- ');
							}).length - 1;
							pathParts.push(`[${Math.max(0, arrayIndex)}]`);
						}
						pathParts.push(keyMatch[1].trim());
						indentStack.push(indent);
					}
				} else {
					// Regular key: value
					const keyMatch = trimmed.match(/^([^:]+):/);
					if (keyMatch) {
						pathParts.push(keyMatch[1].trim());
						indentStack.push(indent);
					}
				}
			}

			return pathParts.length > 0 ? `$.${pathParts.join('.')}` : '$';
		} catch {
			return null;
		}
	};

	// XPath calculation
	const getXPath = (): string | null => {
		if (!view || mode !== 'xml') return null;
		try {
			const pos = view.state.selection.main.head;
			const text = view.state.doc.toString();
			const beforeCursor = text.slice(0, pos);

			const pathParts: string[] = [];
			const tagStack: Array<{ name: string; index: number }> = [];
			const siblingCount: Map<string, number>[] = [new Map()];

			// Simple XML tag parsing
			const tagRegex = /<\/?([a-zA-Z_][\w.-]*)[^>]*\/?>/g;
			let match;

			while ((match = tagRegex.exec(beforeCursor)) !== null) {
				const fullMatch = match[0];
				const tagName = match[1];

				if (fullMatch.startsWith('</')) {
					// Closing tag
					if (tagStack.length > 0 && tagStack[tagStack.length - 1].name === tagName) {
						tagStack.pop();
						siblingCount.pop();
					}
				} else if (fullMatch.endsWith('/>')) {
					// Self-closing tag - count as sibling but don't push to stack
					const currentSiblings = siblingCount[siblingCount.length - 1];
					currentSiblings.set(tagName, (currentSiblings.get(tagName) || 0) + 1);
				} else {
					// Opening tag
					const currentSiblings = siblingCount[siblingCount.length - 1];
					const count = (currentSiblings.get(tagName) || 0) + 1;
					currentSiblings.set(tagName, count);

					tagStack.push({ name: tagName, index: count });
					siblingCount.push(new Map());
				}
			}

			// Build XPath from stack
			for (const tag of tagStack) {
				pathParts.push(tag.index > 1 ? `${tag.name}[${tag.index}]` : tag.name);
			}

			return pathParts.length > 0 ? `/${pathParts.join('/')}` : '/';
		} catch {
			return null;
		}
	};

	const handleCopyJsonPath = async () => {
		const path = getJsonPath();
		if (path) await writeText(path);
	};

	const handleCopyYamlPath = async () => {
		const path = getYamlPath();
		if (path) await writeText(path);
	};

	const handleCopyXPath = async () => {
		const path = getXPath();
		if (path) await writeText(path);
	};

	const handleFormatJson = () => {
		if (!view || readonly || mode !== 'json') return;
		try {
			const text = view.state.doc.toString();
			const formatted = JSON.stringify(JSON.parse(text), null, 2);
			view.dispatch({
				changes: { from: 0, to: text.length, insert: formatted },
			});
		} catch {
			// Invalid JSON
		}
	};

	const handleMinifyJson = () => {
		if (!view || readonly || mode !== 'json') return;
		try {
			const text = view.state.doc.toString();
			const minified = JSON.stringify(JSON.parse(text));
			view.dispatch({
				changes: { from: 0, to: text.length, insert: minified },
			});
		} catch {
			// Invalid JSON
		}
	};

	// Helper to truncate path for display
	const truncatePath = (path: string, maxLen = 30): string =>
		path.length > maxLen ? `${path.slice(0, maxLen - 3)}...` : path;

	// Build context menu items based on mode
	const buildModeSpecificItems = async (): Promise<Array<Awaited<ReturnType<typeof MenuItem.new>> | Awaited<ReturnType<typeof PredefinedMenuItem.new>>>> => {
		const items: Array<Awaited<ReturnType<typeof MenuItem.new>> | Awaited<ReturnType<typeof PredefinedMenuItem.new>>> = [];

		if (mode === 'json') {
			const jsonPath = getJsonPath();
			items.push(
				await PredefinedMenuItem.new({ item: 'Separator' }),
				await MenuItem.new({
					text: `Copy JSON Path${jsonPath ? ` (${truncatePath(jsonPath)})` : ''}`,
					enabled: !!jsonPath,
					action: handleCopyJsonPath,
				}),
				await MenuItem.new({
					text: 'Format JSON',
					enabled: !readonly,
					action: handleFormatJson,
				}),
				await MenuItem.new({
					text: 'Minify JSON',
					enabled: !readonly,
					action: handleMinifyJson,
				})
			);
		}

		if (mode === 'yaml') {
			const yamlPath = getYamlPath();
			items.push(
				await PredefinedMenuItem.new({ item: 'Separator' }),
				await MenuItem.new({
					text: `Copy YAML Path${yamlPath ? ` (${truncatePath(yamlPath)})` : ''}`,
					enabled: !!yamlPath,
					action: handleCopyYamlPath,
				})
			);
		}

		if (mode === 'xml') {
			const xpath = getXPath();
			items.push(
				await PredefinedMenuItem.new({ item: 'Separator' }),
				await MenuItem.new({
					text: `Copy XPath${xpath ? ` (${truncatePath(xpath)})` : ''}`,
					enabled: !!xpath,
					action: handleCopyXPath,
				})
			);
		}

		return items;
	};

	const showContextMenu = async (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const hasSelection = view ? view.state.selection.main.from !== view.state.selection.main.to : false;
		const modeItems = await buildModeSpecificItems();

		const menu = await Menu.new({
			items: [
				await MenuItem.new({
					text: 'Undo',
					enabled: !readonly,
					accelerator: 'CmdOrCtrl+Z',
					action: handleUndo,
				}),
				await MenuItem.new({
					text: 'Redo',
					enabled: !readonly,
					accelerator: 'CmdOrCtrl+Shift+Z',
					action: handleRedo,
				}),
				await PredefinedMenuItem.new({ item: 'Separator' }),
				await MenuItem.new({
					text: 'Cut',
					enabled: !readonly && hasSelection,
					accelerator: 'CmdOrCtrl+X',
					action: handleCut,
				}),
				await MenuItem.new({
					text: 'Copy',
					enabled: hasSelection,
					accelerator: 'CmdOrCtrl+C',
					action: handleCopy,
				}),
				await MenuItem.new({
					text: 'Paste',
					enabled: !readonly,
					accelerator: 'CmdOrCtrl+V',
					action: handlePaste,
				}),
				await PredefinedMenuItem.new({ item: 'Separator' }),
				await MenuItem.new({
					text: 'Select All',
					accelerator: 'CmdOrCtrl+A',
					action: handleSelectAll,
				}),
				...modeItems,
			],
		});

		await menu.popup();
	};

	onMount(() => {
		createEditor();
	});

	onDestroy(() => {
		destroyEditor();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="code-editor-wrapper" style:height bind:this={container} oncontextmenu={showContextMenu}></div>

<style>
	.code-editor-wrapper {
		position: relative;
		overflow: hidden;
		border: 1px solid hsl(var(--border));
		isolation: isolate; /* Create new stacking context */
		z-index: 0;
	}

	.code-editor-wrapper :global(.cm-editor) {
		height: 100%;
		max-width: 100%;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
		font-size: 14px;
	}

	.code-editor-wrapper :global(.cm-scroller) {
		overflow: auto;
	}

	.code-editor-wrapper :global(.cm-content) {
		max-width: 100%;
	}

	.code-editor-wrapper :global(.cm-focused) {
		outline: none;
	}

	.code-editor-wrapper :global(.cm-gutters) {
		border-right: 1px solid hsl(var(--border));
	}

	.code-editor-wrapper :global(.cm-placeholder) {
		color: hsl(var(--muted-foreground));
		font-style: italic;
	}

	.code-editor-wrapper :global(.cm-foldGutter) {
		width: 1em;
	}

	/* Lint gutter styles */
	.code-editor-wrapper :global(.cm-lint-marker-error) {
		content: '';
	}

	.code-editor-wrapper :global(.cm-lintRange-error) {
		background-color: hsl(0 84% 60% / 0.2);
		border-bottom: 2px wavy hsl(0 84% 60%);
	}

	.code-editor-wrapper :global(.cm-lintRange-warning) {
		background-color: hsl(45 93% 47% / 0.2);
		border-bottom: 2px wavy hsl(45 93% 47%);
	}

	.code-editor-wrapper :global(.cm-diagnostic) {
		padding: 4px 8px;
		margin: 2px 0;
		border-radius: 2px;
	}

	.code-editor-wrapper :global(.cm-diagnostic-error) {
		background-color: hsl(0 84% 60% / 0.15);
		border-left: 3px solid hsl(0 84% 60%);
	}

	.code-editor-wrapper :global(.cm-diagnostic-warning) {
		background-color: hsl(45 93% 47% / 0.15);
		border-left: 3px solid hsl(45 93% 47%);
	}

	/* Line highlight styles */
	.code-editor-wrapper :global(.cm-highlight-added) {
		background-color: hsl(142 76% 36% / 0.25);
	}

	.code-editor-wrapper :global(.cm-highlight-removed) {
		background-color: hsl(0 84% 60% / 0.25);
	}

	.code-editor-wrapper :global(.cm-highlight-changed) {
		background-color: hsl(45 93% 47% / 0.25);
	}
</style>
