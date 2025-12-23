<script lang="ts">
	import type { SqlLanguage } from 'sql-formatter';
	import { CodeEditor } from '$lib/components/editor';
	import { FormCheckbox, FormMode, FormSection, FormSelect } from '$lib/components/form';
	import { PageLayout, SplitPane } from '$lib/components/layout';
	import {
		calculateSqlStats,
		defaultSqlFormatOptions,
		formatSql,
		minifySql,
		SAMPLE_SQL,
		SQL_INDENT_STYLE_OPTIONS,
		SQL_KEYWORD_CASE_OPTIONS,
		SQL_LANGUAGE_OPTIONS,
		SQL_LOGICAL_OPERATOR_OPTIONS,
		type SqlFormatOptions,
		type SqlStats,
	} from '$lib/services/formatters';

	type Mode = 'format' | 'minify';

	// State
	let mode = $state<Mode>('format');
	let input = $state('');
	let showOptions = $state(true);

	// Format options
	let language = $state<SqlLanguage>(defaultSqlFormatOptions.language);
	let tabWidthStr = $state(String(defaultSqlFormatOptions.tabWidth));
	let useTabs = $state(defaultSqlFormatOptions.useTabs);
	let keywordCase = $state<'upper' | 'lower' | 'preserve'>(defaultSqlFormatOptions.keywordCase);
	let indentStyle = $state<'standard' | 'tabularLeft' | 'tabularRight'>(
		defaultSqlFormatOptions.indentStyle
	);
	let logicalOperatorNewline = $state<'before' | 'after'>(
		defaultSqlFormatOptions.logicalOperatorNewline
	);
	let expressionWidthStr = $state(String(defaultSqlFormatOptions.expressionWidth));
	let linesBetweenQueriesStr = $state(String(defaultSqlFormatOptions.linesBetweenQueries));
	let denseOperators = $state(defaultSqlFormatOptions.denseOperators);
	let newlineBeforeSemicolon = $state(defaultSqlFormatOptions.newlineBeforeSemicolon);

	// Derived numeric values
	const tabWidth = $derived(Number.parseInt(tabWidthStr, 10) || 2);
	const expressionWidth = $derived(Number.parseInt(expressionWidthStr, 10) || 50);
	const linesBetweenQueries = $derived(Number.parseInt(linesBetweenQueriesStr, 10) || 1);

	// Format options object
	const formatOptions = $derived<Partial<SqlFormatOptions>>({
		language,
		tabWidth,
		useTabs,
		keywordCase,
		indentStyle,
		logicalOperatorNewline,
		expressionWidth,
		linesBetweenQueries,
		denseOperators,
		newlineBeforeSemicolon,
	});

	// Stats calculation
	const stats = $derived.by((): SqlStats | null => {
		if (!input.trim()) return null;
		try {
			return calculateSqlStats(input);
		} catch {
			return null;
		}
	});

	// Output calculation
	const formatResult = $derived.by((): { output: string; error: string } => {
		if (!input.trim()) return { output: '', error: '' };
		try {
			const output = mode === 'minify' ? minifySql(input) : formatSql(input, formatOptions);
			return { output, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid SQL' };
		}
	});

	const output = $derived(formatResult.output);
	const error = $derived(formatResult.error);

	// Validation state
	const valid = $derived.by((): boolean | null => {
		if (!input.trim()) return null;
		return !error;
	});

	// Language display
	const selectedLanguageLabel = $derived(
		SQL_LANGUAGE_OPTIONS.find((opt) => opt.value === language)?.label ?? 'Standard SQL'
	);

	// Handlers
	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) input = text;
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => {
		input = '';
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(output);
		} catch {
			// Clipboard access denied
		}
	};

	const handleSample = () => {
		input = SAMPLE_SQL;
	};
</script>

<svelte:head>
	<title>SQL Formatter - Kogu</title>
</svelte:head>

