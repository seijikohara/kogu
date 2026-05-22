import { useCallback, useState } from 'react';
import * as yaml from 'yaml';

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
	type YamlToJsonOptions,
	type YamlToXmlOptions,
	yamlToJson,
	yamlToXml,
} from '@/lib/services/formatters';
import { copyToClipboard, pasteFromClipboard } from '@/lib/utils/file-operations';
import { getErrorMessage } from '@/lib/utils';

type ConvertFormat = 'json' | 'xml';
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
	const [convertFormat, setConvertFormat] = useState<ConvertFormat>('json');

	// JSON options.
	const [jsonIndentStr, setJsonIndentStr] = useState<string>('2');
	const [jsonSortKeys, setJsonSortKeys] = useState<boolean>(false);

	// XML options - Structure.
	const [xmlRootName, setXmlRootName] = useState<string>('root');
	const [xmlArrayItemName, setXmlArrayItemName] = useState<string>('item');
	const [xmlAttributePrefix, setXmlAttributePrefix] = useState<string>('@');

	// XML options - Formatting.
	const [xmlIndentStr, setXmlIndentStr] = useState<string>('2');
	const [xmlIndentType, setXmlIndentType] = useState<XmlIndentType>('spaces');
	const [xmlLineSeparator, setXmlLineSeparator] = useState<XmlLineSeparator>('\n');
	const [xmlCollapseContent, setXmlCollapseContent] = useState<boolean>(false);

	// XML options - Declaration.
	const [xmlDeclaration, setXmlDeclaration] = useState<boolean>(true);
	const [xmlDeclarationVersion, setXmlDeclarationVersion] = useState<string>('1.0');
	const [xmlDeclarationEncoding, setXmlDeclarationEncoding] = useState<string>('UTF-8');

	// XML options - Tags.
	const [xmlSelfClosing, setXmlSelfClosing] = useState<boolean>(true);
	const [xmlWhiteSpaceAtEndOfSelfclosingTag, setXmlWhiteSpaceAtEndOfSelfclosingTag] =
		useState<boolean>(false);

	// XML options - Content.
	const [xmlCdata, setXmlCdata] = useState<boolean>(false);
	const [xmlCdataThresholdStr, setXmlCdataThresholdStr] = useState<string>('0');
	const [xmlEscapeText, setXmlEscapeText] = useState<boolean>(true);
	const [xmlSortAttributes, setXmlSortAttributes] = useState<boolean>(false);
	const [xmlSortKeys, setXmlSortKeys] = useState<boolean>(false);

	// XML options - Comments.
	const [xmlHeaderComment, setXmlHeaderComment] = useState<string>('');

	const jsonIndent = Number.parseInt(jsonIndentStr, 10) || 2;
	const xmlIndent = Number.parseInt(xmlIndentStr, 10) || 2;
	const xmlCdataThreshold = Number.parseInt(xmlCdataThresholdStr, 10) || 0;

	const jsonOptions: YamlToJsonOptions = {
		indent: jsonIndent,
		sortKeys: jsonSortKeys,
	};

	const xmlOptions: YamlToXmlOptions = {
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

	const validate = useCallback((value: string): { valid: boolean | null } => {
		if (!value.trim()) return { valid: null };
		try {
			yaml.parse(value);
			return { valid: true };
		} catch {
			return { valid: false };
		}
	}, []);

	const convert = useCallback(
		(value: string): { output: string; error: string } => {
			try {
				const result =
					convertFormat === 'json' ? yamlToJson(value, jsonOptions) : yamlToXml(value, xmlOptions);
				return { output: result, error: '' };
			} catch (e) {
				return { output: '', error: getErrorMessage(e, 'Conversion failed') };
			}
		},
		[convertFormat, jsonOptions, xmlOptions]
	);

	const outputEditorMode = convertFormat === 'json' ? 'json' : 'xml';
	const outputTitle = `Output (${convertFormat.toUpperCase()})`;

	const handleCopyAdapter = (text: string): void => {
		copyToClipboard(text).catch(() => {
			// Clipboard write failed; ignore.
		});
	};

	return (
		<ConvertTabTemplate
			inputEditorMode="yaml"
			outputEditorMode={outputEditorMode}
			input={input}
			onInputChange={onInputChange}
			placeholder="Enter YAML here..."
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
								{ value: 'xml', label: 'XML' },
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
										size="compact"
									/>
									<FormSelect
										label="Indent Type"
										value={xmlIndentType}
										onValueChange={(v) => setXmlIndentType(v as XmlIndentType)}
										options={[
											{ value: 'spaces', label: 'Spaces' },
											{ value: 'tabs', label: 'Tabs' },
										]}
										size="compact"
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
									size="compact"
								/>
								<FormCheckboxGroup className="pt-1">
									<FormCheckbox
										label="Collapse content on single line"
										checked={xmlCollapseContent}
										onCheckedChange={setXmlCollapseContent}
										size="compact"
									/>
								</FormCheckboxGroup>
							</FormSection>

							<FormSection title="Declaration">
								<FormCheckbox
									label="Include XML declaration"
									checked={xmlDeclaration}
									onCheckedChange={setXmlDeclaration}
									size="compact"
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
									size="compact"
								/>
								<FormCheckbox
									label="Space before self-closing />"
									checked={xmlWhiteSpaceAtEndOfSelfclosingTag}
									onCheckedChange={setXmlWhiteSpaceAtEndOfSelfclosingTag}
									size="compact"
								/>
							</FormSection>

							<FormSection title="Content">
								<FormCheckbox
									label="Wrap text in CDATA"
									checked={xmlCdata}
									onCheckedChange={setXmlCdata}
									size="compact"
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
									size="compact"
								/>
							</FormSection>

							<FormSection title="Sorting">
								<FormCheckboxGroup>
									<FormCheckbox
										label="Sort element keys"
										checked={xmlSortKeys}
										onCheckedChange={setXmlSortKeys}
										size="compact"
									/>
									<FormCheckbox
										label="Sort attributes"
										checked={xmlSortAttributes}
										onCheckedChange={setXmlSortAttributes}
										size="compact"
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
