<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import CodeEditor, {
		type EditorMode,
		type CursorPosition,
	} from '$lib/components/editors/code-editor.svelte';
	import JsonTreeView from './json-tree-view.svelte';
	import {
		Braces,
		ListTree,
		FileCode,
		FileJson2,
		TextCursorInput,
		Rows3,
		Type,
		HardDrive,
		Columns2,
	} from '@lucide/svelte';
	import * as yaml from 'yaml';
	import { xmlToJson } from '$lib/services/formatters.js';
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';

	type ViewMode = 'code' | 'tree' | 'split';

	interface Props {
		title?: string;
		value?: string;
		mode?: EditorMode;
		readonly?: boolean;
		placeholder?: string;
		showViewToggle?: boolean;
		showStatusBar?: boolean;
		defaultViewMode?: ViewMode;
		maxTreeDepth?: number;
		onchange?: (value: string) => void;
		actions?: Snippet;
	}

	let {
		title = '',
		value = $bindable(''),
		mode = 'json',
		readonly = false,
		placeholder = '',
		showViewToggle = true,
		showStatusBar = true,
		defaultViewMode = 'code',
		maxTreeDepth = 3,
		onchange,
		actions,
	}: Props = $props();

	// Capture initial value only - viewMode is user-controlled after mount
	let viewMode = $state<ViewMode>(untrack(() => defaultViewMode));
	let cursorPosition = $state<CursorPosition>({ line: 1, column: 1, selection: 0 });
	let selectedTreePath = $state<string | null>(null);
	let editorGotoLine = $state<number | null>(null);
	let gotoLineCounter = $state(0); // Used to force re-trigger even for same line

	// Calculate text statistics
	const stats = $derived.by(() => {
		const text = value || '';
		const lines = text ? text.split('\n').length : 0;
		const chars = text.length;
		const words = text.trim() ? text.trim().split(/\s+/).length : 0;

		// Format size
		let size: string;
		if (chars < 1024) {
			size = `${chars} B`;
		} else if (chars < 1024 * 1024) {
			size = `${(chars / 1024).toFixed(1)} KB`;
		} else {
			size = `${(chars / (1024 * 1024)).toFixed(1)} MB`;
		}

		return { lines, chars, words, size };
	});

	const handleCursorChange = (position: CursorPosition) => {
		cursorPosition = position;
		// Update selected path based on cursor position
		updateSelectedPathFromCursor(position.line);
	};

	// Check if tree view is supported for current mode
	const supportsTreeView = $derived(mode === 'json' || mode === 'yaml' || mode === 'xml');

	// Get the appropriate icon for code view based on mode
	const CodeIcon = $derived(mode === 'xml' ? FileCode : mode === 'yaml' ? FileJson2 : Braces);

	// Parse value for tree view
	const parsedValue = $derived.by(() => {
		if (!supportsTreeView || !value?.trim()) return null;
		try {
			if (mode === 'json') {
				return JSON.parse(value);
			} else if (mode === 'yaml') {
				return yaml.parse(value);
			} else if (mode === 'xml') {
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
		if (!value?.trim() || mode !== 'json') return new Map<string, number>();

		const map = new Map<string, number>();
		map.set('$', 1); // Root

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

					// Track array indices
					if (
						trimmedLine.startsWith('[') ||
						(trimmedLine.includes(':') && trimmedLine.endsWith('['))
					) {
						inArray = true;
						arrayIndexStack = [...arrayIndexStack, 0];
					}

					// Match key: value pattern
					const keyMatch = trimmedLine.match(/^"([^"]+)"\s*:/);
					if (keyMatch) {
						const key = keyMatch[1];
						const parentPath = pathStack[pathStack.length - 1];
						const currentPath = `${parentPath}.${key}`;
						map.set(currentPath, lineNum);

						// Check if value is object or array (starts on same or next line)
						if (trimmedLine.endsWith('{')) {
							pathStack = [...pathStack, currentPath];
						} else if (trimmedLine.endsWith('[')) {
							pathStack = [...pathStack, currentPath];
							inArray = true;
							arrayIndexStack = [...arrayIndexStack, 0];
						}
					}

					// Handle array elements (objects in arrays)
					if (inArray && trimmedLine === '{') {
						const parentPath = pathStack[pathStack.length - 1];
						const idx = arrayIndexStack[arrayIndexStack.length - 1];
						const currentPath = `${parentPath}[${idx}]`;
						map.set(currentPath, lineNum);
						pathStack = [...pathStack, currentPath];
						arrayIndexStack = [...arrayIndexStack.slice(0, -1), idx + 1];
					}

					// Track closing brackets
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

	// Update selected path based on cursor line
	const updateSelectedPathFromCursor = (line: number) => {
		// Find the closest path for this line
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

		// Find the line number for this path and scroll editor to it
		const lineNum = pathToLineMap.get(path) ?? findLineByKey(path) ?? findLineByArrayIndex(path);

		if (lineNum) {
			editorGotoLine = lineNum;
			gotoLineCounter++; // Force re-trigger
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

	// Cycle through view modes
	const cycleViewMode = () => {
		if (!canShowTree) {
			viewMode = 'code';
			return;
		}

		switch (viewMode) {
			case 'code':
				viewMode = 'split';
				break;
			case 'split':
				viewMode = 'tree';
				break;
			case 'tree':
				viewMode = 'code';
				break;
		}
	};
</script>

<div class="flex h-full flex-col overflow-hidden">
	{#if title || actions || (showViewToggle && supportsTreeView)}
		<div class="relative z-10 flex h-8 items-center justify-between border-b bg-muted/30 px-3">
			<div class="flex items-center gap-2">
				<span class="text-xs font-medium">{title}</span>
				{#if actions}
					<div class="flex items-center gap-0.5">
						{@render actions()}
					</div>
				{/if}
			</div>
			{#if showViewToggle && supportsTreeView}
				<div class="flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5">
					<Button
						variant={viewMode === 'code' ? 'secondary' : 'ghost'}
						size="icon"
						class="h-6 w-6"
						onclick={() => (viewMode = 'code')}
						title="Code View"
					>
						<CodeIcon class="h-3.5 w-3.5" />
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
	{/if}
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
						{mode}
						height="100%"
						{readonly}
						{placeholder}
						{onchange}
						oncursorchange={handleCursorChange}
						gotoLine={editorGotoLine}
						gotoLineTrigger={gotoLineCounter}
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
				{mode}
				height="100%"
				{readonly}
				{placeholder}
				{onchange}
				oncursorchange={handleCursorChange}
				gotoLine={editorGotoLine}
				gotoLineTrigger={gotoLineCounter}
			/>
		{/if}
	</div>
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
				<div class="flex items-center gap-1 px-2" title="Words">
					<Type class="h-3 w-3 opacity-60" />
					<span>{stats.words}</span>
				</div>
				<div class="flex items-center gap-1 pl-2" title="Size">
					<HardDrive class="h-3 w-3 opacity-60" />
					<span>{stats.size}</span>
				</div>
			</div>
		</div>
	{/if}
</div>
