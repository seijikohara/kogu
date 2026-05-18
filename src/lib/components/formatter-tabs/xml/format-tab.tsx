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
			return { output: '', error: e instanceof Error ? e.message : 'Invalid XML' };
		}
	})();

	// Report stats to parent.
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
							options={['1', '2', '4', '8']}
						/>
						<FormSelect
							label="Type"
							value={indentType}
							onValueChange={(v) => setIndentType(v as IndentType)}
							options={[
								{ value: 'spaces', label: 'Spaces' },
								{ value: 'tabs', label: 'Tabs' },
							]}
						/>
					</div>
				</FormSection>

				<FormSection title="Tags">
					<FormCheckbox
						label="Space before self-closing />"
						checked={whiteSpaceAtEndOfSelfclosingTag}
						onCheckedChange={setWhiteSpaceAtEndOfSelfclosingTag}
					/>
					<FormCheckbox
						label="Force self-closing empty tags"
						checked={forceSelfClosingEmptyTag}
						onCheckedChange={setForceSelfClosingEmptyTag}
					/>
				</FormSection>

				<FormSection title="Content">
					<FormCheckboxGroup>
						<FormCheckbox
							label="Collapse content on single line"
							checked={collapseContent}
							onCheckedChange={setCollapseContent}
						/>
						<FormCheckbox
							label="Preserve whitespace"
							checked={preserveWhitespace}
							onCheckedChange={setPreserveWhitespace}
						/>
						<FormCheckbox
							label="Remove comments"
							checked={excludeComments}
							onCheckedChange={setExcludeComments}
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Attributes">
					<FormCheckbox
						label="Sort attributes alphabetically"
						checked={sortAttributes}
						onCheckedChange={setSortAttributes}
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
						editorMode="xml"
						placeholder="Enter XML here..."
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
						editorMode="xml"
						placeholder="Formatted output..."
						onCopy={handleCopy}
					/>
				}
			/>
		</div>
	);
}

export type { FormatTabProps };
