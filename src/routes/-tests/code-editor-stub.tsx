// Monaco cannot load in jsdom, so route tests replace `@/lib/components/editor`
// with this stub. It keeps the props the routes drive (value, change, and the
// paste / clear / sample actions) and renders them as plain form controls.

interface CodeEditorStubProps {
	readonly title?: string;
	readonly value?: string;
	readonly onChange?: (value: string) => void;
	readonly onPaste?: () => void;
	readonly onClear?: () => void;
	readonly onSample?: () => void;
}

export function CodeEditor({
	title = 'Editor',
	value = '',
	onChange,
	onPaste,
	onClear,
	onSample,
}: CodeEditorStubProps) {
	return (
		<div>
			<textarea aria-label={title} value={value} onChange={(e) => onChange?.(e.target.value)} />
			{onPaste ? (
				<button type="button" onClick={onPaste}>
					Paste
				</button>
			) : null}
			{onClear ? (
				<button type="button" onClick={onClear}>
					Clear
				</button>
			) : null}
			{onSample ? (
				<button type="button" onClick={onSample}>
					Sample
				</button>
			) : null}
		</div>
	);
}

export function CodeEditorWrapper() {
	return null;
}

export function TreeView() {
	return null;
}
