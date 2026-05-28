import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
	Bold,
	ChevronDown,
	Code,
	Download,
	Eraser,
	Eye,
	FileCode,
	FilePenLine,
	Heading1,
	Heading2,
	Heading3,
	Heading4,
	Heading5,
	Heading6,
	Image,
	Italic,
	Link,
	List,
	ListOrdered,
	ListTodo,
	Minus,
	Quote,
	Strikethrough,
	Table,
	TableOfContents,
} from 'lucide-react';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { toast } from 'sonner';
import type { Editor as VizelEditor } from '@vizel/core';
import { getVizelMarkdown, setVizelMarkdown } from '@vizel/core';
import '@vizel/core/styles.css';
import 'katex/dist/katex.min.css';

import { CodeEditor, type CodeEditorHandle } from '@/lib/components/editor';
import { FormMode, FormSection } from '@/lib/components/form';
import { SplitPane } from '@/lib/components/layout';
import { MarkdownContextMenuItems, Vizel } from '@/lib/components/markdown';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Button } from '@/lib/components/ui/button';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuTrigger,
} from '@/lib/components/ui/context-menu';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/lib/components/ui/dropdown-menu';
import { ListItemButton } from '@/lib/components/ui/list-item-button';
import { IconTooltip } from '@/lib/components/ui/icon-tooltip';
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks';
import { usePersistedRail } from '@/lib/stores';
import {
	applyFormat,
	exportAsHtml,
	type FormatAction,
	generateToc,
	getMarkdownStats,
	markdownToHtmlAsync,
	SAMPLE_MARKDOWN,
	type TocItem,
	tocToMarkdown,
} from '@/lib/services/markdown';
import {
	getMarkdownLineFromCursor,
	getProseMirrorPosFromLine,
	type TiptapEditor,
} from '@/lib/services/markdown-cursor-sync';

type RightPanelMode = 'editor' | 'preview';
type ActiveEditor = 'monaco' | 'vizel' | null;

// Vizel format command types (subset of Tiptap commands).
type VizelFormatCommand =
	| 'bold'
	| 'italic'
	| 'strikethrough'
	| 'code'
	| 'heading1'
	| 'heading2'
	| 'heading3'
	| 'heading4'
	| 'heading5'
	| 'heading6'
	| 'bullet'
	| 'numbered'
	| 'task'
	| 'quote'
	| 'codeblock'
	| 'hr'
	| 'link'
	| 'image'
	| 'table'
	| 'clearFormat';

interface ToolbarButton {
	readonly icon: ComponentType<{ className?: string }>;
	readonly label: string;
	readonly action: FormatAction['type'];
}

interface HeadingOption {
	readonly icon: ComponentType<{ className?: string }>;
	readonly label: string;
	readonly action: FormatAction['type'];
}

const textFormatButtons: readonly ToolbarButton[] = [
	{ icon: Bold, label: 'Bold (Ctrl+B)', action: 'bold' },
	{ icon: Italic, label: 'Italic (Ctrl+I)', action: 'italic' },
	{ icon: Strikethrough, label: 'Strikethrough', action: 'strikethrough' },
	{ icon: Code, label: 'Inline Code', action: 'code' },
];

const insertButtons: readonly ToolbarButton[] = [
	{ icon: Link, label: 'Link', action: 'link' },
	{ icon: Image, label: 'Image', action: 'image' },
	{ icon: Quote, label: 'Blockquote', action: 'quote' },
	{ icon: FileCode, label: 'Code Block', action: 'codeblock' },
	{ icon: Minus, label: 'Horizontal Rule', action: 'hr' },
	{ icon: Table, label: 'Table', action: 'table' },
];

const listButtons: readonly ToolbarButton[] = [
	{ icon: List, label: 'Bullet List', action: 'bullet' },
	{ icon: ListOrdered, label: 'Numbered List', action: 'numbered' },
	{ icon: ListTodo, label: 'Task List', action: 'task' },
];

const headingOptions: readonly HeadingOption[] = [
	{ icon: Heading1, label: 'Heading 1', action: 'heading1' },
	{ icon: Heading2, label: 'Heading 2', action: 'heading2' },
	{ icon: Heading3, label: 'Heading 3', action: 'heading3' },
	{ icon: Heading4, label: 'Heading 4', action: 'heading4' },
	{ icon: Heading5, label: 'Heading 5', action: 'heading5' },
	{ icon: Heading6, label: 'Heading 6', action: 'heading6' },
];

