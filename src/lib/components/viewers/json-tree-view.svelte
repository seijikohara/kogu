<script lang="ts">
	import { ChevronRight, Braces, Brackets, Hash, ToggleLeft, Type, CircleSlash, Copy, Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import JsonTreeView from './json-tree-view.svelte';

	interface Props {
		data: unknown;
		expanded?: boolean;
		level?: number;
		keyName?: string;
		path?: string;
		maxInitialDepth?: number;
		selectedPath?: string | null;
		onselect?: (path: string, value: unknown) => void;
	}

	let {
		data,
		expanded = $bindable(true),
		level = 0,
		keyName,
		path = '$',
		maxInitialDepth = 3,
		selectedPath = null,
		onselect,
	}: Props = $props();

	// Track if copy was just performed
	let justCopied = $state<string | null>(null);

	// Determine the type of the data
	const getType = (value: unknown): string => {
		if (value === null) return 'null';
		if (Array.isArray(value)) return 'array';
		return typeof value;
	};

	const type = $derived(getType(data));
	const isExpandable = $derived(type === 'object' || type === 'array');

	// Get array/object entries
	const entries = $derived.by(() => {
		if (type === 'array') {
			return (data as unknown[]).map((value, index) => ({
				key: String(index),
				value,
				path: `${path}[${index}]`,
			}));
		}
		if (type === 'object' && data !== null) {
			return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({
				key,
				value,
				path: `${path}.${key}`,
			}));
		}
		return [];
	});

	// Format primitive values
	const formatValue = (value: unknown): string => {
		if (value === null) return 'null';
		if (typeof value === 'string') {
			// Truncate long strings
			const maxLen = 100;
			if (value.length > maxLen) {
				return `"${value.slice(0, maxLen)}…"`;
			}
			return `"${value}"`;
		}
		if (typeof value === 'undefined') return 'undefined';
		return String(value);
	};

	// Get icon component for type
	const TypeIcon = $derived.by(() => {
		switch (type) {
			case 'object': return Braces;
			case 'array': return Brackets;
			case 'number': return Hash;
			case 'boolean': return ToggleLeft;
			case 'string': return Type;
			case 'null': return CircleSlash;
			default: return Type;
		}
	});

	// Get CSS classes for value type
	const getTypeStyles = (t: string) => {
		switch (t) {
			case 'string':
				return {
					text: 'text-emerald-600 dark:text-emerald-400',
					bg: 'bg-emerald-500/10',
					icon: 'text-emerald-500',
				};
			case 'number':
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
			case 'object':
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
			default:
				return {
					text: 'text-foreground',
					bg: 'bg-muted',
					icon: 'text-muted-foreground',
				};
		}
	};

	const styles = $derived(getTypeStyles(type));

	// Compute initial expanded states based on entries
	const initialExpandedStates = $derived(
		Object.fromEntries(
			entries.map((entry) => [entry.key, level + 1 < maxInitialDepth])
		)
	);

	// Track expanded states
	let expandedStates = $state<Record<string, boolean>>({});

	// Sync expanded states when entries change
	$effect(() => {
		for (const key of Object.keys(initialExpandedStates)) {
			if (!(key in expandedStates)) {
				expandedStates[key] = initialExpandedStates[key];
			}
		}
	});

	const getExpanded = (key: string): boolean => {
		return expandedStates[key] ?? level + 1 < maxInitialDepth;
	};

	const handleClick = () => {
		onselect?.(path, data);
	};

	const handleCopyValue = async (e: Event) => {
		e.stopPropagation();
		try {
			const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
			await navigator.clipboard.writeText(text);
			justCopied = path;
			setTimeout(() => (justCopied = null), 1500);
		} catch {
			toast.error('Copy failed');
		}
	};

	const handleCopyPath = async (e: Event) => {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(path);
			toast.success(`Copied: ${path}`);
		} catch {
			toast.error('Copy failed');
		}
	};

	const isSelected = $derived(selectedPath === path);
</script>

<div
	class="group/tree select-none"
	style:padding-left="{level > 0 ? 16 : 0}px"
	role="treeitem"
	aria-selected={isSelected}
	aria-expanded={isExpandable ? expanded : undefined}
