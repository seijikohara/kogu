/**
 * React wrapper around `@vizel/core`'s editor factory.
 *
 * Vizel ships no React binding, so this component drives a Tiptap editor via
 * `createVizelEditorInstance` and mounts it through `EditorContent` from
 * `@tiptap/react`. The slash command menu (`/`) is supplied through the
 * factory's `createSlashMenuRenderer` hook, and the selection bubble menu is
 * registered after creation — both implemented in React (see
 * `vizel-slash-menu.tsx` / `vizel-bubble-menu.tsx`).
 */
import { useEffect, useRef, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import {
	createVizelEditorInstance,
	type Editor as VizelEditor,
	initVizelIconRenderer,
	type VizelError,
	type VizelFeatureOptions,
	type VizelMarkdownFlavor,
} from '@vizel/core';
import { VizelBubbleMenu } from './vizel-bubble-menu';
import { createReactSlashMenuRenderer } from './vizel-slash-menu';

// Wire Vizel's default icon renderer at module load. Without this call,
// Vizel internals warn "Icon renderer not set" and emit empty placeholders
// for menu / drag-handle / list-item icons.
initVizelIconRenderer();

interface VizelProps {
	readonly placeholder?: string;
	readonly editable?: boolean;
	readonly autofocus?: boolean | 'start' | 'end' | 'all' | number;
	readonly features?: VizelFeatureOptions;
	// Markdown serialization flavor (output syntax). The parser stays tolerant of
	// all formats; only `getMarkdown` output follows the flavor. Captured at
	// creation — change it by remounting with a new `key`.
	readonly markdownFlavor?: VizelMarkdownFlavor;
	// Seed content for a freshly created editor. Used so a flavor-driven remount
	// repopulates from the current markdown instead of starting empty.
	readonly initialMarkdown?: string;
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
	markdownFlavor,
	initialMarkdown,
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
			...(markdownFlavor !== undefined && { markdown: { flavor: markdownFlavor } }),
			...(initialMarkdown !== undefined && { initialMarkdown }),
			createSlashMenuRenderer: createReactSlashMenuRenderer,
			onCreate: ({ editor: e }) => callbacksRef.current.onCreate?.({ editor: e }),
			onError: (error) => callbacksRef.current.onError?.(error),
		})
			.then((result) => {
				if (!lifecycle.mounted) {
					result.editor.destroy();
					return;
				}
				const editorInstance = result.editor;
				// Attach runtime event listeners only after creation. Vizel installs its
				// Markdown surface (editor.getMarkdown / editor.markdown) in the markdown
				// extension's deferred onCreate hook, so passing these as factory options
				// would deliver in-construction updates to an editor without getMarkdown
				// and crash getVizelMarkdown. Subscribing here mirrors @vizel/react.
				editorInstance.on('update', ({ editor: e }) =>
					callbacksRef.current.onUpdate?.({ editor: e })
				);
				editorInstance.on('selectionUpdate', ({ editor: e }) =>
					callbacksRef.current.onSelectionUpdate?.({ editor: e })
				);
				editorInstance.on('focus', ({ editor: e }) =>
					callbacksRef.current.onFocus?.({ editor: e })
				);
				editorInstance.on('blur', ({ editor: e }) => callbacksRef.current.onBlur?.({ editor: e }));
				lifecycle.instance = editorInstance;
				setEditor(editorInstance);
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

	return (
		<>
			{editor ? <VizelBubbleMenu editor={editor} /> : null}
			<EditorContent editor={editor} className={className} />
		</>
	);
}
