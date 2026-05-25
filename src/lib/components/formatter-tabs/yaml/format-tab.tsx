import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import * as yaml from 'yaml';

import type { ContextMenuItem } from '@/lib/components/editor';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInput,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { FormatTabTemplate, type FormatMode } from '@/lib/components/template';
import { SAMPLE_YAML, sortKeysDeep, validateYaml } from '@/lib/services/formatters';
import { getErrorMessage } from '@/lib/utils';

type YamlStringType = 'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE' | 'BLOCK_LITERAL' | 'BLOCK_FOLDED';
type YamlCollectionStyle = 'any' | 'block' | 'flow';
type YamlKeyType = 'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE';

interface YamlFormatTabOptions {
	readonly indentSizeStr: string;
	readonly lineWidthStr: string;
	readonly stringType: YamlStringType;
	readonly singleQuote: boolean;
	readonly forceQuotes: boolean;
	readonly doubleQuotedAsJSON: boolean;
	readonly collectionStyle: YamlCollectionStyle;
	readonly flowCollectionPadding: boolean;
	readonly indentSeq: boolean;
	readonly keyType: YamlKeyType;
	readonly sortKeys: boolean;
	readonly noRefs: boolean;
	readonly nullStr: string;
	readonly trueStr: string;
	readonly falseStr: string;
}

const DEFAULT_OPTIONS: YamlFormatTabOptions = {
	indentSizeStr: '2',
	lineWidthStr: '80',
	stringType: 'PLAIN',
	singleQuote: false,
	forceQuotes: false,
	doubleQuotedAsJSON: false,
	collectionStyle: 'block',
	flowCollectionPadding: false,
	indentSeq: true,
	keyType: 'PLAIN',
	sortKeys: false,
	noRefs: true,
	nullStr: 'null',
	trueStr: 'true',
	falseStr: 'false',
};

const MIN_CONTENT_WIDTH = 20;

const computeOutput = (input: string, mode: FormatMode, tab: YamlFormatTabOptions) => {
	if (!input.trim()) return { output: '', error: '' };

	const validation = validateYaml(input);
	if (!validation.valid) {
		return { output: '', error: validation.error ?? 'Invalid YAML' };
	}

	try {
		if (mode === 'minify') {
			return {
				output: yaml.stringify(yaml.parse(input), { indent: 1, indentSeq: false }),
				error: '',
			};
		}

		const parsed = yaml.parse(input);
		const data = tab.sortKeys ? sortKeysDeep(parsed) : parsed;

		const defaultStringType: YamlStringType = tab.singleQuote
			? 'QUOTE_SINGLE'
			: tab.forceQuotes && tab.stringType === 'PLAIN'
				? 'QUOTE_DOUBLE'
				: tab.stringType;

		const indent = Number.parseInt(tab.indentSizeStr, 10) || 2;
		const lineWidth = Number.parseInt(tab.lineWidthStr, 10) || 80;

		const result = yaml.stringify(data, {
			indent,
			lineWidth: lineWidth === 0 ? 0 : lineWidth,
			minContentWidth: MIN_CONTENT_WIDTH,
			defaultStringType,
			doubleQuotedAsJSON: tab.doubleQuotedAsJSON,
			collectionStyle: tab.collectionStyle,
			flowCollectionPadding: tab.flowCollectionPadding,
			indentSeq: tab.indentSeq,
			defaultKeyType: tab.keyType,
			aliasDuplicateObjects: !tab.noRefs,
			nullStr: tab.nullStr,
			trueStr: tab.trueStr,
			falseStr: tab.falseStr,
		});

		return { output: result, error: '' };
	} catch (e) {
		return { output: '', error: getErrorMessage(e, 'Invalid YAML') };
	}
};

