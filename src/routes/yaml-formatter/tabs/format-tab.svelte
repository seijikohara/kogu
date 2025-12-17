<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import OptionSelect from '$lib/components/options/option-select.svelte';
	import { FormatTabBase } from '$lib/components/tool/index.js';
	import { sortKeysDeep, validateYaml, SAMPLE_YAML } from '$lib/services/formatters.js';
	import { downloadTextFile, copyToClipboard, pasteFromClipboard } from '../utils.js';
	import * as yaml from 'yaml';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// Basic formatting options
	let indentSizeStr = $state('2');
	let lineWidthStr = $state('80');
	let minContentWidthStr = $state('20');

	// String handling options
	let stringType = $state<
		'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE' | 'BLOCK_LITERAL' | 'BLOCK_FOLDED'
	>('PLAIN');
	let singleQuote = $state(false);
	let forceQuotes = $state(false);
	let doubleQuotedAsJSON = $state(false);

	// Collection style options
	let collectionStyle = $state<'any' | 'block' | 'flow'>('block');
	let flowCollectionPadding = $state(false);
	let indentSeq = $state(true);

	// Key handling options
	let keyType = $state<'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE'>('PLAIN');
	let sortKeys = $state(false);

	// Reference handling
	let noRefs = $state(true);

	// Null/Boolean formatting
	let nullStr = $state('null');
	let trueStr = $state('true');
	let falseStr = $state('false');

	// Derived numeric values
	const indentSize = $derived(parseInt(indentSizeStr) || 2);
	const lineWidth = $derived(parseInt(lineWidthStr) || 80);
	const minContentWidth = $derived(parseInt(minContentWidthStr) || 20);

	// Validation function - rejects JSON input
	const validate = (input: string) => {
		if (!input.trim()) return { valid: null as boolean | null };
		const result = validateYaml(input);
		return { valid: result.valid };
	};

	// Format function
	const format = (input: string, minify: boolean) => {
		// Validate first - reject JSON input
		const validation = validateYaml(input);
		if (!validation.valid) {
			return { output: '', error: validation.error ?? 'Invalid YAML' };
		}

		try {
			if (minify) {
				return { output: yaml.stringify(yaml.parse(input), { indent: 0 }), error: '' };
			}

			const parsed = yaml.parse(input);
			const data = sortKeys ? sortKeysDeep(parsed) : parsed;

			// Determine string type
			const defaultStringType = singleQuote
				? 'QUOTE_SINGLE'
				: forceQuotes && stringType === 'PLAIN'
					? 'QUOTE_DOUBLE'
					: stringType;

			const output = yaml.stringify(data, {
				indent: indentSize,
				lineWidth: lineWidth === 0 ? 0 : lineWidth,
				minContentWidth,
				defaultStringType,
				doubleQuotedAsJSON,
				collectionStyle,
				flowCollectionPadding,
				indentSeq,
				defaultKeyType: keyType,
				aliasDuplicateObjects: !noRefs,
				nullStr,
				trueStr,
				falseStr,
			});

			return { output, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid YAML' };
		}
	};
</script>

<FormatTabBase
	editorMode="yaml"
	{input}
	{onInputChange}
	placeholder="Enter YAML here..."
	{validate}
	{format}
	{onStatsChange}
	downloadFilename="formatted.yaml"
	sampleData={SAMPLE_YAML}
	{copyToClipboard}
	{pasteFromClipboard}
	{downloadTextFile}
>
	{#snippet options()}
		<OptionsSection title="Formatting">
			<div class="grid grid-cols-2 gap-2">
				<OptionSelect label="Indent" bind:value={indentSizeStr} options={['2', '4', '8']} />
				<OptionSelect
					label="Line Width"
					bind:value={lineWidthStr}
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
				bind:value={collectionStyle}
				options={[
					{ value: 'block', label: 'Block' },
					{ value: 'flow', label: 'Flow ({...})' },
					{ value: 'any', label: 'Auto' },
				]}
			/>
			<div class="space-y-1.5 pt-1">
				<OptionCheckbox label="Indent sequences" bind:checked={indentSeq} />
				<OptionCheckbox label="Flow collection padding" bind:checked={flowCollectionPadding} />
			</div>
		</OptionsSection>

		<OptionsSection title="Strings">
			<OptionSelect
				label="String Style"
				bind:value={stringType}
				options={[
					{ value: 'PLAIN', label: 'Plain' },
					{ value: 'QUOTE_SINGLE', label: "Single Quote (')" },
					{ value: 'QUOTE_DOUBLE', label: 'Double Quote (")' },
					{ value: 'BLOCK_LITERAL', label: 'Block Literal (|)' },
					{ value: 'BLOCK_FOLDED', label: 'Block Folded (>)' },
				]}
			/>
			<div class="space-y-1.5 pt-1">
				<OptionCheckbox label="Force quotes on all strings" bind:checked={forceQuotes} />
				<OptionCheckbox label="Prefer single quotes" bind:checked={singleQuote} />
				<OptionCheckbox label="Double-quoted as JSON style" bind:checked={doubleQuotedAsJSON} />
			</div>
		</OptionsSection>

		<OptionsSection title="Keys">
			<OptionSelect
				label="Key Style"
				bind:value={keyType}
				options={[
					{ value: 'PLAIN', label: 'Plain' },
					{ value: 'QUOTE_SINGLE', label: "Single Quote (')" },
					{ value: 'QUOTE_DOUBLE', label: 'Double Quote (")' },
				]}
			/>
			<div class="space-y-1.5 pt-1">
				<OptionCheckbox label="Sort keys alphabetically" bind:checked={sortKeys} />
			</div>
		</OptionsSection>

		<OptionsSection title="Special Values">
			<div class="grid grid-cols-3 gap-2">
				<div class="space-y-1">
					<Label class="text-[10px] uppercase tracking-wide text-muted-foreground">Null</Label>
					<Input bind:value={nullStr} placeholder="null" class="h-7 text-xs font-mono" />
				</div>
				<div class="space-y-1">
					<Label class="text-[10px] uppercase tracking-wide text-muted-foreground">True</Label>
					<Input bind:value={trueStr} placeholder="true" class="h-7 text-xs font-mono" />
				</div>
				<div class="space-y-1">
					<Label class="text-[10px] uppercase tracking-wide text-muted-foreground">False</Label>
					<Input bind:value={falseStr} placeholder="false" class="h-7 text-xs font-mono" />
				</div>
			</div>
		</OptionsSection>

		<OptionsSection title="Advanced">
			<OptionCheckbox label="Disable YAML references/aliases" bind:checked={noRefs} />
		</OptionsSection>
	{/snippet}
</FormatTabBase>
