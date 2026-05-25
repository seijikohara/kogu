import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ContextMenuItem } from '@/lib/components/editor';
import { FormCheckbox, FormCheckboxGroup, FormSection, FormSelect } from '@/lib/components/form';
import { FormatTabTemplate, type FormatMode } from '@/lib/components/template';
import {
	defaultJsonFormatOptions,
	type JsonFormatOptions,
	type JsonInputFormat,
	type JsonOutputFormat,
	parseJson,
	processJsonWithOptions,
	SAMPLE_JSON,
	stringifyJson,
	validateJson,
} from '@/lib/services/formatters';
import { useJsonFormatterOptions } from '@/lib/stores';
import { getErrorMessage } from '@/lib/utils';

import { JsonFormatSection } from './json-format-section';

type IndentType = 'spaces' | 'tabs';
type QuoteStyle = 'double' | 'single';

interface JsonFormatTabOptions {
	readonly indentSizeStr: string;
	readonly indentType: IndentType;
	readonly sortKeys: boolean;
	readonly removeNulls: boolean;
	readonly removeEmptyStrings: boolean;
	readonly removeEmptyArrays: boolean;
	readonly removeEmptyObjects: boolean;
	readonly escapeUnicode: boolean;
	readonly trailingComma: boolean;
	readonly quoteStyle: QuoteStyle;
	readonly arrayBracketSpacing: boolean;
	readonly objectBracketSpacing: boolean;
	readonly colonSpacing: boolean;
	readonly compactArrays: boolean;
	readonly maxDepthStr: string;
}

const DEFAULT_OPTIONS: JsonFormatTabOptions = {
	indentSizeStr: String(defaultJsonFormatOptions.indentSize),
	indentType: defaultJsonFormatOptions.indentType,
	sortKeys: defaultJsonFormatOptions.sortKeys,
	removeNulls: defaultJsonFormatOptions.removeNulls,
	removeEmptyStrings: defaultJsonFormatOptions.removeEmptyStrings,
	removeEmptyArrays: defaultJsonFormatOptions.removeEmptyArrays,
	removeEmptyObjects: defaultJsonFormatOptions.removeEmptyObjects,
	escapeUnicode: defaultJsonFormatOptions.escapeUnicode,
	trailingComma: defaultJsonFormatOptions.trailingComma,
	quoteStyle: defaultJsonFormatOptions.quoteStyle,
	arrayBracketSpacing: defaultJsonFormatOptions.arrayBracketSpacing,
	objectBracketSpacing: defaultJsonFormatOptions.objectBracketSpacing,
	colonSpacing: defaultJsonFormatOptions.colonSpacing,
	compactArrays: defaultJsonFormatOptions.compactArrays,
	maxDepthStr: String(defaultJsonFormatOptions.maxDepth),
};

type Transform = (input: string) => string;

const identity: Transform = (input) => input;

const escapeUnicodeTransform: Transform = (input) =>
	input.replace(/[-￿]/g, (char) => `\\u${`0000${char.charCodeAt(0).toString(16)}`.slice(-4)}`);

const arrayBracketSpacingTransform: Transform = (input) =>
	input.replace(/\[(?!\s*\n)/g, '[ ').replace(/(?<!\n\s*)\]/g, ' ]');

const objectBracketSpacingTransform: Transform = (input) =>
	input.replace(/\{(?!\s*\n)/g, '{ ').replace(/(?<!\n\s*)\}/g, ' }');

const stripColonSpacingTransform: Transform = (input) => input.replace(/:\s+/g, ':');

