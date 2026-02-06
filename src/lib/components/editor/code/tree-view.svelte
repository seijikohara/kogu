<script lang="ts">
	import {
		Braces,
		Brackets,
		Check,
		ChevronRight,
		CircleSlash,
		Code,
		Copy,
		Database,
		FileCode,
		FileText,
		Hash,
		Heading,
		List,
		ListChecks,
		Minus,
		Pilcrow,
		Quote,
		Table,
		Tag,
		Terminal,
		ToggleLeft,
		Type,
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { AstNode, AstNodeType } from '$lib/services/ast/index.js';
	import TreeView from './tree-view.svelte';

	interface Props {
		node: AstNode;
		expanded?: boolean;
		level?: number;
		maxInitialDepth?: number;
		selectedPath?: string | null;
		onselect?: (path: string, node: AstNode) => void;
	}

	let {
		node,
		expanded = $bindable(true),
		level = 0,
		maxInitialDepth = 3,
		selectedPath = null,
		onselect,
	}: Props = $props();

	// Track if copy was just performed
	let justCopied = $state<string | null>(null);

	// Check if node has children
	const hasChildren = $derived(node.children && node.children.length > 0);

	// Get icon component for AST node type
	const TypeIcon = $derived.by(() => {
		switch (node.type) {
			// Common types
			case 'root':
				return FileCode;
			case 'object':
				return Braces;
			case 'array':
				return Brackets;
			case 'property':
				return Code;
			case 'string':
				return Type;
			case 'number':
				return Hash;
			case 'boolean':
				return ToggleLeft;
			case 'null':
				return CircleSlash;
			// XML specific
			case 'element':
				return Tag;
			case 'attribute':
				return Code;
			case 'text':
				return Type;
			case 'comment':
				return Code;
			// SQL specific
			case 'statement':
				return Database;
			case 'clause':
				return Terminal;
			case 'expression':
				return Code;
			case 'identifier':
				return Type;
			case 'literal':
				return Hash;
			case 'operator':
				return Code;
			case 'keyword':
				return Terminal;
			case 'function':
				return Code;
			// Markdown specific
			case 'document':
				return FileText;
			case 'heading':
				return Heading;
			case 'paragraph':
				return Pilcrow;
			case 'code_block':
				return Code;
			case 'blockquote':
				return Quote;
			case 'list':
				return List;
			case 'list_item':
				return Minus;
			case 'task_item':
				return ListChecks;
			case 'table':
				return Table;
			case 'table_row':
				return Minus;
			case 'horizontal_rule':
				return Minus;
			default:
				return Code;
		}
	});

	// Get CSS classes for AST node type (using semantic syntax-* tokens)
	const getTypeStyles = (t: AstNodeType) => {
		switch (t) {
			// Value types
			case 'string':
			case 'paragraph':
			case 'text':
				return {
					text: 'text-syntax-string',
					bg: 'bg-syntax-string/10',
					icon: 'text-syntax-string',
				};
			case 'number':
			case 'literal':
				return {
					text: 'text-syntax-number',
					bg: 'bg-syntax-number/10',
					icon: 'text-syntax-number',
				};
			case 'boolean':
			case 'table':
			case 'table_row':
				return {
					text: 'text-syntax-boolean',
					bg: 'bg-syntax-boolean/10',
					icon: 'text-syntax-boolean',
				};
			case 'null':
			case 'horizontal_rule':
				return {
					text: 'text-syntax-null',
					bg: 'bg-syntax-null/10',
					icon: 'text-syntax-null',
				};
			// Container types
			case 'object':
			case 'element':
			case 'code_block':
				return {
					text: 'text-syntax-object',
					bg: 'bg-syntax-object/10',
					icon: 'text-syntax-object',
				};
			case 'array':
			case 'list':
			case 'list_item':
				return {
					text: 'text-syntax-array',
					bg: 'bg-syntax-array/10',
					icon: 'text-syntax-array',
				};
			case 'root':
			case 'document':
				return {
					text: 'text-syntax-root',
					bg: 'bg-syntax-root/10',
					icon: 'text-syntax-root',
				};
			// SQL types
			case 'statement':
			case 'heading':
				return {
					text: 'text-syntax-statement',
					bg: 'bg-syntax-statement/10',
					icon: 'text-syntax-statement',
				};
			case 'clause':
			case 'keyword':
			case 'blockquote':
				return {
					text: 'text-syntax-clause',
					bg: 'bg-syntax-clause/10',
					icon: 'text-syntax-clause',
				};
			case 'expression':
			case 'operator':
				return {
					text: 'text-syntax-expression',
					bg: 'bg-syntax-expression/10',
					icon: 'text-syntax-expression',
				};
			case 'identifier':
			case 'function':
			case 'task_item':
				return {
					text: 'text-syntax-identifier',
					bg: 'bg-syntax-identifier/10',
					icon: 'text-syntax-identifier',
				};
			// Property and attribute
			case 'property':
			case 'attribute':
				return {
					text: 'text-syntax-property',
					bg: 'bg-syntax-property/10',
					icon: 'text-syntax-property',
				};
			default:
				return {
					text: 'text-foreground',
					bg: 'bg-muted',
					icon: 'text-muted-foreground',
				};
		}
	};

	const styles = $derived(getTypeStyles(node.type));

	// Format value for display
	const formatValue = (value: unknown): string | null => {
		if (value === undefined) return null;
		if (value === null) return 'null';
		if (typeof value === 'string') {
			const maxLen = 100;
			if (value.length > maxLen) {
				return `"${value.slice(0, maxLen)}…"`;
			}
			return `"${value}"`;
		}
		return String(value);
	};

	const displayValue = $derived(formatValue(node.value));

	// Get badge text for expandable nodes
	const getBadgeText = (): string => {
		const childCount = node.children?.length ?? 0;
		switch (node.type) {
			case 'array':
				return `array[${childCount}]`;
			case 'object':
				return `object{${childCount}}`;
			case 'element':
				return `<${node.label}>`;
			case 'statement':
				return node.label;
			case 'clause':
				return node.label.toUpperCase();
			case 'root':
				return `root(${childCount})`;
			// Markdown types
			case 'document':
				return `doc(${childCount})`;
			case 'heading':
				return node.label;
			case 'list':
				return `list[${childCount}]`;
			case 'table':
				return `table(${childCount})`;
			case 'blockquote':
				return `quote(${childCount})`;
			default:
				return hasChildren ? `${node.type}(${childCount})` : node.type;
		}
	};

	// Compute initial expanded states based on children
	const initialExpandedStates = $derived(
		Object.fromEntries(
			(node.children ?? []).map((child, i) => [String(i), level + 1 < maxInitialDepth])
		)
	);

	// Track expanded states
	let expandedStates = $state<Record<string, boolean>>({});

	// Sync expanded states when children change
	$effect(() => {
		Object.keys(initialExpandedStates)
			.filter((key) => !(key in expandedStates))
			.forEach((key) => {
				expandedStates[key] = initialExpandedStates[key] ?? false;
			});
	});

	const getExpanded = (index: number): boolean => {
		return expandedStates[String(index)] ?? level + 1 < maxInitialDepth;
	};

	const handleClick = () => {
		onselect?.(node.path, node);
	};

	const handleCopyValue = async (e: Event) => {
		e.stopPropagation();
		try {
			const text =
				node.value !== undefined
					? typeof node.value === 'string'
						? node.value
						: JSON.stringify(node.value, null, 2)
					: node.label;
			await navigator.clipboard.writeText(text);
			justCopied = node.path;
			setTimeout(() => {
				justCopied = null;
			}, 1500);
		} catch {
			toast.error('Copy failed');
		}
	};

	const handleCopyPath = async (e: Event) => {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(node.path);
			toast.success(`Copied: ${node.path}`);
		} catch {
			toast.error('Copy failed');
		}
	};

	const isSelected = $derived(selectedPath === node.path);
