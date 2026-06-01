import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Database } from 'lucide-react';
import { toast } from 'sonner';
import type { SqlLanguage } from 'sql-formatter';

import { CodeEditor } from '@/lib/components/editor';
import { getErrorMessage } from '@/lib/utils';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormMode,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { SectionHeader, SplitPane } from '@/lib/components/layout';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { useDocumentTitle } from '@/lib/hooks';
import { usePersistedRail } from '@/lib/stores';
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
} from '@/lib/services/formatters';

type Mode = 'format' | 'minify';
type KeywordCase = 'upper' | 'lower' | 'preserve';
type IndentStyle = 'standard' | 'tabularLeft' | 'tabularRight';
type LogicalOperatorNewline = 'before' | 'after';

export const Route = createFileRoute('/sql-formatter')({
	component: SqlFormatterPage,
});

function SqlFormatterPage() {
	const [mode, setMode] = useState<Mode>('format');
	const [input, setInput] = useState('');
	const [showOptions, setShowOptions] = usePersistedRail('sql-formatter');

	const [language, setLanguage] = useState<SqlLanguage>(defaultSqlFormatOptions.language);
	const [tabWidthStr, setTabWidthStr] = useState(String(defaultSqlFormatOptions.tabWidth));
	const [useTabs, setUseTabs] = useState<boolean>(defaultSqlFormatOptions.useTabs);
	const [keywordCase, setKeywordCase] = useState<KeywordCase>(defaultSqlFormatOptions.keywordCase);
	const [indentStyle, setIndentStyle] = useState<IndentStyle>(defaultSqlFormatOptions.indentStyle);
	const [logicalOperatorNewline, setLogicalOperatorNewline] = useState<LogicalOperatorNewline>(
		defaultSqlFormatOptions.logicalOperatorNewline
	);
	const [expressionWidthStr, setExpressionWidthStr] = useState(
		String(defaultSqlFormatOptions.expressionWidth)
	);
	const [linesBetweenQueriesStr, setLinesBetweenQueriesStr] = useState(
		String(defaultSqlFormatOptions.linesBetweenQueries)
	);
	const [denseOperators, setDenseOperators] = useState<boolean>(
		defaultSqlFormatOptions.denseOperators
	);
	const [newlineBeforeSemicolon, setNewlineBeforeSemicolon] = useState<boolean>(
		defaultSqlFormatOptions.newlineBeforeSemicolon
	);

	useDocumentTitle('SQL Formatter');

	const tabWidth = Number.parseInt(tabWidthStr, 10) || 2;
	const expressionWidth = Number.parseInt(expressionWidthStr, 10) || 50;
	const linesBetweenQueries = Number.parseInt(linesBetweenQueriesStr, 10) || 1;

	const formatOptions: Partial<SqlFormatOptions> = {
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
	};

	const stats = (() => {
		if (!input.trim()) return null;
		try {
			return calculateSqlStats(input);
		} catch {
			return null;
		}
	})();

	const { output, error } = ((): { output: string; error: string } => {
		if (!input.trim()) return { output: '', error: '' };
		try {
			const result = mode === 'minify' ? minifySql(input) : formatSql(input, formatOptions);
			return { output: result, error: '' };
		} catch (e) {
			return { output: '', error: getErrorMessage(e, 'Invalid SQL') };
		}
	})();

	const valid: boolean | null = !input.trim() ? null : !error;
	const selectedLanguageLabel =
		SQL_LANGUAGE_OPTIONS.find((opt) => opt.value === language)?.label ?? 'Standard SQL';

	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) setInput(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => setInput('');

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(output);
			toast.success('Copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const handleSample = () => setInput(SAMPLE_SQL);

	return (
		<ToolShell
			valid={valid}
			error={error || undefined}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				stats ? (
					<>
						<StatItem label="Statements" value={stats.statements} />
						<StatItem label="Size" value={stats.size} />
					</>
				) : (
					<span className="text-xs text-muted-foreground/70">
						Paste, drop, or load sample to get started
					</span>
				)
			}
			rail={
				<>
					<FormSection title="Mode">
						<FormMode
							value={mode}
							onValueChange={setMode}
							options={[
								{ value: 'format', label: 'Format' },
								{ value: 'minify', label: 'Minify' },
							]}
						/>
						<div className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
							<span className="font-medium text-foreground">Dialect:</span> {selectedLanguageLabel}
						</div>
					</FormSection>

					<FormSection title="SQL Dialect">
						<FormSelect
							label="Language"
							value={language}
							onValueChange={(v) => setLanguage(v as SqlLanguage)}
							options={SQL_LANGUAGE_OPTIONS.map((opt) => ({
								value: opt.value,
								label: opt.label,
							}))}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Indentation">
						<div className="grid grid-cols-2 gap-2">
							<FormSelect
								label="Width"
								value={tabWidthStr}
								onValueChange={setTabWidthStr}
								options={['1', '2', '3', '4', '8']}
								size="compact"
							/>
							<FormSelect
								label="Style"
								value={indentStyle}
								onValueChange={(v) => setIndentStyle(v as IndentStyle)}
								options={SQL_INDENT_STYLE_OPTIONS.map((opt) => ({
									value: opt.value,
									label: opt.label,
									description: opt.description,
								}))}
								size="compact"
							/>
						</div>
						<FormCheckbox
							label="Use tabs instead of spaces"
							checked={useTabs}
							onCheckedChange={setUseTabs}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Keywords">
						<FormSelect
							label="Keyword Case"
							value={keywordCase}
							onValueChange={(v) => setKeywordCase(v as KeywordCase)}
							options={SQL_KEYWORD_CASE_OPTIONS.map((opt) => ({
								value: opt.value,
								label: opt.label,
							}))}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Layout">
						<FormSelect
							label="Logical Operators"
							value={logicalOperatorNewline}
							onValueChange={(v) => setLogicalOperatorNewline(v as LogicalOperatorNewline)}
							options={SQL_LOGICAL_OPERATOR_OPTIONS.map((opt) => ({
								value: opt.value,
								label: opt.label,
								description: opt.description,
							}))}
							size="compact"
						/>
						<FormSelect
							label="Expression Width"
							value={expressionWidthStr}
							onValueChange={setExpressionWidthStr}
							options={['20', '30', '40', '50', '60', '80', '100', '120']}
							size="compact"
						/>
						<FormSelect
							label="Lines Between Queries"
							value={linesBetweenQueriesStr}
							onValueChange={setLinesBetweenQueriesStr}
							options={['0', '1', '2', '3', '4', '5']}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Spacing">
						<FormCheckboxGroup>
							<FormCheckbox
								label="Dense operators (no spaces)"
								checked={denseOperators}
								onCheckedChange={setDenseOperators}
								size="compact"
							/>
							<FormCheckbox
								label="Newline before semicolon"
								checked={newlineBeforeSemicolon}
								onCheckedChange={setNewlineBeforeSemicolon}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>

					<ToolFooter
						relatedItems={[
							{ id: 'json-formatter', reason: 'Format and query JSON documents' },
							{ id: 'xml-formatter', reason: 'Format and validate XML documents' },
							{ id: 'yaml-formatter', reason: 'Format and convert YAML documents' },
						]}
						aboutText={
							<>
								Formats and minifies SQL across 18+ dialects. Dialect, keyword case, indentation,
								and operator spacing are configurable. Formatting is lexical, so malformed SQL is
								reformatted on a best-effort basis rather than rejected.
							</>
						}
					/>
				</>
			}
		>
			<SplitPane
				className="h-full flex-1"
				left={
					<CodeEditor
						title="Input"
						value={input}
						onChange={setInput}
						mode="input"
						editorMode="sql"
						placeholder="Enter SQL here..."
						onSample={handleSample}
						onPaste={handlePaste}
						onClear={handleClear}
					/>
				}
				right={
					!input.trim() ? (
						<div className="flex h-full flex-col overflow-hidden">
							<SectionHeader title="Output" />
							<div className="flex-1">
								<EmbeddedEmptyState
									icon={Database}
									title="Enter SQL to format"
									description="The formatted (or minified) statement will appear here."
									fillHeight
								/>
							</div>
						</div>
					) : (
						<CodeEditor
							title="Output"
							value={output}
							mode="readonly"
							editorMode="sql"
							placeholder="Formatted output..."
							onCopy={handleCopy}
						/>
					)
				}
			/>
		</ToolShell>
	);
}
