<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { EditorMode } from '$lib/components/editors/code-editor.svelte';
	import OptionsPanel from '$lib/components/options/options-panel.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import SplitPane from '$lib/components/layout/split-pane.svelte';
	import { EditorPane } from '$lib/components/tool/index.js';

	interface FormatOption {
		value: string;
		label: string;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type ValidationResult = { valid: boolean | null } & Record<string, any>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type StatsResult = { input: string; valid: boolean | null; error: string } & Record<string, any>;

	interface Props {
		/** Editor mode for syntax highlighting */
		editorMode: EditorMode;
		/** Shared input value from parent */
		input: string;
		/** Callback to update shared input */
		onInputChange: (value: string) => void;
		/** Placeholder text for input */
		placeholder?: string;
		/** Validation function - can return extra properties that will be passed to onStatsChange */
		validate: (input: string) => ValidationResult;
		/** Format function - receives input and minify flag */
		format: (input: string, minify: boolean) => { output: string; error: string };
		/** Callback when stats change - receives base stats plus any extra from validate */
		onStatsChange?: (stats: StatsResult) => void;
		/** Output format options (for format selector) */
		outputFormatOptions?: FormatOption[];
		/** Selected output format */
		selectedOutputFormat?: string;
		/** Callback when output format changes */
		onOutputFormatChange?: (format: string) => void;
		/** Download filename */
		downloadFilename?: string;
		/** Sample data for the sample button */
		sampleData?: string;
		/** File operations */
		copyToClipboard: (text: string) => void;
		pasteFromClipboard: () => Promise<string | null>;
		downloadTextFile: (content: string, filename: string) => void;
		/** Mode section additional content (e.g., detected format badge) */
		modeExtra?: Snippet;
		/** Options panel sections */
		options?: Snippet;
	}

	let {
		editorMode,
		input,
		onInputChange,
		placeholder = 'Enter content here...',
		validate,
		format,
		onStatsChange,
		outputFormatOptions,
		selectedOutputFormat,
		onOutputFormatChange,
		downloadFilename = 'formatted.txt',
		sampleData,
		copyToClipboard,
		pasteFromClipboard,
		downloadTextFile,
		modeExtra,
		options,
	}: Props = $props();
	let minifyMode = $state(false);
	let showOptions = $state(true);

	// Validation (returns valid + any extra properties)
	const inputValidation = $derived.by(() => {
		if (!input.trim()) return { valid: null as boolean | null };
		return validate(input);
	});

	// Format result
	const formatResult = $derived.by(() => {
		if (!input.trim()) return { output: '', error: '' };
		return format(input, minifyMode);
	});

	const output = $derived(formatResult.output);
	const formatError = $derived(formatResult.error);

	// Report stats to parent (including extra properties from validation)
	$effect(() => {
		const { valid, ...extra } = inputValidation;
		onStatsChange?.({
			input,
			valid,
			error: formatError,
			...extra,
		});
	});

	// Handlers
	const handleSample = () => {
		if (sampleData) {
			onInputChange(sampleData);
		}
	};

	const handlePaste = async () => {
		const text = await pasteFromClipboard();
		if (text) onInputChange(text);
	};

	const handleClear = () => {
		onInputChange('');
	};

	const handleCopy = () => copyToClipboard(output);

	const handleDownload = () => {
		downloadTextFile(output, downloadFilename);
	};

	const handleFormatChange = (format: string) => {
		onOutputFormatChange?.(format);
	};
</script>

<div class="flex flex-1 overflow-hidden">
	<OptionsPanel
		show={showOptions}
		onclose={() => (showOptions = false)}
		onopen={() => (showOptions = true)}
	>
		<OptionsSection title="Mode">
			<OptionCheckbox label="Minify output" bind:checked={minifyMode} />
			{#if modeExtra}
				{@render modeExtra()}
			{/if}
		</OptionsSection>

		{#if options}
			{@render options()}
		{/if}
	</OptionsPanel>

	<SplitPane class="h-full flex-1">
		{#snippet left()}
			<EditorPane
				title="Input"
				value={input}
				onchange={onInputChange}
				mode="input"
				{editorMode}
				{placeholder}
				onsample={sampleData ? handleSample : undefined}
				onpaste={handlePaste}
				onclear={handleClear}
			/>
		{/snippet}
		{#snippet right()}
			<EditorPane
				title="Output"
				value={output}
				mode={outputFormatOptions ? 'output' : 'readonly'}
				{editorMode}
				placeholder="Formatted output..."
				formatOptions={outputFormatOptions}
				selectedFormat={selectedOutputFormat}
				onformatchange={handleFormatChange}
				oncopy={handleCopy}
				ondownload={handleDownload}
			/>
		{/snippet}
	</SplitPane>
</div>
