import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { configureMonacoYaml } from 'monaco-yaml';
import yamlWorker from '@/lib/workers/yaml.worker?worker';

// One-shot configuration flags. Kept on a const holder so the bindings
// themselves never reassign; only the boolean fields flip.
const monacoSetupState = { environment: false, yaml: false };

// Configure Monaco Environment once. The desktop runtime is always client-side, so we can
// assign self.MonacoEnvironment at module load without a browser guard.
const configureMonacoEnvironment = () => {
	if (monacoSetupState.environment) return;
	monacoSetupState.environment = true;
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
};
configureMonacoEnvironment();

const configureYaml = () => {
	if (monacoSetupState.yaml) return;
	configureMonacoYaml(monaco, {
		validate: true,
		format: { enable: true },
	});
	monacoSetupState.yaml = true;
};

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
	readonly line: number;
	readonly column: number;
	readonly selection: number;
}

export interface HighlightLine {
	readonly line: number;
	readonly type: 'added' | 'removed' | 'changed';
}

export interface ContextMenuItem {
	readonly text: string;
	readonly enabled?: boolean;
	readonly action: () => void | Promise<void>;
}

export interface EditorContext {
	readonly readonly: boolean;
	readonly hasSelection: boolean;
	readonly getSelectedText: () => string;
	readonly undo: () => void;
	readonly redo: () => void;
	readonly cut: () => void;
	readonly copy: () => void;
	readonly paste: (text: string) => void;
	readonly selectAll: () => void;
}

export interface CodeEditorWrapperHandle {
	readonly getSelectionRange: () => { start: number; end: number };
	readonly setSelectionRange: (start: number, end: number) => void;
	readonly focusEditor: () => void;
	readonly scrollToLine: (line: number, focus?: boolean) => void;
}

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

const getMonacoTheme = (t: EditorTheme): string => (t === 'dark' ? 'vs-dark' : 'vs');