<PageLayout {valid} {error} bind:showOptions>
	{#snippet statusContent()}
		{#if stats}
			<span class="text-muted-foreground"
				>Statements: <strong class="text-foreground">{stats.statements}</strong></span
			>
			<span class="text-muted-foreground"
				>Size: <strong class="text-foreground">{stats.size}</strong></span
			>
		{/if}
	{/snippet}

	{#snippet options()}
		<FormSection title="Mode">
			<FormMode
				value={mode}
				onchange={(v) => (mode = v as Mode)}
				options={[
					{ value: 'format', label: 'Format' },
					{ value: 'minify', label: 'Minify' },
				]}
			/>
			<div class="mt-2 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
				<span class="font-medium text-foreground">Dialect:</span>
				{selectedLanguageLabel}
			</div>
		</FormSection>

		<FormSection title="SQL Dialect">
			<FormSelect
				label="Language"
				value={language}
				onchange={(v) => (language = v as SqlLanguage)}
				options={SQL_LANGUAGE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
			/>
		</FormSection>

		<FormSection title="Indentation">
			<div class="grid grid-cols-2 gap-2">
				<FormSelect
					label="Width"
					value={tabWidthStr}
					onchange={(v) => (tabWidthStr = v)}
					options={['1', '2', '3', '4', '8']}
				/>
				<FormSelect
					label="Style"
					value={indentStyle}
					onchange={(v) => (indentStyle = v as 'standard' | 'tabularLeft' | 'tabularRight')}
					options={SQL_INDENT_STYLE_OPTIONS.map((opt) => ({
						value: opt.value,
						label: opt.label,
					}))}
				/>
			</div>
			<FormCheckbox label="Use tabs instead of spaces" bind:checked={useTabs} />
		</FormSection>

		<FormSection title="Keywords">
			<FormSelect
				label="Keyword Case"
				value={keywordCase}
				onchange={(v) => (keywordCase = v as 'upper' | 'lower' | 'preserve')}
				options={SQL_KEYWORD_CASE_OPTIONS.map((opt) => ({
					value: opt.value,
					label: opt.label,
				}))}
			/>
		</FormSection>

		<FormSection title="Layout">
			<FormSelect
				label="Logical Operators"
				value={logicalOperatorNewline}
				onchange={(v) => (logicalOperatorNewline = v as 'before' | 'after')}
				options={SQL_LOGICAL_OPERATOR_OPTIONS.map((opt) => ({
					value: opt.value,
					label: opt.label,
				}))}
			/>
			<FormSelect
				label="Expression Width"
				value={expressionWidthStr}
				onchange={(v) => (expressionWidthStr = v)}
				options={['20', '30', '40', '50', '60', '80', '100', '120']}
			/>
			<FormSelect
				label="Lines Between Queries"
				value={linesBetweenQueriesStr}
				onchange={(v) => (linesBetweenQueriesStr = v)}
				options={['0', '1', '2', '3', '4', '5']}
			/>
		</FormSection>

		<FormSection title="Spacing">
			<FormCheckbox label="Dense operators (no spaces)" bind:checked={denseOperators} />
			<FormCheckbox label="Newline before semicolon" bind:checked={newlineBeforeSemicolon} />
		</FormSection>
	{/snippet}

	<SplitPane class="h-full flex-1">
		{#snippet left()}
			<CodeEditor
				title="Input"
				value={input}
				onchange={(v) => (input = v)}
				mode="input"
				editorMode="sql"
				placeholder="Enter SQL here..."
				onsample={handleSample}
				onpaste={handlePaste}
				onclear={handleClear}
			/>
		{/snippet}
		{#snippet right()}
			<CodeEditor
				title="Output"
				value={output}
				mode="readonly"
				editorMode="sql"
				placeholder="Formatted output..."
				oncopy={handleCopy}
			/>
		{/snippet}
	</SplitPane>
</PageLayout>
