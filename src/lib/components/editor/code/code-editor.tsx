import {
	type ComponentType,
	forwardRef,
	type ReactNode,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	Braces,
	CircleAlert,
	Clipboard,
	Columns2,
	Copy,
	Database,
	Download,
	FileCode,
	FileJson,
	FileText,
	FlaskConical,
	FolderOpen,
	HardDrive,
	ListTree,
	Rows3,
	TextCursorInput,
	Trash2,
} from 'lucide-react';
import { LogicalPosition } from '@tauri-apps/api/dpi';
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';
import { Button } from '@/lib/components/ui/button';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/lib/components/ui/resizable';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/lib/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/lib/components/ui/toggle-group';
import {
	type AstLanguage,
	type AstNode,
	type AstParseError,
	buildLineToPathMap,
	buildPathToLineMap,
	findLineByPath,
	findPathByLine,
	type LineToPathMap,
	parseToAst,
	type PathToLineMap,
} from '@/lib/services/ast';
import { cn } from '@/lib/utils';
import {
	CodeEditorWrapper,
	type CodeEditorWrapperHandle,
	type ContextMenuItem,
	type CursorPosition,
	type EditorContext,
	type EditorMode,
	type HighlightLine,
} from './code-editor-wrapper';
import { TreeView } from './tree-view';

type PaneMode = 'input' | 'output' | 'readonly';
type ViewMode = 'code' | 'tree' | 'split';

interface FormatOption {
	readonly value: string;
	readonly label: string;
}

const FILE_EXTENSIONS: Record<
	string,
	{ readonly extensions: readonly string[]; readonly name: string }
> = {
	json: { extensions: ['json'], name: 'JSON' },
	yaml: { extensions: ['yaml', 'yml'], name: 'YAML' },
	xml: { extensions: ['xml'], name: 'XML' },
	sql: { extensions: ['sql'], name: 'SQL' },
	text: { extensions: ['txt'], name: 'Text' },
	markdown: { extensions: ['md', 'markdown'], name: 'Markdown' },
	html: { extensions: ['html', 'htm'], name: 'HTML' },
	css: { extensions: ['css'], name: 'CSS' },
	javascript: { extensions: ['js', 'mjs'], name: 'JavaScript' },
	typescript: { extensions: ['ts', 'mts'], name: 'TypeScript' },
};

const getAstLanguage = (mode: EditorMode): AstLanguage | null => {
	const languageMap: Record<string, AstLanguage> = {
		json: 'json',
		yaml: 'yaml',
		xml: 'xml',
		sql: 'sql',
		markdown: 'markdown',
	};
	return languageMap[mode] ?? null;
};

const computeStats = (
	text: string
): { readonly lines: number; readonly chars: number; readonly size: string } => {
	const chars = text.length;
	const lines = text ? text.split('\n').length : 0;
	const size =
		chars < 1024
			? `${chars} B`
			: chars < 1024 * 1024
				? `${(chars / 1024).toFixed(1)} KB`
				: `${(chars / (1024 * 1024)).toFixed(1)} MB`;
	return { lines, chars, size };
};

export interface CodeEditorHandle {
	readonly getSelectionRange: () => { start: number; end: number };
	readonly setSelectionRange: (start: number, end: number) => void;
	readonly focusEditor: () => void;
	readonly gotoLine: (line: number, focus?: boolean) => void;
}

interface ToolbarButtonProps {
	readonly icon: ComponentType<{ className?: string }>;
	readonly label: string;
	readonly title: string;
	readonly onClick: () => void;
}

function ToolbarButton({ icon: Icon, label, title, onClick }: ToolbarButtonProps) {
	return (
		<Button
			variant="ghost"
			size="sm"
			// Header sits on bg-surface-2 (≈ bg-muted in light mode), so the default
			// ghost hover (bg-muted) blends in. Use the project's interactive-hover
			// token to restore a visible affordance without changing the chrome.
			className="h-6 gap-1 px-2 text-xs hover:bg-interactive-hover"
			onClick={onClick}
			title={title}
		>
			<Icon className="h-3 w-3" />
			<span className="hidden sm:inline">{label}</span>
		</Button>
	);
}

const CODE_VIEW_ICONS: Record<string, ComponentType<{ className?: string }>> = {
	xml: FileCode,
	yaml: FileJson,
	sql: Database,
	markdown: FileText,
};