// Vizel includes all Tiptap commands; the dispatcher delegates command lookup
// to the editor's chain at runtime.
const execCmd = (editor: TiptapEditor, cmd: string, args?: unknown): boolean => {
	const commands = editor.commands as unknown as Record<string, (args?: unknown) => boolean>;
	const fn = commands[cmd];
	return fn ? fn(args) : false;
};

const executeVizelFormat = (editor: TiptapEditor, action: VizelFormatCommand, url?: string) => {
	editor.chain().focus();
	switch (action) {
		case 'bold':
			execCmd(editor, 'toggleBold');
			break;
		case 'italic':
			execCmd(editor, 'toggleItalic');
			break;
		case 'strikethrough':
			execCmd(editor, 'toggleStrike');
			break;
		case 'code':
			execCmd(editor, 'toggleCode');
			break;
		case 'heading1':
			execCmd(editor, 'toggleHeading', { level: 1 });
			break;
		case 'heading2':
			execCmd(editor, 'toggleHeading', { level: 2 });
			break;
		case 'heading3':
			execCmd(editor, 'toggleHeading', { level: 3 });
			break;
		case 'heading4':
			execCmd(editor, 'toggleHeading', { level: 4 });
			break;
		case 'heading5':
			execCmd(editor, 'toggleHeading', { level: 5 });
			break;
		case 'heading6':
			execCmd(editor, 'toggleHeading', { level: 6 });
			break;
		case 'bullet':
			execCmd(editor, 'toggleBulletList');
			break;
		case 'numbered':
			execCmd(editor, 'toggleOrderedList');
			break;
		case 'task':
			execCmd(editor, 'toggleTaskList');
			break;
		case 'quote':
			execCmd(editor, 'toggleBlockquote');
			break;
		case 'codeblock':
			execCmd(editor, 'toggleCodeBlock');
			break;
		case 'hr':
			execCmd(editor, 'setHorizontalRule');
			break;
		case 'link':
			if (url) execCmd(editor, 'setLink', { href: url });
			break;
		case 'image':
			if (url) execCmd(editor, 'setImage', { src: url });
			break;
		case 'table':
			execCmd(editor, 'insertTable', { rows: 3, cols: 3, withHeaderRow: true });
			break;
		case 'clearFormat':
			execCmd(editor, 'unsetAllMarks');
			execCmd(editor, 'clearNodes');
			break;
	}
};

export const Route = createFileRoute('/markdown-editor')({
	component: MarkdownEditorPage,
});

interface TocNavProps {
	readonly items: readonly TocItem[];
	readonly onSelect: (line: number) => void;
}

function TocNav({ items, onSelect }: TocNavProps) {
	return (
		<ul className="space-y-0.5">
			{items.map((item) => (
				<li key={`${item.line}-${item.id}`}>
					<ListItemButton variant="toc" size="sm" onClick={() => onSelect(item.line)}>
						{item.text}
					</ListItemButton>
					{item.children.length > 0 ? (
						<ul className="ml-3 mt-0.5 space-y-0.5">
							<TocNav items={item.children} onSelect={onSelect} />
						</ul>
					) : null}
				</li>
			))}
		</ul>
	);
}

