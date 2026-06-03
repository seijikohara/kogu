import { ArrowRightLeft } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { useDebouncedValue, useReportStats } from '@/lib/hooks';
import { CodeEditor } from '@/lib/components/editor';
import { getErrorMessage } from '@/lib/utils';
import { FormSection } from '@/lib/components/form';
import { SplitPane } from '@/lib/components/layout';
import { DiffLegend, DiffResults } from '@/lib/components/panel';
import { Rail } from '@/lib/components/ui/rail';
import { Button } from '@/lib/components/ui/button';
import type { GenericDiffItem } from '@/lib/constants/diff';

import { FormatterAboutFooter } from './formatter-about';

type EditorMode = 'json' | 'xml' | 'yaml';

interface TabStats {
	readonly input: string;
	readonly valid: boolean | null;
	readonly error: string;
}

interface ValidationResult {
	readonly valid: boolean | null;
}

interface HighlightLine {
	readonly line: number;
	readonly type: 'added' | 'removed' | 'changed';
}

interface CompareTabProps {
	/** Editor mode for syntax highlighting */
	readonly editorMode: EditorMode;
	/** Shared input value from parent (used as Original/input1) */
	readonly input: string;
	/** Callback to update shared input */
	readonly onInputChange: (value: string) => void;
	/** Placeholder text for first editor */
	readonly placeholder1?: string;
	/** Placeholder text for second editor */
	readonly placeholder2?: string;
	/** Validation function */
	readonly validate: (input: string) => ValidationResult;
	/** Comparison function */
	readonly compare: (input1: string, input2: string) => GenericDiffItem[];
	/** Callback for stats changes */
	readonly onStatsChange?: (stats: TabStats) => void;
	/** Find line number for path (for highlighting) */
	readonly findLineForPath?: (content: string, path: string) => number | null;
	/** Paste from clipboard function */
	readonly pasteFromClipboard: () => Promise<string | null>;
	/** Render prop for format selection options */
	readonly renderFormatSection?: (showOutput?: boolean) => ReactNode;
	/** Render prop for comparison options */
	readonly renderComparisonOptions?: () => ReactNode;
	/** Render prop for advanced options */
	readonly renderAdvancedOptions?: () => ReactNode;
}

export function CompareTab({
	editorMode,
	input,
	onInputChange,
	placeholder1 = 'Original...',
	placeholder2 = 'Modified...',
	validate,
	compare,
	onStatsChange,
	findLineForPath,
	pasteFromClipboard,
	renderFormatSection,
	renderComparisonOptions,
	renderAdvancedOptions,
}: CompareTabProps) {
	// State - input2 is local to compare tab.
	const [input2, setInput2] = useState('');
	const [showOptions, setShowOptions] = useState(true);
	const [selectedDiff, setSelectedDiff] = useState<GenericDiffItem | null>(null);

	// Validation.
	const validation1 = useMemo<ValidationResult>(() => {
		if (!input.trim()) return { valid: null };
		return validate(input);
	}, [input, validate]);

	const validation2 = useMemo<ValidationResult>(() => {
		if (!input2.trim()) return { valid: null };
		return validate(input2);
	}, [input2, validate]);

	// Combined validity.
	const combinedValidity = useMemo<boolean | null>(() => {
		if (validation1.valid === true && validation2.valid === true) return true;
		if (validation1.valid === false || validation2.valid === false) return false;
		return null;
	}, [validation1, validation2]);

	// Debounce both inputs feeding the (synchronous, potentially expensive)
	// compare so two large pastes do not re-parse and re-diff on every keystroke.
	const debouncedInput = useDebouncedValue(input, 200);
	const debouncedInput2 = useDebouncedValue(input2, 200);

	// Compare result.
	const compareResultData = useMemo(() => {
		if (!debouncedInput.trim() || !debouncedInput2.trim()) {
			return { diffs: [] as GenericDiffItem[], error: '' };
		}
		try {
			const diffs = compare(debouncedInput, debouncedInput2);
			return { diffs, error: '' };
		} catch (e) {
			return {
				diffs: [] as GenericDiffItem[],
				error: getErrorMessage(e, 'Compare failed'),
			};
		}
	}, [debouncedInput, debouncedInput2, compare]);

	const diffResults = compareResultData.diffs;
	const compareError = compareResultData.error;

	// Compute highlight lines for both editors.
	const highlightLinesOriginal = useMemo<HighlightLine[]>(() => {
		if (!selectedDiff || !findLineForPath) return [];
		const line = findLineForPath(input, selectedDiff.path);
		if (!line) return [];
		return [{ line, type: selectedDiff.type }];
	}, [selectedDiff, findLineForPath, input]);

	const highlightLinesModified = useMemo<HighlightLine[]>(() => {
		if (!selectedDiff || !findLineForPath) return [];
		const line = findLineForPath(input2, selectedDiff.path);
		if (!line) return [];
		return [{ line, type: selectedDiff.type }];
	}, [selectedDiff, findLineForPath, input2]);

	const handleDiffClick = (diff: GenericDiffItem) => {
		setSelectedDiff((prev) => (prev?.path === diff.path ? null : diff));
	};

	// Report stats to parent.
	useReportStats(onStatsChange, input, combinedValidity, compareError);

	const handleSwap = () => {
		const temp = input;
		onInputChange(input2);
		setInput2(temp);
	};

	const handlePaste1 = async () => {
		const text = await pasteFromClipboard();
		if (text) onInputChange(text);
	};

	const handlePaste2 = async () => {
		const text = await pasteFromClipboard();
		if (text) setInput2(text);
	};

	// Check if has non-empty content for identical check.
	const hasContent = input.trim() !== '' && input2.trim() !== '' && !compareError;

	return (
		<div className="flex flex-1 overflow-hidden">
			<Rail
				show={showOptions}
				onClose={() => setShowOptions(false)}
				onOpen={() => setShowOptions(true)}
			>
				{renderFormatSection?.()}
				<FormSection title="Actions">
					<Button
						variant="outline"
						size="sm"
						className="w-full gap-1.5 text-xs"
						onClick={handleSwap}
					>
						<ArrowRightLeft className="h-3.5 w-3.5" />
						Swap Left/Right
					</Button>
				</FormSection>

				{renderComparisonOptions ? (
					<FormSection title="Comparison">{renderComparisonOptions()}</FormSection>
				) : null}

				{renderAdvancedOptions ? (
					<FormSection title="Advanced">{renderAdvancedOptions()}</FormSection>
				) : null}

				<DiffLegend />
				<FormatterAboutFooter />
			</Rail>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<SplitPane
					className="h-full flex-1"
					left={
						<CodeEditor
							title="Original"
							value={input}
							onChange={onInputChange}
							mode="input"
							editorMode={editorMode}
							placeholder={placeholder1}
							highlightLines={highlightLinesOriginal}
							onPaste={handlePaste1}
							onClear={() => onInputChange('')}
						/>
					}
					right={
						<CodeEditor
							title="Modified"
							value={input2}
							onChange={setInput2}
							mode="input"
							editorMode={editorMode}
							placeholder={placeholder2}
							highlightLines={highlightLinesModified}
							onPaste={handlePaste2}
							onClear={() => setInput2('')}
						/>
					}
				/>

				<DiffResults
					diffs={diffResults}
					selectedDiff={selectedDiff}
					onDiffClick={handleDiffClick}
					checkIdentical={true}
					hasContent={hasContent}
				/>
			</div>
		</div>
	);
}

export type { CompareTabProps };
