/**
 * Editor synchronization hook for bidirectional sync between two editors.
 * Prevents infinite update loops and manages cursor synchronization.
 */

type EditorType = 'primary' | 'secondary';

/**
 * Options for cursor sync callbacks.
 */
export interface CursorSyncCallbacks {
	/** Callback to set cursor line in secondary editor */
	readonly syncToSecondary: (line: number) => void;
	/** Callback to set cursor line in primary editor */
	readonly syncToPrimary: (line: number) => void;
}

/**
 * Return type for useEditorSync hook.
 */
export interface UseEditorSyncReturn {
	/** Currently active editor (reactive getter) */
	readonly activeEditor: EditorType | null;
	/** Create change handler for primary editor */
	readonly createPrimaryChangeHandler: (
		onValueChange: (value: string) => void
	) => (value: string) => void;
	/** Create change handler for secondary editor */
	readonly createSecondaryChangeHandler: (
		onValueChange: (value: string) => void
	) => (value: string) => void;
	/** Handle primary editor focus */
	readonly handlePrimaryFocus: () => void;
	/** Handle secondary editor focus */
	readonly handleSecondaryFocus: () => void;
	/** Handle primary editor blur (no-op, keeps activeEditor) */
	readonly handlePrimaryBlur: () => void;
	/** Handle secondary editor blur (no-op, keeps activeEditor) */
	readonly handleSecondaryBlur: () => void;
	/** Create cursor change handler for primary editor */
	readonly createPrimaryCursorHandler: (callbacks: CursorSyncCallbacks) => (line: number) => void;
	/** Create cursor change handler for secondary editor */
	readonly createSecondaryCursorHandler: (callbacks: CursorSyncCallbacks) => (line: number) => void;
}

/**
 * Editor synchronization hook with loop prevention and cursor sync.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useEditorSync } from '$lib/utils';
 *
 *   const editorSync = useEditorSync();
 *
 *   const handleMonacoChange = editorSync.createPrimaryChangeHandler((v) => (input = v));
 *   const handleTiptapChange = editorSync.createSecondaryChangeHandler((v) => (input = v));
 * </script>
 * ```
 */
export const useEditorSync = (): UseEditorSyncReturn => {
	// Track which editor made the last change to prevent sync loops
	let lastChangeSource: EditorType | null = null;
	let isProcessingChange = false;

	// Track cursor sync source to prevent infinite loops
	let cursorSyncSource: EditorType | null = null;
	let lastPrimaryCursorLine = 0;
	let lastSecondaryCursorLine = 0;

	// Active editor state
	let _activeEditor = $state<EditorType | null>(null);

	/**
	 * Create change handler for primary editor.
	 */
	const createPrimaryChangeHandler =
		(onValueChange: (value: string) => void) =>
		(value: string): void => {
			if (isProcessingChange) return;
			if (lastChangeSource === 'secondary') {
				lastChangeSource = null;
				return;
			}

			isProcessingChange = true;
			lastChangeSource = 'primary';
			onValueChange(value);

			requestAnimationFrame(() => {
				isProcessingChange = false;
				lastChangeSource = null;
			});
		};

	/**
	 * Create change handler for secondary editor.
	 */
	const createSecondaryChangeHandler =
		(onValueChange: (value: string) => void) =>
		(value: string): void => {
			if (isProcessingChange) return;
			if (lastChangeSource === 'primary') {
				lastChangeSource = null;
				return;
			}

			isProcessingChange = true;
			lastChangeSource = 'secondary';
			onValueChange(value);

			requestAnimationFrame(() => {
				isProcessingChange = false;
				lastChangeSource = null;
			});
		};

	/**
	 * Handle primary editor focus.
	 */
	const handlePrimaryFocus = (): void => {
		_activeEditor = 'primary';
	};

	/**
	 * Handle secondary editor focus.
	 */
	const handleSecondaryFocus = (): void => {
		_activeEditor = 'secondary';
	};

	/**
	 * Handle primary editor blur (no-op, keeps activeEditor).
	 */
	const handlePrimaryBlur = (): void => {
		// Keep activeEditor until another editor is focused
	};

	/**
	 * Handle secondary editor blur (no-op, keeps activeEditor).
	 */
	const handleSecondaryBlur = (): void => {
		// Keep activeEditor until another editor is focused
	};

	/**
	 * Create cursor change handler for primary editor.
	 */
	const createPrimaryCursorHandler =
		(callbacks: CursorSyncCallbacks) =>
		(line: number): void => {
			if (line === lastPrimaryCursorLine) return;
			lastPrimaryCursorLine = line;

			if (cursorSyncSource === 'secondary') {
				cursorSyncSource = null;
				return;
			}

			if (_activeEditor !== 'primary') return;

			cursorSyncSource = 'primary';
			callbacks.syncToSecondary(line);

			requestAnimationFrame(() => {
				cursorSyncSource = null;
			});
		};

	/**
	 * Create cursor change handler for secondary editor.
	 */
	const createSecondaryCursorHandler =
		(callbacks: CursorSyncCallbacks) =>
		(line: number): void => {
			if (line === lastSecondaryCursorLine) return;
			lastSecondaryCursorLine = line;

			if (cursorSyncSource === 'primary') {
				cursorSyncSource = null;
				return;
			}

			if (_activeEditor !== 'secondary') return;

			cursorSyncSource = 'secondary';
			callbacks.syncToPrimary(line);

			requestAnimationFrame(() => {
				cursorSyncSource = null;
			});
		};

	return {
		get activeEditor() {
			return _activeEditor;
		},
		createPrimaryChangeHandler,
		createSecondaryChangeHandler,
		handlePrimaryFocus,
		handleSecondaryFocus,
		handlePrimaryBlur,
		handleSecondaryBlur,
		createPrimaryCursorHandler,
		createSecondaryCursorHandler,
	};
};
