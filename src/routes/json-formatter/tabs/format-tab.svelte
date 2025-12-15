<script lang="ts">
	import OptionsPanel from '$lib/components/options/options-panel.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import OptionSelect from '$lib/components/options/option-select.svelte';
	import SplitPane from '$lib/components/layout/split-pane.svelte';
	import { EditorPane } from '$lib/components/tool/index.js';
	import {
		parseJsonAuto,
		stringifyJson,
		validateJson,
		processJsonWithOptions,
		JSON_FORMAT_OPTIONS,
		JSON_FORMAT_INFO,
		type JsonFormatOptions,
		type JsonInputFormat,
		type JsonOutputFormat,
		defaultJsonFormatOptions,
	} from '$lib/services/formatters.js';
	import { downloadTextFile, copyToClipboard, pasteFromClipboard } from '../utils.js';

	interface Props {
		onStatsChange?: (stats: {
			input: string;
			valid: boolean | null;
			error: string;
			format: JsonInputFormat | null;
		}) => void;
	}

	let { onStatsChange }: Props = $props();

	// State
	let inputJson = $state('{}');
	let minifyMode = $state(false);
	let showOptions = $state(true);
	let outputFormat = $state<JsonOutputFormat>('json');

	// Format options
	let indentSizeStr = $state(String(defaultJsonFormatOptions.indentSize));
	let indentType = $state<'spaces' | 'tabs'>(defaultJsonFormatOptions.indentType);
	let sortKeys = $state(defaultJsonFormatOptions.sortKeys);
	let removeNulls = $state(defaultJsonFormatOptions.removeNulls);
	let removeEmptyStrings = $state(defaultJsonFormatOptions.removeEmptyStrings);
	let removeEmptyArrays = $state(defaultJsonFormatOptions.removeEmptyArrays);
	let removeEmptyObjects = $state(defaultJsonFormatOptions.removeEmptyObjects);
	let escapeUnicode = $state(defaultJsonFormatOptions.escapeUnicode);
	let trailingComma = $state(defaultJsonFormatOptions.trailingComma);
	let quoteStyle = $state<'double' | 'single'>(defaultJsonFormatOptions.quoteStyle);
	let arrayBracketSpacing = $state(defaultJsonFormatOptions.arrayBracketSpacing);
	let objectBracketSpacing = $state(defaultJsonFormatOptions.objectBracketSpacing);
	let colonSpacing = $state(defaultJsonFormatOptions.colonSpacing);
	let compactArrays = $state(defaultJsonFormatOptions.compactArrays);
	let maxDepthStr = $state(String(defaultJsonFormatOptions.maxDepth));

	// Derived numeric values
	const indentSize = $derived(parseInt(indentSizeStr) || 2);
	const maxDepth = $derived(parseInt(maxDepthStr) || 0);

	// Validation
	const inputValidation = $derived.by(() => {
		if (!inputJson.trim())
			return { valid: null as boolean | null, format: null as JsonInputFormat | null };
		const result = validateJson(inputJson);
		return { valid: result.valid, format: result.detectedFormat };
	});

	// Format options object
	const formatOptions = $derived<Partial<JsonFormatOptions>>({
		indentSize,
		indentType,
		sortKeys,
		removeNulls,
		removeEmptyStrings,
		removeEmptyArrays,
		removeEmptyObjects,
		escapeUnicode,
		trailingComma,
		quoteStyle,
		arrayBracketSpacing,
		objectBracketSpacing,
		colonSpacing,
		compactArrays,
		maxDepth,
	});

	// Format result
	const formatResult = $derived.by(() => {
		if (!inputJson.trim()) return { output: '', error: '' };
		try {
			const { data } = parseJsonAuto(inputJson);

			// Apply filtering options (removeNulls, removeEmptyStrings, etc.)
			const processedData = processJsonWithOptions(data, formatOptions);

			let output: string;
			if (minifyMode) {
				output = stringifyJson(processedData, outputFormat, { indent: 0 });
			} else {
				output = stringifyJson(processedData, outputFormat, {
					indent: formatOptions.indentType === 'tabs' ? '\t' : formatOptions.indentSize,
					sortKeys: formatOptions.sortKeys,
					trailingComma: formatOptions.trailingComma,
					quote: formatOptions.quoteStyle,
				});

				// Apply additional formatting options
				if (formatOptions.escapeUnicode) {
					output = output.replace(
						/[\u0080-\uFFFF]/g,
						(char) => '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4)
					);
				}
				if (formatOptions.arrayBracketSpacing) {
					output = output.replace(/\[(?!\s*\n)/g, '[ ').replace(/(?<!\n\s*)\]/g, ' ]');
				}
				if (formatOptions.objectBracketSpacing) {
					output = output.replace(/\{(?!\s*\n)/g, '{ ').replace(/(?<!\n\s*)\}/g, ' }');
				}
				if (!formatOptions.colonSpacing) {
					output = output.replace(/:\s+/g, ':');
				}
				if (formatOptions.compactArrays && (formatOptions.indentSize ?? 2) > 0) {
					output = output.replace(
						/\[\s*\n(\s*)((?:"[^"]*"|'[^']*'|[\d.eE+-]+|true|false|null)(?:,\s*\n\s*(?:"[^"]*"|'[^']*'|[\d.eE+-]+|true|false|null))*)\s*\n\s*\]/g,
						(_, _indent, content: string) => {
							const items = content.split(/,\s*\n\s*/);
							return '[' + items.join(', ') + ']';
						}
					);
				}
			}

			return { output, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid JSON' };
		}
	});

	const outputJson = $derived(formatResult.output);
	const jsonError = $derived(formatResult.error);

	// Report stats to parent
	$effect(() => {
		onStatsChange?.({
			input: inputJson,
			valid: inputValidation.valid,
			error: jsonError,
			format: inputValidation.format,
		});
	});

	// Handlers
	const handlePaste = async () => {
		const text = await pasteFromClipboard();
		if (text) inputJson = text;
	};

	const handleClear = () => {
		inputJson = '{}';
	};

	const handleCopy = () => copyToClipboard(outputJson);

	const handleDownload = () => {
		downloadTextFile(outputJson, `formatted.${JSON_FORMAT_INFO[outputFormat].extension}`);
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
			{#if inputValidation.format && inputValidation.format !== 'json'}
				<div class="mt-2 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
					<span class="font-medium text-foreground">Detected:</span>
					{JSON_FORMAT_INFO[inputValidation.format].label}
				</div>
			{/if}
		</OptionsSection>

		<OptionsSection title="Indentation">
			<div class="grid grid-cols-2 gap-2">
				<OptionSelect label="Size" bind:value={indentSizeStr} options={['1', '2', '3', '4', '8']} />
				<OptionSelect
					label="Type"
					bind:value={indentType}
					options={[
						{ value: 'spaces', label: 'Spaces' },
						{ value: 'tabs', label: 'Tabs' },
					]}
				/>
			</div>
		</OptionsSection>

		<OptionsSection title="Style">
			<div class="grid grid-cols-2 gap-2">
				<OptionSelect
					label="Quotes"
					bind:value={quoteStyle}
					options={[
						{ value: 'double', label: '"..."' },
						{ value: 'single', label: "'...'" },
					]}
				/>
				<OptionSelect
					label="Max Depth"
					bind:value={maxDepthStr}
					options={[
						{ value: '0', label: '∞' },
						{ value: '1', label: '1' },
						{ value: '2', label: '2' },
						{ value: '3', label: '3' },
						{ value: '5', label: '5' },
						{ value: '10', label: '10' },
					]}
				/>
			</div>
			<div class="space-y-1.5 pt-1">
				<OptionCheckbox label="Sort keys alphabetically" bind:checked={sortKeys} />
				<OptionCheckbox label="Escape unicode characters" bind:checked={escapeUnicode} />
			</div>
		</OptionsSection>

		<OptionsSection title="Spacing">
			<OptionCheckbox label="Space after colon" bind:checked={colonSpacing} />
			<OptionCheckbox label="Array bracket spacing" bind:checked={arrayBracketSpacing} />
			<OptionCheckbox label="Object bracket spacing" bind:checked={objectBracketSpacing} />
			<OptionCheckbox label="Trailing commas" bind:checked={trailingComma} />
			<OptionCheckbox label="Compact arrays" bind:checked={compactArrays} />
		</OptionsSection>

		<OptionsSection title="Filtering">
			<OptionCheckbox label="Remove null values" bind:checked={removeNulls} />
			<OptionCheckbox label="Remove empty strings" bind:checked={removeEmptyStrings} />
			<OptionCheckbox label="Remove empty arrays" bind:checked={removeEmptyArrays} />
			<OptionCheckbox label="Remove empty objects" bind:checked={removeEmptyObjects} />
		</OptionsSection>
	</OptionsPanel>

	<SplitPane class="flex-1">
		{#snippet left()}
			<EditorPane
				title="Input"
				bind:value={inputJson}
				mode="input"
				editorMode="json"
				placeholder="Paste JSON here..."
				onpaste={handlePaste}
				onclear={handleClear}
			/>
		{/snippet}
		{#snippet right()}
			<EditorPane
				title="Output"
				value={outputJson}
				mode="output"
				editorMode="json"
				placeholder="Formatted output..."
				formatOptions={JSON_FORMAT_OPTIONS}
				selectedFormat={outputFormat}
				onformatchange={(f) => (outputFormat = f as JsonOutputFormat)}
				oncopy={handleCopy}
				ondownload={handleDownload}
			/>
		{/snippet}
	</SplitPane>
</div>
