/**
 * React wrapper around `@vizel/core`'s editor factory.
 *
 * Vizel ships no React binding, so this component drives a Tiptap editor via
 * `createVizelEditorInstance` and mounts it through `EditorContent` from
 * `@tiptap/react`. Vizel's built-in bubble menu and slash menu are not
 * reusable here and the wrapper deliberately omits them — formatting
 * commands stay reachable through the page-level toolbar and the
 * right-click context menu.
 */
import { useEffect, useRef, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import {
	createVizelEditorInstance,
	type Editor as VizelEditor,
	initVizelIconRenderer,
	type VizelError,
	type VizelFeatureOptions,
} from '@vizel/core';

// Wire Vizel's default icon renderer at module load. Without this call,
// Vizel internals warn "Icon renderer not set" and emit empty placeholders
// for menu / drag-handle / list-item icons.
initVizelIconRenderer();

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
	// `features` are captured at instantiation time; editor construction
	// is intentionally non-reactive.
	useEffect(() => {
		// Track mount state and the resolved editor in a const ref object so
		// the cleanup closure can mutate fields without `let` bindings.
		const lifecycle: { mounted: boolean; instance: VizelEditor | null } = {
			mounted: true,
			instance: null,
		};

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
				if (!lifecycle.mounted) {
					result.editor.destroy();
					return;
				}
				lifecycle.instance = result.editor;
				setEditor(result.editor);
			})
			.catch((error: unknown) => {
				if (lifecycle.mounted) {
					callbacksRef.current.onError?.(error as VizelError);
				}
			});

		return () => {
			lifecycle.mounted = false;
			lifecycle.instance?.destroy();
		};
		// Construction options are captured once on mount. Subsequent prop
		// edits are handled by the second effect (editable) or by
		// side-channel APIs such as setVizelMarkdown.
	}, []);

	// Reflect the `editable` prop onto the live editor without recreating it.
	useEffect(() => {
		editor?.setEditable(editable);
	}, [editor, editable]);

	return <EditorContent editor={editor} className={className} />;
}
