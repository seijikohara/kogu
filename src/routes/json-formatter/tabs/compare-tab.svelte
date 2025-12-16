<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import { CompareTabBase } from '$lib/components/tool/index.js';
	import {
		findJsonDifferences,
		validateJson,
		type JsonInputFormat,
		type JsonDiffOptions,
	} from '$lib/services/formatters.js';
	import type { GenericDiffItem } from '$lib/constants/diff.js';
	import { pasteFromClipboard } from '../utils.js';

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

	// Options state
	let compareIgnoreWhitespace = $state(false);
	let compareIgnoreArrayOrder = $state(false);
	let compareIgnoreCase = $state(false);
	let compareIgnoreNumericType = $state(false);
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
	const diffOptions = $derived<JsonDiffOptions>({
		ignoreCase: compareIgnoreCase,
		ignoreWhitespace: compareIgnoreWhitespace,
		ignoreArrayOrder: compareIgnoreArrayOrder,
		ignoreNumericType: compareIgnoreNumericType,
		ignoreEmpty: compareIgnoreEmpty,
		deepCompare: compareDeepCompare,
		ignoreKeys: ignoredKeysList,
	});

	// Validation function
	const validate = (input: string) => {
		if (!input.trim()) return { valid: null as boolean | null };
		const result = validateJson(input);
		return { valid: result.valid };
	};

	// Compare function
	const compare = (input1: string, input2: string): GenericDiffItem[] => {
		return findJsonDifferences(input1, input2, diffOptions);
	};

	// Find line number for a JSON path in a JSON string
	const findLineForPath = (jsonStr: string, targetPath: string): number | null => {
		if (!jsonStr?.trim() || !targetPath) return null;

		const lines = jsonStr.split('\n');
		const pathParts = targetPath
			.replace(/^\$\.?/, '')
			.split(/\.|\[/)
			.filter(Boolean);

		if (pathParts.length === 0) return 1;

		const targetPathNormalized = pathParts.map((p) => p.replace(/\]$/, '')).join('.');

		interface ParseState {
			pathStack: string[];
			currentArrayIndex: number;
			foundLine: number | null;
		}

		const result = lines.reduce<ParseState>(
			(acc, rawLine, i) => {
				if (acc.foundLine !== null) return acc;

				const line = rawLine.trim();
				const lineNum = i + 1;

				const keyMatch = line.match(/^"([^"]+)"\s*:/);
				if (keyMatch) {
					const key = keyMatch[1];
					const currentPath = [...acc.pathStack, key].join('.');

					if (currentPath === targetPathNormalized) {
						return { ...acc, foundLine: lineNum };
					}

					if (line.endsWith('{') || line.endsWith('[')) {
						const newStack = [...acc.pathStack, key];
						const newArrayIndex = line.endsWith('[') ? 0 : acc.currentArrayIndex;
						return { ...acc, pathStack: newStack, currentArrayIndex: newArrayIndex };
					}
				}

				if (line === '{' && acc.currentArrayIndex >= 0) {
					const arrayPath = [...acc.pathStack, `${acc.currentArrayIndex}]`].join('.');
					if (arrayPath.replace(/\]$/, '') === targetPathNormalized) {
						return { ...acc, foundLine: lineNum };
					}
					return { ...acc, currentArrayIndex: acc.currentArrayIndex + 1 };
				}

				if (line.startsWith('}') || line === '},') {
					if (acc.pathStack.length > 0 && !line.includes('[')) {
						return { ...acc, pathStack: acc.pathStack.slice(0, -1) };
					}
				}
				if (line.startsWith(']') || line === '],') {
					const newStack = acc.pathStack.length > 0 ? acc.pathStack.slice(0, -1) : acc.pathStack;
					return { ...acc, currentArrayIndex: -1, pathStack: newStack };
				}

				return acc;
			},
			{ pathStack: [], currentArrayIndex: -1, foundLine: null }
		);

		return result.foundLine;
	};

	// Stats handler wrapper to include format
	const handleStatsChange = (stats: { input: string; valid: boolean | null; error: string }) => {
		onStatsChange?.({
			...stats,
			format: null,
		});
	};
</script>

<CompareTabBase
	editorMode="json"
	{input}
	{onInputChange}
	placeholder1="Original JSON..."
	placeholder2="Modified JSON..."
	{validate}
	{compare}
	onStatsChange={handleStatsChange}
	{findLineForPath}
	{pasteFromClipboard}
>
	{#snippet comparisonOptions()}
		<OptionCheckbox label="Deep compare" bind:checked={compareDeepCompare} />
		<OptionCheckbox label="Ignore whitespace" bind:checked={compareIgnoreWhitespace} />
		<OptionCheckbox label="Ignore array order" bind:checked={compareIgnoreArrayOrder} />
	{/snippet}

	{#snippet advancedOptions()}
		<OptionCheckbox label="Ignore case" bind:checked={compareIgnoreCase} />
		<OptionCheckbox label="Ignore numeric type" bind:checked={compareIgnoreNumericType} />
		<OptionCheckbox label="Ignore empty values" bind:checked={compareIgnoreEmpty} />
		<div class="space-y-1 pt-1">
			<Label class="text-[10px] uppercase tracking-wide text-muted-foreground">Ignore Keys</Label>
			<Input bind:value={compareIgnoreKeys} placeholder="key1, key2, key3" class="h-7 text-xs" />
			<span class="text-[10px] text-muted-foreground">Comma-separated list of keys to ignore</span>
		</div>
	{/snippet}
</CompareTabBase>