const compactArraysTransform: Transform = (input) =>
	input.replace(
		/\[\s*\n(\s*)((?:"[^"]*"|'[^']*'|[\d.eE+-]+|true|false|null)(?:,\s*\n\s*(?:"[^"]*"|'[^']*'|[\d.eE+-]+|true|false|null))*)\s*\n\s*\]/g,
		(_, _indent, content: string) => {
			const items = content.split(/,\s*\n\s*/);
			return `[${items.join(', ')}]`;
		}
	);

const buildFormatTransforms = (options: Partial<JsonFormatOptions>): readonly Transform[] => {
	const compactArraysEnabled = Boolean(options.compactArrays) && (options.indentSize ?? 2) > 0;
	return [
		options.escapeUnicode ? escapeUnicodeTransform : identity,
		options.arrayBracketSpacing ? arrayBracketSpacingTransform : identity,
		options.objectBracketSpacing ? objectBracketSpacingTransform : identity,
		options.colonSpacing ? identity : stripColonSpacingTransform,
		compactArraysEnabled ? compactArraysTransform : identity,
	];
};

const toJsonFormatOptions = (tabOptions: JsonFormatTabOptions): Partial<JsonFormatOptions> => ({
	indentSize: Number.parseInt(tabOptions.indentSizeStr, 10) || 2,
	indentType: tabOptions.indentType,
	sortKeys: tabOptions.sortKeys,
	removeNulls: tabOptions.removeNulls,
	removeEmptyStrings: tabOptions.removeEmptyStrings,
	removeEmptyArrays: tabOptions.removeEmptyArrays,
	removeEmptyObjects: tabOptions.removeEmptyObjects,
	escapeUnicode: tabOptions.escapeUnicode,
	trailingComma: tabOptions.trailingComma,
	quoteStyle: tabOptions.quoteStyle,
	arrayBracketSpacing: tabOptions.arrayBracketSpacing,
	objectBracketSpacing: tabOptions.objectBracketSpacing,
	colonSpacing: tabOptions.colonSpacing,
	compactArrays: tabOptions.compactArrays,
	maxDepth: Number.parseInt(tabOptions.maxDepthStr, 10) || 0,
});

const buildComputeOutput =
	(inputFormat: JsonInputFormat, outputFormat: JsonOutputFormat) =>
	(input: string, mode: FormatMode, tabOptions: JsonFormatTabOptions) => {
		if (!input.trim()) return { output: '', error: '' };

		const formatOptions = toJsonFormatOptions(tabOptions);

		try {
			const data = parseJson(input, inputFormat);
			const processedData = processJsonWithOptions(data, formatOptions);

			if (mode === 'minify') {
				return {
					output: stringifyJson(processedData, outputFormat, { indent: 0 }),
					error: '',
				};
			}

			const baseResult = stringifyJson(processedData, outputFormat, {
				indent: formatOptions.indentType === 'tabs' ? '\t' : formatOptions.indentSize,
				sortKeys: formatOptions.sortKeys,
				trailingComma: formatOptions.trailingComma,
				quote: formatOptions.quoteStyle,
			});

			const transforms = buildFormatTransforms(formatOptions);
			return {
				output: transforms.reduce((acc, transform) => transform(acc), baseResult),
				error: '',
			};
		} catch (e) {
			return { output: '', error: getErrorMessage(e, 'Invalid JSON') };
		}
	};

const buildValidate = (inputFormat: JsonInputFormat) => (input: string) => {
	if (!input.trim()) return null;
	return validateJson(input, inputFormat).valid;
};

interface FormatTabProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange?: (stats: {
		readonly input: string;
		readonly valid: boolean | null;
		readonly error: string;
	}) => void;
}

export function FormatTab({ input, onInputChange, onStatsChange }: FormatTabProps) {
	const { value: jsonOptions } = useJsonFormatterOptions();
	const { inputFormat, outputFormat } = jsonOptions;

	const handleFormatInput = () => {
		try {
			const data = parseJson(input, inputFormat);
			onInputChange(JSON.stringify(data, null, 2));
		} catch {
			// Invalid JSON.
		}
	};

	const handleMinifyInput = () => {
		try {
			const data = parseJson(input, inputFormat);
			onInputChange(JSON.stringify(data));
		} catch {
			// Invalid JSON.
		}
	};

	const inputContextMenuItems: readonly ContextMenuItem[] = [
		{ text: 'Format JSON', enabled: input.trim().length > 0, action: handleFormatInput },
		{ text: 'Minify JSON', enabled: input.trim().length > 0, action: handleMinifyInput },
	];

	const renderOptions = (
		options: JsonFormatTabOptions,
		setOptions: (next: JsonFormatTabOptions) => void
	): ReactNode => {
		const update = <K extends keyof JsonFormatTabOptions>(key: K, value: JsonFormatTabOptions[K]) =>
			setOptions({ ...options, [key]: value });

		return (
			<>
				<FormSection title="Indentation">
					<div className="grid grid-cols-2 gap-2">
						<FormSelect
							label="Size"
							value={options.indentSizeStr}
							onValueChange={(v) => update('indentSizeStr', v)}
							options={['1', '2', '3', '4', '8']}
							size="compact"
						/>
						<FormSelect
							label="Type"
							value={options.indentType}
							onValueChange={(v) => update('indentType', v as IndentType)}
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
							value={options.quoteStyle}
							onValueChange={(v) => update('quoteStyle', v as QuoteStyle)}
							options={[
								{ value: 'double', label: '"..."' },
								{ value: 'single', label: "'...'" },
							]}
							size="compact"
						/>
						<FormSelect
							label="Max Depth"
							value={options.maxDepthStr}
							onValueChange={(v) => update('maxDepthStr', v)}
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
							checked={options.sortKeys}
							onCheckedChange={(v) => update('sortKeys', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Escape unicode characters"
							checked={options.escapeUnicode}
							onCheckedChange={(v) => update('escapeUnicode', v)}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Spacing">
					<FormCheckboxGroup>
						<FormCheckbox
							label="Space after colon"
							checked={options.colonSpacing}
							onCheckedChange={(v) => update('colonSpacing', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Array bracket spacing"
							checked={options.arrayBracketSpacing}
							onCheckedChange={(v) => update('arrayBracketSpacing', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Object bracket spacing"
							checked={options.objectBracketSpacing}
							onCheckedChange={(v) => update('objectBracketSpacing', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Trailing commas"
							checked={options.trailingComma}
							onCheckedChange={(v) => update('trailingComma', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Compact arrays"
							checked={options.compactArrays}
							onCheckedChange={(v) => update('compactArrays', v)}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Filtering">
					<FormCheckboxGroup>
						<FormCheckbox
							label="Remove null values"
							checked={options.removeNulls}
							onCheckedChange={(v) => update('removeNulls', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Remove empty strings"
							checked={options.removeEmptyStrings}
							onCheckedChange={(v) => update('removeEmptyStrings', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Remove empty arrays"
							checked={options.removeEmptyArrays}
							onCheckedChange={(v) => update('removeEmptyArrays', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Remove empty objects"
							checked={options.removeEmptyObjects}
							onCheckedChange={(v) => update('removeEmptyObjects', v)}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>
			</>
		);
	};

	return (
		<FormatTabTemplate<JsonFormatTabOptions>
			input={input}
			onInputChange={onInputChange}
			onStatsChange={onStatsChange}
			inputEditorMode="json"
			inputPlaceholder="Enter JSON here..."
			outputPlaceholder="Formatted output..."
			emptyIcon={FileText}
			emptyTitle="Enter JSON to format"
			emptyDescription="The formatted (or minified) document will appear here."
			sampleText={SAMPLE_JSON}
			validate={buildValidate(inputFormat)}
			computeOutput={buildComputeOutput(inputFormat, outputFormat)}
			defaultOptions={DEFAULT_OPTIONS}
			renderOptions={renderOptions}
			renderRailHeader={() => <JsonFormatSection />}
			inputContextMenuItems={inputContextMenuItems}
		/>
	);
}

export type { FormatTabProps };