</script>

<div
	class="group/tree select-none"
	style:padding-left="{level > 0 ? 16 : 0}px"
	role="treeitem"
	aria-selected={isSelected}
	aria-expanded={hasChildren ? expanded : undefined}
>
	{#if hasChildren}
		<!-- Expandable node -->
		<div
			class="flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60 {isSelected
				? 'bg-primary/10 ring-1 ring-primary/30'
				: ''}"
			onclick={handleClick}
			onkeydown={(e) => e.key === 'Enter' && handleClick()}
			role="button"
			tabindex="0"
		>
			<!-- Expand/collapse button -->
			<button
				type="button"
				class="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all hover:bg-muted-foreground/20"
				onclick={(e) => {
					e.stopPropagation();
					expanded = !expanded;
				}}
			>
				<ChevronRight
					class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 {expanded
						? 'rotate-90'
						: ''}"
				/>
			</button>

			<!-- Type icon -->
			<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded {styles.bg}">
				<TypeIcon class="h-3 w-3 {styles.icon}" />
			</span>

			<!-- Label -->
			{#if node.label && node.type !== 'root'}
				<span class="font-medium text-foreground">{node.label}</span>
				<span class="text-muted-foreground">:</span>
			{/if}

			<!-- Type badge -->
			<span
				class="rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide {styles.bg} {styles.text}"
			>
				{getBadgeText()}
			</span>

			<!-- Copy buttons (show on hover) -->
			<div
				class="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/tree:opacity-100"
			>
				<button
					type="button"
					class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={handleCopyPath}
					title="Copy path"
				>
					<span class="text-xs font-mono">$</span>
				</button>
				<button
					type="button"
					class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={handleCopyValue}
					title="Copy value"
				>
					{#if justCopied === node.path}
						<Check class="h-3 w-3 text-success" />
					{:else}
						<Copy class="h-3 w-3" />
					{/if}
				</button>
			</div>
		</div>

		<!-- Children -->
		{#if expanded}
			<div class="relative ml-2.5 border-l border-border/50 pl-0.5">
				{#each node.children ?? [] as child, index (child.path)}
					<TreeView
						node={child}
						level={level + 1}
						{maxInitialDepth}
						{selectedPath}
						{onselect}
						expanded={getExpanded(index)}
					/>
				{/each}
			</div>
		{/if}
	{:else}
		<!-- Leaf node -->
		<div
			class="group/leaf flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60 {isSelected
				? 'bg-primary/10 ring-1 ring-primary/30'
				: ''}"
			onclick={handleClick}
			onkeydown={(e) => e.key === 'Enter' && handleClick()}
			role="button"
			tabindex="0"
		>
			<span class="h-5 w-5 shrink-0"></span>
			<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded {styles.bg}">
				<TypeIcon class="h-3 w-3 {styles.icon}" />
			</span>

			<!-- Label -->
			{#if node.label}
				<span class="font-medium text-foreground">{node.label}</span>
				{#if displayValue}
					<span class="text-muted-foreground">:</span>
				{/if}
			{/if}

			<!-- Value -->
			{#if displayValue}
				<span class="truncate {styles.text}" title={displayValue}>
					{displayValue}
				</span>
			{:else}
				<span
					class="rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide {styles.bg} {styles.text}"
				>
					{node.type}
				</span>
			{/if}

			<!-- Copy buttons -->
			<div
				class="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/leaf:opacity-100"
			>
				<button
					type="button"
					class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={handleCopyPath}
					title="Copy path"
				>
					<span class="text-xs font-mono">$</span>
				</button>
				<button
					type="button"
					class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={handleCopyValue}
					title="Copy value"
				>
					{#if justCopied === node.path}
						<Check class="h-3 w-3 text-success" />
					{:else}
						<Copy class="h-3 w-3" />
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Smooth animations */
	:global(.group\/tree) {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
		font-size: 13px;
		line-height: 1.5;
	}
</style>
