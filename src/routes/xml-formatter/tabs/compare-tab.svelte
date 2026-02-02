<script lang="ts">
	import { FormCheckbox } from '$lib/components/form';
	import { CompareTab } from '$lib/components/template';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { GenericDiffItem } from '$lib/constants/diff.js';
	import { findXmlDifferences, parseXml, type XmlDiffOptions } from '$lib/services/xml-diff.js';
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

<CompareTab
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
		<FormCheckbox label="Ignore whitespace" bind:checked={compareIgnoreWhitespace} />
		<FormCheckbox label="Ignore comments" bind:checked={compareIgnoreComments} />
	{/snippet}

	{#snippet advancedOptions()}
		<FormCheckbox label="Ignore case" bind:checked={compareIgnoreCase} />
		<FormCheckbox label="Ignore namespaces" bind:checked={compareIgnoreNamespaces} />
		<div class="space-y-1 pt-1">
			<Label class="text-2xs uppercase tracking-wide text-muted-foreground">Ignore Attributes</Label
			>
			<Input
				bind:value={compareIgnoreAttributes}
				placeholder="attr1, attr2, attr3"
				class="h-7 text-xs"
			/>
			<span class="text-2xs text-muted-foreground"
				>Comma-separated list of attributes to ignore</span
			>
		</div>
	{/snippet}
</CompareTab>
