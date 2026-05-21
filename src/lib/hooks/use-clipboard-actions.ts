import { copyToClipboard, pasteFromClipboard } from '@/lib/utils/file-operations';

interface UseClipboardActionsConfig {
	// Called with the pasted clipboard text. Also called with `emptyValue`
	// when `handleClear` fires.
	readonly onInputChange?: (value: string) => void;
	// Text copied to clipboard when `handleCopy` fires. Defaults to '' (no-op).
	readonly output?: string;
	// Value passed to `onInputChange` from `handleClear`. Defaults to ''.
	// Set to `'{}'` for JSON-input generate tabs, etc.
	readonly emptyValue?: string;
}

interface UseClipboardActionsReturn {
	readonly handlePaste: () => Promise<void>;
	readonly handleClear: () => void;
	readonly handleCopy: () => Promise<void>;
}

// Shared clipboard handlers for tool tabs and routes that wire `CodeEditor`'s
// `onPaste` / `onClear` / `onCopy` props. Both `pasteFromClipboard` and
// `copyToClipboard` from `@/lib/utils/file-operations` already toast success
// and failure ("Pasted" / "Paste failed", "Copied" / "Copy failed"), so the
// hook only owns the boilerplate of feeding the clipboard text into
// `onInputChange` and resetting the input to `emptyValue` on clear. The
// callsite-specific copy target is passed as `output`.
export function useClipboardActions({
	onInputChange,
	output = '',
	emptyValue = '',
}: UseClipboardActionsConfig): UseClipboardActionsReturn {
	const handlePaste = async () => {
		const text = await pasteFromClipboard();
		if (text && onInputChange) onInputChange(text);
	};

	const handleClear = () => {
		onInputChange?.(emptyValue);
	};

	const handleCopy = async () => {
		await copyToClipboard(output);
	};

	return { handlePaste, handleClear, handleCopy };
}
