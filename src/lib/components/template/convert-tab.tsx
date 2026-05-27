import { ArrowRightLeft } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import type { EditorMode } from '@/lib/components/editor';
import { InputOutputSplit } from '@/lib/components/layout';
import { Rail } from '@/lib/components/ui/rail';

import { FormatterAboutFooter } from './formatter-about';

type ValidationResult = { valid: boolean | null } & Record<string, unknown>;
type StatsResult = { input: string; valid: boolean | null; error: string } & Record<
	string,
	unknown
>;

interface ConvertTabProps {
	/** Editor mode for input */
	readonly inputEditorMode: EditorMode;
	/** Editor mode for output (can change based on format) */
	readonly outputEditorMode: EditorMode;
	/** Shared input value from parent */
	readonly input: string;
	/** Callback to update shared input */
	readonly onInputChange: (value: string) => void;
	/** Input placeholder */
	readonly placeholder?: string;
	/** Validate input - can return extra properties that will be passed to onStatsChange */
	readonly validate: (input: string) => ValidationResult;
	/** Convert input to output */
	readonly convert: (input: string) => { output: string; error: string };
	/** Stats change callback - receives base stats plus any extra from validate */
	readonly onStatsChange?: (stats: StatsResult) => void;
	/** Copy to clipboard function */
	readonly copyToClipboard: (text: string) => void;
	/** Paste from clipboard function */
	readonly pasteFromClipboard: () => Promise<string | null>;
	/** Output title (e.g., "Output (YAML)") */
	readonly outputTitle?: string;
	/** Render prop for format selection options */
	readonly renderFormatSection?: (showOutput?: boolean) => ReactNode;
	/** Render prop for additional options */
	readonly renderOptions?: () => ReactNode;
}

export function ConvertTab({
	inputEditorMode,
	outputEditorMode,
	input,
	onInputChange,
	placeholder = 'Enter content here...',
	validate,
	convert,
	onStatsChange,
	copyToClipboard,
	pasteFromClipboard,
	outputTitle = 'Output',
	renderFormatSection,
	renderOptions,
}: ConvertTabProps) {
	const [showOptions, setShowOptions] = useState(true);

	// Validation (returns valid + any extra properties).
	const inputValidation = useMemo<ValidationResult>(() => {
		if (!input.trim()) return { valid: null };
		return validate(input);
	}, [input, validate]);

	// Conversion result.
	const convertResult = useMemo(() => {
		if (!input.trim()) {
			return { output: '', error: '' };
		}
		return convert(input);
	}, [input, convert]);

	const output = convertResult.output;
	const error = convertResult.error;

	// Report stats to parent (including extra properties from validation).
	useEffect(() => {
		if (!onStatsChange) return;
		const { valid, ...extra } = inputValidation;
		onStatsChange({
			input,
			valid,
			error,
			...extra,
		});
	}, [inputValidation, input, error, onStatsChange]);

	const handlePaste = async () => {
		const text = await pasteFromClipboard();
		if (text) onInputChange(text);
	};

	const handleClear = () => {
		onInputChange('');
	};

	const handleCopyOutput = () => copyToClipboard(output);

	return (
		<div className="flex flex-1 overflow-hidden">
			<Rail
				show={showOptions}
				onClose={() => setShowOptions(false)}
				onOpen={() => setShowOptions(true)}
			>
				{renderFormatSection?.()}
				{renderOptions?.()}
				<FormatterAboutFooter />
			</Rail>

			<InputOutputSplit
				input={input}
				onInputChange={onInputChange}
				editorMode={inputEditorMode}
				inputPlaceholder={placeholder}
				onPaste={handlePaste}
				onClear={handleClear}
				output={output}
				outputEditorMode={outputEditorMode}
				outputTitle={outputTitle ?? 'Output'}
				outputPlaceholder="Converted output..."
				onCopy={handleCopyOutput}
				emptyIcon={ArrowRightLeft}
				emptyTitle={`Enter ${inputEditorMode.toUpperCase()} to convert`}
				emptyDescription="The converted document will appear here."
			/>
		</div>
	);
}

export type { ConvertTabProps };
