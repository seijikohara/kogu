<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { EditorMode } from '$lib/components/editor';
	import { CodeEditor } from '$lib/components/editor';
	import { SplitPane } from '$lib/components/layout';
	import { OptionsPanel } from '$lib/components/panel';

	type ValidationResult = { valid: boolean | null } & Record<string, unknown>;
	type StatsResult = { input: string; valid: boolean | null; error: string } & Record<
		string,
		unknown
	>;

	interface Props {
		/** Editor mode for input */
		inputEditorMode: EditorMode;
		/** Editor mode for output (can change based on format) */
		outputEditorMode: EditorMode;
		/** Shared input value from parent */
		input: string;
		/** Callback to update shared input */
		onInputChange: (value: string) => void;
		/** Input placeholder */
		placeholder?: string;
		/** Validate input - can return extra properties that will be passed to onStatsChange */
		validate: (input: string) => ValidationResult;
		/** Convert input to output */
		convert: (input: string) => { output: string; error: string };
		/** Stats change callback - receives base stats plus any extra from validate */
		onStatsChange?: (stats: StatsResult) => void;
		/** Download filename */
		downloadFilename?: string;
		/** Copy to clipboard function */
		copyToClipboard: (text: string) => void;
		/** Paste from clipboard function */
		pasteFromClipboard: () => Promise<string | null>;
		/** Download text file function */
		downloadTextFile: (content: string, filename: string) => void;
		/** Output title (e.g., "Output (YAML)") */
		outputTitle?: string;
		/** Options snippet */
		options?: Snippet;
	}

	let {
		inputEditorMode,
		outputEditorMode,
		input,
		onInputChange,
		placeholder = 'Enter content here...',
		validate,
		convert,
		onStatsChange,
		downloadFilename = 'converted.txt',
		copyToClipboard,
		pasteFromClipboard,
		downloadTextFile,
		outputTitle = 'Output',
		options,
	}: Props = $props();
	let showOptions = $state(true);

	// Validation (returns valid + any extra properties)
	const inputValidation = $derived.by(() => {
		if (!input.trim()) return { valid: null as boolean | null };
		return validate(input);
	});

	// Conversion result
	const convertResult = $derived.by(() => {
		if (!input.trim()) {
			return { output: '', error: '' };
		}
		return convert(input);
	});

	const output = $derived(convertResult.output);
	const error = $derived(convertResult.error);

	// Report stats to parent (including extra properties from validation)
	$effect(() => {
		const { valid, ...extra } = inputValidation;
		onStatsChange?.({
			input,
			valid,
			error,
			...extra,
		});
	});

	// Handlers
	const handlePaste = async () => {
		const text = await pasteFromClipboard();
		if (text) onInputChange(text);
	};

	const handleClear = () => {
		onInputChange('');
	};

	const handleCopyOutput = () => copyToClipboard(output);

	const handleDownload = () => {
		downloadTextFile(output, downloadFilename);
	};
</script>

<div class="flex flex-1 overflow-hidden">
	<OptionsPanel
		show={showOptions}
		onclose={() => (showOptions = false)}
		onopen={() => (showOptions = true)}
	>
		{#if options}
			{@render options()}
		{/if}
	</OptionsPanel>

	<SplitPane class="h-full flex-1">
		{#snippet left()}
			<CodeEditor
				title="Input"
				value={input}
				onchange={onInputChange}
				mode="input"
				editorMode={inputEditorMode}
				{placeholder}
				onpaste={handlePaste}
				onclear={handleClear}
			/>
		{/snippet}
		{#snippet right()}
			<CodeEditor
				title={outputTitle}
				value={output}
				mode="readonly"
				editorMode={outputEditorMode}
				placeholder="Converted output..."
				oncopy={handleCopyOutput}
			/>
		{/snippet}
	</SplitPane>
</div>
