<script lang="ts">
	
	import * as yaml from 'yaml';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import OptionSelect from '$lib/components/options/option-select.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import { ConvertTabBase } from '$lib/components/tool/index.js';
import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		type YamlToJsonOptions,
		type YamlToXmlOptions,
		yamlToJson,
		yamlToXml,
	} from '$lib/services/formatters.js';
	import { copyToClipboard, downloadTextFile, pasteFromClipboard } from '../utils.js';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// Output format
	let convertFormat = $state<'json' | 'xml'>('json');

	// JSON options
	let jsonIndentStr = $state('2');
	let jsonSortKeys = $state(false);

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
	const jsonIndent = $derived(Number.parseInt(jsonIndentStr, 10) || 2);
	const xmlIndent = $derived(Number.parseInt(xmlIndentStr, 10) || 2);
	const xmlCdataThreshold = $derived(Number.parseInt(xmlCdataThresholdStr, 10) || 0);

	// JSON options object
	const jsonOptions = $derived<YamlToJsonOptions>({
		indent: jsonIndent,
		sortKeys: jsonSortKeys,
	});

	// XML options object
	const xmlOptions = $derived<YamlToXmlOptions>({
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
		try {
			yaml.parse(input);
			return { valid: true };
		} catch {
			return { valid: false };
		}
	};

	// Conversion function
	const convert = (input: string) => {
		try {
			const output =
				convertFormat === 'json' ? yamlToJson(input, jsonOptions) : yamlToXml(input, xmlOptions);
			return { output, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
		}
	};

	// Output editor mode based on format
	const outputEditorMode = $derived(convertFormat === 'json' ? 'json' : 'xml');
	const downloadFilename = $derived(`converted.${convertFormat}`);
	const outputTitle = $derived(`Output (${convertFormat.toUpperCase()})`);
</script>

<ConvertTabBase
	inputEditorMode="yaml"
	{outputEditorMode}
	{input}
	{onInputChange}
	placeholder="Enter YAML here..."
	{validate}
	{convert}
	{onStatsChange}
	{downloadFilename}
	{outputTitle}
	{copyToClipboard}
	{pasteFromClipboard}
	{downloadTextFile}
>
	{#snippet options()}
		<OptionsSection title="Output Format">
			<div class="flex gap-1">
				<Button
					variant={convertFormat === 'json' ? 'secondary' : 'ghost'}
					size="sm"
					class="h-7 flex-1 text-xs"
					onclick={() => (convertFormat = 'json')}
				>
					JSON
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

		{#if convertFormat === 'json'}
			<OptionsSection title="Formatting">
				<OptionSelect
					label="Indent"
					bind:value={jsonIndentStr}
					options={[
						{ value: '0', label: 'None' },
						{ value: '2', label: '2' },
						{ value: '4', label: '4' },
						{ value: '8', label: '8' },
					]}
				/>
			</OptionsSection>

			<OptionsSection title="Keys">
				<OptionCheckbox label="Sort keys alphabetically" bind:checked={jsonSortKeys} />
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