function MarkdownEditorPage() {
	const [input, setInput] = useState('');
	const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('editor');
	const [showOptions, setShowOptions] = usePersistedRail('markdown-editor');
	const [activeEditor, setActiveEditor] = useState<ActiveEditor>(null);
	const [htmlOutput, setHtmlOutput] = useState('');

	const monacoRef = useRef<CodeEditorHandle | null>(null);
	const vizelEditorRef = useRef<TiptapEditor | null>(null);

	// Refs guard the bidirectional sync against feedback loops.
	const lastSyncedToVizelRef = useRef('');
	const cursorSyncSourceRef = useRef<'monaco' | 'vizel' | null>(null);
	const lastMonacoCursorLineRef = useRef(0);
	const lastVizelCursorLineRef = useRef(0);
	const activeEditorRef = useRef<ActiveEditor>(null);
	const inputRef = useRef('');

	activeEditorRef.current = activeEditor;
	inputRef.current = input;

	useDocumentTitle('Markdown Editor');

	const stats = useMemo(() => getMarkdownStats(input), [input]);
	const toc = useMemo(() => generateToc(input), [input]);
	const valid: boolean | null = input.trim() ? true : null;

	// Debounce the input feeding the preview pipeline so Mermaid / KaTeX /
	// Lowlight do not recompile on every keystroke. 200ms is short enough to
	// feel live and long enough to collapse rapid typing into one render.
	const debouncedInput = useDebouncedValue(input, 200);

	// Render HTML preview asynchronously to support TeX and diagrams. The
	// cancellation flag lives in a const ref so the cleanup closure can flip
	// it without a `let` binding.
	useEffect(() => {
		const lifecycle = { cancelled: false };
		markdownToHtmlAsync(debouncedInput)
			.then((result) => {
				if (!lifecycle.cancelled) setHtmlOutput(result);
			})
			.catch(() => {});
		return () => {
			lifecycle.cancelled = true;
		};
	}, [debouncedInput]);

	// Mirror markdown into Vizel whenever the source-of-truth string changes
	// from outside Vizel (Monaco edits, paste, sample, TOC insert, etc.).
	useEffect(() => {
		const editor = vizelEditorRef.current;
		if (!editor || input === lastSyncedToVizelRef.current) return;
		lastSyncedToVizelRef.current = input;
		setVizelMarkdown(editor as unknown as VizelEditor, input);
	}, [input]);

	const handleFormat = useCallback(
		(action: FormatAction['type'], providedUrl?: string) => {
			// Resolve the URL for link/image actions via a const IIFE so neither
			// the prompt nor the early-return path needs a `let` rebind.
			const actionUrl = ((): string | undefined => {
				if (providedUrl) return providedUrl;
				if (action === 'link') return prompt('Enter URL:') ?? undefined;
				if (action === 'image') return prompt('Enter image URL:') ?? undefined;
				return undefined;
			})();
			if ((action === 'link' || action === 'image') && !actionUrl) return;

			const targetEditor = activeEditor ?? 'monaco';

			if (targetEditor === 'monaco' && monacoRef.current) {
				const selection = monacoRef.current.getSelectionRange();
				const result = applyFormat(input, selection.start, selection.end, action);
				setInput(result.text);
				requestAnimationFrame(() => {
					monacoRef.current?.setSelectionRange(result.selectionStart, result.selectionEnd);
					monacoRef.current?.focusEditor();
				});
			} else if (targetEditor === 'vizel' && vizelEditorRef.current) {
				executeVizelFormat(vizelEditorRef.current, action as VizelFormatCommand, actionUrl);
			}
		},
		[activeEditor, input]
	);

	const handleMonacoFocus = useCallback(() => setActiveEditor('monaco'), []);

	const handleVizelCreate = useCallback(({ editor }: { editor: VizelEditor }) => {
		vizelEditorRef.current = editor as unknown as TiptapEditor;
	}, []);

	const handleVizelUpdate = useCallback(({ editor }: { editor: VizelEditor }) => {
		vizelEditorRef.current = editor as unknown as TiptapEditor;
		const md = getVizelMarkdown(editor);
		lastSyncedToVizelRef.current = md;
		setInput(md);
	}, []);

	const handleVizelFocus = useCallback(() => setActiveEditor('vizel'), []);

	const handleVizelSelectionUpdate = useCallback(({ editor }: { editor: VizelEditor }) => {
		// Only mirror selection while Vizel has focus to avoid bouncing the
		// Monaco cursor during external Vizel state updates.
		if (activeEditorRef.current !== 'vizel') return;
		const tiptapEditor = editor as unknown as TiptapEditor;
		const line = getMarkdownLineFromCursor(tiptapEditor, inputRef.current);
		if (line === lastVizelCursorLineRef.current) return;
		lastVizelCursorLineRef.current = line;

		if (cursorSyncSourceRef.current === 'monaco') {
			cursorSyncSourceRef.current = null;
			return;
		}
		cursorSyncSourceRef.current = 'vizel';
		monacoRef.current?.gotoLine(line);
		requestAnimationFrame(() => {
			cursorSyncSourceRef.current = null;
		});
	}, []);

	const handleMonacoCursorChange = useCallback((line: number) => {
		if (line === lastMonacoCursorLineRef.current) return;
		lastMonacoCursorLineRef.current = line;

		if (cursorSyncSourceRef.current === 'vizel') {
			cursorSyncSourceRef.current = null;
			return;
		}
		if (activeEditorRef.current !== 'monaco') return;

		cursorSyncSourceRef.current = 'monaco';
		const editor = vizelEditorRef.current;
		if (editor) {
			const pos = getProseMirrorPosFromLine(editor, inputRef.current, line);
			editor.commands['setTextSelection']?.(pos);
		}
		requestAnimationFrame(() => {
			cursorSyncSourceRef.current = null;
		});
	}, []);

	const handlePaste = useCallback(() => {
		readText()
			.then((text) => {
				if (text) setInput(text);
			})
			.catch(() => {});
	}, []);

	const handleClear = useCallback(() => setInput(''), []);
	const handleSample = useCallback(() => setInput(SAMPLE_MARKDOWN), []);

	const handleCopyMarkdown = useCallback(() => {
		writeText(input)
			.then(() => toast.success('Markdown copied to clipboard'))
			.catch(() => toast.error('Failed to copy to clipboard'));
	}, [input]);

	const handleCopyHtml = useCallback(() => {
		writeText(htmlOutput)
			.then(() => toast.success('HTML copied to clipboard'))
			.catch(() => toast.error('Failed to copy to clipboard'));
	}, [htmlOutput]);

	const handleExportHtml = useCallback(() => {
		const fullHtml = exportAsHtml(input, 'Markdown Export');
		const blob = new Blob([fullHtml], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'markdown-export.html';
		a.click();
		URL.revokeObjectURL(url);
		toast.success('HTML file downloaded');
	}, [input]);

	const handleInsertToc = useCallback(() => {
		if (toc.length === 0) {
			toast.error('No headings found for TOC');
			return;
		}
		const tocMarkdown = `## Table of Contents\n\n${tocToMarkdown(toc)}\n\n`;
		setInput((prev) => tocMarkdown + prev);
		toast.success('Table of Contents inserted');
	}, [toc]);

	const handleTocClick = useCallback((line: number) => {
		monacoRef.current?.gotoLine(line, true);
	}, []);

	const monacoActiveBadge =
		activeEditor === 'monaco' ? (
			<span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
				Active
			</span>
		) : null;

	return (
		<ToolShell
			valid={valid}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				input.trim() ? (
					<>
						<StatItem label="words" value={stats.words} />
						<StatItem label="chars" value={stats.chars} />
						<StatItem label="lines" value={stats.lines} />
						<StatItem label="headers" value={stats.headers} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Right Panel">
						<FormMode<RightPanelMode>
							value={rightPanelMode}
							onValueChange={setRightPanelMode}
							options={[
								{ value: 'editor', label: 'Editor' },
								{ value: 'preview', label: 'Preview' },
							]}
						/>
					</FormSection>

					<FormSection title="Export">
						<div className="space-y-2">
							<Button
								variant="outline"
								size="sm"
								className="w-full justify-start"
								onClick={handleCopyMarkdown}
							>
								<FilePenLine className="h-3 w-3" />
								Copy Markdown
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="w-full justify-start"
								onClick={handleCopyHtml}
							>
								<Code className="h-3 w-3" />
								Copy HTML
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="w-full justify-start"
								onClick={handleExportHtml}
							>
								<Download className="h-3 w-3" />
								Export HTML File
							</Button>
						</div>
					</FormSection>

					<FormSection title="Insert">
						<Button
							variant="outline"
							size="sm"
							className="w-full justify-start"
							onClick={handleInsertToc}
							disabled={toc.length === 0}
						>
							<TableOfContents className="h-3 w-3" />
							Insert TOC
						</Button>
					</FormSection>

					{toc.length > 0 ? (
						<FormSection title="Table of Contents">
							<nav className="max-h-48 overflow-auto">
								<TocNav items={toc} onSelect={handleTocClick} />
							</nav>
						</FormSection>
					) : null}

					<ToolFooter
						aboutText={
							<ul className="list-inside list-disc space-y-0.5">
								<li>Monaco editor with syntax highlighting</li>
								<li>Vizel visual editor with rich block content</li>
								<li>Real-time bidirectional sync</li>
								<li>Formatting toolbar &amp; context menu</li>
								<li>Table of Contents generation</li>
								<li>Export to HTML</li>
							</ul>
						}
					/>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="flex h-9 shrink-0 items-center gap-0.5 border-b bg-surface-3 px-2">
					{textFormatButtons.map((btn) => {
						const Icon = btn.icon;
						return (
							<IconTooltip key={btn.action} label={btn.label}>
								<Button
									variant="ghost"
									size="toolbar-icon"
									className="hover:bg-interactive-hover"
									onClick={() => handleFormat(btn.action)}
								>
									<Icon className="h-3.5 w-3.5" />
									<span className="sr-only">{btn.label}</span>
								</Button>
							</IconTooltip>
						);
					})}

					<div className="mx-1 h-4 w-px bg-border" />

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 gap-1 px-2 hover:bg-interactive-hover"
								title="Headings"
							>
								<Heading2 className="h-3.5 w-3.5" />
								<ChevronDown className="h-3 w-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{headingOptions.map((heading) => {
								const Icon = heading.icon;
								return (
									<DropdownMenuItem
										key={heading.action}
										onSelect={() => handleFormat(heading.action)}
									>
										<Icon className="mr-2 h-4 w-4" />
										{heading.label}
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>

					<div className="mx-1 h-4 w-px bg-border" />

					{listButtons.map((btn) => {
						const Icon = btn.icon;
						return (
							<IconTooltip key={btn.action} label={btn.label}>
								<Button
									variant="ghost"
									size="toolbar-icon"
									className="hover:bg-interactive-hover"
									onClick={() => handleFormat(btn.action)}
								>
									<Icon className="h-3.5 w-3.5" />
									<span className="sr-only">{btn.label}</span>
								</Button>
							</IconTooltip>
						);
					})}

					<div className="mx-1 h-4 w-px bg-border" />

					{insertButtons.map((btn) => {
						const Icon = btn.icon;
						return (
							<IconTooltip key={btn.action} label={btn.label}>
								<Button
									variant="ghost"
									size="toolbar-icon"
									className="hover:bg-interactive-hover"
									onClick={() => handleFormat(btn.action)}
								>
									<Icon className="h-3.5 w-3.5" />
									<span className="sr-only">{btn.label}</span>
								</Button>
							</IconTooltip>
						);
					})}

					<div className="mx-1 h-4 w-px bg-border" />

					<IconTooltip label="Clear Formatting">
						<Button
							variant="ghost"
							size="toolbar-icon"
							className="hover:bg-interactive-hover"
							onClick={() => handleFormat('clearFormat')}
						>
							<Eraser className="h-3.5 w-3.5" />
							<span className="sr-only">Clear Formatting</span>
						</Button>
					</IconTooltip>
				</div>

				<SplitPane
					className="h-full flex-1"
					left={
						<CodeEditor
							ref={monacoRef}
							title="Markdown"
							value={input}
							mode="input"
							editorMode="markdown"
							onChange={setInput}
							onCursorChange={handleMonacoCursorChange}
							onFocus={handleMonacoFocus}
							onPaste={handlePaste}
							onClear={handleClear}
							onSample={handleSample}
							actions={monacoActiveBadge}
						/>
					}
					right={
						rightPanelMode === 'editor' ? (
							<ContextMenu>
								<ContextMenuTrigger className="relative block h-full">
									{activeEditor === 'vizel' ? (
										<span className="absolute right-3 top-2 z-10 rounded bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
											Active
										</span>
									) : null}
									<div className="vizel-container h-full overflow-auto">
										<Vizel
											placeholder="Start writing..."
											editable={true}
											autofocus={false}
											onCreate={handleVizelCreate}
											onUpdate={handleVizelUpdate}
											onFocus={handleVizelFocus}
											onSelectionUpdate={handleVizelSelectionUpdate}
										/>
									</div>
								</ContextMenuTrigger>
								<ContextMenuContent className="w-56">
									<MarkdownContextMenuItems onFormat={handleFormat} />
								</ContextMenuContent>
							</ContextMenu>
						) : (
							<div className="flex h-full flex-col">
								<div className="flex h-9 shrink-0 items-center border-b bg-surface-3 px-3">
									<Eye className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
									<span className="text-xs font-medium text-muted-foreground">Preview</span>
								</div>
								<div className="markdown-preview flex-1 overflow-auto p-4">
									{input.trim() ? (
										// biome-ignore lint/security/noDangerouslySetInnerHtml: htmlOutput originates from the local markdownToHtmlAsync pipeline; content is generated from user input that already lives in the same process.
										<div dangerouslySetInnerHTML={{ __html: htmlOutput }} />
									) : (
										<EmbeddedEmptyState
											icon={Eye}
											title="Preview will appear here"
											description="Type Markdown on the left to render it on the right."
											fillHeight
										/>
									)}
								</div>
							</div>
						)
					}
				/>
			</div>

			<style>{`
				.vizel-container {
					--vizel-bg: hsl(var(--background));
					--vizel-text: hsl(var(--foreground));
					--vizel-placeholder: hsl(var(--muted-foreground));
					--vizel-border: hsl(var(--border));
					--vizel-primary: hsl(var(--primary));
				}
				.vizel-container .vizel-editor {
					min-height: 100%;
					padding: 1rem;
				}

				.markdown-preview h1 {
					font-size: 1.75rem;
					font-weight: 700;
					margin-top: 1.5rem;
					margin-bottom: 0.75rem;
					border-bottom: 1px solid hsl(var(--border));
					padding-bottom: 0.5rem;
				}
				.markdown-preview h2 {
					font-size: 1.5rem;
					font-weight: 600;
					margin-top: 1.25rem;
					margin-bottom: 0.5rem;
				}
				.markdown-preview h3 {
					font-size: 1.25rem;
					font-weight: 600;
					margin-top: 1rem;
					margin-bottom: 0.5rem;
				}
				.markdown-preview h4,
				.markdown-preview h5,
				.markdown-preview h6 {
					font-size: 1rem;
					font-weight: 600;
					margin-top: 0.75rem;
					margin-bottom: 0.25rem;
				}
				.markdown-preview p {
					margin-bottom: 0.75rem;
					line-height: 1.6;
				}
				.markdown-preview ul,
				.markdown-preview ol {
					margin-left: 1.5rem;
					margin-bottom: 0.75rem;
				}
				.markdown-preview li {
					margin-bottom: 0.25rem;
				}
				.markdown-preview pre {
					background: hsl(var(--muted));
					padding: 1rem;
					border-radius: 0.375rem;
					overflow-x: auto;
					margin-bottom: 0.75rem;
				}
				.markdown-preview code {
					font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
					font-size: 0.875rem;
				}
				.markdown-preview :not(pre) > code {
					background: hsl(var(--muted));
					padding: 0.125rem 0.375rem;
					border-radius: 0.25rem;
				}
				.markdown-preview blockquote {
					border-left: 4px solid hsl(var(--border));
					padding-left: 1rem;
					margin: 0.75rem 0;
					color: hsl(var(--muted-foreground));
				}
				.markdown-preview hr {
					border: none;
					border-top: 1px solid hsl(var(--border));
					margin: 1.5rem 0;
				}
				.markdown-preview a {
					color: hsl(var(--primary));
					text-decoration: underline;
				}
				.markdown-preview img {
					max-width: 100%;
					height: auto;
					border-radius: 0.375rem;
				}
				.markdown-preview table {
					width: 100%;
					border-collapse: collapse;
					margin-bottom: 0.75rem;
				}
				.markdown-preview th,
				.markdown-preview td {
					border: 1px solid hsl(var(--border));
					padding: 0.5rem;
					text-align: left;
				}
				.markdown-preview th {
					background: hsl(var(--muted));
					font-weight: 600;
				}
				.markdown-preview .task-list {
					list-style: none;
					margin-left: 0;
				}
				.markdown-preview .task-item {
					display: flex;
					align-items: center;
					gap: 0.5rem;
				}
				.markdown-preview .task-item.checked {
					text-decoration: line-through;
					color: hsl(var(--muted-foreground));
				}
			`}</style>
		</ToolShell>
	);
}
