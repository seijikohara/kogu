import { FileText } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { ContextMenuItem } from '@/lib/components/editor';
import { getErrorMessage } from '@/lib/utils';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormMode,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { InputOutputSplit } from '@/lib/components/layout';
import { Rail } from '@/lib/components/ui/rail';
import { useClipboardActions, useReportStats } from '@/lib/hooks';
import {
	defaultXmlFormatOptions,
	formatXml,
	minifyXml,
	SAMPLE_XML,
	type XmlFormatOptions,
} from '@/lib/services/formatters';

type FormatMode = 'format' | 'minify';
type IndentType = 'spaces' | 'tabs';

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

	// Indentation options.
	const [indentSizeStr, setIndentSizeStr] = useState<string>(
		String(defaultXmlFormatOptions.indentSize)
	);
	const [indentType, setIndentType] = useState<IndentType>(defaultXmlFormatOptions.indentType);

	// Tag options.
	const [whiteSpaceAtEndOfSelfclosingTag, setWhiteSpaceAtEndOfSelfclosingTag] = useState<boolean>(
		defaultXmlFormatOptions.whiteSpaceAtEndOfSelfclosingTag
	);
	const [forceSelfClosingEmptyTag, setForceSelfClosingEmptyTag] = useState<boolean>(
		defaultXmlFormatOptions.forceSelfClosingEmptyTag
	);

	// Content options.
	const [collapseContent, setCollapseContent] = useState<boolean>(
		defaultXmlFormatOptions.collapseContent
	);
	const [preserveWhitespace, setPreserveWhitespace] = useState<boolean>(
		defaultXmlFormatOptions.preserveWhitespace
	);
	const [excludeComments, setExcludeComments] = useState<boolean>(
		defaultXmlFormatOptions.excludeComments
	);

	// Attribute options.
	const [sortAttributes, setSortAttributes] = useState<boolean>(
		defaultXmlFormatOptions.sortAttributes
	);

	const indentSize = Number.parseInt(indentSizeStr, 10) || 2;

	const formatOptions: Partial<XmlFormatOptions> = {
		indentSize,
		indentType,
		collapseContent,
		whiteSpaceAtEndOfSelfclosingTag,
		excludeComments,
		preserveWhitespace,
		forceSelfClosingEmptyTag,
		sortAttributes,
	};

	const validation = useMemo<{ valid: boolean | null }>(() => {
		if (!input.trim()) return { valid: null };
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(input, 'application/xml');
			const parserError = doc.querySelector('parsererror');
			return { valid: parserError === null };
		} catch {
			return { valid: false };
		}
	}, [input]);

	const { output, error: formatError } = ((): { output: string; error: string } => {
		if (!input.trim()) return { output: '', error: '' };
		try {
			const result = formatMode === 'minify' ? minifyXml(input) : formatXml(input, formatOptions);
			return { output: result, error: '' };
		} catch (e) {
			return { output: '', error: getErrorMessage(e, 'Invalid XML') };
		}
	})();

	// Report stats to parent.
	useReportStats(onStatsChange, input, validation.valid, formatError);

	const { handlePaste, handleClear, handleCopy } = useClipboardActions({
		onInputChange,
		output,
	});

	const handleSample = () => {
		onInputChange(SAMPLE_XML);
	};

	const handleFormatInput = () => {
		try {
			const formatted = formatXml(input, { indentSize: 2, indentType: 'spaces' });
			onInputChange(formatted);
		} catch {
			// Invalid XML.
		}
	};

	const handleMinifyInput = () => {
		try {
			const minified = minifyXml(input);
			onInputChange(minified);
		} catch {
			// Invalid XML.
		}
	};

	const inputContextMenuItems: readonly ContextMenuItem[] = [
		{
			text: 'Format XML',
			enabled: input.trim().length > 0,
			action: handleFormatInput,
		},
		{
			text: 'Minify XML',
			enabled: input.trim().length > 0,
			action: handleMinifyInput,
		},
	];

	return (
		<div className="flex flex-1 overflow-hidden">
			<Rail
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
							options={['1', '2', '4', '8']}
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

				<FormSection title="Tags">
					<FormCheckbox
						label="Space before self-closing />"
						checked={whiteSpaceAtEndOfSelfclosingTag}
						onCheckedChange={setWhiteSpaceAtEndOfSelfclosingTag}
						size="compact"
					/>
					<FormCheckbox
						label="Force self-closing empty tags"
						checked={forceSelfClosingEmptyTag}
						onCheckedChange={setForceSelfClosingEmptyTag}
						size="compact"
					/>
				</FormSection>

				<FormSection title="Content">
					<FormCheckboxGroup>
						<FormCheckbox
							label="Collapse content on single line"
							checked={collapseContent}
							onCheckedChange={setCollapseContent}
							size="compact"
						/>
						<FormCheckbox
							label="Preserve whitespace"
							checked={preserveWhitespace}
							onCheckedChange={setPreserveWhitespace}
							size="compact"
						/>
						<FormCheckbox
							label="Remove comments"
							checked={excludeComments}
							onCheckedChange={setExcludeComments}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Attributes">
					<FormCheckbox
						label="Sort attributes alphabetically"
						checked={sortAttributes}
						onCheckedChange={setSortAttributes}
						size="compact"
					/>
				</FormSection>
			</Rail>

			<InputOutputSplit
				input={input}
				onInputChange={onInputChange}
				editorMode="xml"
				inputPlaceholder="Enter XML here..."
				onSample={handleSample}
				onPaste={handlePaste}
				onClear={handleClear}
				inputContextMenuItems={inputContextMenuItems}
				output={output}
				outputPlaceholder="Formatted output..."
				onCopy={handleCopy}
				emptyIcon={FileText}
				emptyTitle="Enter XML to format"
				emptyDescription="The formatted (or minified) document will appear here."
			/>
		</div>
	);
}

export type { FormatTabProps };
