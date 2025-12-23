<script lang="ts">
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
	} from '@lucide/svelte';
	import { LogicalPosition } from '@tauri-apps/api/dpi';
	import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
	import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
	import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
	import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import {
		type AstLanguage,
		type AstNode,
		type AstParseError,
		buildLineToPathMap,
		buildPathToLineMap,
		findLineByPath,
		findPathByLine,
		type LineToPathMap,
		type PathToLineMap,
		parseToAst,
	} from '$lib/services/ast/index.js';
	import { cn } from '$lib/utils.js';
	import CodeEditorWrapper, {
		type ContextMenuItem,
		type CursorPosition,
		type EditorContext,
		type EditorMode,
		type HighlightLine,
	} from './code-editor-wrapper.svelte';
	import TreeView from './tree-view.svelte';

	type PaneMode = 'input' | 'output' | 'readonly';
	type ViewMode = 'code' | 'tree' | 'split';

	interface FormatOption {
		value: string;
		label: string;
	}

	interface Props {
		title?: string;
		value?: string;
		mode?: PaneMode;
		editorMode?: EditorMode;
		placeholder?: string;
		formatOptions?: FormatOption[];
		selectedFormat?: string;
		showStatusBar?: boolean;
		showViewToggle?: boolean;
		maxTreeDepth?: number;
		highlightLines?: HighlightLine[];
		contextMenuItems?: ContextMenuItem[];
		defaultFileName?: string;
		onformatchange?: (format: string) => void;
		onchange?: (value: string) => void;
		oncursorchange?: (line: number) => void;
		onfocus?: () => void;
		onblur?: () => void;
		onpaste?: () => void;
		onclear?: () => void;
		onsample?: () => void;
		oncopy?: () => void;
		actions?: Snippet;
		class?: string;
	}

	let {
		title = '',
		value = $bindable(''),
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
		onformatchange,
		onchange,
		oncursorchange,
		onfocus,
		onblur,
		onpaste,
		onclear,
		onsample,
		oncopy,
		actions,
		class: className = '',
	}: Props = $props();

	let cursorPosition = $state<CursorPosition>({ line: 1, column: 1, selection: 0 });
	let viewMode = $state<ViewMode>('code');
	let selectedTreePath = $state<string | null>(null);
	let editorGotoLine = $state<number | null>(null);
	let gotoLineCounter = $state(0);
	let isDragOver = $state(false);
	let dragCounter = $state(0);

	// Editor wrapper reference for exposing methods
	let editorWrapperRef = $state<CodeEditorWrapper | null>(null);

	// Exported methods for parent components
	export const getSelectionRange = (): { start: number; end: number } => {
		return editorWrapperRef?.getSelectionRange() ?? { start: 0, end: 0 };
	};

	export const setSelectionRange = (start: number, end: number) => {
		editorWrapperRef?.setSelectionRange(start, end);
	};

	export const focusEditor = () => {
		editorWrapperRef?.focusEditor();
	};

	export const gotoLine = (line: number, focus: boolean = false) => {
		editorWrapperRef?.scrollToLine(line, focus);
	};

	const isInput = $derived(mode === 'input');
	const isOutput = $derived(mode === 'output' || mode === 'readonly');
	const isReadonly = $derived(mode === 'output' || mode === 'readonly');

	// Check if tree view is supported for current mode (AST-supported languages)
	const supportsTreeView = $derived(
		editorMode === 'json' ||
			editorMode === 'yaml' ||
			editorMode === 'xml' ||
			editorMode === 'sql' ||
			editorMode === 'markdown'
	);

	// AST and path maps state
	let currentAst = $state<AstNode | null>(null);
	let parseErrors = $state<readonly AstParseError[]>([]);
	let pathToLineMap = $state<PathToLineMap>(new Map());
	let lineToPathMap = $state<LineToPathMap>(new Map());

	// Can show tree view if AST is available OR there are parse errors
	const canShowTree = $derived(supportsTreeView && (currentAst !== null || parseErrors.length > 0));

	// Track if tree/split view was manually selected (to maintain view on errors)
	let hasContent = $state(false);

	// Only reset to code view when content is cleared completely
	$effect(() => {
		const contentExists = !!value?.trim();
		if (!contentExists && hasContent) {
			viewMode = 'code';
		}
		hasContent = contentExists;
	});

	// Map editor mode to AST language
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

	// Parse AST and build path maps when value or editor mode changes
	$effect(() => {
		const language = getAstLanguage(editorMode);
		if (!language || !value?.trim()) {
			currentAst = null;
			parseErrors = [];
			pathToLineMap = new Map();
			lineToPathMap = new Map();
			return;
		}

		// Parse AST asynchronously
		parseToAst(value, language).then((result) => {
			currentAst = result.ast;
			parseErrors = result.errors;
			if (result.ast) {
				pathToLineMap = buildPathToLineMap(result.ast);
				lineToPathMap = buildLineToPathMap(result.ast);
			} else {
				pathToLineMap = new Map();
				lineToPathMap = new Map();
			}
		});
	});

	// Calculate text statistics
	const stats = $derived.by(() => {
		const text = value || '';
		const lines = text ? text.split('\n').length : 0;
		const chars = text.length;

		let size: string;
		if (chars < 1024) {
			size = `${chars} B`;
		} else if (chars < 1024 * 1024) {
			size = `${(chars / 1024).toFixed(1)} KB`;
		} else {
			size = `${(chars / (1024 * 1024)).toFixed(1)} MB`;
		}

		return { lines, chars, size };
	});

	// Handle cursor position change
	const handleCursorChange = (position: CursorPosition) => {
		cursorPosition = position;
		updateSelectedPathFromCursor(position.line);
		oncursorchange?.(position.line);
	};

	// Update selected path based on cursor line (using AST-based line map)
	const updateSelectedPathFromCursor = (line: number) => {
		const closestPath = findPathByLine(lineToPathMap, line);
		if (closestPath) {
			selectedTreePath = closestPath;
		}
	};

	// Handle tree node selection - scroll to line in editor (using AST-based path map)
	const handleTreeSelect = (path: string, _node: AstNode) => {
		selectedTreePath = path;

		const lineNum = findLineByPath(pathToLineMap, path);
		if (lineNum) {
			editorGotoLine = lineNum;
			gotoLineCounter++;
		}
	};

	// Handle format selection change
	const handleFormatChange = (newFormat: string | undefined) => {
		if (newFormat && onformatchange) {
			onformatchange(newFormat);
		}
	};

	// File extension mapping for editor modes
	const FILE_EXTENSIONS: Record<string, { extensions: string[]; name: string }> = {
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

	// Get file filters for dialog based on editor mode
	const getFileFilters = () => {
		const config = FILE_EXTENSIONS[editorMode];
		if (!config) return [{ name: 'All Files', extensions: ['*'] }];
		return [
			{ name: config.name, extensions: config.extensions },
			{ name: 'All Files', extensions: ['*'] },
		];
	};

	// Get default file extension for current editor mode
	const getDefaultExtension = (): string => {
		const config = FILE_EXTENSIONS[editorMode];
		return config?.extensions[0] ?? 'txt';
	};

	// Handle file open dialog
	const handleOpenFile = async () => {
		try {
			const selected = await openDialog({
				multiple: false,
				filters: getFileFilters(),
			});

			if (!selected) return;

			const filePath = typeof selected === 'string' ? selected : selected[0];
			if (!filePath) return;

			const content = await readTextFile(filePath);
			value = content;
			onchange?.(content);
			toast.success('File loaded');
		} catch (error) {
			toast.error('Failed to open file');
		}
	};

	// Handle file drag enter (counter-based to handle child elements)
	const handleDragEnter = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounter++;
		// Only show drop zone if dragging files
		if (e.dataTransfer?.types.includes('Files')) {
			isDragOver = true;
		}
	};

	// Handle file drag over
	const handleDragOver = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
	};

	// Handle file drag leave (counter-based)
	const handleDragLeave = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		// Only hide when truly leaving the container
		if (dragCounter === 0) {
			isDragOver = false;
		}
	};

	// Handle file drop
	const handleDrop = async (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounter = 0;
		isDragOver = false;

		if (!isInput) return;

		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		if (!file) return;

		try {
			const content = await file.text();
			value = content;
			onchange?.(content);
			toast.success(`Loaded: ${file.name}`);
		} catch {
			toast.error('Failed to read file');
		}
	};

	// Handle file save/download
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
		} catch (error) {
			toast.error('Failed to save file');
		}
	};

	// Build and show Tauri context menu
	const handleContextMenu = async (event: MouseEvent, context: EditorContext) => {
		const separator = await PredefinedMenuItem.new({ item: 'Separator' });

		const standardItems = [
			await MenuItem.new({
				text: 'Undo',
				enabled: !context.readonly,
				action: context.undo,
			}),
			await MenuItem.new({
				text: 'Redo',
				enabled: !context.readonly,
				action: context.redo,
			}),
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
			await MenuItem.new({
				text: 'Select All',
				action: context.selectAll,
			}),
		];

		// Add custom menu items if provided
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
	};
