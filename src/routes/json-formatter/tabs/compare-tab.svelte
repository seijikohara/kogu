<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import OptionsPanel from '$lib/components/options/options-panel.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import SplitPane from '$lib/components/layout/split-pane.svelte';
	import { EditorPane } from '$lib/components/tool/index.js';
	import { ArrowRightLeft, Plus, Minus, RefreshCw } from '@lucide/svelte';
	import {
		findJsonDifferences,
		validateJson,
		type DiffItem,
		type JsonInputFormat,
		type JsonDiffOptions,
	} from '$lib/services/formatters.js';

	interface Props {
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string; format: JsonInputFormat | null }) => void;
	}

	let { onStatsChange }: Props = $props();

	// State
	let compareJson1 = $state('{}');
	let compareJson2 = $state('{}');
	let showOptions = $state(true);

	// Options
	let compareIgnoreWhitespace = $state(false);
	let compareIgnoreArrayOrder = $state(false);
	let compareShowOnlyDiffs = $state(false);
	let compareIgnoreCase = $state(false);
	let compareIgnoreNumericType = $state(false);
	let compareIgnoreEmpty = $state(false);
	let compareDeepCompare = $state(true);
	let compareIgnoreKeys = $state('');

	// Validation
	const json1Validation = $derived.by(() => {
		if (!compareJson1.trim()) return { valid: null as boolean | null, format: null as JsonInputFormat | null };
		const result = validateJson(compareJson1);
		return { valid: result.valid, format: result.detectedFormat };
	});

	const json2Validation = $derived.by(() => {
		if (!compareJson2.trim()) return { valid: null as boolean | null, format: null as JsonInputFormat | null };
		const result = validateJson(compareJson2);
		return { valid: result.valid, format: result.detectedFormat };
	});

	// Combined validity
	const combinedValidity = $derived.by((): boolean | null => {
		if (json1Validation.valid === true && json2Validation.valid === true) return true;
		if (json1Validation.valid === false || json2Validation.valid === false) return false;
		return null;
	});

	// Parse ignored keys from comma-separated string
	const ignoredKeysList = $derived(
		compareIgnoreKeys
			.split(',')
			.map((k) => k.trim())
			.filter(Boolean)
	);

	// Diff options object
	const diffOptions = $derived<JsonDiffOptions>({
		ignoreCase: compareIgnoreCase,
		ignoreWhitespace: compareIgnoreWhitespace,
		ignoreArrayOrder: compareIgnoreArrayOrder,
		ignoreNumericType: compareIgnoreNumericType,
		ignoreEmpty: compareIgnoreEmpty,
		deepCompare: compareDeepCompare,
		ignoreKeys: ignoredKeysList,
	});

	// Compare result
	const compareResultData = $derived.by(() => {
		if (!compareJson1.trim() || !compareJson2.trim()) {
			return { diffs: [] as DiffItem[], error: '' };
		}
		try {
			const diffs = findJsonDifferences(compareJson1, compareJson2, diffOptions);
			return { diffs, error: '' };
		} catch (e) {
			return { diffs: [] as DiffItem[], error: e instanceof Error ? e.message : 'Compare failed' };
		}
	});

	const diffResults = $derived(compareResultData.diffs);
	const compareError = $derived(compareResultData.error);

	// Diff summary counts
	const diffSummary = $derived.by(() => ({
		total: diffResults.length,
		added: diffResults.filter((d) => d.type === 'added').length,
		removed: diffResults.filter((d) => d.type === 'removed').length,
		changed: diffResults.filter((d) => d.type === 'changed').length,
	}));

	// Selected diff for highlighting
	let selectedDiff = $state<DiffItem | null>(null);

	// Find line number for a JSON path in a JSON string
	const findLineForPath = (jsonStr: string, targetPath: string): number | null => {
		if (!jsonStr?.trim() || !targetPath) return null;

		const lines = jsonStr.split('\n');
		const pathParts = targetPath.replace(/^\$\.?/, '').split(/\.|\[/).filter(Boolean);

		if (pathParts.length === 0) return 1;

		const pathStack: string[] = [];
		let currentArrayIndex = -1;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			const lineNum = i + 1;

			// Match object key
			const keyMatch = line.match(/^"([^"]+)"\s*:/);
			if (keyMatch) {
				const key = keyMatch[1];
				const currentPath = [...pathStack, key].join('.');

				// Check if this matches the target path
				const targetPathNormalized = pathParts.map((p) => p.replace(/\]$/, '')).join('.');
				if (currentPath === targetPathNormalized) {
					return lineNum;
				}

				// Track nested objects
				if (line.endsWith('{') || line.endsWith('[')) {
					pathStack.push(key);
					if (line.endsWith('[')) {
						currentArrayIndex = 0;
					}
				}
			}

			// Track array items
			if (line === '{' && currentArrayIndex >= 0) {
				const arrayPath = [...pathStack, `${currentArrayIndex}]`].join('.');
				const targetPathNormalized = pathParts.map((p) => p.replace(/\]$/, '')).join('.');
				if (arrayPath.replace(/\]$/, '') === targetPathNormalized) {
					return lineNum;
				}
				currentArrayIndex++;
			}

			// Track closing brackets
			if (line.startsWith('}') || line === '},') {
				if (pathStack.length > 0 && !line.includes('[')) {
					pathStack.pop();
				}
			}
			if (line.startsWith(']') || line === '],') {
				currentArrayIndex = -1;
				if (pathStack.length > 0) {
					pathStack.pop();
				}
			}
		}

		return null;
	};

	// Compute highlight lines for both editors
	const highlightLinesOriginal = $derived.by(() => {
		if (!selectedDiff) return [];
		const line = findLineForPath(compareJson1, selectedDiff.path);
		if (!line) return [];
		return [{ line, type: selectedDiff.type }];
	});

	const highlightLinesModified = $derived.by(() => {
		if (!selectedDiff) return [];
		const line = findLineForPath(compareJson2, selectedDiff.path);
		if (!line) return [];
		return [{ line, type: selectedDiff.type }];
	});

	const handleDiffClick = (diff: DiffItem) => {
		selectedDiff = selectedDiff?.path === diff.path ? null : diff;
	};

	// Report stats to parent
	$effect(() => {
		onStatsChange?.({
			input: compareJson1,
			valid: combinedValidity,
			error: compareError,
			format: json1Validation.format,
		});
	});

	// Handlers
	const handleSwap = () => {
		const temp = compareJson1;
		compareJson1 = compareJson2;
		compareJson2 = temp;
	};

	const handleClear = () => {
		compareJson1 = '{}';
		compareJson2 = '{}';
	};

	const DIFF_TYPE_CLASSES: Record<DiffItem['type'], string> = {
		added: 'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300',
		removed: 'bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300',
		changed: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-700 dark:text-yellow-300',
	};

	const getDiffTypeClass = (type: DiffItem['type']) => DIFF_TYPE_CLASSES[type];
