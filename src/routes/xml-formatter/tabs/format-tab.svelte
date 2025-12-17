<script lang="ts">
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import OptionSelect from '$lib/components/options/option-select.svelte';
	import { FormatTabBase } from '$lib/components/tool/index.js';
	import {
		formatXml,
		minifyXml,
		defaultXmlFormatOptions,
		SAMPLE_XML,
		type XmlFormatOptions,
	} from '$lib/services/formatters.js';
	import { downloadTextFile, copyToClipboard, pasteFromClipboard } from '../utils.js';

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
	const indentSize = $derived(parseInt(indentSizeStr) || 2);

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
