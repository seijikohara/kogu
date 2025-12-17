<script lang="ts">
	import type { SqlLanguage } from 'sql-formatter';
	import { PageHeader } from '$lib/components/layout/index.js';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import OptionSelect from '$lib/components/options/option-select.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import { FormatTabBase } from '$lib/components/tool/index.js';
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
		validateSql,
	} from '$lib/services/formatters.js';
	import { copyToClipboard, downloadTextFile, pasteFromClipboard } from './utils.js';

	// Shared state
	let input = $state('');
	let valid = $state<boolean | null>(null);
	let error = $state('');

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

	// Validation function
	const validate = (value: string) => {
		if (!value.trim()) {
			return { valid: null as boolean | null };
		}
		const result = validateSql(value);
		return { valid: result.valid };
	};

	// Format function
	const format = (value: string, minify: boolean) => {
		try {
			const output = minify ? minifySql(value) : formatSql(value, formatOptions);
			return { output, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid SQL' };
		}
	};

	// Stats handler
	const handleStatsChange = (newStats: { input: string; valid: boolean | null; error: string }) => {
		valid = newStats.valid;
		error = newStats.error;
	};

	// Language display
	const selectedLanguageLabel = $derived(
		SQL_LANGUAGE_OPTIONS.find((opt) => opt.value === language)?.label ?? 'Standard SQL'
	);
</script>

<svelte:head>
	<title>SQL Formatter - Kogu</title>
</svelte:head>

<div class="flex h-full flex-col overflow-hidden">
	<PageHeader {valid} {error}>
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
	</PageHeader>

	<!-- Content -->
	<div class="flex flex-1 overflow-hidden">
		<FormatTabBase
			editorMode="sql"
			{input}
			onInputChange={(v) => (input = v)}
			placeholder="Enter SQL here..."
			{validate}
			{format}
			onStatsChange={handleStatsChange}
			downloadFilename="formatted.sql"
			sampleData={SAMPLE_SQL}
			{copyToClipboard}
			{pasteFromClipboard}
			{downloadTextFile}
		>
			{#snippet modeExtra()}
				<div class="mt-2 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
					<span class="font-medium text-foreground">Dialect:</span>
					{selectedLanguageLabel}
				</div>
			{/snippet}

			{#snippet options()}
				<OptionsSection title="SQL Dialect">
					<OptionSelect
						label="Language"
						value={language}
						onchange={(v) => (language = v as SqlLanguage)}
						options={SQL_LANGUAGE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
					/>
				</OptionsSection>

				<OptionsSection title="Indentation">
					<div class="grid grid-cols-2 gap-2">
						<OptionSelect
							label="Width"
							value={tabWidthStr}
							onchange={(v) => (tabWidthStr = v)}
							options={['1', '2', '3', '4', '8']}
						/>
						<OptionSelect
							label="Style"
							value={indentStyle}
							onchange={(v) => (indentStyle = v as 'standard' | 'tabularLeft' | 'tabularRight')}
							options={SQL_INDENT_STYLE_OPTIONS.map((opt) => ({
								value: opt.value,
								label: opt.label,
							}))}
						/>
					</div>
					<OptionCheckbox label="Use tabs instead of spaces" bind:checked={useTabs} />
				</OptionsSection>

				<OptionsSection title="Keywords">
					<OptionSelect
						label="Keyword Case"
						value={keywordCase}
						onchange={(v) => (keywordCase = v as 'upper' | 'lower' | 'preserve')}
						options={SQL_KEYWORD_CASE_OPTIONS.map((opt) => ({
							value: opt.value,
							label: opt.label,
						}))}
					/>
				</OptionsSection>

				<OptionsSection title="Layout">
					<OptionSelect
						label="Logical Operators"
						value={logicalOperatorNewline}
						onchange={(v) => (logicalOperatorNewline = v as 'before' | 'after')}
						options={SQL_LOGICAL_OPERATOR_OPTIONS.map((opt) => ({
							value: opt.value,
							label: opt.label,
						}))}
					/>
					<OptionSelect
						label="Expression Width"
						value={expressionWidthStr}
						onchange={(v) => (expressionWidthStr = v)}
						options={['20', '30', '40', '50', '60', '80', '100', '120']}
					/>
					<OptionSelect
						label="Lines Between Queries"
						value={linesBetweenQueriesStr}
						onchange={(v) => (linesBetweenQueriesStr = v)}
						options={['0', '1', '2', '3', '4', '5']}
					/>
				</OptionsSection>

				<OptionsSection title="Spacing">
					<OptionCheckbox label="Dense operators (no spaces)" bind:checked={denseOperators} />
					<OptionCheckbox label="Newline before semicolon" bind:checked={newlineBeforeSemicolon} />
				</OptionsSection>
			{/snippet}
		</FormatTabBase>
	</div>
</div>