</script>

<div class="flex flex-1 overflow-hidden">
	<OptionsPanel show={showOptions} onclose={() => (showOptions = false)} onopen={() => (showOptions = true)}>
		<OptionsSection title="Actions">
			<Button variant="outline" size="sm" class="w-full gap-1.5 text-xs" onclick={handleSwap}>
				<ArrowRightLeft class="h-3.5 w-3.5" />
				Swap Left/Right
			</Button>
		</OptionsSection>

		<OptionsSection title="Comparison">
			<OptionCheckbox label="Deep compare" bind:checked={compareDeepCompare} />
			<OptionCheckbox label="Ignore whitespace" bind:checked={compareIgnoreWhitespace} />
			<OptionCheckbox label="Ignore array order" bind:checked={compareIgnoreArrayOrder} />
			<OptionCheckbox label="Show only differences" bind:checked={compareShowOnlyDiffs} />
		</OptionsSection>

		<OptionsSection title="Advanced">
			<OptionCheckbox label="Ignore case" bind:checked={compareIgnoreCase} />
			<OptionCheckbox label="Ignore numeric type" bind:checked={compareIgnoreNumericType} />
			<OptionCheckbox label="Ignore empty values" bind:checked={compareIgnoreEmpty} />
			<div class="space-y-1 pt-1">
				<Label class="text-[10px] uppercase tracking-wide text-muted-foreground">Ignore Keys</Label>
				<Input bind:value={compareIgnoreKeys} placeholder="key1, key2, key3" class="h-7 text-xs" />
				<span class="text-[10px] text-muted-foreground">Comma-separated list of keys to ignore</span>
			</div>
		</OptionsSection>

		<OptionsSection title="Legend">
			<div class="space-y-1.5 rounded-md bg-muted/50 p-2">
				<div class="flex items-center gap-2 text-xs">
					<span class="h-2.5 w-2.5 rounded-sm bg-green-500/40"></span>
					<span class="text-muted-foreground">Added</span>
				</div>
				<div class="flex items-center gap-2 text-xs">
					<span class="h-2.5 w-2.5 rounded-sm bg-red-500/40"></span>
					<span class="text-muted-foreground">Removed</span>
				</div>
				<div class="flex items-center gap-2 text-xs">
					<span class="h-2.5 w-2.5 rounded-sm bg-yellow-500/40"></span>
					<span class="text-muted-foreground">Changed</span>
				</div>
			</div>
		</OptionsSection>
	</OptionsPanel>

	<div class="flex flex-1 flex-col overflow-hidden">
		<SplitPane class="flex-1">
			{#snippet left()}
				<EditorPane
					title="Original"
					bind:value={compareJson1}
					mode="input"
					editorMode="json"
					placeholder="Original JSON..."
					highlightLines={highlightLinesOriginal}
					onpaste={async () => { compareJson1 = await navigator.clipboard.readText(); toast.success('Pasted'); }}
					onclear={() => (compareJson1 = '{}')}
				/>
			{/snippet}
			{#snippet right()}
				<EditorPane
					title="Modified"
					bind:value={compareJson2}
					mode="input"
					editorMode="json"
					placeholder="Modified JSON..."
					highlightLines={highlightLinesModified}
					onpaste={async () => { compareJson2 = await navigator.clipboard.readText(); toast.success('Pasted'); }}
					onclear={() => (compareJson2 = '{}')}
				/>
			{/snippet}
		</SplitPane>

		{#if diffResults.length > 0}
			<!-- Diff Summary -->
			<div class="flex items-center gap-4 border-t bg-muted/30 px-3 py-1.5 text-xs">
				<span class="font-medium">{diffSummary.total} difference{diffSummary.total !== 1 ? 's' : ''}</span>
				{#if diffSummary.added > 0}
					<span class="flex items-center gap-1 text-green-600 dark:text-green-400">
						<Plus class="h-3 w-3" />
						{diffSummary.added}
					</span>
				{/if}
				{#if diffSummary.removed > 0}
					<span class="flex items-center gap-1 text-red-600 dark:text-red-400">
						<Minus class="h-3 w-3" />
						{diffSummary.removed}
					</span>
				{/if}
				{#if diffSummary.changed > 0}
					<span class="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
						<RefreshCw class="h-3 w-3" />
						{diffSummary.changed}
					</span>
				{/if}
			</div>
			<!-- Diff Results -->
			<div class="max-h-64 overflow-auto border-t bg-muted/20 p-2">
				<div class="space-y-1">
					{#each diffResults as diff}
						<button
							type="button"
							class={`flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left transition-all hover:ring-2 hover:ring-ring/50 ${getDiffTypeClass(diff.type)} ${selectedDiff?.path === diff.path ? 'ring-2 ring-ring' : ''}`}
							onclick={() => handleDiffClick(diff)}
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
		{:else if compareJson1.trim() !== '{}' && compareJson2.trim() !== '{}' && !compareError}
			<div class="flex h-8 items-center justify-center border-t bg-green-500/20 text-xs font-medium text-green-600 dark:text-green-400">
				✓ Identical
			</div>
		{/if}
	</div>
</div>
