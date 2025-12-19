<script lang="ts">
	import { FormCheckbox } from '$lib/components/form';
	import { CompareTab } from '$lib/components/template';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { GenericDiffItem } from '$lib/constants/diff.js';
	import {
		findJsonDifferences,
		type JsonDiffOptions,
		type JsonInputFormat,
		validateJson,
	} from '$lib/services/formatters';
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

	// Types for line search state
	interface SearchState {
		found: number | null;
		pathStack: string[];
		currentArrayIndex: number;
	}

	/** Handle key match in JSON line */
	const handleKeyMatch = (
		key: string,
		line: string,
		lineNum: number,
		state: SearchState,
		targetPath: string
	): SearchState | null => {
		const currentPath = [...state.pathStack, key].join('.');
		if (currentPath === targetPath) return { ...state, found: lineNum };

		if (line.endsWith('{') || line.endsWith('[')) {
			return {
				...state,
				pathStack: [...state.pathStack, key],
				currentArrayIndex: line.endsWith('[') ? 0 : state.currentArrayIndex,
			};
		}
		return null;
	};

	/** Handle array element start */
	const handleArrayStart = (
		lineNum: number,
		state: SearchState,
		targetPath: string
	): SearchState => {
		const arrayPath = [...state.pathStack, String(state.currentArrayIndex)].join('.');
		if (arrayPath === targetPath) return { ...state, found: lineNum };
		return { ...state, currentArrayIndex: state.currentArrayIndex + 1 };
	};

	/** Handle closing bracket */
	const handleClosingBracket = (line: string, state: SearchState): SearchState => {
		const isArrayClose = line.startsWith(']') || line === '],';
		const isObjectClose = line.startsWith('}') || line === '},';

		if (isArrayClose) {
			return state.pathStack.length > 0
				? { ...state, pathStack: state.pathStack.slice(0, -1), currentArrayIndex: -1 }
				: { ...state, currentArrayIndex: -1 };
		}
		if (isObjectClose && state.pathStack.length > 0 && !line.includes('[')) {
			return { ...state, pathStack: state.pathStack.slice(0, -1) };
		}
		return state;
	};

	/** Process a single line in JSON search */
	const processSearchLine = (
		state: SearchState,
		line: string,
		lineNum: number,
		targetPath: string
	): SearchState => {
		if (state.found !== null) return state;

		const keyMatch = line.match(/^"([^"]+)"\s*:/);
		if (keyMatch?.[1] !== undefined) {
			const result = handleKeyMatch(keyMatch[1], line, lineNum, state, targetPath);
			if (result) return result;
		}

		if (line === '{' && state.currentArrayIndex >= 0) {
			return handleArrayStart(lineNum, state, targetPath);
		}

		return handleClosingBracket(line, state);
	};

	// Find line number for a JSON path in a JSON string
	const findLineForPath = (jsonStr: string, targetPath: string): number | null => {
		if (!jsonStr?.trim() || !targetPath) return null;

		const pathParts = targetPath
			.replace(/^\$\.?/, '')
			.split(/\.|\[/)
			.filter(Boolean);
		if (pathParts.length === 0) return 1;

		const targetPathNormalized = pathParts.map((p) => p.replace(/\]$/, '')).join('.');
		const lines = jsonStr.split('\n');
		const initialState: SearchState = { found: null, pathStack: [], currentArrayIndex: -1 };

		const result = lines.reduce<SearchState>(
			(acc, rawLine, i) =>
				rawLine === undefined
					? acc
					: processSearchLine(acc, rawLine.trim(), i + 1, targetPathNormalized),
			initialState
		);

		return result.found;
	};

	// Stats handler wrapper to include format
	const handleStatsChange = (stats: { input: string; valid: boolean | null; error: string }) => {
		onStatsChange?.({
			...stats,
			format: null,
		});
	};
</script>

<CompareTab
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
		<FormCheckbox label="Deep compare" bind:checked={compareDeepCompare} />
		<FormCheckbox label="Ignore whitespace" bind:checked={compareIgnoreWhitespace} />
		<FormCheckbox label="Ignore array order" bind:checked={compareIgnoreArrayOrder} />
	{/snippet}

	{#snippet advancedOptions()}
		<FormCheckbox label="Ignore case" bind:checked={compareIgnoreCase} />
		<FormCheckbox label="Ignore numeric type" bind:checked={compareIgnoreNumericType} />
		<FormCheckbox label="Ignore empty values" bind:checked={compareIgnoreEmpty} />
		<div class="space-y-1 pt-1">
			<Label class="text-[10px] uppercase tracking-wide text-muted-foreground">Ignore Keys</Label>
			<Input bind:value={compareIgnoreKeys} placeholder="key1, key2, key3" class="h-7 text-xs" />
			<span class="text-[10px] text-muted-foreground">Comma-separated list of keys to ignore</span>
		</div>
	{/snippet}
</CompareTab>
