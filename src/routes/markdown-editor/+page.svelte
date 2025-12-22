<script lang="ts">
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
	} from '@lucide/svelte';
	import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
	import { toast } from 'svelte-sonner';
	import { CodeEditor, type FormatCommand, TiptapEditor } from '$lib/components/editor';
	import { FormInfo, FormMode, FormSection } from '$lib/components/form';
	import { PageLayout, SplitPane } from '$lib/components/layout';
	import { Button } from '$lib/components/ui/button';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		applyFormat,
		exportAsHtml,
		type FormatAction,
		generateToc,
		getMarkdownStats,
		type MarkdownStats,
		markdownToHtmlAsync,
		SAMPLE_MARKDOWN,
		type TocItem,
		tocToMarkdown,
	} from '$lib/services/markdown.js';
	import MarkdownContextMenuItems from './markdown-context-menu-items.svelte';

	type RightPanelMode = 'wysiwyg' | 'preview';
	type ActiveEditor = 'monaco' | 'tiptap' | null;

	// Toolbar group definitions
	interface ToolbarButton {
		readonly icon: typeof Bold;
		readonly label: string;
		readonly action: FormatAction['type'];
	}

	interface HeadingOption {
		readonly level: 1 | 2 | 3 | 4 | 5 | 6;
		readonly icon: typeof Heading1;
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
		{ level: 1, icon: Heading1, label: 'Heading 1', action: 'heading1' },
		{ level: 2, icon: Heading2, label: 'Heading 2', action: 'heading2' },
		{ level: 3, icon: Heading3, label: 'Heading 3', action: 'heading3' },
		{ level: 4, icon: Heading4, label: 'Heading 4', action: 'heading4' },
		{ level: 5, icon: Heading5, label: 'Heading 5', action: 'heading5' },
		{ level: 6, icon: Heading6, label: 'Heading 6', action: 'heading6' },
	];

	// State
	let input = $state('');
	let rightPanelMode = $state<RightPanelMode>('wysiwyg');
	let showOptions = $state(true);
	let activeEditor = $state<ActiveEditor>(null);

	// Component references
	let monacoRef = $state<CodeEditor | null>(null);
	let tiptapRef = $state<TiptapEditor | null>(null);

	// Track which editor made the last change to prevent sync loops
	let lastChangeSource: 'monaco' | 'tiptap' | null = null;
	let isProcessingChange = false;

	// Track cursor sync source to prevent infinite loops
	let cursorSyncSource: 'monaco' | 'tiptap' | null = null;
	let lastMonacoCursorLine = 0;
	let lastTiptapCursorLine = 0;

	// Computed values
	let htmlOutput = $state('');
	const stats = $derived.by((): MarkdownStats => getMarkdownStats(input));
	const toc = $derived.by((): readonly TocItem[] => generateToc(input));

	// Async HTML rendering with TeX and diagram support
	$effect(() => {
		const currentInput = input;
		markdownToHtmlAsync(currentInput).then((result) => {
			// Only update if input hasn't changed
			if (currentInput === input) {
				htmlOutput = result;
			}
		});
	});

	// Validation state
	const valid = $derived.by((): boolean | null => {
		if (!input.trim()) return null;
		return true;
	});

	// Handle format button click
	const handleFormat = (action: FormatAction['type'], providedUrl?: string) => {
		// Handle link and image with URL prompt
		let actionUrl = providedUrl;
		if (action === 'link' && !actionUrl) {
			const inputUrl = prompt('Enter URL:');
			if (!inputUrl) return;
			actionUrl = inputUrl;
		}
		if (action === 'image' && !actionUrl) {
			const inputUrl = prompt('Enter image URL:');
			if (!inputUrl) return;
			actionUrl = inputUrl;
		}

		// Determine which editor to format
		const targetEditor = activeEditor ?? 'monaco';

		if (targetEditor === 'monaco' && monacoRef) {
			// Format Monaco editor
			const selection = monacoRef.getSelectionRange();
			const result = applyFormat(input, selection.start, selection.end, action);
			input = result.text;

			// Set selection after update
			requestAnimationFrame(() => {
				monacoRef?.setSelectionRange(result.selectionStart, result.selectionEnd);
				monacoRef?.focusEditor();
			});
		} else if (targetEditor === 'tiptap' && tiptapRef) {
			// Format Tiptap editor
			tiptapRef.executeFormat(action as FormatCommand, actionUrl);
		}
	};

	// Handlers for Monaco Editor (left side)
	const handleMonacoChange = (value: string) => {
		// Prevent re-entrant updates
		if (isProcessingChange) return;
		if (lastChangeSource === 'tiptap') {
			lastChangeSource = null;
			return;
		}

		isProcessingChange = true;
		lastChangeSource = 'monaco';
		input = value;

		// Reset after a short delay
		requestAnimationFrame(() => {
			isProcessingChange = false;
			lastChangeSource = null;
		});
	};

	const handleMonacoFocus = () => {
		activeEditor = 'monaco';
	};

	const handleMonacoBlur = () => {
		// Keep activeEditor until another editor is focused
	};

	// Handlers for Tiptap Editor (right side)
	const handleTiptapChange = (markdown: string) => {
		// Prevent re-entrant updates
		if (isProcessingChange) return;
		if (lastChangeSource === 'monaco') {
			lastChangeSource = null;
			return;
		}

		isProcessingChange = true;
		lastChangeSource = 'tiptap';
		input = markdown;

		// Reset after a short delay
		requestAnimationFrame(() => {
			isProcessingChange = false;
			lastChangeSource = null;
		});
	};

	const handleTiptapFocus = () => {
		activeEditor = 'tiptap';
	};

	const handleTiptapBlur = () => {
		// Keep activeEditor until another editor is focused
	};

	// Cursor synchronization handlers
	const handleMonacoCursorChange = (line: number) => {
		// Skip if line hasn't changed (e.g., during selection)
		if (line === lastMonacoCursorLine) return;
		lastMonacoCursorLine = line;

		// Skip if this cursor change was triggered by Tiptap sync
		if (cursorSyncSource === 'tiptap') {
			cursorSyncSource = null;
			return;
		}

		// Only sync when Monaco is the active editor
		if (activeEditor !== 'monaco') return;

		cursorSyncSource = 'monaco';
		tiptapRef?.setCursorLine(line);

		// Reset after a short delay
		requestAnimationFrame(() => {
			cursorSyncSource = null;
		});
	};

	const handleTiptapCursorChange = (line: number) => {
		// Skip if line hasn't changed (e.g., during selection)
		if (line === lastTiptapCursorLine) return;
		lastTiptapCursorLine = line;

		// Skip if this cursor change was triggered by Monaco sync
		if (cursorSyncSource === 'monaco') {
			cursorSyncSource = null;
			return;
		}

		// Only sync when Tiptap is the active editor
		if (activeEditor !== 'tiptap') return;

		cursorSyncSource = 'tiptap';
		monacoRef?.gotoLine(line);

		// Reset after a short delay
		requestAnimationFrame(() => {
			cursorSyncSource = null;
		});
	};

	const handlePaste = async () => {
		try {
			const text = await readText();
			if (text) input = text;
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => {
		input = '';
	};

	const handleSample = () => {
		input = SAMPLE_MARKDOWN;
	};

	const handleCopyMarkdown = async () => {
		try {
			await writeText(input);
			toast.success('Markdown copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const handleCopyHtml = async () => {
		try {
			await writeText(htmlOutput);
			toast.success('HTML copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const handleExportHtml = () => {
		const fullHtml = exportAsHtml(input, 'Markdown Export');
		const blob = new Blob([fullHtml], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'markdown-export.html';
		a.click();
		URL.revokeObjectURL(url);
		toast.success('HTML file downloaded');
	};

	const handleInsertToc = () => {
		if (toc.length === 0) {
			toast.error('No headings found for TOC');
			return;
		}
		const tocMarkdown = `## Table of Contents

${tocToMarkdown(toc)}

`;
		input = tocMarkdown + input;
		toast.success('Table of Contents inserted');
	};

	const handleRightPanelModeChange = (newMode: string) => {
		rightPanelMode = newMode as RightPanelMode;
	};

	// Handle TOC item click - scroll to line in Monaco
	const handleTocClick = (line: number) => {
		monacoRef?.gotoLine(line, true);
	};
</script>

{#snippet tocItem(item: TocItem)}
	<li>
		<button
			type="button"
			class="text-left text-xs hover:underline hover:text-primary"
			onclick={() => handleTocClick(item.line)}
		>
			{item.text}
		</button>
		{#if item.children.length > 0}
			<ul class="ml-3 mt-0.5 space-y-0.5">
				{#each item.children as child}
					{@render tocItem(child)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}

<svelte:head>
	<title>Markdown Editor - Kogu</title>
</svelte:head>

<PageLayout {valid} bind:showOptions>
	{#snippet statusContent()}
		{#if input.trim()}
			<span class="text-muted-foreground">
				<strong class="text-foreground">{stats.words}</strong> words
			</span>
			<span class="text-muted-foreground">
				<strong class="text-foreground">{stats.chars}</strong> chars
			</span>
			<span class="text-muted-foreground">
				<strong class="text-foreground">{stats.lines}</strong> lines
			</span>
			<span class="text-muted-foreground">
				<strong class="text-foreground">{stats.headers}</strong> headers
			</span>
		{/if}
	{/snippet}

	{#snippet options()}
		<FormSection title="Right Panel">
			<FormMode
				value={rightPanelMode}
				onchange={handleRightPanelModeChange}
				options={[
					{ value: 'wysiwyg', label: 'WYSIWYG' },
					{ value: 'preview', label: 'Preview' },
				]}
			/>
		</FormSection>

		<FormSection title="Export">
			<div class="space-y-2">
				<Button
					variant="outline"
					size="sm"
					class="w-full justify-start"
					onclick={handleCopyMarkdown}
				>
					<FilePenLine class="mr-2 h-3 w-3" />
					Copy Markdown
				</Button>
				<Button variant="outline" size="sm" class="w-full justify-start" onclick={handleCopyHtml}>
					<Code class="mr-2 h-3 w-3" />
					Copy HTML
				</Button>
				<Button variant="outline" size="sm" class="w-full justify-start" onclick={handleExportHtml}>
					<Download class="mr-2 h-3 w-3" />
					Export HTML File
				</Button>
			</div>
		</FormSection>

		<FormSection title="Insert">
			<Button
				variant="outline"
				size="sm"
				class="w-full justify-start"
				onclick={handleInsertToc}
				disabled={toc.length === 0}
			>
				<TableOfContents class="mr-2 h-3 w-3" />
				Insert TOC
			</Button>
		</FormSection>

		{#if toc.length > 0}
			<FormSection title="Table of Contents">
				<nav class="max-h-48 overflow-auto">
					<ul class="space-y-0.5">
						{#each toc as item}
							{@render tocItem(item)}
						{/each}
					</ul>
				</nav>
			</FormSection>
		{/if}

		<FormSection title="About">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li>Monaco editor with syntax highlighting</li>
					<li>Tiptap WYSIWYG editor</li>
					<li>Real-time bidirectional sync</li>
					<li>Formatting toolbar & context menu</li>
					<li>Table of Contents generation</li>
					<li>Export to HTML</li>
				</ul>
			</FormInfo>
		</FormSection>
	{/snippet}

	<div class="flex h-full flex-col overflow-hidden">
		<!-- Toolbar -->
		<div class="flex h-9 shrink-0 items-center gap-0.5 border-b bg-muted/30 px-2">
			<!-- Text Formatting -->
			{#each textFormatButtons as btn}
				<Button
					variant="ghost"
					size="sm"
					class="h-7 w-7 p-0"
					title={btn.label}
					onclick={() => handleFormat(btn.action)}
				>
					<btn.icon class="h-3.5 w-3.5" />
				</Button>
			{/each}

			<div class="mx-1 h-4 w-px bg-border"></div>

			<!-- Heading Dropdown -->
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					<Button variant="ghost" size="sm" class="h-7 gap-1 px-2" title="Headings">
						<Heading2 class="h-3.5 w-3.5" />
						<ChevronDown class="h-3 w-3" />
					</Button>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start">
					{#each headingOptions as heading}
						<DropdownMenu.Item onclick={() => handleFormat(heading.action)}>
							<heading.icon class="mr-2 h-4 w-4" />
							{heading.label}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			<div class="mx-1 h-4 w-px bg-border"></div>

			<!-- Lists -->
			{#each listButtons as btn}
				<Button
					variant="ghost"
					size="sm"
					class="h-7 w-7 p-0"
					title={btn.label}
					onclick={() => handleFormat(btn.action)}
				>
					<btn.icon class="h-3.5 w-3.5" />
				</Button>
			{/each}

			<div class="mx-1 h-4 w-px bg-border"></div>

			<!-- Insert Elements -->
			{#each insertButtons as btn}
				<Button
					variant="ghost"
					size="sm"
					class="h-7 w-7 p-0"
					title={btn.label}
					onclick={() => handleFormat(btn.action)}
				>
					<btn.icon class="h-3.5 w-3.5" />
				</Button>
			{/each}

			<div class="mx-1 h-4 w-px bg-border"></div>

			<!-- Clear Formatting -->
			<Button
				variant="ghost"
				size="sm"
				class="h-7 w-7 p-0"
				title="Clear Formatting"
				onclick={() => handleFormat('clearFormat')}
			>
				<Eraser class="h-3.5 w-3.5" />
			</Button>
		</div>

		<!-- Content Area -->
		<SplitPane class="h-full flex-1">
			{#snippet left()}
				<CodeEditor
					bind:this={monacoRef}
					title="Markdown"
					bind:value={input}
					mode="input"
					editorMode="markdown"
					onchange={handleMonacoChange}
					oncursorchange={handleMonacoCursorChange}
					onfocus={handleMonacoFocus}
					onblur={handleMonacoBlur}
					onpaste={handlePaste}
					onclear={handleClear}
					onsample={handleSample}
				>
					{#snippet actions()}
						{#if activeEditor === 'monaco'}
							<span class="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
								Active
							</span>
						{/if}
					{/snippet}
				</CodeEditor>
			{/snippet}
			{#snippet right()}
				{#if rightPanelMode === 'wysiwyg'}
					<ContextMenu.Root>
						<ContextMenu.Trigger class="relative h-full">
							{#if activeEditor === 'tiptap'}
								<span
									class="absolute right-3 top-2 z-10 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary"
								>
									Active
								</span>
							{/if}
							<TiptapEditor
								bind:this={tiptapRef}
								content={input}
								placeholder="Start writing..."
								onchange={handleTiptapChange}
								oncursorchange={handleTiptapCursorChange}
								onfocus={handleTiptapFocus}
								onblur={handleTiptapBlur}
							/>
						</ContextMenu.Trigger>
						<ContextMenu.Content class="w-56">
							<MarkdownContextMenuItems onformat={handleFormat} />
						</ContextMenu.Content>
					</ContextMenu.Root>
				{:else}
					<div class="flex h-full flex-col">
						<div class="flex h-9 shrink-0 items-center border-b bg-muted/30 px-3">
							<Eye class="mr-2 h-3.5 w-3.5 text-muted-foreground" />
							<span class="text-xs font-medium text-muted-foreground">Preview</span>
						</div>
						<div class="markdown-preview flex-1 overflow-auto p-4">
							{#if input.trim()}
								{@html htmlOutput}
							{:else}
								<div class="flex h-full items-center justify-center text-muted-foreground">
									<div class="text-center">
										<Eye class="mx-auto mb-2 h-12 w-12 opacity-50" />
										<p class="text-sm">Preview will appear here</p>
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			{/snippet}
		</SplitPane>
	</div>
</PageLayout>

<style>
	.markdown-preview :global(h1) {
		font-size: 1.75rem;
		font-weight: 700;
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		border-bottom: 1px solid hsl(var(--border));
		padding-bottom: 0.5rem;
	}

	.markdown-preview :global(h2) {
		font-size: 1.5rem;
		font-weight: 600;
		margin-top: 1.25rem;
		margin-bottom: 0.5rem;
	}

	.markdown-preview :global(h3) {
		font-size: 1.25rem;
		font-weight: 600;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
	}

	.markdown-preview :global(h4),
	.markdown-preview :global(h5),
	.markdown-preview :global(h6) {
		font-size: 1rem;
		font-weight: 600;
		margin-top: 0.75rem;
		margin-bottom: 0.25rem;
	}

	.markdown-preview :global(p) {
		margin-bottom: 0.75rem;
		line-height: 1.6;
	}

	.markdown-preview :global(ul),
	.markdown-preview :global(ol) {
		margin-left: 1.5rem;
		margin-bottom: 0.75rem;
	}

	.markdown-preview :global(li) {
		margin-bottom: 0.25rem;
	}

	.markdown-preview :global(pre) {
		background: hsl(var(--muted));
		padding: 1rem;
		border-radius: 0.375rem;
		overflow-x: auto;
		margin-bottom: 0.75rem;
	}

	.markdown-preview :global(code) {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
	}

	.markdown-preview :global(:not(pre) > code) {
		background: hsl(var(--muted));
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	.markdown-preview :global(blockquote) {
		border-left: 4px solid hsl(var(--border));
		padding-left: 1rem;
		margin: 0.75rem 0;
		color: hsl(var(--muted-foreground));
	}

	.markdown-preview :global(hr) {
		border: none;
		border-top: 1px solid hsl(var(--border));
		margin: 1.5rem 0;
	}

	.markdown-preview :global(a) {
		color: hsl(var(--primary));
		text-decoration: underline;
	}

	.markdown-preview :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.375rem;
	}

	.markdown-preview :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 0.75rem;
	}

	.markdown-preview :global(th),
	.markdown-preview :global(td) {
		border: 1px solid hsl(var(--border));
		padding: 0.5rem;
		text-align: left;
	}

	.markdown-preview :global(th) {
		background: hsl(var(--muted));
		font-weight: 600;
	}

	.markdown-preview :global(.task-list) {
		list-style: none;
		margin-left: 0;
	}

	.markdown-preview :global(.task-item) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.markdown-preview :global(.task-item.checked) {
		text-decoration: line-through;
		color: hsl(var(--muted-foreground));
	}
</style>
