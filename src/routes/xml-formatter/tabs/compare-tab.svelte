<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import { CompareTabBase } from '$lib/components/tool/index.js';
	import { parseXml, findXmlDifferences, type XmlDiffOptions } from '$lib/services/xml-diff.js';
	import type { GenericDiffItem } from '$lib/constants/diff.js';
	import { pasteFromClipboard } from '../utils.js';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// Options state
	let compareIgnoreWhitespace = $state(true);
	let compareIgnoreComments = $state(false);
	let compareIgnoreCase = $state(false);
	let compareIgnoreNamespaces = $state(false);
	let compareIgnoreAttributes = $state('');

	// Parse ignored attributes from comma-separated string
	const ignoredAttributesList = $derived(
		compareIgnoreAttributes
			.split(',')
			.map((a) => a.trim())
			.filter(Boolean)
	);

	// Diff options object
	const diffOptions = $derived<XmlDiffOptions>({
		ignoreWhitespace: compareIgnoreWhitespace,
		ignoreComments: compareIgnoreComments,
		ignoreCase: compareIgnoreCase,
		ignoreNamespaces: compareIgnoreNamespaces,
		ignoreAttributes: ignoredAttributesList,
	});

	// Validation function
	const validate = (input: string) => {
		if (!input.trim()) return { valid: null as boolean | null };
		return { valid: parseXml(input) !== null };
	};

	// Compare function
	const compare = (input1: string, input2: string): GenericDiffItem[] => {
		return findXmlDifferences(input1, input2, diffOptions);
	};
</script>

<CompareTabBase
	editorMode="xml"
	{input}
	{onInputChange}
	placeholder1="Original XML..."
	placeholder2="Modified XML..."
	{validate}
	{compare}
	{onStatsChange}
	{pasteFromClipboard}
>
	{#snippet comparisonOptions()}
		<OptionCheckbox label="Ignore whitespace" bind:checked={compareIgnoreWhitespace} />
		<OptionCheckbox label="Ignore comments" bind:checked={compareIgnoreComments} />
	{/snippet}

	{#snippet advancedOptions()}
		<OptionCheckbox label="Ignore case" bind:checked={compareIgnoreCase} />
		<OptionCheckbox label="Ignore namespaces" bind:checked={compareIgnoreNamespaces} />
		<div class="space-y-1 pt-1">
			<Label class="text-[10px] uppercase tracking-wide text-muted-foreground"
				>Ignore Attributes</Label
			>
			<Input
				bind:value={compareIgnoreAttributes}
				placeholder="attr1, attr2, attr3"
				class="h-7 text-xs"
			/>
			<span class="text-[10px] text-muted-foreground"
				>Comma-separated list of attributes to ignore</span
			>
		</div>
	{/snippet}
</CompareTabBase>
