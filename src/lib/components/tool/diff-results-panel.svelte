<script lang="ts">
	import { Plus, Minus, RefreshCw } from '@lucide/svelte';
	import {
		type DiffType,
		type DiffSummary,
		getDiffTypeClass,
		calculateDiffSummary,
	} from '$lib/constants/diff.js';

	interface DiffItem {
		path: string;
		type: DiffType;
		oldValue?: string;
		newValue?: string;
	}

	interface Props {
		/** Array of diff items to display */
		readonly diffs: readonly DiffItem[];
		/** Currently selected diff item */
		readonly selectedDiff?: DiffItem | null;
		/** Callback when a diff item is clicked */
		readonly onDiffClick?: (diff: DiffItem) => void;
		/** Check for identical state - text to check if inputs are not empty */
		readonly checkIdentical?: boolean;
		/** Whether to show the panel (has content) */
		readonly hasContent?: boolean;
	}

	let {
		diffs,
		selectedDiff = null,
		onDiffClick,
		checkIdentical = false,
		hasContent = true,
	}: Props = $props();

	const summary = $derived<DiffSummary>(calculateDiffSummary(diffs));

	const handleClick = (diff: DiffItem) => {
		onDiffClick?.(diff);
	};
</script>

{#if diffs.length > 0}
	<!-- Diff Summary -->
	<div class="flex items-center gap-4 border-t bg-muted/30 px-3 py-1.5 text-xs">
		<span class="font-medium">{summary.total} difference{summary.total !== 1 ? 's' : ''}</span>
		{#if summary.added > 0}
			<span class="flex items-center gap-1 text-green-600 dark:text-green-400">
				<Plus class="h-3 w-3" />
				{summary.added}
			</span>
		{/if}
		{#if summary.removed > 0}
			<span class="flex items-center gap-1 text-red-600 dark:text-red-400">
				<Minus class="h-3 w-3" />
				{summary.removed}
			</span>
		{/if}
		{#if summary.changed > 0}
			<span class="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
				<RefreshCw class="h-3 w-3" />
				{summary.changed}
			</span>
		{/if}
	</div>
	<!-- Diff Results -->
	<div class="max-h-64 overflow-auto border-t bg-muted/20 p-2">
		<div class="space-y-1">
			{#each diffs as diff}
				<button
					type="button"
					class={`flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left transition-all hover:ring-2 hover:ring-ring/50 ${getDiffTypeClass(diff.type)} ${selectedDiff?.path === diff.path ? 'ring-2 ring-ring' : ''}`}
					onclick={() => handleClick(diff)}
				>
					{#if diff.type === 'added'}
						<Plus class="h-3.5 w-3.5 shrink-0 text-green-500" />
					{:else if diff.type === 'removed'}
						<Minus class="h-3.5 w-3.5 shrink-0 text-red-500" />
					{:else}
						<RefreshCw class="h-3.5 w-3.5 shrink-0 text-yellow-500" />
					{/if}
					<span class="shrink-0 font-mono text-xs font-medium">{diff.path}</span>
					<span class="truncate text-xs opacity-80">
						{#if diff.type === 'added'}{diff.newValue}
						{:else if diff.type === 'removed'}{diff.oldValue}
						{:else}{diff.oldValue} → {diff.newValue}{/if}
					</span>
				</button>
			{/each}
		</div>
	</div>
{:else if checkIdentical && hasContent}
	<div
		class="flex h-8 items-center justify-center border-t bg-green-500/20 text-xs font-medium text-green-600 dark:text-green-400"
	>
		✓ Identical
	</div>
{/if}