>
	{#if isExpandable}
		<!-- Expandable node (object/array) -->
		<div
			class="flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60 {isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : ''}"
			onclick={handleClick}
			onkeydown={(e) => e.key === 'Enter' && handleClick()}
			role="button"
			tabindex="0"
		>
			<!-- Expand/collapse button -->
			<button
				type="button"
				class="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all hover:bg-muted-foreground/20"
				onclick={(e) => { e.stopPropagation(); expanded = !expanded; }}
			>
				<ChevronRight
					class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 {expanded ? 'rotate-90' : ''}"
				/>
			</button>

			<!-- Type icon -->
			<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded {styles.bg}">
				<TypeIcon class="h-3 w-3 {styles.icon}" />
			</span>

			<!-- Key name -->
			{#if keyName !== undefined}
				<span class="font-medium text-foreground">{keyName}</span>
				<span class="text-muted-foreground">:</span>
			{/if}

			<!-- Type badge -->
			<span class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide {styles.bg} {styles.text}">
				{type === 'array' ? `array[${entries.length}]` : `object{${entries.length}}`}
			</span>

			<!-- Copy buttons (show on hover) -->
			<div class="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/tree:opacity-100">
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
					{#if justCopied === path}
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
				{#each entries as entry (entry.key)}
					{@const entryType = getType(entry.value)}
					{@const entryExpandable = entryType === 'object' || entryType === 'array'}
					{#if entryExpandable}
						<JsonTreeView
							data={entry.value}
							keyName={entry.key}
							path={entry.path}
							level={level + 1}
							{maxInitialDepth}
							{selectedPath}
							{onselect}
							expanded={getExpanded(entry.key)}
						/>
					{:else}
						{@const entryStyles = getTypeStyles(entryType)}
						{@const EntryIcon = entryType === 'string' ? Type : entryType === 'number' ? Hash : entryType === 'boolean' ? ToggleLeft : CircleSlash}
						<div
							class="group/leaf flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60 {selectedPath === entry.path ? 'bg-primary/10 ring-1 ring-primary/30' : ''}"
							style:padding-left="16px"
							onclick={() => onselect?.(entry.path, entry.value)}
							onkeydown={(e) => e.key === 'Enter' && onselect?.(entry.path, entry.value)}
							role="button"
							tabindex="0"
						>
							<!-- Spacer for alignment -->
							<span class="h-5 w-5 shrink-0"></span>

							<!-- Type icon -->
							<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded {entryStyles.bg}">
								<EntryIcon class="h-3 w-3 {entryStyles.icon}" />
							</span>

							<!-- Key -->
							<span class="font-medium text-foreground">{entry.key}</span>
							<span class="text-muted-foreground">:</span>

							<!-- Value -->
							<span class="truncate {entryStyles.text}" title={formatValue(entry.value)}>
								{formatValue(entry.value)}
							</span>

							<!-- Copy buttons -->
							<div class="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/leaf:opacity-100">
								<button
									type="button"
									class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
									onclick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(entry.path); toast.success(`Copied: ${entry.path}`); }}
									title="Copy path"
								>
									<span class="text-[9px] font-mono">$</span>
								</button>
								<button
									type="button"
									class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
									onclick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)); toast.success('Copied'); }}
									title="Copy value"
								>
									<Copy class="h-3 w-3" />
								</button>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	{:else}
		<!-- Leaf node (primitive value at root) -->
		<div
			class="group/leaf flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60 {isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : ''}"
			onclick={handleClick}
			onkeydown={(e) => e.key === 'Enter' && handleClick()}
			role="button"
			tabindex="0"
		>
			<span class="h-5 w-5 shrink-0"></span>
			<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded {styles.bg}">
				<TypeIcon class="h-3 w-3 {styles.icon}" />
			</span>
			{#if keyName !== undefined}
				<span class="font-medium text-foreground">{keyName}</span>
				<span class="text-muted-foreground">:</span>
			{/if}
			<span class="truncate {styles.text}">{formatValue(data)}</span>
			<div class="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/leaf:opacity-100">
				<button
					type="button"
					class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={handleCopyValue}
					title="Copy value"
				>
					{#if justCopied === path}
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
