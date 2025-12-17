<script lang="ts">
	
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import OptionSelect from '$lib/components/options/option-select.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import { ConvertTabBase } from '$lib/components/tool/index.js';
import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		type XmlToJsonOptions,
		type XmlToYamlOptions,
		xmlToJson,
		xmlToYaml,
	} from '$lib/services/formatters.js';
	import { copyToClipboard, downloadTextFile, pasteFromClipboard } from '../utils.js';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// Output format
	let convertFormat = $state<'json' | 'yaml'>('json');

	// JSON options
	let jsonIndentStr = $state('2');
	let jsonSortKeys = $state(false);

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

	// Derived values
	const jsonIndent = $derived(Number.parseInt(jsonIndentStr, 10) || 2);
	const yamlIndent = $derived(Number.parseInt(yamlIndentStr, 10) || 2);
	const yamlLineWidth = $derived(Number.parseInt(yamlLineWidthStr, 10) || 80);
	const yamlMinContentWidth = $derived(Number.parseInt(yamlMinContentWidthStr, 10) || 20);

	// JSON options object
	const jsonOptions = $derived<XmlToJsonOptions>({
		indent: jsonIndent,
		sortKeys: jsonSortKeys,
	});

	// YAML options object
	const yamlOptions = $derived<XmlToYamlOptions>({
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

	// Conversion function
	const convert = (input: string) => {
		try {
			const output =
				convertFormat === 'json' ? xmlToJson(input, jsonOptions) : xmlToYaml(input, yamlOptions);
			return { output, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
		}
	};

	// Output editor mode based on format
	const outputEditorMode = $derived(convertFormat === 'json' ? 'json' : 'yaml');
	const downloadFilename = $derived(`converted.${convertFormat}`);
	const outputTitle = $derived(`Output (${convertFormat.toUpperCase()})`);
</script>

<ConvertTabBase
	inputEditorMode="xml"
	{outputEditorMode}
	{input}
	{onInputChange}
	placeholder="Enter XML here..."
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
					variant={convertFormat === 'yaml' ? 'secondary' : 'ghost'}
					size="sm"
					class="h-7 flex-1 text-xs"
					onclick={() => (convertFormat = 'yaml')}
				>
					YAML
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
	{/snippet}
</ConvertTabBase>
