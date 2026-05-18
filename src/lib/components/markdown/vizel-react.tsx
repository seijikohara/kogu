/**
 * React wrapper around `@vizel/core`'s editor factory.
 *
 * `@vizel/svelte` does not have a React counterpart, so this component drives
 * a Tiptap editor via `createVizelEditorInstance` and mounts it through the
 * `EditorContent` component from `@tiptap/react`. Vizel's bubble menu and
 * slash menu are rendered by the Svelte package and cannot be reused here;
 * the wrapper deliberately omits them. Formatting commands stay reachable
 * through the page-level toolbar and the right-click context menu.
 */
import { useEffect, useRef, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import {
	createVizelEditorInstance,
	type Editor as VizelEditor,
	type VizelError,
	type VizelFeatureOptions,
} from '@vizel/core';

// A no-op slash menu renderer satisfies the required factory parameter.
// We rely on the toolbar / context menu for command discovery instead of
// replicating Vizel's slash popup in React.
const createNoopSlashMenuRenderer = () => ({
	render: () => ({
		onStart: () => {},
		onUpdate: () => {},
		onKeyDown: () => false,
		onExit: () => {},
	}),
});

interface VizelProps {
	readonly placeholder?: string;
	readonly editable?: boolean;
	readonly autofocus?: boolean | 'start' | 'end' | 'all' | number;
	readonly features?: VizelFeatureOptions;
	readonly className?: string;
	readonly onCreate?: (args: { readonly editor: VizelEditor }) => void;
	readonly onUpdate?: (args: { readonly editor: VizelEditor }) => void;
	readonly onFocus?: (args: { readonly editor: VizelEditor }) => void;
	readonly onBlur?: (args: { readonly editor: VizelEditor }) => void;
	readonly onSelectionUpdate?: (args: { readonly editor: VizelEditor }) => void;
	readonly onError?: (error: VizelError) => void;
}

export function Vizel({
	placeholder,
	editable = true,
	autofocus = false,
	features,
	className,
	onCreate,
	onUpdate,
	onFocus,
	onBlur,
	onSelectionUpdate,
	onError,
}: VizelProps) {
	// `editor` is reactive so `EditorContent` re-renders once the async editor
	// is ready. `editorRef` is used to avoid stale closures inside the create
	// effect when the effect tears down before instantiation finishes.
	const [editor, setEditor] = useState<VizelEditor | null>(null);
	const callbacksRef = useRef({
		onCreate,
		onUpdate,
		onFocus,
		onBlur,
		onSelectionUpdate,
		onError,
	});
	callbacksRef.current = {
		onCreate,
		onUpdate,
		onFocus,
		onBlur,
		onSelectionUpdate,
		onError,
	};

	// Create the editor exactly once. Vizel options like `placeholder` and
	// `features` are captured at instantiation time, matching the Svelte
	// component's intentional non-reactivity for editor construction.
	useEffect(() => {
		let mounted = true;
		let instance: VizelEditor | null = null;

		createVizelEditorInstance({
			...(placeholder !== undefined && { placeholder }),
			editable,
			autofocus,
			...(features !== undefined && { features }),
			createSlashMenuRenderer: createNoopSlashMenuRenderer,
			onCreate: ({ editor: e }) => callbacksRef.current.onCreate?.({ editor: e }),
			onUpdate: ({ editor: e }) => callbacksRef.current.onUpdate?.({ editor: e }),
			onFocus: ({ editor: e }) => callbacksRef.current.onFocus?.({ editor: e }),
			onBlur: ({ editor: e }) => callbacksRef.current.onBlur?.({ editor: e }),
			onSelectionUpdate: ({ editor: e }) => callbacksRef.current.onSelectionUpdate?.({ editor: e }),
			onError: (error) => callbacksRef.current.onError?.(error),
		})
			.then((result) => {
				if (!mounted) {
					result.editor.destroy();
					return;
				}
				instance = result.editor;
				setEditor(result.editor);
			})
			.catch((error: unknown) => {
				if (mounted) {
					callbacksRef.current.onError?.(error as VizelError);
				}
			});

		return () => {
			mounted = false;
			instance?.destroy();
		};
		// Construction options are captured once on mount, matching the Svelte
		// wrapper's contract. Subsequent prop edits are handled by the second
		// effect (editable) or by side-channel APIs such as setVizelMarkdown.
	}, []);

	// Reflect the `editable` prop onto the live editor without recreating it.
	useEffect(() => {
		editor?.setEditable(editable);
	}, [editor, editable]);

	return <EditorContent editor={editor} className={className} />;
}