const validate = (input: string): boolean | null => {
	if (!input.trim()) return null;
	return validateYaml(input).valid;
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
	const handleFormatInput = () => {
		try {
			onInputChange(yaml.stringify(yaml.parse(input), { indent: 2 }));
		} catch {
			// Invalid YAML.
		}
	};

	const handleMinifyInput = () => {
		try {
			onInputChange(yaml.stringify(yaml.parse(input), { indent: 1, indentSeq: false }));
		} catch {
			// Invalid YAML.
		}
	};

	const inputContextMenuItems: readonly ContextMenuItem[] = [
		{ text: 'Format YAML', enabled: input.trim().length > 0, action: handleFormatInput },
		{ text: 'Minify YAML', enabled: input.trim().length > 0, action: handleMinifyInput },
	];

	const renderOptions = (
		options: YamlFormatTabOptions,
		setOptions: (next: YamlFormatTabOptions) => void
	): ReactNode => {
		const update = <K extends keyof YamlFormatTabOptions>(key: K, value: YamlFormatTabOptions[K]) =>
			setOptions({ ...options, [key]: value });

		return (
			<>
				<FormSection title="Formatting">
					<div className="grid grid-cols-2 gap-2">
						<FormSelect
							label="Indent"
							value={options.indentSizeStr}
							onValueChange={(v) => update('indentSizeStr', v)}
							options={['2', '4', '8']}
							size="compact"
						/>
						<FormSelect
							label="Line Width"
							value={options.lineWidthStr}
							onValueChange={(v) => update('lineWidthStr', v)}
							options={[
								{ value: '40', label: '40' },
								{ value: '80', label: '80' },
								{ value: '120', label: '120' },
								{ value: '0', label: '∞' },
							]}
							size="compact"
						/>
					</div>
					<FormSelect
						label="Collection Style"
						value={options.collectionStyle}
						onValueChange={(v) => update('collectionStyle', v as YamlCollectionStyle)}
						options={[
							{ value: 'block', label: 'Block' },
							{ value: 'flow', label: 'Flow ({...})' },
							{ value: 'any', label: 'Auto' },
						]}
						size="compact"
					/>
					<FormCheckboxGroup className="pt-1">
						<FormCheckbox
							label="Indent sequences"
							checked={options.indentSeq}
							onCheckedChange={(v) => update('indentSeq', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Flow collection padding"
							checked={options.flowCollectionPadding}
							onCheckedChange={(v) => update('flowCollectionPadding', v)}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Strings">
					<FormSelect
						label="String Style"
						value={options.stringType}
						onValueChange={(v) => update('stringType', v as YamlStringType)}
						options={[
							{ value: 'PLAIN', label: 'Plain' },
							{ value: 'QUOTE_SINGLE', label: "Single Quote (')" },
							{ value: 'QUOTE_DOUBLE', label: 'Double Quote (")' },
							{ value: 'BLOCK_LITERAL', label: 'Block Literal (|)' },
							{ value: 'BLOCK_FOLDED', label: 'Block Folded (>)' },
						]}
						size="compact"
					/>
					<FormCheckboxGroup className="pt-1">
						<FormCheckbox
							label="Force quotes on all strings"
							checked={options.forceQuotes}
							onCheckedChange={(v) => update('forceQuotes', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Prefer single quotes"
							checked={options.singleQuote}
							onCheckedChange={(v) => update('singleQuote', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Double-quoted as JSON style"
							checked={options.doubleQuotedAsJSON}
							onCheckedChange={(v) => update('doubleQuotedAsJSON', v)}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Keys">
					<FormSelect
						label="Key Style"
						value={options.keyType}
						onValueChange={(v) => update('keyType', v as YamlKeyType)}
						options={[
							{ value: 'PLAIN', label: 'Plain' },
							{ value: 'QUOTE_SINGLE', label: "Single Quote (')" },
							{ value: 'QUOTE_DOUBLE', label: 'Double Quote (")' },
						]}
						size="compact"
					/>
					<FormCheckboxGroup className="pt-1">
						<FormCheckbox
							label="Sort keys alphabetically"
							checked={options.sortKeys}
							onCheckedChange={(v) => update('sortKeys', v)}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Special Values">
					<div className="grid grid-cols-3 gap-2">
						<FormInput
							label="Null"
							value={options.nullStr}
							onValueChange={(v) => update('nullStr', v)}
							placeholder="null"
							size="compact"
							className="font-mono"
						/>
						<FormInput
							label="True"
							value={options.trueStr}
							onValueChange={(v) => update('trueStr', v)}
							placeholder="true"
							size="compact"
							className="font-mono"
						/>
						<FormInput
							label="False"
							value={options.falseStr}
							onValueChange={(v) => update('falseStr', v)}
							placeholder="false"
							size="compact"
							className="font-mono"
						/>
					</div>
				</FormSection>

				<FormSection title="Advanced">
					<FormCheckbox
						label="Disable YAML references/aliases"
						checked={options.noRefs}
						onCheckedChange={(v) => update('noRefs', v)}
						size="compact"
					/>
				</FormSection>
			</>
		);
	};

	return (
		<FormatTabTemplate<YamlFormatTabOptions>
			input={input}
			onInputChange={onInputChange}
			onStatsChange={onStatsChange}
			inputEditorMode="yaml"
			inputPlaceholder="Enter YAML here..."
			outputPlaceholder="Formatted output..."
			emptyIcon={FileText}
			emptyTitle="Enter YAML to format"
			emptyDescription="The formatted (or minified) document will appear here."
			sampleText={SAMPLE_YAML}
			validate={validate}
			computeOutput={computeOutput}
			defaultOptions={DEFAULT_OPTIONS}
			renderOptions={renderOptions}
			inputContextMenuItems={inputContextMenuItems}
		/>
	);
}

export type { FormatTabProps };
