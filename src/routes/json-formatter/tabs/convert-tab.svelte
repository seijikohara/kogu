<script lang="ts">
	
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import OptionSelect from '$lib/components/options/option-select.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import { ConvertTabBase } from '$lib/components/tool/index.js';
import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		type JsonInputFormat,
		type JsonToXmlOptions,
		type JsonToYamlOptions,
		jsonToXml,
		jsonToYaml,
		validateJson,
	} from '$lib/services/formatters.js';
	import { copyToClipboard, downloadTextFile, pasteFromClipboard } from '../utils.js';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: {
			input: string;
			valid: boolean | null;
			error: string;
			format: JsonInputFormat | null;
		}) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

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
		if (!input.trim())
			return { valid: null as boolean | null, format: null as JsonInputFormat | null };
		const result = validateJson(input);
		return { valid: result.valid, format: result.detectedFormat };
	};

	// Convert function
	const convert = (input: string) => {
		try {
			const output =
				convertFormat === 'yaml' ? jsonToYaml(input, yamlOptions) : jsonToXml(input, xmlOptions);
			return { output, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
		}
	};

	// Stats handler wrapper to include format
	const handleStatsChange = (stats: {
		input: string;
		valid: boolean | null;
		error: string;
		format?: JsonInputFormat | null;
	}) => {
		onStatsChange?.({
			...stats,
			format: stats.format ?? null,
		});
	};

	// Output editor mode based on format
	const outputEditorMode = $derived(convertFormat === 'yaml' ? 'yaml' : 'xml');

	// Download filename
	const downloadFilename = $derived(`converted.${convertFormat}`);

	// Output title
	const outputTitle = $derived(`Output (${convertFormat.toUpperCase()})`);
</script>

<ConvertTabBase
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
	{pasteFromClipboard}
	{downloadTextFile}
	{outputTitle}
>
	{#snippet options()}
		<OptionsSection title="Output Format">
			<div class="flex gap-1">
				<Button
					variant={convertFormat === 'yaml' ? 'secondary' : 'ghost'}
					size="sm"
					class="h-7 flex-1 text-xs"
					onclick={() => (convertFormat = 'yaml')}
				>
					YAML
				</Button>
				<Button
					variant={convertFormat === 'xml' ? 'secondary' : 'ghost'}
					size="sm"
					class="h-7 flex-1 text-xs"
					onclick={() => (convertFormat = 'xml')}
				>
					XML
				</Button>
			</div>
		</OptionsSection>

		{#if convertFormat === 'yaml'}
			<OptionsSection title="Formatting">
				<div class="grid grid-cols-2 gap-2">
					<OptionSelect label="Indent" bind:value={yamlIndentStr} options={['2', '4', '8']} />
					<OptionSelect
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
				<OptionSelect
					label="Collection Style"
					bind:value={yamlCollectionStyle}
					options={[
						{ value: 'block', label: 'Block' },
						{ value: 'flow', label: 'Flow ({...})' },
						{ value: 'any', label: 'Auto' },
					]}
				/>
				<div class="space-y-1.5 pt-1">
					<OptionCheckbox label="Indent sequences" bind:checked={yamlIndentSeq} />
					<OptionCheckbox
						label="Flow collection padding"
						bind:checked={yamlFlowCollectionPadding}
					/>
				</div>
			</OptionsSection>

			<OptionsSection title="Strings">
				<OptionSelect
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
					<OptionCheckbox label="Force quotes on all strings" bind:checked={yamlForceQuotes} />
					<OptionCheckbox label="Prefer single quotes" bind:checked={yamlSingleQuote} />
					<OptionCheckbox
						label="Double-quoted as JSON style"
						bind:checked={yamlDoubleQuotedAsJSON}
					/>
				</div>
			</OptionsSection>

			<OptionsSection title="Keys">
				<OptionSelect
					label="Key Style"
					bind:value={yamlKeyType}
					options={[
						{ value: 'PLAIN', label: 'Plain' },
						{ value: 'QUOTE_SINGLE', label: "Single Quote (')" },
						{ value: 'QUOTE_DOUBLE', label: 'Double Quote (")' },
					]}
				/>
				<div class="space-y-1.5 pt-1">
					<OptionCheckbox label="Sort keys alphabetically" bind:checked={yamlSortKeys} />
				</div>
			</OptionsSection>

			<OptionsSection title="Special Values">
				<div class="grid grid-cols-3 gap-2">
					<div class="space-y-1">
						<Label class="text-[10px] uppercase tracking-wide text-muted-foreground">Null</Label>
						<Input bind:value={yamlNullStr} placeholder="null" class="h-7 text-xs font-mono" />
					</div>
					<div class="space-y-1">
						<Label class="text-[10px] uppercase tracking-wide text-muted-foreground">True</Label>
						<Input bind:value={yamlTrueStr} placeholder="true" class="h-7 text-xs font-mono" />
					</div>
					<div class="space-y-1">
						<Label class="text-[10px] uppercase tracking-wide text-muted-foreground">False</Label>
						<Input bind:value={yamlFalseStr} placeholder="false" class="h-7 text-xs font-mono" />
					</div>
				</div>
			</OptionsSection>

			<OptionsSection title="Advanced">
				<OptionCheckbox label="Disable YAML references/aliases" bind:checked={yamlNoRefs} />
			</OptionsSection>
		{/if}

		{#if convertFormat === 'xml'}
			<OptionsSection title="Structure">
				<div class="grid grid-cols-2 gap-2">
					<div class="space-y-1">
						<Label class="text-[10px] uppercase tracking-wide text-muted-foreground"
							>Root Element</Label
						>
						<Input bind:value={xmlRootName} placeholder="root" class="h-7 text-xs" />
					</div>
					<div class="space-y-1">
						<Label class="text-[10px] uppercase tracking-wide text-muted-foreground"
							>Array Item</Label
						>
						<Input bind:value={xmlArrayItemName} placeholder="item" class="h-7 text-xs" />
					</div>
				</div>
				<div class="space-y-1">
					<Label class="text-[10px] uppercase tracking-wide text-muted-foreground"
						>Attribute Prefix</Label
					>
					<Input bind:value={xmlAttributePrefix} placeholder="@" class="h-7 text-xs font-mono" />
				</div>
			</OptionsSection>

			<OptionsSection title="Formatting">
				<div class="grid grid-cols-2 gap-2">
					<OptionSelect
						label="Indent"
						bind:value={xmlIndentStr}
						options={[
							{ value: '0', label: 'None' },
							{ value: '2', label: '2' },
							{ value: '4', label: '4' },
							{ value: '8', label: '8' },
						]}
					/>
					<OptionSelect
						label="Indent Type"
						bind:value={xmlIndentType}
						options={[
							{ value: 'spaces', label: 'Spaces' },
							{ value: 'tabs', label: 'Tabs' },
						]}
					/>
				</div>
				<OptionSelect
					label="Line Separator"
					bind:value={xmlLineSeparator}
					options={[
						{ value: '\n', label: 'LF (Unix)' },
						{ value: '\r\n', label: 'CRLF (Windows)' },
					]}
				/>
				<div class="space-y-1.5 pt-1">
					<OptionCheckbox
						label="Collapse content on single line"
						bind:checked={xmlCollapseContent}
					/>
				</div>
			</OptionsSection>

			<OptionsSection title="Declaration">
				<OptionCheckbox label="Include XML declaration" bind:checked={xmlDeclaration} />
				{#if xmlDeclaration}
					<div class="grid grid-cols-2 gap-2 pt-1">
						<div class="space-y-1">
							<Label class="text-[10px] uppercase tracking-wide text-muted-foreground"
								>Version</Label
							>
							<Input
								bind:value={xmlDeclarationVersion}
								placeholder="1.0"
								class="h-7 text-xs font-mono"
							/>
						</div>
						<div class="space-y-1">
							<Label class="text-[10px] uppercase tracking-wide text-muted-foreground"
								>Encoding</Label
							>
							<Input
								bind:value={xmlDeclarationEncoding}
								placeholder="UTF-8"
								class="h-7 text-xs font-mono"
							/>
						</div>
					</div>
				{/if}
			</OptionsSection>

			<OptionsSection title="Tags">
				<OptionCheckbox label="Use self-closing tags" bind:checked={xmlSelfClosing} />
				<OptionCheckbox
					label="Space before self-closing />"
					bind:checked={xmlWhiteSpaceAtEndOfSelfclosingTag}
				/>
			</OptionsSection>

			<OptionsSection title="Content">
				<OptionCheckbox label="Wrap text in CDATA" bind:checked={xmlCdata} />
				{#if xmlCdata}
					<div class="space-y-1 pt-1">
						<Label class="text-[10px] uppercase tracking-wide text-muted-foreground"
							>CDATA Threshold (chars)</Label
						>
						<Input
							bind:value={xmlCdataThresholdStr}
							placeholder="0"
							class="h-7 text-xs font-mono"
						/>
						<span class="text-[10px] text-muted-foreground">0 = always use CDATA</span>
					</div>
				{/if}
				<OptionCheckbox label="Escape special characters" bind:checked={xmlEscapeText} />
			</OptionsSection>

			<OptionsSection title="Sorting">
				<OptionCheckbox label="Sort element keys" bind:checked={xmlSortKeys} />
				<OptionCheckbox label="Sort attributes" bind:checked={xmlSortAttributes} />
			</OptionsSection>

			<OptionsSection title="Comments">
				<div class="space-y-1">
					<Label class="text-[10px] uppercase tracking-wide text-muted-foreground"
						>Header Comment</Label
					>
					<Input
						bind:value={xmlHeaderComment}
						placeholder="Optional comment..."
						class="h-7 text-xs"
					/>
				</div>
			</OptionsSection>
		{/if}
	{/snippet}
</ConvertTabBase>
