<script lang="ts">
	import SplitPane from '$lib/components/layout/split-pane.svelte';
	import { OptionsPanel } from '$lib/components/panel';
	import { FormSection } from '$lib/components/form';
	import { CodeEditor } from '$lib/components/editor';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { executeXPath, formatXml } from '$lib/services/formatters';
	import { copyToClipboard, downloadTextFile, pasteFromClipboard } from '../utils.js';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// State
	let xpathExpression = $state('//');
	let showOptions = $state(true);

	// Validation
	const inputValidation = $derived.by(() => {
		if (!input.trim()) return { valid: null as boolean | null };
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(input, 'application/xml');
			const parserError = doc.querySelector('parsererror');
			return { valid: parserError === null };
		} catch {
			return { valid: false };
		}
	});

	// Query result - reactive evaluation
	const queryResultData = $derived.by(() => {
		if (!input.trim() || xpathExpression.trim() === '' || xpathExpression.trim() === '//') {
			return { output: '', error: '', count: 0 };
		}
		try {
			const results = executeXPath(input, xpathExpression);
			if (results.length === 0) {
				return { output: '', error: 'No matches found', count: 0 };
			}
			// Format each result and join with newlines
			const formattedResults = results.map((result) => {
				try {
					return formatXml(result, { indentSize: 2 });
				} catch {
					return result;
				}
			});
			return {
				output: formattedResults.join('\n\n'),
				error: '',
				count: results.length,
			};
		} catch (e) {
			return {
				output: '',
				error: e instanceof Error ? e.message : 'Query failed',
				count: 0,
			};
		}
	});

	const queryOutput = $derived(queryResultData.output);
	const queryError = $derived(queryResultData.error);
	const resultCount = $derived(queryResultData.count);

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
		xpathExpression = '//';
	};

	const handleCopyOutput = () => copyToClipboard(queryOutput);

	const handleDownload = () => {
		downloadTextFile(queryOutput, 'xpath-result.xml');
	};
</script>

<div class="flex flex-1 overflow-hidden">
	<OptionsPanel
		show={showOptions}
		onclose={() => (showOptions = false)}
		onopen={() => (showOptions = true)}
	>
		<FormSection title="XPath Expression">
			<div class="space-y-1">
				<Label class="text-[10px] uppercase tracking-wide text-muted-foreground"
					>Path Expression</Label
				>
				<Input bind:value={xpathExpression} placeholder="//element" class="h-7 font-mono text-xs" />
			</div>
			{#if resultCount > 0}
				<div class="rounded-md bg-primary/10 p-2 text-[11px] text-primary">
					Found <strong>{resultCount}</strong> match{resultCount > 1 ? 'es' : ''}
				</div>
			{/if}
		</FormSection>

		<FormSection title="Examples">
			<div class="space-y-1.5 text-[11px]">
				<div class="space-y-1">
					<code class="text-muted-foreground">//element</code>
					<p class="text-muted-foreground/70">Select all elements named "element"</p>
				</div>
				<div class="space-y-1">
					<code class="text-muted-foreground">//element[@attr]</code>
					<p class="text-muted-foreground/70">Elements with attribute "attr"</p>
				</div>
				<div class="space-y-1">
					<code class="text-muted-foreground">//element[@attr='value']</code>
					<p class="text-muted-foreground/70">Elements with specific attribute value</p>
				</div>
				<div class="space-y-1">
					<code class="text-muted-foreground">//parent/child</code>
					<p class="text-muted-foreground/70">Direct child elements</p>
				</div>
				<div class="space-y-1">
					<code class="text-muted-foreground">//element/text()</code>
					<p class="text-muted-foreground/70">Text content of elements</p>
				</div>
			</div>
		</FormSection>
	</OptionsPanel>

	<SplitPane class="flex-1">
		{#snippet left()}
			<CodeEditor
				title="Input"
				value={input}
				onchange={onInputChange}
				mode="input"
				editorMode="xml"
				placeholder="Enter XML here..."
				onpaste={handlePaste}
				onclear={handleClear}
			/>
		{/snippet}
		{#snippet right()}
			<CodeEditor
				title="Result"
				value={queryOutput}
				mode="readonly"
				editorMode="xml"
				placeholder="Query results will appear here..."
				oncopy={handleCopyOutput}
			/>
		{/snippet}
	</SplitPane>
</div>
