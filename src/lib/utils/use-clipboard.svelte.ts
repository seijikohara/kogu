import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

/**
 * Return type for useClipboard hook.
 */
export interface UseClipboardReturn {
	/** Read text from clipboard. Returns null on failure. */
	readonly paste: () => Promise<string | null>;
	/** Write text to clipboard. Returns true on success. */
	readonly copy: (text: string) => Promise<boolean>;
}

/**
 * Clipboard operations hook with error handling.
 * Uses Tauri clipboard plugin for cross-platform support.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useClipboard } from '$lib/utils';
 *
 *   const clipboard = useClipboard();
 *
 *   const handlePaste = async () => {
 *     const text = await clipboard.paste();
 *     if (text) input = text;
 *   };
 *
 *   const handleCopy = async () => {
 *     await clipboard.copy(output);
 *   };
 * </script>
 * ```
 */
export const useClipboard = (): UseClipboardReturn => {
	/**
	 * Read text from clipboard.
	 * Returns null if clipboard access is denied or empty.
	 */
	const paste = async (): Promise<string | null> => {
		try {
			const text = await readText();
			return text ?? null;
		} catch {
			return null;
		}
	};

	/**
	 * Write text to clipboard.
	 * Returns true on success, false on failure.
	 */
	const copy = async (text: string): Promise<boolean> => {
		try {
			await writeText(text);
			return true;
		} catch {
			return false;
		}
	};

	return {
		paste,
		copy,
	};
};
