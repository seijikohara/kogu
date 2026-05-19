import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { CodeEditor, type ContextMenuItem } from '@/lib/components/editor';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormMode,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { SplitPane } from '@/lib/components/layout';
import { OptionsPanel } from '@/lib/components/panel';
import {
	defaultJsonFormatOptions,
	type JsonFormatOptions,
	parseJson,
	processJsonWithOptions,
	SAMPLE_JSON,
	stringifyJson,
	validateJson,
} from '@/lib/services/formatters';

type FormatMode = 'format' | 'minify';
type IndentType = 'spaces' | 'tabs';
type QuoteStyle = 'double' | 'single';

interface TabStats {
	readonly input: string;
	readonly valid: boolean | null;
	readonly error: string;
}

interface FormatTabProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange?: (stats: TabStats) => void;
}

export function FormatTab({ input, onInputChange, onStatsChange }: FormatTabProps) {
	const [formatMode, setFormatMode] = useState<FormatMode>('format');
	const [showOptions, setShowOptions] = useState(true);

	// Format options.
	const [indentSizeStr, setIndentSizeStr] = useState<string>(
		String(defaultJsonFormatOptions.indentSize)
	);
	const [indentType, setIndentType] = useState<IndentType>(defaultJsonFormatOptions.indentType);
	const [sortKeys, setSortKeys] = useState<boolean>(defaultJsonFormatOptions.sortKeys);
	const [removeNulls, setRemoveNulls] = useState<boolean>(defaultJsonFormatOptions.removeNulls);
	const [removeEmptyStrings, setRemoveEmptyStrings] = useState<boolean>(
		defaultJsonFormatOptions.removeEmptyStrings
	);
	const [removeEmptyArrays, setRemoveEmptyArrays] = useState<boolean>(
		defaultJsonFormatOptions.removeEmptyArrays
	);
	const [removeEmptyObjects, setRemoveEmptyObjects] = useState<boolean>(
		defaultJsonFormatOptions.removeEmptyObjects
	);
	const [escapeUnicode, setEscapeUnicode] = useState<boolean>(
		defaultJsonFormatOptions.escapeUnicode
	);
	const [trailingComma, setTrailingComma] = useState<boolean>(
		defaultJsonFormatOptions.trailingComma
	);
	const [quoteStyle, setQuoteStyle] = useState<QuoteStyle>(defaultJsonFormatOptions.quoteStyle);
	const [arrayBracketSpacing, setArrayBracketSpacing] = useState<boolean>(
		defaultJsonFormatOptions.arrayBracketSpacing
	);
	const [objectBracketSpacing, setObjectBracketSpacing] = useState<boolean>(
		defaultJsonFormatOptions.objectBracketSpacing
	);
	const [colonSpacing, setColonSpacing] = useState<boolean>(defaultJsonFormatOptions.colonSpacing);
	const [compactArrays, setCompactArrays] = useState<boolean>(
		defaultJsonFormatOptions.compactArrays
	);
	const [maxDepthStr, setMaxDepthStr] = useState<string>(String(defaultJsonFormatOptions.maxDepth));

	const indentSize = Number.parseInt(indentSizeStr, 10) || 2;
	const maxDepth = Number.parseInt(maxDepthStr, 10) || 0;

	const formatOptions: Partial<JsonFormatOptions> = {
		indentSize,
		indentType,
		sortKeys,
		removeNulls,
		removeEmptyStrings,
		removeEmptyArrays,
		removeEmptyObjects,
		escapeUnicode,
		trailingComma,
		quoteStyle,
		arrayBracketSpacing,
		objectBracketSpacing,
		colonSpacing,
		compactArrays,
		maxDepth,
	};

	const validation = useMemo<{ valid: boolean | null }>(() => {
		if (!input.trim()) return { valid: null };
		const result = validateJson(input);
		return { valid: result.valid };
	}, [input]);

	const { output, error: formatError } = ((): { output: string; error: string } => {
		if (!input.trim()) return { output: '', error: '' };

		try {
			const data = parseJson(input);

			// Apply filtering options (removeNulls, removeEmptyStrings, etc.).
			const processedData = processJsonWithOptions(data, formatOptions);

			if (formatMode === 'minify') {
				return { output: stringifyJson(processedData, 'json', { indent: 0 }), error: '' };
			}

			let result = stringifyJson(processedData, 'json', {
				indent: formatOptions.indentType === 'tabs' ? '\t' : formatOptions.indentSize,
				sortKeys: formatOptions.sortKeys,
				trailingComma: formatOptions.trailingComma,
				quote: formatOptions.quoteStyle,
			});

			// Apply additional formatting options.
			if (formatOptions.escapeUnicode) {
				result = result.replace(
					/[\u0080-\uffff]/g,
					(char) => `\\u${`0000${char.charCodeAt(0).toString(16)}`.slice(-4)}`
				);
			}
			if (formatOptions.arrayBracketSpacing) {
				result = result.replace(/\[(?!\s*\n)/g, '[ ').replace(/(?<!\n\s*)\]/g, ' ]');
			}
			if (formatOptions.objectBracketSpacing) {
				result = result.replace(/\{(?!\s*\n)/g, '{ ').replace(/(?<!\n\s*)\}/g, ' }');
			}
			if (!formatOptions.colonSpacing) {
				result = result.replace(/:\s+/g, ':');
			}
			if (formatOptions.compactArrays && (formatOptions.indentSize ?? 2) > 0) {
				result = result.replace(
					/\[\s*\n(\s*)((?:"[^"]*"|'[^']*'|[\d.eE+-]+|true|false|null)(?:,\s*\n\s*(?:"[^"]*"|'[^']*'|[\d.eE+-]+|true|false|null))*)\s*\n\s*\]/g,
					(_, _indent, content: string) => {
						const items = content.split(/,\s*\n\s*/);
						return `[${items.join(', ')}]`;
					}
				);
			}

			return { output: result, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid JSON' };
		}
	})();

	useEffect(() => {
		onStatsChange?.({
			input,
			valid: validation.valid,
			error: formatError,
		});
	}, [input, validation.valid, formatError, onStatsChange]);

	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) onInputChange(text);
		} catch {
			// Clipboard access denied.
		}
	};

	const handleClear = () => {
		onInputChange('');
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(output);
			toast.success('Copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const handleSample = () => {
		onInputChange(SAMPLE_JSON);
	};

	const handleFormatInput = () => {
		try {
			const data = parseJson(input);
			onInputChange(JSON.stringify(data, null, 2));
		} catch {
			// Invalid JSON.
		}
	};

	const handleMinifyInput = () => {
		try {
			const data = parseJson(input);
			onInputChange(JSON.stringify(data));
		} catch {
			// Invalid JSON.
		}
	};

	const inputContextMenuItems: readonly ContextMenuItem[] = [
		{
			text: 'Format JSON',
			enabled: input.trim().length > 0,
			action: handleFormatInput,
		},
		{
			text: 'Minify JSON',
			enabled: input.trim().length > 0,
			action: handleMinifyInput,
		},
	];

	return (
		<div className="flex flex-1 overflow-hidden">
			<OptionsPanel
				show={showOptions}
				onClose={() => setShowOptions(false)}
				onOpen={() => setShowOptions(true)}
			>
				<FormSection title="Mode">
					<FormMode
						value={formatMode}
						onValueChange={setFormatMode}
						options={[
							{ value: 'format', label: 'Format' },
							{ value: 'minify', label: 'Minify' },
						]}
					/>
				</FormSection>

				<FormSection title="Indentation">
					<div className="grid grid-cols-2 gap-2">
						<FormSelect
							label="Size"
							value={indentSizeStr}
							onValueChange={setIndentSizeStr}
							options={['1', '2', '3', '4', '8']}
							size="compact"
						/>
						<FormSelect
							label="Type"
							value={indentType}
							onValueChange={(v) => setIndentType(v as IndentType)}
							options={[
								{ value: 'spaces', label: 'Spaces' },
								{ value: 'tabs', label: 'Tabs' },
							]}
							size="compact"
						/>
					</div>
				</FormSection>

				<FormSection title="Style">
					<div className="grid grid-cols-2 gap-2">
						<FormSelect
							label="Quotes"
							value={quoteStyle}
							onValueChange={(v) => setQuoteStyle(v as QuoteStyle)}
							options={[
								{ value: 'double', label: '"..."' },
								{ value: 'single', label: "'...'" },
							]}
							size="compact"
						/>
						<FormSelect
							label="Max Depth"
							value={maxDepthStr}
							onValueChange={setMaxDepthStr}
							options={[
								{ value: '0', label: '∞' },
								{ value: '1', label: '1' },
								{ value: '2', label: '2' },
								{ value: '3', label: '3' },
								{ value: '5', label: '5' },
								{ value: '10', label: '10' },
							]}
							size="compact"
						/>
					</div>
					<FormCheckboxGroup className="pt-1">
						<FormCheckbox
							label="Sort keys alphabetically"
							checked={sortKeys}
							onCheckedChange={setSortKeys}
							size="compact"
						/>
						<FormCheckbox
							label="Escape unicode characters"
							checked={escapeUnicode}
							onCheckedChange={setEscapeUnicode}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Spacing">
					<FormCheckboxGroup>
						<FormCheckbox
							label="Space after colon"
							checked={colonSpacing}
							onCheckedChange={setColonSpacing}
							size="compact"
						/>
						<FormCheckbox
							label="Array bracket spacing"
							checked={arrayBracketSpacing}
							onCheckedChange={setArrayBracketSpacing}
							size="compact"
						/>
						<FormCheckbox
							label="Object bracket spacing"
							checked={objectBracketSpacing}
							onCheckedChange={setObjectBracketSpacing}
							size="compact"
						/>
						<FormCheckbox
							label="Trailing commas"
							checked={trailingComma}
							onCheckedChange={setTrailingComma}
							size="compact"
						/>
						<FormCheckbox
							label="Compact arrays"
							checked={compactArrays}
							onCheckedChange={setCompactArrays}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Filtering">
					<FormCheckboxGroup>
						<FormCheckbox
							label="Remove null values"
							checked={removeNulls}
							onCheckedChange={setRemoveNulls}
							size="compact"
						/>
						<FormCheckbox
							label="Remove empty strings"
							checked={removeEmptyStrings}
							onCheckedChange={setRemoveEmptyStrings}
							size="compact"
						/>
						<FormCheckbox
							label="Remove empty arrays"
							checked={removeEmptyArrays}
							onCheckedChange={setRemoveEmptyArrays}
							size="compact"
						/>
						<FormCheckbox
							label="Remove empty objects"
							checked={removeEmptyObjects}
							onCheckedChange={setRemoveEmptyObjects}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>
			</OptionsPanel>

			<SplitPane
				className="h-full flex-1"
				left={
					<CodeEditor
						title="Input"
						value={input}
						onChange={onInputChange}
						mode="input"
						editorMode="json"
						placeholder="Enter JSON here..."
						onSample={handleSample}
						onPaste={handlePaste}
						onClear={handleClear}
						contextMenuItems={inputContextMenuItems}
					/>
				}
				right={
					<CodeEditor
						title="Output"
						value={output}
						mode="readonly"
						editorMode="json"
						placeholder="Formatted output..."
						onCopy={handleCopy}
					/>
				}
			/>
		</div>
	);
}

export type { FormatTabProps };
