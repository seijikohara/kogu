<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import CodeEditor, {
		type EditorMode,
		type CursorPosition,
		type HighlightLine,
	} from '$lib/components/editors/code-editor.svelte';
	import JsonTreeView from '$lib/components/viewers/json-tree-view.svelte';
	import {
		Clipboard,
		Trash2,
		Copy,
		Download,
		TextCursorInput,
		Rows3,
		HardDrive,
		Braces,
		ListTree,
		Columns2,
		FileCode,
		FileJson2,
		FlaskConical,
	} from '@lucide/svelte';
	import * as yaml from 'yaml';
	import { xmlToJson } from '$lib/services/formatters.js';
	import type { Snippet } from 'svelte';

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
		onformatchange?: (format: string) => void;
		onchange?: (value: string) => void;
		onpaste?: () => void;
		onclear?: () => void;
		onsample?: () => void;
		oncopy?: () => void;
		ondownload?: () => void;
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
		onformatchange,
		onchange,
		onpaste,
		onclear,
		onsample,
		oncopy,
		ondownload,
		actions,
		class: className = '',
	}: Props = $props();

	let cursorPosition = $state<CursorPosition>({ line: 1, column: 1, selection: 0 });
	let viewMode = $state<ViewMode>('code');
	let selectedTreePath = $state<string | null>(null);
	let editorGotoLine = $state<number | null>(null);
	let gotoLineCounter = $state(0);

	const isInput = $derived(mode === 'input');
	const isOutput = $derived(mode === 'output' || mode === 'readonly');
	const isReadonly = $derived(mode === 'output' || mode === 'readonly');

	// Check if tree view is supported for current mode
	const supportsTreeView = $derived(
		editorMode === 'json' || editorMode === 'yaml' || editorMode === 'xml'
	);

	// Parse value for tree view
	const parsedValue = $derived.by(() => {
		if (!supportsTreeView || !value?.trim()) return null;
		try {
			if (editorMode === 'json') {
				return JSON.parse(value);
			} else if (editorMode === 'yaml') {
				return yaml.parse(value);
			} else if (editorMode === 'xml') {
				const jsonStr = xmlToJson(value);
				return JSON.parse(jsonStr);
			}
			return null;
		} catch {
			return null;
		}
	});

	// Can show tree view only if supported and data is valid
	const canShowTree = $derived(supportsTreeView && parsedValue !== null);

	// Reset to code view if tree view becomes unavailable
	$effect(() => {
		if ((viewMode === 'tree' || viewMode === 'split') && !canShowTree) {
			viewMode = 'code';
		}
	});

	// Build a map of JSON paths to line numbers for synchronization
	const pathToLineMap = $derived.by(() => {
		if (!value?.trim() || editorMode !== 'json') return new Map<string, number>();

		const map = new Map<string, number>();
		map.set('$', 1);

		try {
			const lines = value.split('\n');

			interface ParseState {
				pathStack: string[];
				arrayIndexStack: number[];
				inArray: boolean;
			}

			lines.reduce<ParseState>(
				(acc, line, i) => {
					const lineNum = i + 1;
					const trimmedLine = line.trim();

					let { pathStack, arrayIndexStack, inArray } = acc;

					if (
						trimmedLine.startsWith('[') ||
						(trimmedLine.includes(':') && trimmedLine.endsWith('['))
					) {
						inArray = true;
						arrayIndexStack = [...arrayIndexStack, 0];
					}

					const keyMatch = trimmedLine.match(/^"([^"]+)"\s*:/);
					if (keyMatch) {
						const key = keyMatch[1];
						const parentPath = pathStack[pathStack.length - 1];
						const currentPath = `${parentPath}.${key}`;
						map.set(currentPath, lineNum);

						if (trimmedLine.endsWith('{')) {
							pathStack = [...pathStack, currentPath];
						} else if (trimmedLine.endsWith('[')) {
							pathStack = [...pathStack, currentPath];
							inArray = true;
							arrayIndexStack = [...arrayIndexStack, 0];
						}
					}

					if (inArray && trimmedLine === '{') {
						const parentPath = pathStack[pathStack.length - 1];
						const idx = arrayIndexStack[arrayIndexStack.length - 1];
						const currentPath = `${parentPath}[${idx}]`;
						map.set(currentPath, lineNum);
						pathStack = [...pathStack, currentPath];
						arrayIndexStack = [...arrayIndexStack.slice(0, -1), idx + 1];
					}

					if (trimmedLine.startsWith('}') || trimmedLine === '},') {
						if (pathStack.length > 1) {
							pathStack = pathStack.slice(0, -1);
						}
					}

					if (trimmedLine.startsWith(']') || trimmedLine === '],') {
						if (arrayIndexStack.length > 0) {
							arrayIndexStack = arrayIndexStack.slice(0, -1);
							inArray = arrayIndexStack.length > 0;
						}
					}

					return { pathStack, arrayIndexStack, inArray };
				},
				{ pathStack: ['$'], arrayIndexStack: [], inArray: false }
			);
		} catch {
			// Ignore parsing errors
		}

		return map;
	});

	// Build line to path map (reverse of above)
	const lineToPathMap = $derived(
		new Map(Array.from(pathToLineMap, ([path, line]) => [line, path]))
	);

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
	};

	// Update selected path based on cursor line
	const updateSelectedPathFromCursor = (line: number) => {
		const closestPath =
			Array.from(lineToPathMap.entries())
				.filter(([l]) => l <= line)
				.sort(([a], [b]) => b - a)
				.at(0)?.[1] ?? null;

		if (closestPath) {
			selectedTreePath = closestPath;
		}
	};

	// Handle tree node selection - scroll to line in editor
	const handleTreeSelect = (path: string, _value: unknown) => {
		selectedTreePath = path;

		const lineNum = pathToLineMap.get(path) ?? findLineByKey(path) ?? findLineByArrayIndex(path);

		if (lineNum) {
			editorGotoLine = lineNum;
			gotoLineCounter++;
		}
	};

	// Find line number by key name in path
	const findLineByKey = (path: string): number | null => {
		if (!path.includes('.')) return null;

		const key = path.split('.').pop() ?? '';
		const lines = value.split('\n');
		const lineIndex = lines.findIndex((line) => line.includes(`"${key}"`));
		return lineIndex >= 0 ? lineIndex + 1 : null;
	};

	// Find line number by array index in path
	const findLineByArrayIndex = (path: string): number | null => {
		const match = path.match(/\[(\d+)\]$/);
		if (!match) return null;

		const targetIndex = parseInt(match[1]);
		const lines = value.split('\n');

		const result = lines.reduce<{
			bracketCount: number;
			arrayItemCount: number;
			foundLine: number | null;
		}>(
			(acc, line, i) => {
				if (acc.foundLine !== null) return acc;

				const trimmed = line.trim();
				const newBracketCount =
					acc.bracketCount + (trimmed.includes('[') ? 1 : 0) - (trimmed.includes(']') ? 1 : 0);

				if (trimmed.startsWith('{') && acc.bracketCount === 1) {
					if (acc.arrayItemCount === targetIndex) {
						return { ...acc, foundLine: i + 1 };
					}
					return { ...acc, bracketCount: newBracketCount, arrayItemCount: acc.arrayItemCount + 1 };
				}

				return { ...acc, bracketCount: newBracketCount };
			},
			{ bracketCount: 0, arrayItemCount: 0, foundLine: null }
		);

		return result.foundLine;
	};

	// Handle format selection change
	const handleFormatChange = (newFormat: string | undefined) => {
		if (newFormat && onformatchange) {
			onformatchange(newFormat);
		}
	};