interface ViewToggleProps {
	readonly viewMode: 'code' | 'split' | 'tree';
	readonly canShowTree: boolean;
	readonly editorMode: EditorMode;
	readonly onChange: (mode: 'code' | 'split' | 'tree') => void;
}

function ViewToggle({ viewMode, canShowTree, editorMode, onChange }: ViewToggleProps) {
	const CodeIcon = CODE_VIEW_ICONS[editorMode] ?? Braces;
	return (
		<ToggleGroup
			type="single"
			value={viewMode}
			onValueChange={(v: string) => {
				if (v === 'code' || v === 'split' || v === 'tree') onChange(v);
			}}
			className="bg-muted/50 inline-flex h-auto w-fit items-center gap-0.5 rounded-md p-0.5"
		>
			<ToggleGroupItem
				value="code"
				aria-label="Code View"
				title="Code View"
				className="h-6 w-6 rounded p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
			>
				<CodeIcon className="h-3.5 w-3.5" />
			</ToggleGroupItem>
			<ToggleGroupItem
				value="split"
				aria-label="Split View"
				title="Split View"
				disabled={!canShowTree}
				className="h-6 w-6 rounded p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
			>
				<Columns2 className="h-3.5 w-3.5" />
			</ToggleGroupItem>
			<ToggleGroupItem
				value="tree"
				aria-label="Tree View"
				title="Tree View"
				disabled={!canShowTree}
				className="h-6 w-6 rounded p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
			>
				<ListTree className="h-3.5 w-3.5" />
			</ToggleGroupItem>
		</ToggleGroup>
	);
}

interface StatusBarProps {
	readonly cursorPosition: CursorPosition;
	readonly selectedTreePath: string | null;
	readonly viewMode: 'code' | 'split' | 'tree';
	readonly stats: { readonly lines: number; readonly chars: number; readonly size: string };
}

function StatusBar({ cursorPosition, selectedTreePath, viewMode, stats }: StatusBarProps) {
	return (
		<div className="flex h-5 shrink-0 items-center justify-between border-t bg-muted/20 px-2 font-mono text-xs text-muted-foreground/80">
			<div className="flex items-center divide-x divide-border/50">
				<div className="flex items-center gap-1 pr-2" title="Cursor Position">
					<TextCursorInput className="h-3 w-3 opacity-60" />
					<span>
						{cursorPosition.line}:{cursorPosition.column}
					</span>
				</div>
				{cursorPosition.selection > 0 ? (
					<div className="flex items-center gap-1 px-2" title="Selected Characters">
						<span className="text-primary/80">{cursorPosition.selection} sel</span>
					</div>
				) : null}
				{selectedTreePath && (viewMode === 'split' || viewMode === 'tree') ? (
					<div className="flex items-center gap-1 px-2" title="Selected Path">
						<span className="text-warning">{selectedTreePath}</span>
					</div>
				) : null}
			</div>
			<div className="flex items-center divide-x divide-border/50">
				<div className="flex items-center gap-1 px-2" title="Lines">
					<Rows3 className="h-3 w-3 opacity-60" />
					<span>{stats.lines}</span>
				</div>
				<div className="flex items-center gap-1 pl-2" title="Size">
					<HardDrive className="h-3 w-3 opacity-60" />
					<span>{stats.size}</span>
				</div>
			</div>
		</div>
	);
}

interface InputActionsProps {
	readonly onPaste?: () => void;
	readonly onOpenFile: () => void;
	readonly onClear?: () => void;
	readonly onSample?: () => void;
}

function InputActions({ onPaste, onOpenFile, onClear, onSample }: InputActionsProps) {
	return (
		<div className="flex items-center gap-0.5">
			{onPaste ? (
				<ToolbarButton
					icon={Clipboard}
					label="Paste"
					title="Paste from clipboard"
					onClick={onPaste}
				/>
			) : null}
			<ToolbarButton icon={FolderOpen} label="Open" title="Open file" onClick={onOpenFile} />
			{onClear ? (
				<ToolbarButton icon={Trash2} label="Clear" title="Clear input" onClick={onClear} />
			) : null}
			{onSample ? (
				<ToolbarButton
					icon={FlaskConical}
					label="Sample"
					title="Load sample data"
					onClick={onSample}
				/>
			) : null}
		</div>
	);
}

