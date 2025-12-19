<script lang="ts">
	import type { ContextMenuItem } from '$lib/components/editor';
	import { CodeEditor } from '$lib/components/editor';
	import { FormCheckbox, FormMode, FormSection, FormSelect } from '$lib/components/form';
	import { SplitPane } from '$lib/components/layout';
	import { OptionsPanel } from '$lib/components/panel';
	import {
		defaultXmlFormatOptions,
		formatXml,
		minifyXml,
		SAMPLE_XML,
		type XmlFormatOptions,
	} from '$lib/services/formatters';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// Mode and UI state
	let formatMode = $state<'format' | 'minify'>('format');
	let showOptions = $state(true);

	// Format options - Indentation
	let indentSizeStr = $state(String(defaultXmlFormatOptions.indentSize));
	let indentType = $state<'spaces' | 'tabs'>(defaultXmlFormatOptions.indentType);

	// Format options - Tags
	let whiteSpaceAtEndOfSelfclosingTag = $state(
		defaultXmlFormatOptions.whiteSpaceAtEndOfSelfclosingTag
	);
	let forceSelfClosingEmptyTag = $state(defaultXmlFormatOptions.forceSelfClosingEmptyTag);

	// Format options - Content
	let collapseContent = $state(defaultXmlFormatOptions.collapseContent);
	let preserveWhitespace = $state(defaultXmlFormatOptions.preserveWhitespace);
	let excludeComments = $state(defaultXmlFormatOptions.excludeComments);

	// Format options - Attributes
	let sortAttributes = $state(defaultXmlFormatOptions.sortAttributes);

	// Derived numeric values
	const indentSize = $derived(Number.parseInt(indentSizeStr, 10) || 2);

	// Format options object
	const formatOptions = $derived<Partial<XmlFormatOptions>>({
		indentSize,
		indentType,
		collapseContent,
		whiteSpaceAtEndOfSelfclosingTag,
		excludeComments,
		preserveWhitespace,
		forceSelfClosingEmptyTag,
		sortAttributes,
	});

	// Validation
	const validation = $derived.by(() => {
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

	// Output calculation
	const formatResult = $derived.by((): { output: string; error: string } => {
		if (!input.trim()) return { output: '', error: '' };
		try {
			const output = formatMode === 'minify' ? minifyXml(input) : formatXml(input, formatOptions);
			return { output, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid XML' };
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
		onInputChange(SAMPLE_XML);
	};

	// Format input XML
	const handleFormatInput = () => {
		try {
			const formatted = formatXml(input, { indentSize: 2, indentType: 'spaces' });
			onInputChange(formatted);
		} catch {
			// Invalid XML
		}
	};

	// Minify input XML
	const handleMinifyInput = () => {
		try {
			const minified = minifyXml(input);
			onInputChange(minified);
		} catch {
			// Invalid XML
		}
	};

	// Context menu items for input editor
	const inputContextMenuItems = $derived<ContextMenuItem[]>([
		{
			text: 'Format XML',
			enabled: !!input.trim(),
			action: handleFormatInput,
		},
		{
			text: 'Minify XML',
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

		<FormSection title="Indentation">
			<div class="grid grid-cols-2 gap-2">
				<FormSelect label="Size" bind:value={indentSizeStr} options={['1', '2', '4', '8']} />
				<FormSelect
					label="Type"
					bind:value={indentType}
					options={[
						{ value: 'spaces', label: 'Spaces' },
						{ value: 'tabs', label: 'Tabs' },
					]}
				/>
			</div>
		</FormSection>

		<FormSection title="Tags">
			<FormCheckbox
				label="Space before self-closing />"
				bind:checked={whiteSpaceAtEndOfSelfclosingTag}
			/>
			<FormCheckbox label="Force self-closing empty tags" bind:checked={forceSelfClosingEmptyTag} />
		</FormSection>

		<FormSection title="Content">
			<FormCheckbox label="Collapse content on single line" bind:checked={collapseContent} />
			<FormCheckbox label="Preserve whitespace" bind:checked={preserveWhitespace} />
			<FormCheckbox label="Remove comments" bind:checked={excludeComments} />
		</FormSection>

		<FormSection title="Attributes">
			<FormCheckbox label="Sort attributes alphabetically" bind:checked={sortAttributes} />
		</FormSection>
	</OptionsPanel>

	<SplitPane class="h-full flex-1">
		{#snippet left()}
			<CodeEditor
				title="Input"
				value={input}
				onchange={onInputChange}
				mode="input"
				editorMode="xml"
				placeholder="Enter XML here..."
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
				editorMode="xml"
				placeholder="Formatted output..."
				oncopy={handleCopy}
			/>
		{/snippet}
	</SplitPane>
</div>