</script>

<div
	class={cn('relative flex h-full flex-col overflow-hidden', className)}
	ondragenter={isInput ? handleDragEnter : undefined}
	ondragover={isInput ? handleDragOver : undefined}
	ondragleave={isInput ? handleDragLeave : undefined}
	ondrop={isInput ? handleDrop : undefined}
	role={isInput ? 'region' : undefined}
	aria-label={isInput ? 'Drop files here' : undefined}
>
	<!-- Drop zone overlay -->
	{#if isDragOver && isInput}
		<div
			class="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 ring-2 ring-inset ring-primary"
			role="region"
			aria-label="File drop zone"
			ondragover={handleDragOver}
			ondrop={handleDrop}
			ondragleave={handleDragLeave}
		>
			<div class="rounded-lg bg-background/90 px-6 py-4 shadow-lg">
				<p class="text-sm font-medium text-primary">Drop file here</p>
			</div>
		</div>
	{/if}
	<!-- Pane Header -->
	<div
		class="relative z-10 flex h-9 shrink-0 items-center justify-between border-b bg-muted/30 px-3"
	>
		<div class="flex items-center gap-2">
			{#if title}
				<span class="text-xs font-medium text-muted-foreground">{title}</span>
			{/if}

			{#if isInput}
				<!-- Input actions: Paste, Open, Clear, Sample (all on left side) -->
				<div class="flex items-center gap-0.5">
					{#if onpaste}
						<Button
							variant="ghost"
							size="sm"
							class="h-6 gap-1 px-2 text-xs"
							onclick={onpaste}
							title="Paste from clipboard"
						>
							<Clipboard class="h-3 w-3" />
							<span class="hidden sm:inline">Paste</span>
						</Button>
					{/if}
					<Button
						variant="ghost"
						size="sm"
						class="h-6 gap-1 px-2 text-xs"
						onclick={handleOpenFile}
						title="Open file"
					>
						<FolderOpen class="h-3 w-3" />
						<span class="hidden sm:inline">Open</span>
					</Button>
					{#if onclear}
						<Button
							variant="ghost"
							size="sm"
							class="h-6 gap-1 px-2 text-xs"
							onclick={onclear}
							title="Clear input"
						>
							<Trash2 class="h-3 w-3" />
							<span class="hidden sm:inline">Clear</span>
						</Button>
					{/if}
					{#if onsample}
						<Button
							variant="ghost"
							size="sm"
							class="h-6 gap-1 px-2 text-xs"
							onclick={onsample}
							title="Load sample data"
						>
							<FlaskConical class="h-3 w-3" />
							<span class="hidden sm:inline">Sample</span>
						</Button>
					{/if}
				</div>
			{/if}

			{#if isOutput}
				<!-- Output actions: Copy, Save (all on left side) -->
				<div class="flex items-center gap-0.5">
					{#if oncopy}
						<Button
							variant="ghost"
							size="sm"
							class="h-6 gap-1 px-2 text-xs"
							onclick={oncopy}
							title="Copy to clipboard"
						>
							<Copy class="h-3 w-3" />
							<span class="hidden sm:inline">Copy</span>
						</Button>
					{/if}
					<Button
						variant="ghost"
						size="sm"
						class="h-6 gap-1 px-2 text-xs"
						onclick={handleSaveFile}
						title="Save to file"
					>
						<Download class="h-3 w-3" />
						<span class="hidden sm:inline">Save</span>
					</Button>
				</div>
			{/if}

			{#if actions}
				{@render actions()}
			{/if}
		</div>

		<div class="flex items-center gap-2">
			{#if isOutput}
				<!-- Output format selector (right side) -->
				{#if formatOptions && formatOptions.length > 0}
					<Select.Root
						type="single"
						value={selectedFormat}
						onValueChange={(v) => handleFormatChange(v)}
					>
						<Select.Trigger class="h-6 w-auto min-w-[80px] gap-1 px-2 text-xs">
							{selectedFormat
								? (formatOptions.find((f) => f.value === selectedFormat)?.label ?? selectedFormat)
								: 'Format'}
						</Select.Trigger>
						<Select.Content>
							{#each formatOptions as option}
								<Select.Item value={option.value}>{option.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				{/if}
			{/if}

			<!-- View Toggle (right side) -->
			{#if showViewToggle && supportsTreeView}
				<div class="flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5">
					<Button
						variant={viewMode === 'code' ? 'secondary' : 'ghost'}
						size="icon"
						class="h-6 w-6"
						onclick={() => (viewMode = 'code')}
						title="Code View"
					>
						{#if editorMode === 'xml'}
							<FileCode class="h-3.5 w-3.5" />
						{:else if editorMode === 'yaml'}
							<FileJson class="h-3.5 w-3.5" />
						{:else if editorMode === 'sql'}
							<Database class="h-3.5 w-3.5" />
						{:else if editorMode === 'markdown'}
							<FileText class="h-3.5 w-3.5" />
						{:else}
							<Braces class="h-3.5 w-3.5" />
						{/if}
					</Button>
					<Button
						variant={viewMode === 'split' ? 'secondary' : 'ghost'}
						size="icon"
						class="h-6 w-6"
						onclick={() => (viewMode = 'split')}
						title="Split View"
						disabled={!canShowTree}
					>
						<Columns2 class="h-3.5 w-3.5" />
					</Button>
					<Button
						variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
						size="icon"
						class="h-6 w-6"
						onclick={() => (viewMode = 'tree')}
						title="Tree View"
						disabled={!canShowTree}
					>
						<ListTree class="h-3.5 w-3.5" />
					</Button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Editor Content -->
	<div class="flex-1 overflow-hidden">
		{#if viewMode === 'tree' && canShowTree}
			<div class="h-full overflow-auto p-3">
				{#if currentAst}
					<TreeView
						node={currentAst}
						maxInitialDepth={maxTreeDepth}
						selectedPath={selectedTreePath}
						onselect={handleTreeSelect}
					/>
				{:else if parseErrors.length > 0}
					<div class="flex flex-col gap-2">
						{#each parseErrors as error}
							<div
								class="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
							>
								<CircleAlert class="mt-0.5 h-4 w-4 shrink-0" />
								<div class="flex flex-col gap-1">
									<span class="font-medium">Syntax Error</span>
									<span class="text-destructive/80">{error.message}</span>
									{#if error.range}
										<span class="text-xs text-muted-foreground">
											Line {error.range.start.line}, Column {error.range.start.column}
										</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{:else if viewMode === 'split' && canShowTree}
			<Resizable.PaneGroup direction="horizontal" class="h-full">
				<Resizable.Pane defaultSize={50} minSize={20}>
					<CodeEditorWrapper
						bind:this={editorWrapperRef}
						bind:value
						mode={editorMode}
						height="100%"
						readonly={isReadonly}
						{placeholder}
						{onchange}
						oncursorchange={handleCursorChange}
						{onfocus}
						{onblur}
						oncontextmenu={handleContextMenu}
						gotoLine={editorGotoLine}
						gotoLineTrigger={gotoLineCounter}
						{highlightLines}
					/>
				</Resizable.Pane>
				<Resizable.Handle withHandle />
				<Resizable.Pane defaultSize={50} minSize={20}>
					<div class="h-full overflow-auto border-l bg-muted/10 p-3">
						{#if currentAst}
							<TreeView
								node={currentAst}
								maxInitialDepth={maxTreeDepth}
								selectedPath={selectedTreePath}
								onselect={handleTreeSelect}
							/>
						{:else if parseErrors.length > 0}
							<div class="flex flex-col gap-2">
								{#each parseErrors as error}
									<div
										class="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
									>
										<CircleAlert class="mt-0.5 h-4 w-4 shrink-0" />
										<div class="flex flex-col gap-1">
											<span class="font-medium">Syntax Error</span>
											<span class="text-destructive/80">{error.message}</span>
											{#if error.range}
												<span class="text-xs text-muted-foreground">
													Line {error.range.start.line}, Column {error.range.start.column}
												</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</Resizable.Pane>
			</Resizable.PaneGroup>
		{:else}
			<CodeEditorWrapper
				bind:this={editorWrapperRef}
				bind:value
				mode={editorMode}
				height="100%"
				readonly={isReadonly}
				{placeholder}
				{onchange}
				oncursorchange={handleCursorChange}
				{onfocus}
				{onblur}
				oncontextmenu={handleContextMenu}
				gotoLine={editorGotoLine}
				gotoLineTrigger={gotoLineCounter}
				{highlightLines}
			/>
		{/if}
	</div>

	<!-- Status Bar -->
	{#if showStatusBar}
		<div
			class="flex h-5 shrink-0 items-center justify-between border-t bg-muted/20 px-2 font-mono text-[10px] text-muted-foreground/80"
		>
			<div class="flex items-center divide-x divide-border/50">
				<div class="flex items-center gap-1 pr-2" title="Cursor Position">
					<TextCursorInput class="h-3 w-3 opacity-60" />
					<span>{cursorPosition.line}:{cursorPosition.column}</span>
				</div>
				{#if cursorPosition.selection > 0}
					<div class="flex items-center gap-1 px-2" title="Selected Characters">
						<span class="text-primary/80">{cursorPosition.selection} sel</span>
					</div>
				{/if}
				{#if selectedTreePath && (viewMode === 'split' || viewMode === 'tree')}
					<div class="flex items-center gap-1 px-2" title="Selected Path">
						<span class="text-amber-600 dark:text-amber-400">{selectedTreePath}</span>
					</div>
				{/if}
			</div>
			<div class="flex items-center divide-x divide-border/50">
				<div class="flex items-center gap-1 px-2" title="Lines">
					<Rows3 class="h-3 w-3 opacity-60" />
					<span>{stats.lines}</span>
				</div>
				<div class="flex items-center gap-1 pl-2" title="Size">
					<HardDrive class="h-3 w-3 opacity-60" />
					<span>{stats.size}</span>
				</div>
			</div>
		</div>
	{/if}
</div>