interface OutputActionsProps {
	readonly onCopy?: () => void;
	readonly onSaveFile: () => void;
}

function OutputActions({ onCopy, onSaveFile }: OutputActionsProps) {
	return (
		<div className="flex items-center gap-0.5">
			{onCopy ? (
				<ToolbarButton icon={Copy} label="Copy" title="Copy to clipboard" onClick={onCopy} />
			) : null}
			<ToolbarButton icon={Download} label="Save" title="Save to file" onClick={onSaveFile} />
		</div>
	);
}

interface FormatSelectorProps {
	readonly options: readonly FormatOption[];
	readonly selected?: string;
	readonly onChange: (value: string) => void;
}

function FormatSelector({ options, selected, onChange }: FormatSelectorProps) {
	const selectedLabel = options.find((f) => f.value === selected)?.label;
	return (
		<Select value={selected} onValueChange={onChange}>
			<SelectTrigger className="h-6 w-auto min-w-[80px] gap-1 px-2 text-xs">
				<SelectValue placeholder="Format">{selectedLabel ?? selected ?? 'Format'}</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

interface HeaderProps {
	readonly title: string;
	readonly isInput: boolean;
	readonly isOutput: boolean;
	readonly onPaste?: () => void;
	readonly onOpenFile: () => void;
	readonly onClear?: () => void;
	readonly onSample?: () => void;
	readonly onCopy?: () => void;
	readonly onSaveFile: () => void;
	readonly actions?: ReactNode;
	readonly formatOptions?: readonly FormatOption[];
	readonly selectedFormat?: string;
	readonly onFormatChange: (value: string) => void;
	readonly showViewToggle: boolean;
	readonly supportsTreeView: boolean;
	readonly viewMode: 'code' | 'split' | 'tree';
	readonly canShowTree: boolean;
	readonly editorMode: EditorMode;
	readonly onViewModeChange: (mode: 'code' | 'split' | 'tree') => void;
}

function Header({
	title,
	isInput,
	isOutput,
	onPaste,
	onOpenFile,
	onClear,
	onSample,
	onCopy,
	onSaveFile,
	actions,
	formatOptions,
	selectedFormat,
	onFormatChange,
	showViewToggle,
	supportsTreeView,
	viewMode,
	canShowTree,
	editorMode,
	onViewModeChange,
}: HeaderProps) {
	const showFormatSelector = isOutput && formatOptions && formatOptions.length > 0;
	return (
		<div
			className="relative z-10 flex shrink-0 items-center justify-between border-b border-border/60 bg-surface-2 px-3"
			style={{ height: 'var(--editor-header-h)' }}
		>
			<div className="flex items-center gap-2">
				{title ? (
					<span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
						{title}
					</span>
				) : null}
				{isInput ? (
					<InputActions
						onPaste={onPaste}
						onOpenFile={onOpenFile}
						onClear={onClear}
						onSample={onSample}
					/>
				) : null}
				{isOutput ? <OutputActions onCopy={onCopy} onSaveFile={onSaveFile} /> : null}
				{actions}
			</div>
			<div className="flex items-center gap-2">
				{showFormatSelector ? (
					<FormatSelector
						options={formatOptions}
						selected={selectedFormat}
						onChange={onFormatChange}
					/>
				) : null}
				{showViewToggle && supportsTreeView ? (
					<ViewToggle
						viewMode={viewMode}
						canShowTree={canShowTree}
						editorMode={editorMode}
						onChange={onViewModeChange}
					/>
				) : null}
			</div>
		</div>
	);
}

interface ParseErrorsListProps {
	readonly errors: readonly AstParseError[];
}

function ParseErrorsList({ errors }: ParseErrorsListProps) {
	return (
		<div className="flex flex-col gap-2">
			{errors.map((error) => (
				<div
					key={`${error.range?.start.line ?? 0}:${error.range?.start.column ?? 0}-${error.message}`}
					className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
				>
					<CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
					<div className="flex flex-col gap-1">
						<span className="font-medium">Syntax Error</span>
						<span className="text-destructive/80">{error.message}</span>
						{error.range ? (
							<span className="text-xs text-muted-foreground">
								Line {error.range.start.line}, Column {error.range.start.column}
							</span>
						) : null}
					</div>
				</div>
			))}
		</div>
	);
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
	{
		title = '',
		value = '',
		mode = 'input',
		editorMode = 'json',
		placeholder = '',
		formatOptions,
		selectedFormat,
		showStatusBar = true,
		showViewToggle = true,
		maxTreeDepth = 3,
		highlightLines = [],
		contextMenuItems = [],
		defaultFileName = 'untitled',
		onFormatChange,
		onChange,
		onCursorChange,
		onFocus,
		onBlur,
		onPaste,
		onClear,
		onSample,
		onCopy,
		actions,
		className = '',
	},
	ref
) {
	const [cursorPosition, setCursorPosition] = useState<CursorPosition>({
		line: 1,
		column: 1,
		selection: 0,
	});
	const [viewMode, setViewMode] = useState<ViewMode>('code');
	const [selectedTreePath, setSelectedTreePath] = useState<string | null>(null);
	const [editorGotoLine, setEditorGotoLine] = useState<number | null>(null);
	const [gotoLineCounter, setGotoLineCounter] = useState(0);
	const [isDragOver, setIsDragOver] = useState(false);
	const dragCounterRef = useRef(0);

	const editorWrapperRef = useRef<CodeEditorWrapperHandle | null>(null);

	useImperativeHandle(
		ref,
		(): CodeEditorHandle => ({
			getSelectionRange: () =>
				editorWrapperRef.current?.getSelectionRange() ?? { start: 0, end: 0 },
			setSelectionRange: (start, end) => {
				editorWrapperRef.current?.setSelectionRange(start, end);
			},
			focusEditor: () => {
				editorWrapperRef.current?.focusEditor();
			},
			gotoLine: (line, focus = false) => {
				editorWrapperRef.current?.scrollToLine(line, focus);
			},
		})
	);

	const isInput = mode === 'input';
	const isOutput = mode === 'output' || mode === 'readonly';
	const isReadonly = mode === 'output' || mode === 'readonly';

	const supportsTreeView =
		editorMode === 'json' ||
		editorMode === 'yaml' ||
		editorMode === 'xml' ||
		editorMode === 'sql' ||
		editorMode === 'markdown';

	const [currentAst, setCurrentAst] = useState<AstNode | null>(null);
	const [parseErrors, setParseErrors] = useState<readonly AstParseError[]>([]);
	const [pathToLineMap, setPathToLineMap] = useState<PathToLineMap>(new Map());
	const [lineToPathMap, setLineToPathMap] = useState<LineToPathMap>(new Map());

	const canShowTree = supportsTreeView && (currentAst !== null || parseErrors.length > 0);

	// Reset to code view when content is cleared completely. Track previous hasContent in a
	// ref so a flicker through empty does not loop back through the effect on every render.
	const hasContentRef = useRef(false);
	useEffect(() => {
		const contentExists = !!value?.trim();
		if (!contentExists && hasContentRef.current) {
			setViewMode('code');
		}
		hasContentRef.current = contentExists;
	}, [value]);

	useEffect(() => {
		const language = getAstLanguage(editorMode);
		if (!language || !value?.trim()) {
			setCurrentAst(null);
			setParseErrors([]);
			setPathToLineMap(new Map());
			setLineToPathMap(new Map());
			return;
		}
		// Cancellation flag in a const ref so the cleanup closure can flip
		// `.cancelled` without a `let` binding.
		const lifecycle = { cancelled: false };
		parseToAst(value, language).then((result) => {
			if (lifecycle.cancelled) return;
			setCurrentAst(result.ast);
			setParseErrors(result.errors);
			if (result.ast) {
				setPathToLineMap(buildPathToLineMap(result.ast));
				setLineToPathMap(buildLineToPathMap(result.ast));
			} else {
				setPathToLineMap(new Map());
				setLineToPathMap(new Map());
			}
		});
		return () => {
			lifecycle.cancelled = true;
		};
	}, [value, editorMode]);

	const stats = useMemo(() => computeStats(value || ''), [value]);

	const handleCursorChange = useCallback(
		(position: CursorPosition) => {
			setCursorPosition(position);
			const closestPath = findPathByLine(lineToPathMap, position.line);
			if (closestPath) {
				setSelectedTreePath(closestPath);
			}
			onCursorChange?.(position.line);
		},
		[lineToPathMap, onCursorChange]
	);

	const handleTreeSelect = useCallback(
		(path: string, _node: AstNode) => {
			setSelectedTreePath(path);
			const lineNum = findLineByPath(pathToLineMap, path);
			if (lineNum) {
				setEditorGotoLine(lineNum);
				setGotoLineCounter((n) => n + 1);
			}
		},
		[pathToLineMap]
	);

	const handleFormatChange = (newFormat: string) => {
		if (newFormat) {
			onFormatChange?.(newFormat);
		}
	};

	const getFileFilters = () => {
		const config = FILE_EXTENSIONS[editorMode];
		if (!config) return [{ name: 'All Files', extensions: ['*'] }];
		return [
			{ name: config.name, extensions: [...config.extensions] },
			{ name: 'All Files', extensions: ['*'] },
		];
	};

	const getDefaultExtension = (): string => {
		const config = FILE_EXTENSIONS[editorMode];
		return config?.extensions[0] ?? 'txt';
	};

	const handleOpenFile = async () => {
		try {
			const selected = await openDialog({ multiple: false, filters: getFileFilters() });
			if (!selected) return;
			const filePath = typeof selected === 'string' ? selected : selected[0];
			if (!filePath) return;
			const content = await readTextFile(filePath);
			onChange?.(content);
			toast.success('File loaded');
		} catch {
			toast.error('Failed to open file');
		}
	};

	const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current += 1;
		if (e.dataTransfer?.types.includes('Files')) {
			setIsDragOver(true);
		}
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
	};

	const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current -= 1;
		if (dragCounterRef.current === 0) {
			setIsDragOver(false);
		}
	};

	const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current = 0;
		setIsDragOver(false);
		if (!isInput) return;
		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;
		const file = files[0];
		if (!file) return;
		try {
			const content = await file.text();
			onChange?.(content);
			toast.success(`Loaded: ${file.name}`);
		} catch {
			toast.error('Failed to read file');
		}
	};

	const handleSaveFile = async () => {
		try {
			const ext = getDefaultExtension();
			const selected = await saveDialog({
				defaultPath: `${defaultFileName}.${ext}`,
				filters: getFileFilters(),
			});
			if (!selected) return;
			await writeTextFile(selected, value);
			toast.success('File saved');
		} catch {
			toast.error('Failed to save file');
		}
	};

	const handleContextMenu = useCallback(
		async (event: MouseEvent, context: EditorContext) => {
			const separator = await PredefinedMenuItem.new({ item: 'Separator' });

			const standardItems = [
				await MenuItem.new({ text: 'Undo', enabled: !context.readonly, action: context.undo }),
				await MenuItem.new({ text: 'Redo', enabled: !context.readonly, action: context.redo }),
				separator,
				await MenuItem.new({
					text: 'Cut',
					enabled: !context.readonly && context.hasSelection,
					action: async () => {
						const text = context.getSelectedText();
						if (text) {
							await writeText(text);
							context.cut();
						}
					},
				}),
				await MenuItem.new({
					text: 'Copy',
					enabled: context.hasSelection,
					action: async () => {
						const text = context.getSelectedText();
						if (text) {
							await writeText(text);
						}
					},
				}),
				await MenuItem.new({
					text: 'Paste',
					enabled: !context.readonly,
					action: async () => {
						const text = await readText();
						if (text) {
							context.paste(text);
						}
					},
				}),
				separator,
				await MenuItem.new({ text: 'Select All', action: context.selectAll }),
			];

			const customItems = await Promise.all(
				contextMenuItems.map(async (item) =>
					MenuItem.new({
						text: item.text,
						enabled: item.enabled ?? true,
						action: item.action,
					})
				)
			);

			const allItems =
				customItems.length > 0 ? [...customItems, separator, ...standardItems] : standardItems;

			const menu = await Menu.new({ items: allItems });
			await menu.popup(new LogicalPosition(event.clientX, event.clientY));
		},
		[contextMenuItems]
	);

	const renderTreePanel = () => {
		if (currentAst) {
			return (
				<TreeView
					node={currentAst}
					maxInitialDepth={maxTreeDepth}
					selectedPath={selectedTreePath}
					onSelect={handleTreeSelect}
				/>
			);
		}
		if (parseErrors.length > 0) {
			return <ParseErrorsList errors={parseErrors} />;
		}
		return null;
	};

	const renderEditor = () => (
		<CodeEditorWrapper
			ref={editorWrapperRef}
			value={value}
			mode={editorMode}
			height="100%"
			readOnly={isReadonly}
			placeholder={placeholder}
			onChange={onChange}
			onCursorChange={handleCursorChange}
			onFocus={onFocus}
			onBlur={onBlur}
			onContextMenu={handleContextMenu}
			gotoLine={editorGotoLine}
			gotoLineTrigger={gotoLineCounter}
			highlightLines={highlightLines}
		/>
	);

	return (
		<section
			className={cn('relative flex h-full flex-col overflow-hidden', className)}
			onDragEnter={isInput ? handleDragEnter : undefined}
			onDragOver={isInput ? handleDragOver : undefined}
			onDragLeave={isInput ? handleDragLeave : undefined}
			onDrop={isInput ? handleDrop : undefined}
			aria-label={isInput ? 'Drop files here' : undefined}
		>
			{isDragOver && isInput ? (
				// biome-ignore lint/a11y/noStaticElementInteractions: overlay forwards drag/drop to the labelled outer <section>; the inner div is a visual marker only.
				<div
					className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 ring-2 ring-inset ring-primary"
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					onDragLeave={handleDragLeave}
				>
					<div className="rounded-lg bg-background/90 px-6 py-4 shadow-lg">
						<p className="text-sm font-medium text-primary">Drop file here</p>
					</div>
				</div>
			) : null}

			<Header
				title={title}
				isInput={isInput}
				isOutput={isOutput}
				onPaste={onPaste}
				onOpenFile={handleOpenFile}
				onClear={onClear}
				onSample={onSample}
				onCopy={onCopy}
				onSaveFile={handleSaveFile}
				actions={actions}
				formatOptions={formatOptions}
				selectedFormat={selectedFormat}
				onFormatChange={handleFormatChange}
				showViewToggle={showViewToggle}
				supportsTreeView={supportsTreeView}
				viewMode={viewMode}
				canShowTree={canShowTree}
				editorMode={editorMode}
				onViewModeChange={setViewMode}
			/>

			<div className="flex-1 overflow-hidden">
				{viewMode === 'tree' && canShowTree ? (
					<div className="h-full overflow-auto p-3" role="tree" aria-label="AST tree">
						{renderTreePanel()}
					</div>
				) : viewMode === 'split' && canShowTree ? (
					<ResizablePanelGroup orientation="horizontal" className="h-full">
						<ResizablePanel defaultSize="50" minSize="20">
							{renderEditor()}
						</ResizablePanel>
						<ResizableHandle withHandle />
						<ResizablePanel defaultSize="50" minSize="20">
							<div
								className="h-full overflow-auto border-l bg-muted/10 p-3"
								role="tree"
								aria-label="AST tree"
							>
								{renderTreePanel()}
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				) : (
					renderEditor()
				)}
			</div>

			{showStatusBar ? (
				<StatusBar
					cursorPosition={cursorPosition}
					selectedTreePath={selectedTreePath}
					viewMode={viewMode}
					stats={stats}
				/>
			) : null}
		</section>
	);
});

export type CodeEditorProps = {
	readonly title?: string;
	readonly value?: string;
	readonly mode?: PaneMode;
	readonly editorMode?: EditorMode;
	readonly placeholder?: string;
	readonly formatOptions?: readonly FormatOption[];
	readonly selectedFormat?: string;
	readonly showStatusBar?: boolean;
	readonly showViewToggle?: boolean;
	readonly maxTreeDepth?: number;
	readonly highlightLines?: readonly HighlightLine[];
	readonly contextMenuItems?: readonly ContextMenuItem[];
	readonly defaultFileName?: string;
	readonly onFormatChange?: (format: string) => void;
	readonly onChange?: (value: string) => void;
	readonly onCursorChange?: (line: number) => void;
	readonly onFocus?: () => void;
	readonly onBlur?: () => void;
	readonly onPaste?: () => void;
	readonly onClear?: () => void;
	readonly onSample?: () => void;
	readonly onCopy?: () => void;
	readonly actions?: ReactNode;
	readonly className?: string;
};
