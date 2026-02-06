<script lang="ts">
	import * as yaml from 'yaml';
	import { FormCheckbox } from '$lib/components/form';
	import { CompareTab } from '$lib/components/template';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { GenericDiffItem } from '$lib/constants/diff.js';
	import { findYamlDifferences, type YamlDiffOptions } from '$lib/services/yaml-diff.js';
	import { pasteFromClipboard } from '../utils.js';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// Options state
	let compareIgnoreWhitespace = $state(false);
	let compareIgnoreArrayOrder = $state(false);
	let compareIgnoreCase = $state(false);
	let compareIgnoreEmpty = $state(false);
	let compareDeepCompare = $state(true);
	let compareIgnoreKeys = $state('');

	// Parse ignored keys from comma-separated string
	const ignoredKeysList = $derived(
		compareIgnoreKeys
			.split(',')
			.map((k) => k.trim())
			.filter(Boolean)
	);

	// Diff options object
	const diffOptions = $derived<YamlDiffOptions>({
		ignoreWhitespace: compareIgnoreWhitespace,
		ignoreArrayOrder: compareIgnoreArrayOrder,
		ignoreCase: compareIgnoreCase,
		ignoreEmpty: compareIgnoreEmpty,
		deepCompare: compareDeepCompare,
		ignoreKeys: ignoredKeysList,
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

	// Compare function
	const compare = (input1: string, input2: string): GenericDiffItem[] => {
		return findYamlDifferences(input1, input2, diffOptions);
	};
</script>

<CompareTab
	editorMode="yaml"
	{input}
	{onInputChange}
	placeholder1="Original YAML..."
	placeholder2="Modified YAML..."
	{validate}
	{compare}
	{onStatsChange}
	{pasteFromClipboard}
>
	{#snippet comparisonOptions()}
		<FormCheckbox label="Deep compare" bind:checked={compareDeepCompare} />
		<FormCheckbox label="Ignore whitespace" bind:checked={compareIgnoreWhitespace} />
		<FormCheckbox label="Ignore array order" bind:checked={compareIgnoreArrayOrder} />
	{/snippet}

	{#snippet advancedOptions()}
		<FormCheckbox label="Ignore case" bind:checked={compareIgnoreCase} />
		<FormCheckbox label="Ignore empty values" bind:checked={compareIgnoreEmpty} />
		<div class="space-y-1 pt-1">
			<Label class="text-xs uppercase tracking-wide text-muted-foreground">Ignore Keys</Label>
			<Input bind:value={compareIgnoreKeys} placeholder="key1, key2, key3" class="h-7 text-xs" />
			<span class="text-xs text-muted-foreground">Comma-separated list of keys to ignore</span>
		</div>
	{/snippet}
</CompareTab>
