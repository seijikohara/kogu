import { FileText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import * as yaml from 'yaml';

import { CodeEditor, type ContextMenuItem } from '@/lib/components/editor';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInput,
	FormMode,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { SplitPane } from '@/lib/components/layout';
import { OptionsPanel } from '@/lib/components/panel';
import { EmptyOutputPane } from '@/lib/components/status';
import { useClipboardActions } from '@/lib/hooks';
import { SAMPLE_YAML, sortKeysDeep, validateYaml } from '@/lib/services/formatters';

type FormatMode = 'format' | 'minify';
type YamlStringType = 'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE' | 'BLOCK_LITERAL' | 'BLOCK_FOLDED';
type YamlCollectionStyle = 'any' | 'block' | 'flow';
type YamlKeyType = 'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE';

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

	// Basic formatting options.
	const [indentSizeStr, setIndentSizeStr] = useState<string>('2');
	const [lineWidthStr, setLineWidthStr] = useState<string>('80');
	const [minContentWidthStr] = useState<string>('20');

	// String handling options.
	const [stringType, setStringType] = useState<YamlStringType>('PLAIN');
	const [singleQuote, setSingleQuote] = useState<boolean>(false);
	const [forceQuotes, setForceQuotes] = useState<boolean>(false);
	const [doubleQuotedAsJSON, setDoubleQuotedAsJSON] = useState<boolean>(false);

	// Collection style options.
	const [collectionStyle, setCollectionStyle] = useState<YamlCollectionStyle>('block');
	const [flowCollectionPadding, setFlowCollectionPadding] = useState<boolean>(false);
	const [indentSeq, setIndentSeq] = useState<boolean>(true);

	// Key handling options.
	const [keyType, setKeyType] = useState<YamlKeyType>('PLAIN');
	const [sortKeys, setSortKeys] = useState<boolean>(false);

	// Reference handling options.
	const [noRefs, setNoRefs] = useState<boolean>(true);

	// Null / boolean formatting options.
	const [nullStr, setNullStr] = useState<string>('null');
	const [trueStr, setTrueStr] = useState<string>('true');
	const [falseStr, setFalseStr] = useState<string>('false');

	const indentSize = Number.parseInt(indentSizeStr, 10) || 2;
	const lineWidth = Number.parseInt(lineWidthStr, 10) || 80;
	const minContentWidth = Number.parseInt(minContentWidthStr, 10) || 20;

	const validation = useMemo<{ valid: boolean | null }>(() => {
		if (!input.trim()) return { valid: null };
		const result = validateYaml(input);
		return { valid: result.valid };
	}, [input]);

	const { output, error: formatError } = ((): { output: string; error: string } => {
		if (!input.trim()) return { output: '', error: '' };

		// Validate first to reject non-YAML input.
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

			// Determine string type.
			const defaultStringType: YamlStringType = singleQuote
				? 'QUOTE_SINGLE'
				: forceQuotes && stringType === 'PLAIN'
					? 'QUOTE_DOUBLE'
					: stringType;

			const result = yaml.stringify(data, {
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

			return { output: result, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid YAML' };
		}
	})();

	useEffect(() => {
		onStatsChange?.({
			input,
			valid: validation.valid,
			error: formatError,
		});
	}, [input, validation.valid, formatError, onStatsChange]);

	const { handlePaste, handleClear, handleCopy } = useClipboardActions({
		onInputChange,
		output,
	});

	const handleSample = () => {
		onInputChange(SAMPLE_YAML);
	};

	const handleFormatInput = () => {
		try {
			const parsed = yaml.parse(input);
			const formatted = yaml.stringify(parsed, { indent: 2 });
			onInputChange(formatted);
		} catch {
			// Invalid YAML.
		}
	};

	const handleMinifyInput = () => {
		try {
			const parsed = yaml.parse(input);
			const minified = yaml.stringify(parsed, { indent: 1, indentSeq: false });
			onInputChange(minified);
		} catch {
			// Invalid YAML.
		}
	};

	const inputContextMenuItems: readonly ContextMenuItem[] = [
		{
			text: 'Format YAML',
			enabled: input.trim().length > 0,
			action: handleFormatInput,
		},
		{
			text: 'Minify YAML',
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

				<FormSection title="Formatting">
					<div className="grid grid-cols-2 gap-2">
						<FormSelect
							label="Indent"
							value={indentSizeStr}
							onValueChange={setIndentSizeStr}
							options={['2', '4', '8']}
							size="compact"
						/>
						<FormSelect
							label="Line Width"
							value={lineWidthStr}
							onValueChange={setLineWidthStr}
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
						value={collectionStyle}
						onValueChange={(v) => setCollectionStyle(v as YamlCollectionStyle)}
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
							checked={indentSeq}
							onCheckedChange={setIndentSeq}
							size="compact"
						/>
						<FormCheckbox
							label="Flow collection padding"
							checked={flowCollectionPadding}
							onCheckedChange={setFlowCollectionPadding}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Strings">
					<FormSelect
						label="String Style"
						value={stringType}
						onValueChange={(v) => setStringType(v as YamlStringType)}
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
							checked={forceQuotes}
							onCheckedChange={setForceQuotes}
							size="compact"
						/>
						<FormCheckbox
							label="Prefer single quotes"
							checked={singleQuote}
							onCheckedChange={setSingleQuote}
							size="compact"
						/>
						<FormCheckbox
							label="Double-quoted as JSON style"
							checked={doubleQuotedAsJSON}
							onCheckedChange={setDoubleQuotedAsJSON}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Keys">
					<FormSelect
						label="Key Style"
						value={keyType}
						onValueChange={(v) => setKeyType(v as YamlKeyType)}
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
							checked={sortKeys}
							onCheckedChange={setSortKeys}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Special Values">
					<div className="grid grid-cols-3 gap-2">
						<FormInput
							label="Null"
							value={nullStr}
							onValueChange={setNullStr}
							placeholder="null"
							size="compact"
							className="font-mono"
						/>
						<FormInput
							label="True"
							value={trueStr}
							onValueChange={setTrueStr}
							placeholder="true"
							size="compact"
							className="font-mono"
						/>
						<FormInput
							label="False"
							value={falseStr}
							onValueChange={setFalseStr}
							placeholder="false"
							size="compact"
							className="font-mono"
						/>
					</div>
				</FormSection>

				<FormSection title="Advanced">
					<FormCheckbox
						label="Disable YAML references/aliases"
						checked={noRefs}
						onCheckedChange={setNoRefs}
						size="compact"
					/>
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
						editorMode="yaml"
						placeholder="Enter YAML here..."
						onSample={handleSample}
						onPaste={handlePaste}
						onClear={handleClear}
						contextMenuItems={inputContextMenuItems}
					/>
				}
				right={
					input.trim().length === 0 ? (
						<EmptyOutputPane
							headerTitle="Output"
							icon={FileText}
							title="Enter YAML to format"
							description="The formatted (or minified) document will appear here."
						/>
					) : (
						<CodeEditor
							title="Output"
							value={output}
							mode="readonly"
							editorMode="yaml"
							placeholder="Formatted output..."
							onCopy={handleCopy}
						/>
					)
				}
			/>
		</div>
	);
}

export type { FormatTabProps };
