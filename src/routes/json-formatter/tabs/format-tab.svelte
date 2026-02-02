<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ContextMenuItem } from '$lib/components/editor';
	import { CodeEditor } from '$lib/components/editor';
	import { FormCheckbox, FormMode, FormSection, FormSelect } from '$lib/components/form';
	import { SplitPane } from '$lib/components/layout';
	import { OptionsPanel } from '$lib/components/panel';
	import {
		defaultJsonFormatOptions,
		JSON_FORMAT_INFO,
		type JsonFormatOptions,
		type JsonInputFormat,
		type JsonOutputFormat,
		parseJson,
		processJsonWithOptions,
		SAMPLE_JSON,
		stringifyJson,
		validateJson,
	} from '$lib/services/formatters';

	interface Props {
		readonly formatSection?: Snippet<[boolean?]>;
		readonly inputFormat: JsonInputFormat;
		readonly outputFormat: JsonOutputFormat;
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { formatSection, inputFormat, outputFormat, input, onInputChange, onStatsChange }: Props =
		$props();

	// Mode and UI state
	let formatMode = $state<'format' | 'minify'>('format');
	let showOptions = $state(true);

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
	const indentSize = $derived(Number.parseInt(indentSizeStr, 10) || 2);
	const maxDepth = $derived(Number.parseInt(maxDepthStr, 10) || 0);

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

	// Validation
	const validation = $derived.by(() => {
		if (!input.trim()) {
			return { valid: null as boolean | null };
		}
		const result = validateJson(input, inputFormat);
		return { valid: result.valid };
	});

	// Output calculation
	const formatResult = $derived.by((): { output: string; error: string } => {
		if (!input.trim()) return { output: '', error: '' };

		try {
			const data = parseJson(input, inputFormat);

			// Apply filtering options (removeNulls, removeEmptyStrings, etc.)
			const processedData = processJsonWithOptions(data, formatOptions);

			let output: string;
			if (formatMode === 'minify') {
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
						(char) => `\\u${`0000${char.charCodeAt(0).toString(16)}`.slice(-4)}`
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
							return `[${items.join(', ')}]`;
						}
					);
				}
			}

			return { output, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid JSON' };
		}
	});

	const output = $derived(formatResult.output);
	const formatError = $derived(formatResult.error);

	// Report stats to parent
	$effect(() => {
		onStatsChange?.({
			input,
			valid: validation.valid,
			error: formatError,
		});
	});

	// Download filename based on output format
	const downloadFilename = $derived(`formatted.${JSON_FORMAT_INFO[outputFormat].extension}`);

	// Handlers
	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) onInputChange(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => {
		onInputChange('');
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(output);
		} catch {
			// Clipboard access denied
		}
	};

	const handleSample = () => {
		onInputChange(SAMPLE_JSON);
	};

	// Format input JSON
	const handleFormatInput = () => {
		try {
			const data = parseJson(input, inputFormat);
			const formatted = JSON.stringify(data, null, 2);
			onInputChange(formatted);
		} catch {
			// Invalid JSON
		}
	};

	// Minify input JSON
	const handleMinifyInput = () => {
		try {
			const data = parseJson(input, inputFormat);
			const minified = JSON.stringify(data);
			onInputChange(minified);
		} catch {
			// Invalid JSON
		}
	};

	// Context menu items for input editor
	const inputContextMenuItems = $derived<ContextMenuItem[]>([
		{
			text: 'Format JSON',
			enabled: !!input.trim(),
			action: handleFormatInput,
		},
		{
			text: 'Minify JSON',
			enabled: !!input.trim(),
			action: handleMinifyInput,
		},
	]);
</script>

<div class="flex flex-1 overflow-hidden">
	<OptionsPanel
		show={showOptions}
		onclose={() => (showOptions = false)}
		onopen={() => (showOptions = true)}
	>
		{@render formatSection?.(true)}
		<FormSection title="Mode">
			<FormMode
				bind:value={formatMode}
				options={[
					{ value: 'format', label: 'Format' },
					{ value: 'minify', label: 'Minify' },
				]}
			/>
		</FormSection>

		<FormSection title="Indentation">
			<div class="grid grid-cols-2 gap-2">
				<FormSelect label="Size" bind:value={indentSizeStr} options={['1', '2', '3', '4', '8']} />
				<FormSelect
					label="Type"
					bind:value={indentType}
					options={[
						{ value: 'spaces', label: 'Spaces' },
						{ value: 'tabs', label: 'Tabs' },
					]}
				/>
			</div>
		</FormSection>

		<FormSection title="Style">
			<div class="grid grid-cols-2 gap-2">
				<FormSelect
					label="Quotes"
					bind:value={quoteStyle}
					options={[
						{ value: 'double', label: '"..."' },
						{ value: 'single', label: "'...'" },
					]}
				/>
				<FormSelect
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
				<FormCheckbox label="Sort keys alphabetically" bind:checked={sortKeys} />
				<FormCheckbox label="Escape unicode characters" bind:checked={escapeUnicode} />
			</div>
		</FormSection>

		<FormSection title="Spacing">
			<FormCheckbox label="Space after colon" bind:checked={colonSpacing} />
			<FormCheckbox label="Array bracket spacing" bind:checked={arrayBracketSpacing} />
			<FormCheckbox label="Object bracket spacing" bind:checked={objectBracketSpacing} />
			<FormCheckbox label="Trailing commas" bind:checked={trailingComma} />
			<FormCheckbox label="Compact arrays" bind:checked={compactArrays} />
		</FormSection>

		<FormSection title="Filtering">
			<FormCheckbox label="Remove null values" bind:checked={removeNulls} />
			<FormCheckbox label="Remove empty strings" bind:checked={removeEmptyStrings} />
			<FormCheckbox label="Remove empty arrays" bind:checked={removeEmptyArrays} />
			<FormCheckbox label="Remove empty objects" bind:checked={removeEmptyObjects} />
		</FormSection>
	</OptionsPanel>

	<SplitPane class="h-full flex-1">
		{#snippet left()}
			<CodeEditor
				title="Input"
				value={input}
				onchange={onInputChange}
				mode="input"
				editorMode="json"
				placeholder="Enter JSON here..."
				onsample={handleSample}
				onpaste={handlePaste}
				onclear={handleClear}
				contextMenuItems={inputContextMenuItems}
			/>
		{/snippet}
		{#snippet right()}
			<CodeEditor
				title="Output"
				value={output}
				mode="output"
				editorMode="json"
				placeholder="Formatted output..."
				oncopy={handleCopy}
			/>
		{/snippet}
	</SplitPane>
</div>
