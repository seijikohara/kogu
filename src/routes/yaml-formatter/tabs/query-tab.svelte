<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import OptionsPanel from '$lib/components/options/options-panel.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import OptionSelect from '$lib/components/options/option-select.svelte';
	import SplitPane from '$lib/components/layout/split-pane.svelte';
	import { EditorPane } from '$lib/components/tool/index.js';
	import { executeJsonPath } from '$lib/services/formatters.js';
	import { downloadTextFile, copyToClipboard, pasteFromClipboard } from '../utils.js';
	import * as yaml from 'yaml';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// State
	let queryPath = $state('$.');
	let showOptions = $state(true);

	// Options
	let queryOutputFormat = $state<'yaml' | 'json'>('yaml');
	let queryFirstMatchOnly = $state(false);
	let queryMaxResultsStr = $state('0');
	let queryShowPaths = $state(false);
	let queryFlattenArrays = $state(false);
	let queryWrapResults = $state(true);

	// Validation
	const inputValidation = $derived.by(() => {
		if (!input.trim()) return { valid: null as boolean | null };
		try {
			yaml.parse(input);
			return { valid: true };
		} catch {
			return { valid: false };
		}
	});

	// Derived numeric values
	const queryMaxResults = $derived(parseInt(queryMaxResultsStr) || 0);

	// Query result
	const queryResultData = $derived.by(() => {
		if (!input.trim() || queryPath.trim() === '' || queryPath.trim() === '$.') {
			return { result: '', error: '' };
		}
		try {
			// Parse YAML to JSON for JSONPath query
			const yamlData = yaml.parse(input);
			const jsonInput = JSON.stringify(yamlData);

			let result: unknown = executeJsonPath(jsonInput, queryPath);

			// Apply options for array results
			if (Array.isArray(result)) {
				let arr = result as unknown[];

				// Flatten nested arrays if enabled
				if (queryFlattenArrays) {
					arr = arr.flat(Infinity);
				}

				// First match only
				if (queryFirstMatchOnly && arr.length > 0) {
					result = arr[0];
				} else {
					// Apply max results limit
					if (queryMaxResults > 0) {
						arr = arr.slice(0, queryMaxResults);
					}

					// Unwrap single-element arrays if wrap is disabled
					if (!queryWrapResults && arr.length === 1) {
						result = arr[0];
					} else {
						result = arr;
					}
				}
			}

			// Show paths in results
			if (queryShowPaths && result !== undefined) {
				result = { path: queryPath, value: result };
			}

			// Format output
			if (queryOutputFormat === 'yaml') {
				return { result: yaml.stringify(result, { indent: 2 }), error: '' };
			} else {
				return { result: JSON.stringify(result, null, 2), error: '' };
			}
		} catch (e) {
			return { result: '', error: e instanceof Error ? e.message : 'Query failed' };
		}
	});

	const queryResult = $derived(queryResultData.result);
	const queryError = $derived(queryResultData.error);

	// Report stats to parent
	$effect(() => {
		onStatsChange?.({
			input,
			valid: inputValidation.valid,
			error: queryError,
		});
	});

	// Handlers
	const handlePaste = async () => {
		const text = await pasteFromClipboard();
		if (text) onInputChange(text);
	};

	const handleClear = () => {
		onInputChange('');
		queryPath = '$.';
	};

	const handleCopyResult = () => copyToClipboard(queryResult);

	const handleDownload = () => {
		const ext = queryOutputFormat === 'yaml' ? 'yaml' : 'json';
		downloadTextFile(queryResult, `query-result.${ext}`);
	};
</script>

<div class="flex flex-1 overflow-hidden">
	<OptionsPanel
		show={showOptions}
		onclose={() => (showOptions = false)}
		onopen={() => (showOptions = true)}
	>
		<OptionsSection title="JSONPath Query">
			<div class="space-y-1">
				<Label class="text-[10px] uppercase tracking-wide text-muted-foreground"
					>Path Expression</Label
				>
				<Input bind:value={queryPath} placeholder="$.path.to.value" class="h-7 font-mono text-xs" />
			</div>
		</OptionsSection>

		<OptionsSection title="Output">
			<div class="grid grid-cols-2 gap-2">
				<OptionSelect
					label="Format"
					bind:value={queryOutputFormat}
					options={[
						{ value: 'yaml', label: 'YAML' },
						{ value: 'json', label: 'JSON' },
					]}
				/>
				<OptionSelect
					label="Max Results"
					bind:value={queryMaxResultsStr}
					options={[
						{ value: '0', label: 'Unlimited' },
						{ value: '1', label: '1' },
						{ value: '5', label: '5' },
						{ value: '10', label: '10' },
						{ value: '50', label: '50' },
						{ value: '100', label: '100' },
					]}
				/>
			</div>
			<div class="space-y-1.5 pt-1">
				<OptionCheckbox label="First match only" bind:checked={queryFirstMatchOnly} />
				<OptionCheckbox label="Show paths in results" bind:checked={queryShowPaths} />
				<OptionCheckbox label="Flatten nested arrays" bind:checked={queryFlattenArrays} />
				<OptionCheckbox label="Wrap results in array" bind:checked={queryWrapResults} />
			</div>
		</OptionsSection>

		<OptionsSection title="JSONPath Examples">
			<div
				class="space-y-1.5 rounded-md bg-muted/50 p-2 font-mono text-[11px] text-muted-foreground"
			>
				<div class="truncate" title="All items">$.store.book[*]</div>
				<div class="truncate" title="All authors">$..author</div>
				<div class="truncate" title="Items with condition">$.store.book[?(@.price&lt;10)]</div>
				<div class="truncate" title="First two items">$.store.book[0:2]</div>
				<div class="truncate" title="Last item">$.store.book[-1:]</div>
			</div>
		</OptionsSection>
	</OptionsPanel>

	<SplitPane class="flex-1">
		{#snippet left()}
			<EditorPane
				title="Input"
				value={input}
				onchange={onInputChange}
				mode="input"
				editorMode="yaml"
				placeholder="Enter YAML here..."
				onpaste={handlePaste}
				onclear={handleClear}
			/>
		{/snippet}
		{#snippet right()}
			<EditorPane
				title="Result"
				value={queryResult}
				mode="readonly"
				editorMode={queryOutputFormat}
				placeholder="Query result..."
				oncopy={handleCopyResult}
			/>
		{/snippet}
	</SplitPane>
</div>
