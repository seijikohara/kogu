<script lang="ts">
	import { ArrowRightLeft } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { CodeEditor } from '$lib/components/editor';
	import { FormSection } from '$lib/components/form';
	import { SplitPane } from '$lib/components/layout';
	import { DiffLegend, DiffResults, OptionsPanel } from '$lib/components/panel';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { GenericDiffItem } from '$lib/constants/diff.js';

	type EditorMode = 'json' | 'xml' | 'yaml';

	interface TabStats {
		input: string;
		valid: boolean | null;
		error: string;
	}

	interface ValidationResult {
		valid: boolean | null;
	}

	interface HighlightLine {
		line: number;
		type: 'added' | 'removed' | 'changed';
	}

	interface Props {
		/** Editor mode for syntax highlighting */
		editorMode: EditorMode;
		/** Shared input value from parent (used as Original/input1) */
		input: string;
		/** Callback to update shared input */
		onInputChange: (value: string) => void;
		/** Placeholder text for first editor */
		placeholder1?: string;
		/** Placeholder text for second editor */
		placeholder2?: string;
		/** Validation function */
		validate: (input: string) => ValidationResult;
		/** Comparison function */
		compare: (input1: string, input2: string) => GenericDiffItem[];
		/** Callback for stats changes */
		onStatsChange?: (stats: TabStats) => void;
		/** Find line number for path (for highlighting) */
		findLineForPath?: (content: string, path: string) => number | null;
		/** Paste from clipboard function */
		pasteFromClipboard: () => Promise<string | null>;
		/** Snippet for comparison options */
		comparisonOptions?: Snippet;
		/** Snippet for advanced options */
		advancedOptions?: Snippet;
	}

	let {
		editorMode,
		input,
		onInputChange,
		placeholder1 = 'Original...',
		placeholder2 = 'Modified...',
		validate,
		compare,
		onStatsChange,
		findLineForPath,
		pasteFromClipboard,
		comparisonOptions,
		advancedOptions,
	}: Props = $props();

	// State - input2 is local to compare tab
	let input2 = $state('');
	let showOptions = $state(true);

	// Validation
	const validation1 = $derived.by(() => {
		if (!input.trim()) return { valid: null as boolean | null };
		return validate(input);
	});

	const validation2 = $derived.by(() => {
		if (!input2.trim()) return { valid: null as boolean | null };
		return validate(input2);
	});

	// Combined validity
	const combinedValidity = $derived.by((): boolean | null => {
		if (validation1.valid === true && validation2.valid === true) return true;
		if (validation1.valid === false || validation2.valid === false) return false;
		return null;
	});

	// Compare result
	const compareResultData = $derived.by(() => {
		if (!input.trim() || !input2.trim()) {
			return { diffs: [] as GenericDiffItem[], error: '' };
		}
		try {
			const diffs = compare(input, input2);
			return { diffs, error: '' };
		} catch (e) {
			return {
				diffs: [] as GenericDiffItem[],
				error: e instanceof Error ? e.message : 'Compare failed',
			};
		}
	});

	const diffResults = $derived(compareResultData.diffs);
	const compareError = $derived(compareResultData.error);

	// Selected diff for highlighting
	let selectedDiff = $state<GenericDiffItem | null>(null);

	// Compute highlight lines for both editors
	const highlightLinesOriginal = $derived.by((): HighlightLine[] => {
		if (!selectedDiff || !findLineForPath) return [];
		const line = findLineForPath(input, selectedDiff.path);
		if (!line) return [];
		return [{ line, type: selectedDiff.type }];
	});

	const highlightLinesModified = $derived.by((): HighlightLine[] => {
		if (!selectedDiff || !findLineForPath) return [];
		const line = findLineForPath(input2, selectedDiff.path);
		if (!line) return [];
		return [{ line, type: selectedDiff.type }];
	});

	const handleDiffClick = (diff: GenericDiffItem) => {
		selectedDiff = selectedDiff?.path === diff.path ? null : diff;
	};

	// Report stats to parent
	$effect(() => {
		onStatsChange?.({
			input,
			valid: combinedValidity,
			error: compareError,
		});
	});

	// Handlers
	const handleSwap = () => {
		const temp = input;
		onInputChange(input2);
		input2 = temp;
	};

	const handlePaste1 = async () => {
		const text = await pasteFromClipboard();
		if (text) onInputChange(text);
	};

	const handlePaste2 = async () => {
		const text = await pasteFromClipboard();
		if (text) input2 = text;
	};

	// Check if has non-empty content for identical check
	const hasContent = $derived(input.trim() !== '' && input2.trim() !== '' && !compareError);
</script>

<div class="flex flex-1 overflow-hidden">
	<OptionsPanel
		show={showOptions}
		onclose={() => (showOptions = false)}
		onopen={() => (showOptions = true)}
	>
		<FormSection title="Actions">
			<Button variant="outline" size="sm" class="w-full gap-1.5 text-xs" onclick={handleSwap}>
				<ArrowRightLeft class="h-3.5 w-3.5" />
				Swap Left/Right
			</Button>
		</FormSection>

		{#if comparisonOptions}
			<FormSection title="Comparison">
				{@render comparisonOptions()}
			</FormSection>
		{/if}

		{#if advancedOptions}
			<FormSection title="Advanced">
				{@render advancedOptions()}
			</FormSection>
		{/if}

		<DiffLegend />
	</OptionsPanel>

	<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
		<SplitPane class="h-full flex-1">
			{#snippet left()}
				<CodeEditor
					title="Original"
					value={input}
					onchange={onInputChange}
					mode="input"
					{editorMode}
					placeholder={placeholder1}
					highlightLines={highlightLinesOriginal}
					onpaste={handlePaste1}
					onclear={() => onInputChange('')}
				/>
			{/snippet}
			{#snippet right()}
				<CodeEditor
					title="Modified"
					bind:value={input2}
					mode="input"
					{editorMode}
					placeholder={placeholder2}
					highlightLines={highlightLinesModified}
					onpaste={handlePaste2}
					onclear={() => (input2 = '')}
				/>
			{/snippet}
		</SplitPane>

		<DiffResults
			diffs={diffResults}
			{selectedDiff}
			onDiffClick={handleDiffClick}
			checkIdentical={true}
			{hasContent}
		/>
	</div>
</div>
