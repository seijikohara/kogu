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
	type JsonToXmlOptions,
	type JsonToYamlOptions,
	jsonToXml,
	jsonToYaml,
	validateJson,
} from '@/lib/services/formatters';
import { useJsonFormatterOptions } from '@/lib/stores';
import { copyToClipboard, pasteFromClipboard } from '@/lib/utils/file-operations';

import { JsonFormatSection } from './json-format-section';

type ConvertFormat = 'yaml' | 'xml';
type YamlStringType = 'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE' | 'BLOCK_LITERAL' | 'BLOCK_FOLDED';
type YamlCollectionStyle = 'any' | 'block' | 'flow';
type YamlKeyType = 'PLAIN' | 'QUOTE_SINGLE' | 'QUOTE_DOUBLE';
type XmlIndentType = 'spaces' | 'tabs';
type XmlLineSeparator = '\n' | '\r\n';

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
	const { value: jsonOptions } = useJsonFormatterOptions();
	const { inputFormat } = jsonOptions;

	const [convertFormat, setConvertFormat] = useState<ConvertFormat>('yaml');

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

	// XML structure options.
	const [xmlRootName, setXmlRootName] = useState<string>('root');
	const [xmlArrayItemName, setXmlArrayItemName] = useState<string>('item');
	const [xmlAttributePrefix, setXmlAttributePrefix] = useState<string>('@');

	// XML formatting options.
	const [xmlIndentStr, setXmlIndentStr] = useState<string>('2');
	const [xmlIndentType, setXmlIndentType] = useState<XmlIndentType>('spaces');
	const [xmlLineSeparator, setXmlLineSeparator] = useState<XmlLineSeparator>('\n');
	const [xmlCollapseContent, setXmlCollapseContent] = useState<boolean>(false);

	// XML declaration options.
	const [xmlDeclaration, setXmlDeclaration] = useState<boolean>(true);
	const [xmlDeclarationVersion, setXmlDeclarationVersion] = useState<string>('1.0');
	const [xmlDeclarationEncoding, setXmlDeclarationEncoding] = useState<string>('UTF-8');

	// XML tag options.
	const [xmlSelfClosing, setXmlSelfClosing] = useState<boolean>(true);
	const [xmlWhiteSpaceAtEndOfSelfclosingTag, setXmlWhiteSpaceAtEndOfSelfclosingTag] =
		useState<boolean>(false);

	// XML content options.
	const [xmlCdata, setXmlCdata] = useState<boolean>(false);
	const [xmlCdataThresholdStr, setXmlCdataThresholdStr] = useState<string>('0');
	const [xmlEscapeText, setXmlEscapeText] = useState<boolean>(true);
	const [xmlSortAttributes, setXmlSortAttributes] = useState<boolean>(false);
	const [xmlSortKeys, setXmlSortKeys] = useState<boolean>(false);

	// XML comments options.
	const [xmlHeaderComment, setXmlHeaderComment] = useState<string>('');

	const yamlIndent = Number.parseInt(yamlIndentStr, 10) || 2;
	const yamlLineWidth = Number.parseInt(yamlLineWidthStr, 10) || 80;
	const yamlMinContentWidth = Number.parseInt(yamlMinContentWidthStr, 10) || 20;
	const xmlIndent = Number.parseInt(xmlIndentStr, 10) || 2;
	const xmlCdataThreshold = Number.parseInt(xmlCdataThresholdStr, 10) || 0;

	const yamlOptions: JsonToYamlOptions = {
		// Basic formatting.
		indent: yamlIndent,
		lineWidth: yamlLineWidth,
		minContentWidth: yamlMinContentWidth,
		// String handling.
		defaultStringType: yamlStringType,
		singleQuote: yamlSingleQuote,
		forceQuotes: yamlForceQuotes,
		doubleQuotedAsJSON: yamlDoubleQuotedAsJSON,
		// Collection style.
		collectionStyle: yamlCollectionStyle,
		flowCollectionPadding: yamlFlowCollectionPadding,
		indentSeq: yamlIndentSeq,
		// Key handling.
		defaultKeyType: yamlKeyType,
		sortKeys: yamlSortKeys,
		// Reference handling.
		noRefs: yamlNoRefs,
		// Null / boolean formatting.
		nullStr: yamlNullStr,
		trueStr: yamlTrueStr,
		falseStr: yamlFalseStr,
	};

	const xmlOptions: JsonToXmlOptions = {
		// Structure.
		rootName: xmlRootName,
		arrayItemName: xmlArrayItemName,
		attributePrefix: xmlAttributePrefix,
		// Formatting.
		indent: xmlIndent,
		indentType: xmlIndentType,
		lineSeparator: xmlLineSeparator,
		collapseContent: xmlCollapseContent,
		// Declaration.
		declaration: xmlDeclaration,
		declarationVersion: xmlDeclarationVersion,
		declarationEncoding: xmlDeclarationEncoding,
		// Tags.
		selfClosing: xmlSelfClosing,
		whiteSpaceAtEndOfSelfclosingTag: xmlWhiteSpaceAtEndOfSelfclosingTag,
		// Content.
		cdata: xmlCdata,
		cdataThreshold: xmlCdataThreshold,
		escapeText: xmlEscapeText,
		sortAttributes: xmlSortAttributes,
		sortKeys: xmlSortKeys,
		// Comments.
		headerComment: xmlHeaderComment || undefined,
	};

	const validate = useCallback(
		(value: string): { valid: boolean | null } => {
			if (!value.trim()) return { valid: null };
			const result = validateJson(value, inputFormat);
			return { valid: result.valid };
		},
		[inputFormat]
	);

	const convert = useCallback(
		(value: string): { output: string; error: string } => {
			try {
				const result =
					convertFormat === 'yaml'
						? jsonToYaml(value, yamlOptions, inputFormat)
						: jsonToXml(value, xmlOptions, inputFormat);
				return { output: result, error: '' };
			} catch (e) {
				return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
			}
		},
		[convertFormat, yamlOptions, xmlOptions, inputFormat]
	);

	const outputEditorMode = convertFormat === 'yaml' ? 'yaml' : 'xml';
	const outputTitle = `Output (${convertFormat.toUpperCase()})`;

	const handleCopyAdapter = (text: string): void => {
		copyToClipboard(text).catch(() => {
			// Clipboard write failed; ignore.
		});
	};

	return (
		<ConvertTabTemplate
			inputEditorMode="json"
			outputEditorMode={outputEditorMode}
			input={input}
			onInputChange={onInputChange}
			placeholder="Enter JSON here..."
			validate={validate}
			convert={convert}
			onStatsChange={onStatsChange}
			outputTitle={outputTitle}
			copyToClipboard={handleCopyAdapter}
			pasteFromClipboard={pasteFromClipboard}
			renderFormatSection={() => <JsonFormatSection showOutput={false} />}
			renderOptions={() => (
				<>
					<FormSection title="Output Format">
						<FormMode
							value={convertFormat}
							onValueChange={setConvertFormat}
							options={[
								{ value: 'yaml', label: 'YAML' },
								{ value: 'xml', label: 'XML' },
							]}
						/>
					</FormSection>

					{convertFormat === 'yaml' ? (
						<>
							<FormSection title="Formatting">
								<div className="grid grid-cols-2 gap-2">
									<FormSelect
										label="Indent"
										value={yamlIndentStr}
										onValueChange={setYamlIndentStr}
										options={['2', '4', '8']}
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
								/>
								<FormCheckboxGroup className="pt-1">
									<FormCheckbox
										label="Indent sequences"
										checked={yamlIndentSeq}
										onCheckedChange={setYamlIndentSeq}
									/>
									<FormCheckbox
										label="Flow collection padding"
										checked={yamlFlowCollectionPadding}
										onCheckedChange={setYamlFlowCollectionPadding}
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
								/>
								<FormCheckboxGroup className="pt-1">
									<FormCheckbox
										label="Force quotes on all strings"
										checked={yamlForceQuotes}
										onCheckedChange={setYamlForceQuotes}
									/>
									<FormCheckbox
										label="Prefer single quotes"
										checked={yamlSingleQuote}
										onCheckedChange={setYamlSingleQuote}
									/>
									<FormCheckbox
										label="Double-quoted as JSON style"
										checked={yamlDoubleQuotedAsJSON}
										onCheckedChange={setYamlDoubleQuotedAsJSON}
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
								/>
								<FormCheckboxGroup className="pt-1">
									<FormCheckbox
										label="Sort keys alphabetically"
										checked={yamlSortKeys}
										onCheckedChange={setYamlSortKeys}
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
								/>
							</FormSection>
						</>
					) : null}

					{convertFormat === 'xml' ? (
						<>
							<FormSection title="Structure">
								<div className="grid grid-cols-2 gap-2">
									<FormInput
										label="Root Element"
										value={xmlRootName}
										onValueChange={setXmlRootName}
										placeholder="root"
										size="compact"
									/>
									<FormInput
										label="Array Item"
										value={xmlArrayItemName}
										onValueChange={setXmlArrayItemName}
										placeholder="item"
										size="compact"
									/>
								</div>
								<FormInput
									label="Attribute Prefix"
									value={xmlAttributePrefix}
									onValueChange={setXmlAttributePrefix}
									placeholder="@"
									size="compact"
									className="font-mono"
								/>
							</FormSection>

							<FormSection title="Formatting">
								<div className="grid grid-cols-2 gap-2">
									<FormSelect
										label="Indent"
										value={xmlIndentStr}
										onValueChange={setXmlIndentStr}
										options={[
											{ value: '0', label: 'None' },
											{ value: '2', label: '2' },
											{ value: '4', label: '4' },
											{ value: '8', label: '8' },
										]}
									/>
									<FormSelect
										label="Indent Type"
										value={xmlIndentType}
										onValueChange={(v) => setXmlIndentType(v as XmlIndentType)}
										options={[
											{ value: 'spaces', label: 'Spaces' },
											{ value: 'tabs', label: 'Tabs' },
										]}
									/>
								</div>
								<FormSelect
									label="Line Separator"
									value={xmlLineSeparator}
									onValueChange={(v) => setXmlLineSeparator(v as XmlLineSeparator)}
									options={[
										{ value: '\n', label: 'LF (Unix)' },
										{ value: '\r\n', label: 'CRLF (Windows)' },
									]}
								/>
								<FormCheckboxGroup className="pt-1">
									<FormCheckbox
										label="Collapse content on single line"
										checked={xmlCollapseContent}
										onCheckedChange={setXmlCollapseContent}
									/>
								</FormCheckboxGroup>
							</FormSection>

							<FormSection title="Declaration">
								<FormCheckbox
									label="Include XML declaration"
									checked={xmlDeclaration}
									onCheckedChange={setXmlDeclaration}
								/>
								{xmlDeclaration ? (
									<div className="grid grid-cols-2 gap-2 pt-1">
										<FormInput
											label="Version"
											value={xmlDeclarationVersion}
											onValueChange={setXmlDeclarationVersion}
											placeholder="1.0"
											size="compact"
											className="font-mono"
										/>
										<FormInput
											label="Encoding"
											value={xmlDeclarationEncoding}
											onValueChange={setXmlDeclarationEncoding}
											placeholder="UTF-8"
											size="compact"
											className="font-mono"
										/>
									</div>
								) : null}
							</FormSection>

							<FormSection title="Tags">
								<FormCheckbox
									label="Use self-closing tags"
									checked={xmlSelfClosing}
									onCheckedChange={setXmlSelfClosing}
								/>
								<FormCheckbox
									label="Space before self-closing />"
									checked={xmlWhiteSpaceAtEndOfSelfclosingTag}
									onCheckedChange={setXmlWhiteSpaceAtEndOfSelfclosingTag}
								/>
							</FormSection>

							<FormSection title="Content">
								<FormCheckbox
									label="Wrap text in CDATA"
									checked={xmlCdata}
									onCheckedChange={setXmlCdata}
								/>
								{xmlCdata ? (
									<div className="pt-1">
										<FormInput
											label="CDATA Threshold (chars)"
											value={xmlCdataThresholdStr}
											onValueChange={setXmlCdataThresholdStr}
											placeholder="0"
											size="compact"
											className="font-mono"
											hint="0 = always use CDATA"
										/>
									</div>
								) : null}
								<FormCheckbox
									label="Escape special characters"
									checked={xmlEscapeText}
									onCheckedChange={setXmlEscapeText}
								/>
							</FormSection>

							<FormSection title="Sorting">
								<FormCheckboxGroup>
									<FormCheckbox
										label="Sort element keys"
										checked={xmlSortKeys}
										onCheckedChange={setXmlSortKeys}
									/>
									<FormCheckbox
										label="Sort attributes"
										checked={xmlSortAttributes}
										onCheckedChange={setXmlSortAttributes}
									/>
								</FormCheckboxGroup>
							</FormSection>

							<FormSection title="Comments">
								<FormInput
									label="Header Comment"
									value={xmlHeaderComment}
									onValueChange={setXmlHeaderComment}
									placeholder="Optional comment..."
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
