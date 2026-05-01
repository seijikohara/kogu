<script lang="ts">
	import type { Snippet } from 'svelte';
	import { FormCheckbox, FormInput, FormMode, FormSection, FormSelect } from '$lib/components/form';
	import { ConvertTab } from '$lib/components/template';
	import {
		type JsonInputFormat,
		type JsonToXmlOptions,
		type JsonToYamlOptions,
		jsonToXml,
		jsonToYaml,
		validateJson,
	} from '$lib/services/formatters';
	import { copyToClipboard, downloadTextFile, pasteFromClipboard } from '../utils.js';

	interface Props {
		readonly formatSection?: Snippet<[boolean?]>;
		readonly inputFormat: JsonInputFormat;
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { formatSection, inputFormat, input, onInputChange, onStatsChange }: Props = $props();

	// State
	let convertFormat = $state<'yaml' | 'xml'>('yaml');

	// YAML options - Basic formatting
	let yamlIndentStr = $state('2');
	let yamlLineWidthStr = $state('80');
	let yamlMinContentWidthStr = $state('20');

	// YAML options - String handling
	let yamlStringType = $state<
		'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE' | 'BLOCK_LITERAL' | 'BLOCK_FOLDED'
	>('PLAIN');
	let yamlSingleQuote = $state(false);
	let yamlForceQuotes = $state(false);
	let yamlDoubleQuotedAsJSON = $state(false);

	// YAML options - Collection style
	let yamlCollectionStyle = $state<'any' | 'block' | 'flow'>('block');
	let yamlFlowCollectionPadding = $state(false);
	let yamlIndentSeq = $state(true);

	// YAML options - Key handling
	let yamlKeyType = $state<'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE'>('PLAIN');
	let yamlSortKeys = $state(false);

	// YAML options - Reference handling
	let yamlNoRefs = $state(true);

	// YAML options - Null/Boolean formatting
	let yamlNullStr = $state('null');
	let yamlTrueStr = $state('true');
	let yamlFalseStr = $state('false');

	// XML options - Structure
	let xmlRootName = $state('root');
	let xmlArrayItemName = $state('item');
	let xmlAttributePrefix = $state('@');

	// XML options - Formatting
	let xmlIndentStr = $state('2');
	let xmlIndentType = $state<'spaces' | 'tabs'>('spaces');
	let xmlLineSeparator = $state<'\n' | '\r\n'>('\n');
	let xmlCollapseContent = $state(false);

	// XML options - Declaration
	let xmlDeclaration = $state(true);
	let xmlDeclarationVersion = $state('1.0');
	let xmlDeclarationEncoding = $state('UTF-8');

	// XML options - Tags
	let xmlSelfClosing = $state(true);
	let xmlWhiteSpaceAtEndOfSelfclosingTag = $state(false);

	// XML options - Content
	let xmlCdata = $state(false);
	let xmlCdataThresholdStr = $state('0');
	let xmlEscapeText = $state(true);
	let xmlSortAttributes = $state(false);
	let xmlSortKeys = $state(false);

	// XML options - Comments
	let xmlHeaderComment = $state('');

	// Derived values
	const yamlIndent = $derived(Number.parseInt(yamlIndentStr, 10) || 2);
	const yamlLineWidth = $derived(Number.parseInt(yamlLineWidthStr, 10) || 80);
	const yamlMinContentWidth = $derived(Number.parseInt(yamlMinContentWidthStr, 10) || 20);
	const xmlIndent = $derived(Number.parseInt(xmlIndentStr, 10) || 2);
	const xmlCdataThreshold = $derived(Number.parseInt(xmlCdataThresholdStr, 10) || 0);

	// YAML options object
	const yamlOptions = $derived<JsonToYamlOptions>({
		// Basic formatting
		indent: yamlIndent,
		lineWidth: yamlLineWidth,
		minContentWidth: yamlMinContentWidth,
		// String handling
		defaultStringType: yamlStringType,
		singleQuote: yamlSingleQuote,
		forceQuotes: yamlForceQuotes,
		doubleQuotedAsJSON: yamlDoubleQuotedAsJSON,
		// Collection style
		collectionStyle: yamlCollectionStyle,
		flowCollectionPadding: yamlFlowCollectionPadding,
		indentSeq: yamlIndentSeq,
		// Key handling
		defaultKeyType: yamlKeyType,
		sortKeys: yamlSortKeys,
		// Reference handling
		noRefs: yamlNoRefs,
		// Null/Boolean formatting
		nullStr: yamlNullStr,
		trueStr: yamlTrueStr,
		falseStr: yamlFalseStr,
	});

	// XML options object
	const xmlOptions = $derived<JsonToXmlOptions>({
		// Structure
		rootName: xmlRootName,
		arrayItemName: xmlArrayItemName,
		attributePrefix: xmlAttributePrefix,
		// Formatting
		indent: xmlIndent,
		indentType: xmlIndentType,
		lineSeparator: xmlLineSeparator,
		collapseContent: xmlCollapseContent,
		// Declaration
		declaration: xmlDeclaration,
		declarationVersion: xmlDeclarationVersion,
		declarationEncoding: xmlDeclarationEncoding,
		// Tags
		selfClosing: xmlSelfClosing,
		whiteSpaceAtEndOfSelfclosingTag: xmlWhiteSpaceAtEndOfSelfclosingTag,
		// Content
		cdata: xmlCdata,
		cdataThreshold: xmlCdataThreshold,
		escapeText: xmlEscapeText,
		sortAttributes: xmlSortAttributes,
		sortKeys: xmlSortKeys,
		// Comments
		headerComment: xmlHeaderComment || undefined,
	});

	// Validation function
	const validate = (input: string) => {
		if (!input.trim()) return { valid: null as boolean | null };
		const result = validateJson(input, inputFormat);
		return { valid: result.valid };
	};

	// Convert function
	const convert = (input: string) => {
		try {
			const output =
				convertFormat === 'yaml'
					? jsonToYaml(input, yamlOptions, inputFormat)
					: jsonToXml(input, xmlOptions, inputFormat);
			return { output, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
		}
	};

	// Stats handler
	const handleStatsChange = (stats: { input: string; valid: boolean | null; error: string }) => {
		onStatsChange?.(stats);
	};

	// Output editor mode based on format
	const outputEditorMode = $derived(convertFormat === 'yaml' ? 'yaml' : 'xml');

	// Download filename
	const downloadFilename = $derived(`converted.${convertFormat}`);

	// Output title
	const outputTitle = $derived(`Output (${convertFormat.toUpperCase()})`);
</script>

<ConvertTab
	inputEditorMode="json"
	{outputEditorMode}
	{input}
	{onInputChange}
	placeholder="Enter JSON here..."
	{validate}
	{convert}
	onStatsChange={handleStatsChange}
	{downloadFilename}
	{copyToClipboard}
	{formatSection}
	{pasteFromClipboard}
	{downloadTextFile}
	{outputTitle}
>
	{#snippet options()}
		<FormSection title="Output Format">
			<FormMode
				bind:value={convertFormat}
				options={[
					{ value: 'yaml', label: 'YAML' },
					{ value: 'xml', label: 'XML' },
				]}
			/>
		</FormSection>

		{#if convertFormat === 'yaml'}
			<FormSection title="Formatting">
				<div class="grid grid-cols-2 gap-2">
					<FormSelect label="Indent" bind:value={yamlIndentStr} options={['2', '4', '8']} />
					<FormSelect
						label="Line Width"
						bind:value={yamlLineWidthStr}
						options={[
							{ value: '40', label: '40' },
							{ value: '80', label: '80' },
							{ value: '120', label: '120' },
							{ value: '0', label: '∞' },
						]}
					/>
				</div>
				<FormSelect
					label="Collection Style"
					bind:value={yamlCollectionStyle}
					options={[
						{ value: 'block', label: 'Block' },
						{ value: 'flow', label: 'Flow ({...})' },
						{ value: 'any', label: 'Auto' },
					]}
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Indent sequences" bind:checked={yamlIndentSeq} />
					<FormCheckbox label="Flow collection padding" bind:checked={yamlFlowCollectionPadding} />
				</div>
			</FormSection>

			<FormSection title="Strings">
				<FormSelect
					label="String Style"
					bind:value={yamlStringType}
					options={[
						{ value: 'PLAIN', label: 'Plain' },
						{ value: 'QUOTE_SINGLE', label: "Single Quote (')" },
						{ value: 'QUOTE_DOUBLE', label: 'Double Quote (")' },
						{ value: 'BLOCK_LITERAL', label: 'Block Literal (|)' },
						{ value: 'BLOCK_FOLDED', label: 'Block Folded (>)' },
					]}
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Force quotes on all strings" bind:checked={yamlForceQuotes} />
					<FormCheckbox label="Prefer single quotes" bind:checked={yamlSingleQuote} />
					<FormCheckbox label="Double-quoted as JSON style" bind:checked={yamlDoubleQuotedAsJSON} />
				</div>
			</FormSection>

			<FormSection title="Keys">
				<FormSelect
					label="Key Style"
					bind:value={yamlKeyType}
					options={[
						{ value: 'PLAIN', label: 'Plain' },
						{ value: 'QUOTE_SINGLE', label: "Single Quote (')" },
						{ value: 'QUOTE_DOUBLE', label: 'Double Quote (")' },
					]}
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Sort keys alphabetically" bind:checked={yamlSortKeys} />
				</div>
			</FormSection>

			<FormSection title="Special Values">
				<div class="grid grid-cols-3 gap-2">
					<FormInput
						label="Null"
						bind:value={yamlNullStr}
						placeholder="null"
						size="compact"
						class="font-mono"
					/>
					<FormInput
						label="True"
						bind:value={yamlTrueStr}
						placeholder="true"
						size="compact"
						class="font-mono"
					/>
					<FormInput
						label="False"
						bind:value={yamlFalseStr}
						placeholder="false"
						size="compact"
						class="font-mono"
					/>
				</div>
			</FormSection>

			<FormSection title="Advanced">
				<FormCheckbox label="Disable YAML references/aliases" bind:checked={yamlNoRefs} />
			</FormSection>
		{/if}

		{#if convertFormat === 'xml'}
			<FormSection title="Structure">
				<div class="grid grid-cols-2 gap-2">
					<FormInput
						label="Root Element"
						bind:value={xmlRootName}
						placeholder="root"
						size="compact"
					/>
					<FormInput
						label="Array Item"
						bind:value={xmlArrayItemName}
						placeholder="item"
						size="compact"
					/>
				</div>
				<FormInput
					label="Attribute Prefix"
					bind:value={xmlAttributePrefix}
					placeholder="@"
					size="compact"
					class="font-mono"
				/>
			</FormSection>

			<FormSection title="Formatting">
				<div class="grid grid-cols-2 gap-2">
					<FormSelect
						label="Indent"
						bind:value={xmlIndentStr}
						options={[
							{ value: '0', label: 'None' },
							{ value: '2', label: '2' },
							{ value: '4', label: '4' },
							{ value: '8', label: '8' },
						]}
					/>
					<FormSelect
						label="Indent Type"
						bind:value={xmlIndentType}
						options={[
							{ value: 'spaces', label: 'Spaces' },
							{ value: 'tabs', label: 'Tabs' },
						]}
					/>
				</div>
				<FormSelect
					label="Line Separator"
					bind:value={xmlLineSeparator}
					options={[
						{ value: '\n', label: 'LF (Unix)' },
						{ value: '\r\n', label: 'CRLF (Windows)' },
					]}
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Collapse content on single line" bind:checked={xmlCollapseContent} />
				</div>
			</FormSection>

			<FormSection title="Declaration">
				<FormCheckbox label="Include XML declaration" bind:checked={xmlDeclaration} />
				{#if xmlDeclaration}
					<div class="grid grid-cols-2 gap-2 pt-1">
						<FormInput
							label="Version"
							bind:value={xmlDeclarationVersion}
							placeholder="1.0"
							size="compact"
							class="font-mono"
						/>
						<FormInput
							label="Encoding"
							bind:value={xmlDeclarationEncoding}
							placeholder="UTF-8"
							size="compact"
							class="font-mono"
						/>
					</div>
				{/if}
			</FormSection>

			<FormSection title="Tags">
				<FormCheckbox label="Use self-closing tags" bind:checked={xmlSelfClosing} />
				<FormCheckbox
					label="Space before self-closing />"
					bind:checked={xmlWhiteSpaceAtEndOfSelfclosingTag}
				/>
			</FormSection>

			<FormSection title="Content">
				<FormCheckbox label="Wrap text in CDATA" bind:checked={xmlCdata} />
				{#if xmlCdata}
					<div class="pt-1">
						<FormInput
							label="CDATA Threshold (chars)"
							bind:value={xmlCdataThresholdStr}
							placeholder="0"
							size="compact"
							class="font-mono"
							hint="0 = always use CDATA"
						/>
					</div>
				{/if}
				<FormCheckbox label="Escape special characters" bind:checked={xmlEscapeText} />
			</FormSection>

			<FormSection title="Sorting">
				<FormCheckbox label="Sort element keys" bind:checked={xmlSortKeys} />
				<FormCheckbox label="Sort attributes" bind:checked={xmlSortAttributes} />
			</FormSection>

			<FormSection title="Comments">
				<FormInput
					label="Header Comment"
					bind:value={xmlHeaderComment}
					placeholder="Optional comment..."
					size="compact"
				/>
			</FormSection>
		{/if}
	{/snippet}
</ConvertTab>
