<script lang="ts">
	import {
		ChevronRight,
		Braces,
		Brackets,
		Hash,
		ToggleLeft,
		Type,
		CircleSlash,
		Copy,
		Check,
		Code,
		Tag,
		FileCode,
		Database,
		Terminal,
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { AstNode, AstNodeType } from '$lib/services/ast/index.js';
	import AstTreeView from './ast-tree-view.svelte';

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
			default:
				return Code;
		}
	});

	// Get CSS classes for AST node type
	const getTypeStyles = (t: AstNodeType) => {
		switch (t) {
			// Value types
			case 'string':
			case 'text':
				return {
					text: 'text-emerald-600 dark:text-emerald-400',
					bg: 'bg-emerald-500/10',
					icon: 'text-emerald-500',
				};
			case 'number':
			case 'literal':
				return {
					text: 'text-blue-600 dark:text-blue-400',
					bg: 'bg-blue-500/10',
					icon: 'text-blue-500',
				};
			case 'boolean':
				return {
					text: 'text-violet-600 dark:text-violet-400',
					bg: 'bg-violet-500/10',
					icon: 'text-violet-500',
				};
			case 'null':
				return {
					text: 'text-gray-500 dark:text-gray-400',
					bg: 'bg-gray-500/10',
					icon: 'text-gray-400',
				};
			// Container types
			case 'object':
			case 'element':
				return {
					text: 'text-amber-600 dark:text-amber-400',
					bg: 'bg-amber-500/10',
					icon: 'text-amber-500',
				};
			case 'array':
				return {
					text: 'text-cyan-600 dark:text-cyan-400',
					bg: 'bg-cyan-500/10',
					icon: 'text-cyan-500',
				};
			case 'root':
				return {
					text: 'text-purple-600 dark:text-purple-400',
					bg: 'bg-purple-500/10',
					icon: 'text-purple-500',
				};
			// SQL types
			case 'statement':
				return {
					text: 'text-rose-600 dark:text-rose-400',
					bg: 'bg-rose-500/10',
					icon: 'text-rose-500',
				};
			case 'clause':
			case 'keyword':
				return {
					text: 'text-indigo-600 dark:text-indigo-400',
					bg: 'bg-indigo-500/10',
					icon: 'text-indigo-500',
				};
			case 'expression':
			case 'operator':
				return {
					text: 'text-orange-600 dark:text-orange-400',
					bg: 'bg-orange-500/10',
					icon: 'text-orange-500',
				};
			case 'identifier':
			case 'function':
				return {
					text: 'text-teal-600 dark:text-teal-400',
					bg: 'bg-teal-500/10',
					icon: 'text-teal-500',
				};
			// Property and attribute
			case 'property':
			case 'attribute':
				return {
					text: 'text-sky-600 dark:text-sky-400',
					bg: 'bg-sky-500/10',
					icon: 'text-sky-500',
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
				expandedStates[key] = initialExpandedStates[key];
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
			setTimeout(() => (justCopied = null), 1500);
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
				class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide {styles.bg} {styles.text}"
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
					<span class="text-[9px] font-mono">$</span>
				</button>
				<button
					type="button"
					class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={handleCopyValue}
					title="Copy value"
				>
					{#if justCopied === node.path}
						<Check class="h-3 w-3 text-green-500" />
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
					<AstTreeView
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
					class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide {styles.bg} {styles.text}"
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
					<span class="text-[9px] font-mono">$</span>
				</button>
				<button
					type="button"
					class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={handleCopyValue}
					title="Copy value"
				>
					{#if justCopied === node.path}
						<Check class="h-3 w-3 text-green-500" />
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
