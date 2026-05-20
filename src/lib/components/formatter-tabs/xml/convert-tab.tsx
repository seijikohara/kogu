import { useCallback, useState } from 'react';

import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInput,
	FormMode,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { ConvertTab as ConvertTabTemplate } from '@/lib/components/template';
import {
	type XmlToJsonOptions,
	type XmlToYamlOptions,
	xmlToJson,
	xmlToYaml,
} from '@/lib/services/formatters';
import { copyToClipboard, pasteFromClipboard } from '@/lib/utils/file-operations';

type ConvertFormat = 'json' | 'yaml';
type YamlStringType = 'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE' | 'BLOCK_LITERAL' | 'BLOCK_FOLDED';
type YamlCollectionStyle = 'any' | 'block' | 'flow';
type YamlKeyType = 'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE';

interface TabStats {
	readonly input: string;
	readonly valid: boolean | null;
	readonly error: string;
}

interface ConvertTabProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange?: (stats: TabStats) => void;
}

export function ConvertTab({ input, onInputChange, onStatsChange }: ConvertTabProps) {
	const [convertFormat, setConvertFormat] = useState<ConvertFormat>('json');

	// JSON options.
	const [jsonIndentStr, setJsonIndentStr] = useState<string>('2');
	const [jsonSortKeys, setJsonSortKeys] = useState<boolean>(false);

	// YAML basic formatting options.
	const [yamlIndentStr, setYamlIndentStr] = useState<string>('2');
	const [yamlLineWidthStr, setYamlLineWidthStr] = useState<string>('80');
	const [yamlMinContentWidthStr] = useState<string>('20');

	// YAML string handling options.
	const [yamlStringType, setYamlStringType] = useState<YamlStringType>('PLAIN');
	const [yamlSingleQuote, setYamlSingleQuote] = useState<boolean>(false);
	const [yamlForceQuotes, setYamlForceQuotes] = useState<boolean>(false);
	const [yamlDoubleQuotedAsJSON, setYamlDoubleQuotedAsJSON] = useState<boolean>(false);

	// YAML collection style options.
	const [yamlCollectionStyle, setYamlCollectionStyle] = useState<YamlCollectionStyle>('block');
	const [yamlFlowCollectionPadding, setYamlFlowCollectionPadding] = useState<boolean>(false);
	const [yamlIndentSeq, setYamlIndentSeq] = useState<boolean>(true);

	// YAML key handling options.
	const [yamlKeyType, setYamlKeyType] = useState<YamlKeyType>('PLAIN');
	const [yamlSortKeys, setYamlSortKeys] = useState<boolean>(false);

	// YAML reference handling options.
	const [yamlNoRefs, setYamlNoRefs] = useState<boolean>(true);

	// YAML null / boolean formatting options.
	const [yamlNullStr, setYamlNullStr] = useState<string>('null');
	const [yamlTrueStr, setYamlTrueStr] = useState<string>('true');
	const [yamlFalseStr, setYamlFalseStr] = useState<string>('false');

	const jsonIndent = Number.parseInt(jsonIndentStr, 10) || 2;
	const yamlIndent = Number.parseInt(yamlIndentStr, 10) || 2;
	const yamlLineWidth = Number.parseInt(yamlLineWidthStr, 10) || 80;
	const yamlMinContentWidth = Number.parseInt(yamlMinContentWidthStr, 10) || 20;

	const jsonOptions: XmlToJsonOptions = {
		indent: jsonIndent,
		sortKeys: jsonSortKeys,
	};

	const yamlOptions: XmlToYamlOptions = {
		indent: yamlIndent,
		lineWidth: yamlLineWidth,
		minContentWidth: yamlMinContentWidth,
		defaultStringType: yamlStringType,
		singleQuote: yamlSingleQuote,
		forceQuotes: yamlForceQuotes,
		doubleQuotedAsJSON: yamlDoubleQuotedAsJSON,
		collectionStyle: yamlCollectionStyle,
		flowCollectionPadding: yamlFlowCollectionPadding,
		indentSeq: yamlIndentSeq,
		defaultKeyType: yamlKeyType,
		sortKeys: yamlSortKeys,
		noRefs: yamlNoRefs,
		nullStr: yamlNullStr,
		trueStr: yamlTrueStr,
		falseStr: yamlFalseStr,
	};

	const validate = useCallback((value: string): { valid: boolean | null } => {
		if (!value.trim()) return { valid: null };
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(value, 'application/xml');
			const parserError = doc.querySelector('parsererror');
			return { valid: parserError === null };
		} catch {
			return { valid: false };
		}
	}, []);

	const convert = useCallback(
		(value: string): { output: string; error: string } => {
			try {
				const result =
					convertFormat === 'json' ? xmlToJson(value, jsonOptions) : xmlToYaml(value, yamlOptions);
				return { output: result, error: '' };
			} catch (e) {
				return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
			}
		},
		[convertFormat, jsonOptions, yamlOptions]
	);

	const outputEditorMode = convertFormat === 'json' ? 'json' : 'yaml';
	const outputTitle = `Output (${convertFormat.toUpperCase()})`;

	const handleCopyAdapter = (text: string): void => {
		copyToClipboard(text).catch(() => {
			// Clipboard write failed; ignore.
		});
	};

	return (
		<ConvertTabTemplate
			inputEditorMode="xml"
			outputEditorMode={outputEditorMode}
			input={input}
			onInputChange={onInputChange}
			placeholder="Enter XML here..."
			validate={validate}
			convert={convert}
			onStatsChange={onStatsChange}
			outputTitle={outputTitle}
			copyToClipboard={handleCopyAdapter}
			pasteFromClipboard={pasteFromClipboard}
			renderOptions={() => (
				<>
					<FormSection title="Output Format">
						<FormMode
							value={convertFormat}
							onValueChange={setConvertFormat}
							options={[
								{ value: 'json', label: 'JSON' },
								{ value: 'yaml', label: 'YAML' },
							]}
						/>
					</FormSection>

					{convertFormat === 'json' ? (
						<>
							<FormSection title="Formatting">
								<FormSelect
									label="Indent"
									value={jsonIndentStr}
									onValueChange={setJsonIndentStr}
									options={[
										{ value: '0', label: 'None' },
										{ value: '2', label: '2' },
										{ value: '4', label: '4' },
										{ value: '8', label: '8' },
									]}
									size="compact"
								/>
							</FormSection>

							<FormSection title="Keys">
								<FormCheckbox
									label="Sort keys alphabetically"
									checked={jsonSortKeys}
									onCheckedChange={setJsonSortKeys}
									size="compact"
								/>
							</FormSection>
						</>
					) : null}

					{convertFormat === 'yaml' ? (
						<>
							<FormSection title="Formatting">
								<div className="grid grid-cols-2 gap-2">
									<FormSelect
										label="Indent"
										value={yamlIndentStr}
										onValueChange={setYamlIndentStr}
										options={['2', '4', '8']}
										size="compact"
									/>
									<FormSelect
										label="Line Width"
										value={yamlLineWidthStr}
										onValueChange={setYamlLineWidthStr}
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
									value={yamlCollectionStyle}
									onValueChange={(v) => setYamlCollectionStyle(v as YamlCollectionStyle)}
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
										checked={yamlIndentSeq}
										onCheckedChange={setYamlIndentSeq}
										size="compact"
									/>
									<FormCheckbox
										label="Flow collection padding"
										checked={yamlFlowCollectionPadding}
										onCheckedChange={setYamlFlowCollectionPadding}
										size="compact"
									/>
								</FormCheckboxGroup>
							</FormSection>

							<FormSection title="Strings">
								<FormSelect
									label="String Style"
									value={yamlStringType}
									onValueChange={(v) => setYamlStringType(v as YamlStringType)}
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
										checked={yamlForceQuotes}
										onCheckedChange={setYamlForceQuotes}
										size="compact"
									/>
									<FormCheckbox
										label="Prefer single quotes"
										checked={yamlSingleQuote}
										onCheckedChange={setYamlSingleQuote}
										size="compact"
									/>
									<FormCheckbox
										label="Double-quoted as JSON style"
										checked={yamlDoubleQuotedAsJSON}
										onCheckedChange={setYamlDoubleQuotedAsJSON}
										size="compact"
									/>
								</FormCheckboxGroup>
							</FormSection>

							<FormSection title="Keys">
								<FormSelect
									label="Key Style"
									value={yamlKeyType}
									onValueChange={(v) => setYamlKeyType(v as YamlKeyType)}
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
										checked={yamlSortKeys}
										onCheckedChange={setYamlSortKeys}
										size="compact"
									/>
								</FormCheckboxGroup>
							</FormSection>

							<FormSection title="Special Values">
								<div className="grid grid-cols-3 gap-2">
									<FormInput
										label="Null"
										value={yamlNullStr}
										onValueChange={setYamlNullStr}
										placeholder="null"
										size="compact"
										className="font-mono"
									/>
									<FormInput
										label="True"
										value={yamlTrueStr}
										onValueChange={setYamlTrueStr}
										placeholder="true"
										size="compact"
										className="font-mono"
									/>
									<FormInput
										label="False"
										value={yamlFalseStr}
										onValueChange={setYamlFalseStr}
										placeholder="false"
										size="compact"
										className="font-mono"
									/>
								</div>
							</FormSection>

							<FormSection title="Advanced">
								<FormCheckbox
									label="Disable YAML references/aliases"
									checked={yamlNoRefs}
									onCheckedChange={setYamlNoRefs}
									size="compact"
								/>
							</FormSection>
						</>
					) : null}
				</>
			)}
		/>
	);
}

export type { ConvertTabProps };
