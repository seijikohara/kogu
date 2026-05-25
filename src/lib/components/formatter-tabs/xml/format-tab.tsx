import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ContextMenuItem } from '@/lib/components/editor';
import { FormCheckbox, FormCheckboxGroup, FormSection, FormSelect } from '@/lib/components/form';
import { FormatTabTemplate, type FormatMode } from '@/lib/components/template';
import {
	defaultXmlFormatOptions,
	formatXml,
	minifyXml,
	SAMPLE_XML,
	type XmlFormatOptions,
} from '@/lib/services/formatters';
import { getErrorMessage } from '@/lib/utils';

type IndentType = 'spaces' | 'tabs';

interface XmlFormatTabOptions {
	readonly indentSizeStr: string;
	readonly indentType: IndentType;
	readonly collapseContent: boolean;
	readonly whiteSpaceAtEndOfSelfclosingTag: boolean;
	readonly excludeComments: boolean;
	readonly preserveWhitespace: boolean;
	readonly forceSelfClosingEmptyTag: boolean;
	readonly sortAttributes: boolean;
}

const DEFAULT_OPTIONS: XmlFormatTabOptions = {
	indentSizeStr: String(defaultXmlFormatOptions.indentSize),
	indentType: defaultXmlFormatOptions.indentType,
	collapseContent: defaultXmlFormatOptions.collapseContent,
	whiteSpaceAtEndOfSelfclosingTag: defaultXmlFormatOptions.whiteSpaceAtEndOfSelfclosingTag,
	excludeComments: defaultXmlFormatOptions.excludeComments,
	preserveWhitespace: defaultXmlFormatOptions.preserveWhitespace,
	forceSelfClosingEmptyTag: defaultXmlFormatOptions.forceSelfClosingEmptyTag,
	sortAttributes: defaultXmlFormatOptions.sortAttributes,
};

const toXmlFormatOptions = (tab: XmlFormatTabOptions): Partial<XmlFormatOptions> => ({
	indentSize: Number.parseInt(tab.indentSizeStr, 10) || 2,
	indentType: tab.indentType,
	collapseContent: tab.collapseContent,
	whiteSpaceAtEndOfSelfclosingTag: tab.whiteSpaceAtEndOfSelfclosingTag,
	excludeComments: tab.excludeComments,
	preserveWhitespace: tab.preserveWhitespace,
	forceSelfClosingEmptyTag: tab.forceSelfClosingEmptyTag,
	sortAttributes: tab.sortAttributes,
});

const computeOutput = (input: string, mode: FormatMode, tab: XmlFormatTabOptions) => {
	if (!input.trim()) return { output: '', error: '' };
	try {
		const result = mode === 'minify' ? minifyXml(input) : formatXml(input, toXmlFormatOptions(tab));
		return { output: result, error: '' };
	} catch (e) {
		return { output: '', error: getErrorMessage(e, 'Invalid XML') };
	}
};

const validate = (input: string): boolean | null => {
	if (!input.trim()) return null;
	try {
		const doc = new DOMParser().parseFromString(input, 'application/xml');
		return doc.querySelector('parsererror') === null;
	} catch {
		return false;
	}
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
			onInputChange(formatXml(input, { indentSize: 2, indentType: 'spaces' }));
		} catch {
			// Invalid XML.
		}
	};

	const handleMinifyInput = () => {
		try {
			onInputChange(minifyXml(input));
		} catch {
			// Invalid XML.
		}
	};

	const inputContextMenuItems: readonly ContextMenuItem[] = [
		{ text: 'Format XML', enabled: input.trim().length > 0, action: handleFormatInput },
		{ text: 'Minify XML', enabled: input.trim().length > 0, action: handleMinifyInput },
	];

	const renderOptions = (
		options: XmlFormatTabOptions,
		setOptions: (next: XmlFormatTabOptions) => void
	): ReactNode => {
		const update = <K extends keyof XmlFormatTabOptions>(key: K, value: XmlFormatTabOptions[K]) =>
			setOptions({ ...options, [key]: value });

		return (
			<>
				<FormSection title="Indentation">
					<div className="grid grid-cols-2 gap-2">
						<FormSelect
							label="Size"
							value={options.indentSizeStr}
							onValueChange={(v) => update('indentSizeStr', v)}
							options={['1', '2', '4', '8']}
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

				<FormSection title="Tags">
					<FormCheckbox
						label="Space before self-closing />"
						checked={options.whiteSpaceAtEndOfSelfclosingTag}
						onCheckedChange={(v) => update('whiteSpaceAtEndOfSelfclosingTag', v)}
						size="compact"
					/>
					<FormCheckbox
						label="Force self-closing empty tags"
						checked={options.forceSelfClosingEmptyTag}
						onCheckedChange={(v) => update('forceSelfClosingEmptyTag', v)}
						size="compact"
					/>
				</FormSection>

				<FormSection title="Content">
					<FormCheckboxGroup>
						<FormCheckbox
							label="Collapse content on single line"
							checked={options.collapseContent}
							onCheckedChange={(v) => update('collapseContent', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Preserve whitespace"
							checked={options.preserveWhitespace}
							onCheckedChange={(v) => update('preserveWhitespace', v)}
							size="compact"
						/>
						<FormCheckbox
							label="Remove comments"
							checked={options.excludeComments}
							onCheckedChange={(v) => update('excludeComments', v)}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Attributes">
					<FormCheckbox
						label="Sort attributes alphabetically"
						checked={options.sortAttributes}
						onCheckedChange={(v) => update('sortAttributes', v)}
						size="compact"
					/>
				</FormSection>
			</>
		);
	};

	return (
		<FormatTabTemplate<XmlFormatTabOptions>
			input={input}
			onInputChange={onInputChange}
			onStatsChange={onStatsChange}
			inputEditorMode="xml"
			inputPlaceholder="Enter XML here..."
			outputPlaceholder="Formatted output..."
			emptyIcon={FileText}
			emptyTitle="Enter XML to format"
			emptyDescription="The formatted (or minified) document will appear here."
			sampleText={SAMPLE_XML}
			validate={validate}
			computeOutput={computeOutput}
			defaultOptions={DEFAULT_OPTIONS}
			renderOptions={renderOptions}
			inputContextMenuItems={inputContextMenuItems}
		/>
	);
}

export type { FormatTabProps };
