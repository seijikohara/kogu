import { useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import type { ContextMenuItem, EditorMode } from '@/lib/components/editor';
import { FormMode, FormSection } from '@/lib/components/form';
import { InputOutputSplit } from '@/lib/components/layout';
import { Rail } from '@/lib/components/ui/rail';
import { useClipboardActions, useReportStats } from '@/lib/hooks';

type FormatMode = 'format' | 'minify';

interface TabStats {
	readonly input: string;
	readonly valid: boolean | null;
	readonly error: string;
}

interface FormatResult {
	readonly output: string;
	readonly error: string;
}

interface FormatTabTemplateProps<TOptions> {
	// -- Controlled input / reporting --
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange?: (stats: TabStats) => void;

	// -- Per-lang services --
	readonly inputEditorMode: EditorMode;
	readonly inputPlaceholder: string;
	readonly outputPlaceholder?: string;
	readonly emptyIcon: LucideIcon;
	readonly emptyTitle: string;
	readonly emptyDescription: string;
	readonly sampleText: string;
	readonly validate: (input: string) => boolean | null;
	readonly computeOutput: (input: string, mode: FormatMode, options: TOptions) => FormatResult;

	// -- Per-lang options (template owns state via TOptions generic) --
	readonly defaultOptions: TOptions;
	readonly renderOptions: (options: TOptions, setOptions: (next: TOptions) => void) => ReactNode;

	// -- Per-lang slot above the options panel (e.g. JSON's input/output format selector) --
	readonly renderRailHeader?: () => ReactNode;

	// -- Per-lang input context menu items (e.g. Format JSON / Minify JSON) --
	readonly inputContextMenuItems?: readonly ContextMenuItem[];
}

export function FormatTabTemplate<TOptions>({
	input,
	onInputChange,
	onStatsChange,
	inputEditorMode,
	inputPlaceholder,
	outputPlaceholder,
	emptyIcon,
	emptyTitle,
	emptyDescription,
	sampleText,
	validate,
	computeOutput,
	defaultOptions,
	renderOptions,
	renderRailHeader,
	inputContextMenuItems,
}: FormatTabTemplateProps<TOptions>) {
	const [formatMode, setFormatMode] = useState<FormatMode>('format');
	const [showOptions, setShowOptions] = useState(true);
	const [options, setOptions] = useState<TOptions>(defaultOptions);

	const validity = useMemo<boolean | null>(() => validate(input), [validate, input]);

	const { output, error } = useMemo<FormatResult>(
		() => computeOutput(input, formatMode, options),
		[computeOutput, input, formatMode, options]
	);

	useReportStats(onStatsChange, input, validity, error);

	const { handlePaste, handleClear, handleCopy } = useClipboardActions({
		onInputChange,
		output,
	});

	const handleSample = () => onInputChange(sampleText);

	return (
		<div className="flex flex-1 overflow-hidden">
			<Rail
				show={showOptions}
				onClose={() => setShowOptions(false)}
				onOpen={() => setShowOptions(true)}
			>
				{renderRailHeader?.()}
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
				{renderOptions(options, setOptions)}
			</Rail>

			<InputOutputSplit
				input={input}
				onInputChange={onInputChange}
				editorMode={inputEditorMode}
				inputPlaceholder={inputPlaceholder}
				onSample={handleSample}
				onPaste={handlePaste}
				onClear={handleClear}
				inputContextMenuItems={inputContextMenuItems}
				output={output}
				outputPlaceholder={outputPlaceholder}
				onCopy={handleCopy}
				emptyIcon={emptyIcon}
				emptyTitle={emptyTitle}
				emptyDescription={emptyDescription}
			/>
		</div>
	);
}

export type { FormatTabTemplateProps, FormatMode, FormatResult, TabStats };