export const CodeEditorWrapper = forwardRef<CodeEditorWrapperHandle, CodeEditorWrapperProps>(
	function CodeEditorWrapper(
		{
			value = '',
			mode = 'json',
			theme = 'dark',
			height = '300px',
			readOnly = false,
			gotoLine = null,
			gotoLineTrigger = 0,
			highlightLines = [],
			onChange,
			onCursorChange,
			onFocus,
			onBlur,
			onContextMenu,
		},
		ref
	) {
		const containerRef = useRef<HTMLDivElement | null>(null);
		const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
		const decorationCollectionRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
		const isUpdatingFromPropsRef = useRef(false);

		// Callbacks change on every render; hold them in a ref so the editor lifecycle effect
		// can read the latest version without resubscribing or recreating the editor.
		const callbacksRef = useRef({ onChange, onCursorChange, onFocus, onBlur, onContextMenu });
		useEffect(() => {
			callbacksRef.current = { onChange, onCursorChange, onFocus, onBlur, onContextMenu };
		}, [onChange, onCursorChange, onFocus, onBlur, onContextMenu]);

		const readOnlyRef = useRef(readOnly);
		useEffect(() => {
			readOnlyRef.current = readOnly;
		}, [readOnly]);

		const getSelectedText = (): string => {
			const editor = editorRef.current;
			if (!editor) return '';
			const selection = editor.getSelection();
			if (!selection) return '';
			const model = editor.getModel();
			if (!model) return '';
			return model.getValueInRange(selection);
		};

		const buildEditorContext = (): EditorContext => {
			const editor = editorRef.current;
			return {
				readonly: readOnlyRef.current,
				hasSelection: editor ? !editor.getSelection()?.isEmpty() : false,
				getSelectedText,
				undo: () => editorRef.current?.trigger('keyboard', 'undo', null),
				redo: () => editorRef.current?.trigger('keyboard', 'redo', null),
				cut: () => {
					if (!editorRef.current || readOnlyRef.current) return;
					editorRef.current.trigger('keyboard', 'editor.action.clipboardCutAction', null);
				},
				copy: () => {
					editorRef.current?.trigger('keyboard', 'editor.action.clipboardCopyAction', null);
				},
				paste: (text: string) => {
					if (!editorRef.current || readOnlyRef.current) return;
					editorRef.current.trigger('keyboard', 'type', { text });
				},
				selectAll: () => editorRef.current?.trigger('keyboard', 'editor.action.selectAll', null),
			};
		};

		useImperativeHandle(
			ref,
			(): CodeEditorWrapperHandle => ({
				getSelectionRange: () => {
					const editor = editorRef.current;
					if (!editor) return { start: 0, end: 0 };
					const model = editor.getModel();
					if (!model) return { start: 0, end: 0 };
					const selection = editor.getSelection();
					if (!selection) return { start: 0, end: 0 };
					return {
						start: model.getOffsetAt(selection.getStartPosition()),
						end: model.getOffsetAt(selection.getEndPosition()),
					};
				},
				setSelectionRange: (start, end) => {
					const editor = editorRef.current;
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
				},
				focusEditor: () => editorRef.current?.focus(),
				scrollToLine: (line, focus = true) => {
					const editor = editorRef.current;
					if (!editor) return;
					const model = editor.getModel();
					if (!model) return;
					const lineCount = model.getLineCount();
					const targetLine = Math.min(Math.max(1, line), lineCount);
					editor.revealLineInCenter(targetLine);
					editor.setPosition({ lineNumber: targetLine, column: 1 });
					if (focus) {
						editor.focus();
					}
				},
			})
		);

		// Editor lifecycle: create on mount, dispose on unmount. Empty deps array ensures we
		// never recreate the editor on prop changes — value/mode/theme/readOnly sync through
		// dedicated effects below.
		useEffect(() => {
			const container = containerRef.current;
			if (!container) return;

			if (mode === 'yaml') {
				configureYaml();
			}

			monaco.json.jsonDefaults.setDiagnosticsOptions({
				validate: true,
				allowComments: false,
				trailingCommas: 'error',
			});

			const editor = monaco.editor.create(container, {
				value,
				language: LANGUAGE_MAP[mode],
				theme: getMonacoTheme(theme),
				readOnly,
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
				contextmenu: !callbacksRef.current.onContextMenu,
				fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
				fontSize: 14,
			});
			editorRef.current = editor;

			const contentSub = editor.onDidChangeModelContent(() => {
				if (isUpdatingFromPropsRef.current) return;
				const newValue = editor.getValue();
				callbacksRef.current.onChange?.(newValue);
			});

			const cursorSub = editor.onDidChangeCursorPosition((e) => {
				const model = editor.getModel();
				if (!model) return;
				const selection = editor.getSelection();
				const selectionLength = selection ? model.getValueInRange(selection).length : 0;
				callbacksRef.current.onCursorChange?.({
					line: e.position.lineNumber,
					column: e.position.column,
					selection: selectionLength,
				});
			});

			const focusSub = editor.onDidFocusEditorText(() => callbacksRef.current.onFocus?.());
			const blurSub = editor.onDidBlurEditorText(() => callbacksRef.current.onBlur?.());

			return () => {
				contentSub.dispose();
				cursorSub.dispose();
				focusSub.dispose();
				blurSub.dispose();
				decorationCollectionRef.current?.clear();
				decorationCollectionRef.current = null;
				editor.dispose();
				editorRef.current = null;
			};
		}, []);

		// Sync external value into the editor without echoing back through onChange.
		useEffect(() => {
			const editor = editorRef.current;
			if (!editor) return;
			const currentValue = editor.getValue();
			if (currentValue !== value) {
				isUpdatingFromPropsRef.current = true;
				editor.setValue(value);
				isUpdatingFromPropsRef.current = false;
			}
		}, [value]);

		useEffect(() => {
			if (!editorRef.current) return;
			monaco.editor.setTheme(getMonacoTheme(theme));
		}, [theme]);

		useEffect(() => {
			const editor = editorRef.current;
			if (!editor) return;
			const model = editor.getModel();
			if (model) {
				monaco.editor.setModelLanguage(model, LANGUAGE_MAP[mode]);
			}
			if (mode === 'yaml') {
				configureYaml();
			}
		}, [mode]);

		useEffect(() => {
			editorRef.current?.updateOptions({ readOnly });
		}, [readOnly]);

		// gotoLineTrigger is included so a re-trigger of the same line still scrolls.
		useEffect(() => {
			if (!gotoLine) return;
			const editor = editorRef.current;
			if (!editor) return;
			const model = editor.getModel();
			if (!model) return;
			const lineCount = model.getLineCount();
			const targetLine = Math.min(Math.max(1, gotoLine), lineCount);
			editor.revealLineInCenter(targetLine);
			editor.setPosition({ lineNumber: targetLine, column: 1 });
			editor.focus();
		}, [gotoLine, gotoLineTrigger]);

		useEffect(() => {
			const editor = editorRef.current;
			if (!editor) return;
			const decorations: monaco.editor.IModelDeltaDecoration[] = highlightLines.map(
				({ line, type }) => ({
					range: new monaco.Range(line, 1, line, 1),
					options: {
						isWholeLine: true,
						className: `highlight-${type}`,
						glyphMarginClassName: `highlight-glyph-${type}`,
					},
				})
			);
			if (!decorationCollectionRef.current) {
				decorationCollectionRef.current = editor.createDecorationsCollection(decorations);
			} else {
				decorationCollectionRef.current.set(decorations);
			}
		}, [highlightLines]);

		const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
			const handler = callbacksRef.current.onContextMenu;
			if (!handler) return;
			e.preventDefault();
			e.stopPropagation();
			handler(e.nativeEvent, buildEditorContext());
		};

		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: Monaco mounts focusable, role-aware editor widgets inside this container; the contextmenu handler delegates to Monaco's own keyboard/mouse semantics.
			<div
				ref={containerRef}
				className="code-editor-wrapper relative isolate z-0 overflow-hidden border border-border [&_.monaco-editor]:h-full [&_.highlight-added]:bg-[hsl(142_76%_36%/0.25)] [&_.highlight-changed]:bg-[hsl(45_93%_47%/0.25)] [&_.highlight-glyph-added]:bg-[hsl(142_76%_36%)] [&_.highlight-glyph-changed]:bg-[hsl(45_93%_47%)] [&_.highlight-glyph-removed]:bg-[hsl(0_84%_60%)] [&_.highlight-removed]:bg-[hsl(0_84%_60%/0.25)]"
				style={{ height }}
				onContextMenu={handleContextMenu}
			/>
		);
	}
);

export type CodeEditorWrapperProps = {
	readonly value?: string;
	readonly mode?: EditorMode;
	readonly theme?: EditorTheme;
	readonly height?: string;
	readonly readOnly?: boolean;
	readonly placeholder?: string;
	readonly gotoLine?: number | null;
	readonly gotoLineTrigger?: number;
	readonly highlightLines?: readonly HighlightLine[];
	readonly onChange?: (value: string) => void;
	readonly onCursorChange?: (position: CursorPosition) => void;
	readonly onFocus?: () => void;
	readonly onBlur?: () => void;
	readonly onContextMenu?: (event: MouseEvent, context: EditorContext) => void;
};