</script>

<div class="flex h-full flex-col overflow-hidden {className}">
	<!-- Pane Header -->
	<div
		class="relative z-10 flex h-9 shrink-0 items-center justify-between border-b bg-muted/30 px-3"
	>
		<div class="flex items-center gap-2">
			{#if title}
				<span class="text-xs font-medium text-muted-foreground">{title}</span>
			{/if}

			{#if isInput}
				<!-- Input actions: Paste, Clear, Sample (all on left side) -->
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
				<!-- Output actions: Copy, Download (all on left side) -->
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
					{#if ondownload}
						<Button
							variant="ghost"
							size="sm"
							class="h-6 gap-1 px-2 text-xs"
							onclick={ondownload}
							title="Download file"
						>
							<Download class="h-3 w-3" />
							<span class="hidden sm:inline">Download</span>
						</Button>
					{/if}
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
							<FileJson2 class="h-3.5 w-3.5" />
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
				<JsonTreeView
					data={parsedValue}
					maxInitialDepth={maxTreeDepth}
					selectedPath={selectedTreePath}
					onselect={handleTreeSelect}
				/>
			</div>
		{:else if viewMode === 'split' && canShowTree}
			<Resizable.PaneGroup direction="horizontal" class="h-full">
				<Resizable.Pane defaultSize={50} minSize={20}>
					<CodeEditor
						bind:value
						mode={editorMode}
						height="100%"
						readonly={isReadonly}
						{placeholder}
						{onchange}
						oncursorchange={handleCursorChange}
						gotoLine={editorGotoLine}
						gotoLineTrigger={gotoLineCounter}
						{highlightLines}
					/>
				</Resizable.Pane>
				<Resizable.Handle withHandle />
				<Resizable.Pane defaultSize={50} minSize={20}>
					<div class="h-full overflow-auto border-l bg-muted/10 p-3">
						<JsonTreeView
							data={parsedValue}
							maxInitialDepth={maxTreeDepth}
							selectedPath={selectedTreePath}
							onselect={handleTreeSelect}
						/>
					</div>
				</Resizable.Pane>
			</Resizable.PaneGroup>
		{:else}
			<CodeEditor
				bind:value
				mode={editorMode}
				height="100%"
				readonly={isReadonly}
				{placeholder}
				{onchange}
				oncursorchange={handleCursorChange}
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
