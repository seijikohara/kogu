<script lang="ts">
	import * as monaco from 'monaco-editor';
	import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
	import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
	import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
	import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
	import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
	import { configureMonacoYaml } from 'monaco-yaml';
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import yamlWorker from '$lib/workers/yaml.worker.js?worker';

	// Configure Monaco Environment to use workers (Vite official approach)
	// Reference: https://github.com/microsoft/monaco-editor/tree/main/samples/browser-esm-vite-react
	if (browser) {
		self.MonacoEnvironment = {
			getWorker(_: unknown, label: string) {
				switch (label) {
					case 'json':
						return new jsonWorker();
					case 'yaml':
						return new yamlWorker();
					case 'typescript':
					case 'javascript':
						return new tsWorker();
					case 'css':
					case 'scss':
					case 'less':
						return new cssWorker();
					case 'html':
					case 'handlebars':
					case 'razor':
						return new htmlWorker();
					default:
						return new editorWorker();
				}
			},
		};
	}

	export type EditorMode =
		| 'json'
		| 'xml'
		| 'yaml'
		| 'sql'
		| 'javascript'
		| 'typescript'
		| 'python'
		| 'go'
		| 'rust'
		| 'java'
		| 'csharp'
		| 'kotlin'
		| 'swift'
		| 'php'
		| 'plain'
		| 'markdown';
	export type EditorTheme = 'dark' | 'light';

	export interface CursorPosition {
		line: number;
		column: number;
		selection: number;
	}

	export interface HighlightLine {
		line: number;
		type: 'added' | 'removed' | 'changed';
	}

	export interface ContextMenuItem {
		text: string;
		enabled?: boolean;
		action: () => void | Promise<void>;
	}

	// Context for showing context menu (injected from parent)
	export interface EditorContext {
		readonly: boolean;
		hasSelection: boolean;
		getSelectedText: () => string;
		undo: () => void;
		redo: () => void;
		cut: () => void;
		copy: () => void;
		paste: (text: string) => void;
		selectAll: () => void;
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
		onfocus?: () => void;
		onblur?: () => void;
		oncontextmenu?: (event: MouseEvent, context: EditorContext) => void;
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
		onfocus,
		onblur,
		oncontextmenu,
	}: Props = $props();

	const LANGUAGE_MAP: Record<EditorMode, string> = {
		json: 'json',
		xml: 'xml',
		yaml: 'yaml',
		sql: 'sql',
		javascript: 'javascript',
		typescript: 'typescript',
		python: 'python',
		go: 'go',
		rust: 'rust',
		java: 'java',
		csharp: 'csharp',
		kotlin: 'kotlin',
		swift: 'swift',
		php: 'php',
		plain: 'plaintext',
		markdown: 'markdown',
	};

	let container: HTMLDivElement;
	let editor: monaco.editor.IStandaloneCodeEditor | null = null;
	let decorationCollection: monaco.editor.IEditorDecorationsCollection | null = null;
	let isUpdatingFromProps = false;
	let yamlConfigured = false;

	const configureYaml = () => {
		if (yamlConfigured) return;
		configureMonacoYaml(monaco, {
			validate: true,
			format: true,
		});
		yamlConfigured = true;
	};

	const getMonacoTheme = (t: EditorTheme): string => (t === 'dark' ? 'vs-dark' : 'vs');

	const createEditor = () => {
		if (!container || editor) return;

		if (mode === 'yaml') {
			configureYaml();
		}

		monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
			validate: true,
			allowComments: false,
			trailingCommas: 'error',
		});

		editor = monaco.editor.create(container, {
			value,
			language: LANGUAGE_MAP[mode],
			theme: getMonacoTheme(theme),
			readOnly: readonly,
			automaticLayout: true,
			minimap: { enabled: false },
			lineNumbers: 'on',
			folding: true,
			foldingStrategy: 'auto',
			showFoldingControls: 'mouseover',
			wordWrap: 'on',
			tabSize: 2,
			insertSpaces: false,
			scrollBeyondLastLine: false,
			renderLineHighlight: 'all',
			bracketPairColorization: { enabled: true },
			autoClosingBrackets: 'always',
			autoClosingQuotes: 'always',
			formatOnPaste: false,
			formatOnType: false,
			suggestOnTriggerCharacters: true,
			quickSuggestions: true,
			// Use custom context menu if handler provided, otherwise use Monaco's built-in
			contextmenu: !oncontextmenu,
			fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
			fontSize: 14,
		});

		editor.onDidChangeModelContent(() => {
			if (isUpdatingFromProps) return;
			const newValue = editor?.getValue() ?? '';
			value = newValue;
			onchange?.(newValue);
		});

		editor.onDidChangeCursorPosition((e) => {
			if (!editor) return;
			const model = editor.getModel();
			if (!model) return;

			const selection = editor.getSelection();
			const selectionLength = selection ? model.getValueInRange(selection).length : 0;

			oncursorchange?.({
				line: e.position.lineNumber,
				column: e.position.column,
				selection: selectionLength,
			});
		});

		editor.onDidFocusEditorText(() => {
			onfocus?.();
		});

		editor.onDidBlurEditorText(() => {
			onblur?.();
		});

		if (placeholder && !value) {
			updatePlaceholder();
		}
	};

	const updatePlaceholder = () => {
		// Monaco does not have native placeholder support
		// We'll handle this with CSS overlay if needed
	};

	const destroyEditor = () => {
		if (decorationCollection) {
			decorationCollection.clear();
			decorationCollection = null;
		}
		if (editor) {
			editor.dispose();
			editor = null;
		}
	};

	// Sync value changes from props to editor
	$effect(() => {
		const newValue = value;
		if (editor && !isUpdatingFromProps) {
			const currentValue = editor.getValue();
			if (currentValue !== newValue) {
				isUpdatingFromProps = true;
				editor.setValue(newValue);
				isUpdatingFromProps = false;
			}
		}
	});

	// Update theme when changed
	$effect(() => {
		const currentTheme = theme;
		if (editor) {
			monaco.editor.setTheme(getMonacoTheme(currentTheme));
		}
	});

	// Recreate editor when mode changes
	$effect(() => {
		const currentMode = mode;
		if (editor) {
			const model = editor.getModel();
			if (model) {
				monaco.editor.setModelLanguage(model, LANGUAGE_MAP[currentMode]);
			}
			if (currentMode === 'yaml') {
				configureYaml();
			}
		}
	});

	// Handle readonly changes
	$effect(() => {
		const currentReadonly = readonly;
		if (editor) {
			editor.updateOptions({ readOnly: currentReadonly });
		}
	});

	// Go to line when gotoLine prop changes
	$effect(() => {
		// Include gotoLineTrigger as dependency to force re-trigger
		const _trigger = gotoLineTrigger;
		if (gotoLine && editor && _trigger !== undefined) {
			const model = editor.getModel();
			if (!model) return;

			const lineCount = model.getLineCount();
			const targetLine = Math.min(Math.max(1, gotoLine), lineCount);

			editor.revealLineInCenter(targetLine);
			editor.setPosition({ lineNumber: targetLine, column: 1 });
			editor.focus();
		}
	});

	// Update highlight lines when prop changes
	$effect(() => {
		const lines = highlightLines;
		if (!editor) return;

		const decorations: monaco.editor.IModelDeltaDecoration[] = lines.map(({ line, type }) => ({
			range: new monaco.Range(line, 1, line, 1),
			options: {
				isWholeLine: true,
				className: `highlight-${type}`,
				glyphMarginClassName: `highlight-glyph-${type}`,
			},
		}));

		if (!decorationCollection) {
			decorationCollection = editor.createDecorationsCollection(decorations);
		} else {
			decorationCollection.set(decorations);
		}
	});

	// Editor actions (exposed via EditorContext)
	const handleUndo = () => editor?.trigger('keyboard', 'undo', null);
	const handleRedo = () => editor?.trigger('keyboard', 'redo', null);
	const handleSelectAll = () => editor?.trigger('keyboard', 'editor.action.selectAll', null);

	const getSelectedText = (): string => {
		if (!editor) return '';
		const selection = editor.getSelection();
		if (!selection) return '';
		const model = editor.getModel();
		if (!model) return '';
		return model.getValueInRange(selection);
	};

	const handleCut = () => {
		if (!editor || readonly) return;
		editor.trigger('keyboard', 'editor.action.clipboardCutAction', null);
	};

	const handleCopy = () => {
		if (!editor) return;
		editor.trigger('keyboard', 'editor.action.clipboardCopyAction', null);
	};

	const handlePaste = (text: string) => {
		if (!editor || readonly) return;
		editor.trigger('keyboard', 'type', { text });
	};

	// Build editor context for context menu handler
	const buildEditorContext = (): EditorContext => ({
		readonly,
		hasSelection: editor ? !editor.getSelection()?.isEmpty() : false,
		getSelectedText,
		undo: handleUndo,
		redo: handleRedo,
		cut: handleCut,
		copy: handleCopy,
		paste: handlePaste,
		selectAll: handleSelectAll,
	});

	const showContextMenu = (e: MouseEvent) => {
		if (oncontextmenu) {
			e.preventDefault();
			e.stopPropagation();
			oncontextmenu(e, buildEditorContext());
		}
		// If no custom handler, Monaco's built-in context menu will be used
	};

	// Exported methods for parent components
	export const getSelectionRange = (): { start: number; end: number } => {
		if (!editor) return { start: 0, end: 0 };
		const model = editor.getModel();
		if (!model) return { start: 0, end: 0 };
		const selection = editor.getSelection();
		if (!selection) return { start: 0, end: 0 };
		return {
			start: model.getOffsetAt(selection.getStartPosition()),
			end: model.getOffsetAt(selection.getEndPosition()),
		};
	};

	export const setSelectionRange = (start: number, end: number) => {
		if (!editor) return;
		const model = editor.getModel();
		if (!model) return;
		const startPos = model.getPositionAt(start);
		const endPos = model.getPositionAt(end);
		editor.setSelection({
			startLineNumber: startPos.lineNumber,
			startColumn: startPos.column,
			endLineNumber: endPos.lineNumber,
			endColumn: endPos.column,
		});
	};

	export const focusEditor = () => {
		editor?.focus();
	};

	export const scrollToLine = (line: number) => {
		if (!editor) return;
		const model = editor.getModel();
		if (!model) return;
		const lineCount = model.getLineCount();
		const targetLine = Math.min(Math.max(1, line), lineCount);
		editor.revealLineInCenter(targetLine);
		editor.setPosition({ lineNumber: targetLine, column: 1 });
		editor.focus();
	};

	onMount(() => {
		createEditor();
	});

	onDestroy(() => {
		destroyEditor();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="code-editor-wrapper"
	style:height
	bind:this={container}
	oncontextmenu={showContextMenu}
></div>

<style>
	.code-editor-wrapper {
		position: relative;
		overflow: hidden;
		border: 1px solid hsl(var(--border));
		isolation: isolate;
		z-index: 0;
	}

	.code-editor-wrapper :global(.monaco-editor) {
		height: 100%;
	}

	/* Line highlight styles */
	.code-editor-wrapper :global(.highlight-added) {
		background-color: hsl(142 76% 36% / 0.25);
	}

	.code-editor-wrapper :global(.highlight-removed) {
		background-color: hsl(0 84% 60% / 0.25);
	}

	.code-editor-wrapper :global(.highlight-changed) {
		background-color: hsl(45 93% 47% / 0.25);
	}

	.code-editor-wrapper :global(.highlight-glyph-added) {
		background-color: hsl(142 76% 36%);
	}

	.code-editor-wrapper :global(.highlight-glyph-removed) {
		background-color: hsl(0 84% 60%);
	}

	.code-editor-wrapper :global(.highlight-glyph-changed) {
		background-color: hsl(45 93% 47%);
	}
</style>
