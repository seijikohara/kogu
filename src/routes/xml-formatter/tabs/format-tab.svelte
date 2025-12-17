<script lang="ts">
	import type { ContextMenuItem } from '$lib/components/editors/code-editor.svelte';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import OptionSelect from '$lib/components/options/option-select.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import { FormatTabBase } from '$lib/components/tool/index.js';
	import {
		defaultXmlFormatOptions,
		formatXml,
		minifyXml,
		SAMPLE_XML,
		type XmlFormatOptions,
	} from '$lib/services/formatters.js';
	import { copyToClipboard, downloadTextFile, pasteFromClipboard } from '../utils.js';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// Format options - Indentation
	let indentSizeStr = $state(String(defaultXmlFormatOptions.indentSize));
	let indentType = $state<'spaces' | 'tabs'>(defaultXmlFormatOptions.indentType);

	// Format options - Tags
	let whiteSpaceAtEndOfSelfclosingTag = $state(
		defaultXmlFormatOptions.whiteSpaceAtEndOfSelfclosingTag
	);
	let forceSelfClosingEmptyTag = $state(defaultXmlFormatOptions.forceSelfClosingEmptyTag);

	// Format options - Content
	let collapseContent = $state(defaultXmlFormatOptions.collapseContent);
	let preserveWhitespace = $state(defaultXmlFormatOptions.preserveWhitespace);
	let excludeComments = $state(defaultXmlFormatOptions.excludeComments);

	// Format options - Attributes
	let sortAttributes = $state(defaultXmlFormatOptions.sortAttributes);

	// Derived numeric values
	const indentSize = $derived(Number.parseInt(indentSizeStr, 10) || 2);

	// Format options object
	const formatOptions = $derived<Partial<XmlFormatOptions>>({
		indentSize,
		indentType,
		collapseContent,
		whiteSpaceAtEndOfSelfclosingTag,
		excludeComments,
		preserveWhitespace,
		forceSelfClosingEmptyTag,
		sortAttributes,
	});

	// Validation function
	const validate = (input: string) => {
		if (!input.trim()) return { valid: null as boolean | null };
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(input, 'application/xml');
			const parserError = doc.querySelector('parsererror');
			return { valid: parserError === null };
		} catch {
			return { valid: false };
		}
	};

	// Format function
	const format = (input: string, minify: boolean) => {
		try {
			const output = minify ? minifyXml(input) : formatXml(input, formatOptions);
			return { output, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid XML' };
		}
	};

	// Format input XML
	const handleFormatInput = () => {
		try {
			const formatted = formatXml(input, { indentSize: 2, indentType: 'spaces' });
			onInputChange(formatted);
		} catch {
			// Invalid XML
		}
	};

	// Minify input XML
	const handleMinifyInput = () => {
		try {
			const minified = minifyXml(input);
			onInputChange(minified);
		} catch {
			// Invalid XML
		}
	};

	// Context menu items for input editor
	const inputContextMenuItems = $derived<ContextMenuItem[]>([
		{
			text: 'Format XML',
			enabled: !!input.trim(),
			action: handleFormatInput,
		},
		{
			text: 'Minify XML',
			enabled: !!input.trim(),
			action: handleMinifyInput,
		},
	]);
</script>

<FormatTabBase
	editorMode="xml"
	{input}
	{onInputChange}
	placeholder="Enter XML here..."
	{validate}
	{format}
	{onStatsChange}
	downloadFilename="formatted.xml"
	sampleData={SAMPLE_XML}
	{copyToClipboard}
	{pasteFromClipboard}
	{downloadTextFile}
	{inputContextMenuItems}
>
	{#snippet options()}
		<OptionsSection title="Indentation">
			<div class="grid grid-cols-2 gap-2">
				<OptionSelect label="Size" bind:value={indentSizeStr} options={['1', '2', '4', '8']} />
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

		<OptionsSection title="Tags">
			<OptionCheckbox
				label="Space before self-closing />"
				bind:checked={whiteSpaceAtEndOfSelfclosingTag}
			/>
			<OptionCheckbox
				label="Force self-closing empty tags"
				bind:checked={forceSelfClosingEmptyTag}
			/>
		</OptionsSection>

		<OptionsSection title="Content">
			<OptionCheckbox label="Collapse content on single line" bind:checked={collapseContent} />
			<OptionCheckbox label="Preserve whitespace" bind:checked={preserveWhitespace} />
			<OptionCheckbox label="Remove comments" bind:checked={excludeComments} />
		</OptionsSection>

		<OptionsSection title="Attributes">
			<OptionCheckbox label="Sort attributes alphabetically" bind:checked={sortAttributes} />
		</OptionsSection>
	{/snippet}
</FormatTabBase>
