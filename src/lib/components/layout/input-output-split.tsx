import type { LucideIcon } from 'lucide-react';

import { CodeEditor, type ContextMenuItem, type EditorMode } from '@/lib/components/editor';
import { EmptyOutputPane } from '@/lib/components/status';
import { cn } from '@/lib/utils';

import { SplitPane } from './split-pane';

interface InputOutputSplitProps {
	// Input editor.
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly editorMode: EditorMode;
	readonly inputTitle?: string;
	readonly inputPlaceholder?: string;
	readonly onSample?: () => void;
	readonly onPaste?: () => void;
	readonly onClear?: () => void;
	readonly inputContextMenuItems?: readonly ContextMenuItem[];

	// Output editor (readonly).
	readonly output: string;
	// Defaults to `editorMode`. Override only when the output format differs
	// from the input (e.g. JSON-to-XML convert).
	readonly outputEditorMode?: EditorMode;
	readonly outputTitle?: string;
	readonly outputPlaceholder?: string;
	readonly onCopy?: () => void;

	// Empty-state graphic shown in place of the output editor when the input
	// is empty. The three text props are required — there is no good default.
	readonly emptyIcon: LucideIcon;
	readonly emptyTitle: string;
	readonly emptyDescription: string;

	// SplitPane className override (defaults to `h-full flex-1`).
	readonly className?: string;
}

// Single source of truth for the "input editor on the left, readonly output
// (or empty state) on the right" shell shared by every formatter family tab
// — format, query, generate, convert — across JSON, XML, and YAML. Bakes in
// the empty-state branch, the SplitPane wrapper, and the editor mode
// inheritance so callers only carry per-tab text and handlers.
export function InputOutputSplit({
	input,
	onInputChange,
	editorMode,
	inputTitle = 'Input',
	inputPlaceholder,
	onSample,
	onPaste,
	onClear,
	inputContextMenuItems,
	output,
	outputEditorMode,
	outputTitle = 'Output',
	outputPlaceholder,
	onCopy,
	emptyIcon,
	emptyTitle,
	emptyDescription,
	className,
}: InputOutputSplitProps) {
	return (
		<SplitPane
			className={cn('h-full flex-1', className)}
			left={
				<CodeEditor
					title={inputTitle}
					value={input}
					onChange={onInputChange}
					mode="input"
					editorMode={editorMode}
					placeholder={inputPlaceholder}
					onSample={onSample}
					onPaste={onPaste}
					onClear={onClear}
					contextMenuItems={inputContextMenuItems}
				/>
			}
			right={
				input.trim().length === 0 ? (
					<EmptyOutputPane
						headerTitle={outputTitle}
						icon={emptyIcon}
						title={emptyTitle}
						description={emptyDescription}
					/>
				) : (
					<CodeEditor
						title={outputTitle}
						value={output}
						mode="readonly"
						editorMode={outputEditorMode ?? editorMode}
						placeholder={outputPlaceholder}
						onCopy={onCopy}
					/>
				)
			}
		/>
	);
}

export type { InputOutputSplitProps };
