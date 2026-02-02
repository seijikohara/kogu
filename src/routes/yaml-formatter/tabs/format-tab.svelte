<script lang="ts">
	import * as yaml from 'yaml';
	import type { ContextMenuItem } from '$lib/components/editor';
	import { CodeEditor } from '$lib/components/editor';
	import { FormCheckbox, FormMode, FormSection, FormSelect } from '$lib/components/form';
	import { SplitPane } from '$lib/components/layout';
	import { OptionsPanel } from '$lib/components/panel';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { SAMPLE_YAML, sortKeysDeep, validateYaml } from '$lib/services/formatters';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// Mode and UI state
	let formatMode = $state<'format' | 'minify'>('format');
	let showOptions = $state(true);

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
	const indentSize = $derived(Number.parseInt(indentSizeStr, 10) || 2);
	const lineWidth = $derived(Number.parseInt(lineWidthStr, 10) || 80);
	const minContentWidth = $derived(Number.parseInt(minContentWidthStr, 10) || 20);

	// Validation
	const validation = $derived.by(() => {
		if (!input.trim()) return { valid: null as boolean | null };
		const result = validateYaml(input);
		return { valid: result.valid };
	});

	// Output calculation
	const formatResult = $derived.by((): { output: string; error: string } => {
		if (!input.trim()) return { output: '', error: '' };

		// Validate first - reject JSON input
		const validationResult = validateYaml(input);
		if (!validationResult.valid) {
			return { output: '', error: validationResult.error ?? 'Invalid YAML' };
		}

		try {
			if (formatMode === 'minify') {
				return {
					output: yaml.stringify(yaml.parse(input), { indent: 1, indentSeq: false }),
					error: '',
				};
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
	});

	const output = $derived(formatResult.output);
	const formatError = $derived(formatResult.error);

	// Report stats to parent
	$effect(() => {
		onStatsChange?.({
			input,
			valid: validation.valid,
			error: formatError,
		});
	});

	// Handlers
	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) onInputChange(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => {
		onInputChange('');
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(output);
		} catch {
			// Clipboard access denied
		}
	};

	const handleSample = () => {
		onInputChange(SAMPLE_YAML);
	};

	// Format input YAML
	const handleFormatInput = () => {
		try {
			const parsed = yaml.parse(input);
			const formatted = yaml.stringify(parsed, { indent: 2 });
			onInputChange(formatted);
		} catch {
			// Invalid YAML
		}
	};

	// Minify input YAML
	const handleMinifyInput = () => {
		try {
			const parsed = yaml.parse(input);
			const minified = yaml.stringify(parsed, { indent: 1, indentSeq: false });
			onInputChange(minified);
		} catch {
			// Invalid YAML
		}
	};

	// Context menu items for input editor
	const inputContextMenuItems = $derived<ContextMenuItem[]>([
		{
			text: 'Format YAML',
			enabled: !!input.trim(),
			action: handleFormatInput,
		},
		{
			text: 'Minify YAML',
			enabled: !!input.trim(),
			action: handleMinifyInput,
		},
	]);
</script>

<div class="flex flex-1 overflow-hidden">
	<OptionsPanel
		show={showOptions}
		onclose={() => (showOptions = false)}
		onopen={() => (showOptions = true)}
	>
		<FormSection title="Mode">
			<FormMode
				bind:value={formatMode}
				options={[
					{ value: 'format', label: 'Format' },
					{ value: 'minify', label: 'Minify' },
				]}
			/>
		</FormSection>

		<FormSection title="Formatting">
			<div class="grid grid-cols-2 gap-2">
				<FormSelect label="Indent" bind:value={indentSizeStr} options={['2', '4', '8']} />
				<FormSelect
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
			<FormSelect
				label="Collection Style"
				bind:value={collectionStyle}
				options={[
					{ value: 'block', label: 'Block' },
					{ value: 'flow', label: 'Flow ({...})' },
					{ value: 'any', label: 'Auto' },
				]}
			/>
			<div class="space-y-1.5 pt-1">
				<FormCheckbox label="Indent sequences" bind:checked={indentSeq} />
				<FormCheckbox label="Flow collection padding" bind:checked={flowCollectionPadding} />
			</div>
		</FormSection>

		<FormSection title="Strings">
			<FormSelect
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
				<FormCheckbox label="Force quotes on all strings" bind:checked={forceQuotes} />
				<FormCheckbox label="Prefer single quotes" bind:checked={singleQuote} />
				<FormCheckbox label="Double-quoted as JSON style" bind:checked={doubleQuotedAsJSON} />
			</div>
		</FormSection>

		<FormSection title="Keys">
			<FormSelect
				label="Key Style"
				bind:value={keyType}
				options={[
					{ value: 'PLAIN', label: 'Plain' },
					{ value: 'QUOTE_SINGLE', label: "Single Quote (')" },
					{ value: 'QUOTE_DOUBLE', label: 'Double Quote (")' },
				]}
			/>
			<div class="space-y-1.5 pt-1">
				<FormCheckbox label="Sort keys alphabetically" bind:checked={sortKeys} />
			</div>
		</FormSection>

		<FormSection title="Special Values">
			<div class="grid grid-cols-3 gap-2">
				<div class="space-y-1">
					<Label class="text-2xs uppercase tracking-wide text-muted-foreground">Null</Label>
					<Input bind:value={nullStr} placeholder="null" class="h-7 font-mono text-xs" />
				</div>
				<div class="space-y-1">
					<Label class="text-2xs uppercase tracking-wide text-muted-foreground">True</Label>
					<Input bind:value={trueStr} placeholder="true" class="h-7 font-mono text-xs" />
				</div>
				<div class="space-y-1">
					<Label class="text-2xs uppercase tracking-wide text-muted-foreground">False</Label>
					<Input bind:value={falseStr} placeholder="false" class="h-7 font-mono text-xs" />
				</div>
			</div>
		</FormSection>

		<FormSection title="Advanced">
			<FormCheckbox label="Disable YAML references/aliases" bind:checked={noRefs} />
		</FormSection>
	</OptionsPanel>

	<SplitPane class="h-full flex-1">
		{#snippet left()}
			<CodeEditor
				title="Input"
				value={input}
				onchange={onInputChange}
				mode="input"
				editorMode="yaml"
				placeholder="Enter YAML here..."
				onsample={handleSample}
				onpaste={handlePaste}
				onclear={handleClear}
				contextMenuItems={inputContextMenuItems}
			/>
		{/snippet}
		{#snippet right()}
			<CodeEditor
				title="Output"
				value={output}
				mode="readonly"
				editorMode="yaml"
				placeholder="Formatted output..."
				oncopy={handleCopy}
			/>
		{/snippet}
	</SplitPane>
</div>
