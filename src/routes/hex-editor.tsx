import { createFileRoute } from '@tanstack/react-router';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
	ChevronLeft,
	ChevronRight,
	FileSearch,
	FolderOpen,
	Loader2,
	Redo2,
	Save,
	Search,
	Trash2,
	Undo2,
} from 'lucide-react';
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type DragEvent,
	type KeyboardEvent,
	type MouseEvent,
} from 'react';
import { toast } from 'sonner';

import { FormCheckbox, FormInfo, FormInput, FormMode, FormSection } from '@/lib/components/form';
import { RelatedTools } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { useDocumentTitle } from '@/lib/hooks';
import { detectMimeFromMagic } from '@/lib/services/file-inspect';
import {
	bytesToAscii,
	findAllMatches,
	formatHexByte,
	formatOffset,
	hexOpen,
	hexRead,
	hexSave,
	humanSize,
	interpretBytes,
	parseHexPattern,
	parseJumpOffset,
	textToBytes,
	type HexEditOp,
	type HexFileInfo,
} from '@/lib/services/hex-editor';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import { basename, cn } from '@/lib/utils';

const ROW_HEIGHT = 20;
const OVERSCAN_ROWS = 12;
// Magic-byte highlight covers the first N bytes (matches the common
// file-signature length; longer signatures still tint the same row).
const MAGIC_BYTES_HIGHLIGHT = 8;
const UNDO_LIMIT = 100;

type BytesPerRow = 16 | 32;
type SearchMode = 'hex' | 'text';

interface HexEditorPrefs {
	readonly bytesPerRow: BytesPerRow;
	readonly uppercase: boolean;
	readonly showAscii: boolean;
	readonly readOnly: boolean;
	readonly backupOnSave: boolean;
}

const DEFAULT_PREFS: HexEditorPrefs = {
	bytesPerRow: 16,
	uppercase: true,
	showAscii: true,
	readOnly: true,
	backupOnSave: true,
};

const useHexEditorPrefs = createToolOptionsStore<HexEditorPrefs>('hex-editor', DEFAULT_PREFS);

interface Selection {
	readonly start: number;
	readonly end: number;
}

export const Route = createFileRoute('/hex-editor')({
	component: HexEditorPage,
});

function HexEditorPage() {
	useDocumentTitle('Hex Editor');

	const { value: prefs, patch } = useHexEditorPrefs();

	const [file, setFile] = useState<HexFileInfo | null>(null);
	const [buffer, setBuffer] = useState<Uint8Array | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [showRail, setShowRail] = usePersistedRail('hex-editor');
	const [selection, setSelection] = useState<Selection | null>(null);
	const [pendingOps, setPendingOps] = useState<readonly HexEditOp[]>([]);
	const [undoStack, setUndoStack] = useState<readonly Uint8Array[]>([]);
	const [redoStack, setRedoStack] = useState<readonly Uint8Array[]>([]);
	const [searchInput, setSearchInput] = useState('');
	const [searchMode, setSearchMode] = useState<SearchMode>('hex');
	const [activeMatchIdx, setActiveMatchIdx] = useState(0);
	const [jumpInput, setJumpInput] = useState('');
	const [scrollTop, setScrollTop] = useState(0);
	const [editingByte, setEditingByte] = useState<{
		readonly offset: number;
		readonly draft: string;
	} | null>(null);

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const dragAnchorRef = useRef<number | null>(null);
	const viewportRef = useRef<HTMLDivElement | null>(null);

	const handleClear = useCallback(() => {
		setFile(null);
		setBuffer(null);
		setError(null);
		setSelection(null);
		setPendingOps([]);
		setUndoStack([]);
		setRedoStack([]);
		setSearchInput('');
		setActiveMatchIdx(0);
		setJumpInput('');
		setScrollTop(0);
		setEditingByte(null);
	}, []);

	const loadFromPath = useCallback(async (path: string) => {
		setLoading(true);
		setError(null);
		try {
			const info = await hexOpen(path);
			// Read the entire file into memory for editing. For very
			// large files (> a few hundred megabytes) this is the point
			// where a future PR would switch to viewport-streaming.
			const bytes =
				info.sizeBytes === 0 ? new Uint8Array(0) : await hexRead(path, 0, info.sizeBytes);
			setFile(info);
			setBuffer(bytes);
			setSelection(null);
			setPendingOps([]);
			setUndoStack([]);
			setRedoStack([]);
			setScrollTop(0);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message);
			toast.error('Failed to open file', { description: message });
		} finally {
			setLoading(false);
		}
	}, []);

	const handlePickFile = async () => {
		try {
			const selected = await openDialog({ multiple: false, directory: false });
			if (typeof selected === 'string' && selected.length > 0) {
				await loadFromPath(selected);
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to open file dialog', { description: message });
		}
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
		const dropped = e.dataTransfer.files[0] as (File & { readonly path?: string }) | undefined;
		if (!dropped) return;
		if (dropped.path) {
			loadFromPath(dropped.path).catch(() => undefined);
			return;
		}
		toast.error('Could not determine file path', {
			description: 'Use the Open file button to pick the file.',
		});
	};
	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
	};
	const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
	};

	const dirty = pendingOps.length > 0;
	const editable = !prefs.readOnly;

	const mimeInfo = useMemo(() => {
		if (!buffer || !file) return null;
		const head = buffer.subarray(0, Math.min(buffer.length, 4096));
		return detectMimeFromMagic(head, basename(file.path));
	}, [buffer, file]);
	const detectedMime = mimeInfo?.mime ?? mimeInfo?.expectedFromExtension ?? null;

	const searchPattern = useMemo<Uint8Array | null>(() => {
		if (searchInput.length === 0) return null;
		if (searchMode === 'hex') return parseHexPattern(searchInput);
		return textToBytes(searchInput);
	}, [searchInput, searchMode]);

	const matches = useMemo(() => {
		if (!buffer || !searchPattern) return [] as readonly number[];
		return findAllMatches(buffer, searchPattern);
	}, [buffer, searchPattern]);

	useEffect(() => {
		if (matches.length === 0) {
			setActiveMatchIdx(0);
		} else if (activeMatchIdx >= matches.length) {
			setActiveMatchIdx(0);
		}
	}, [matches, activeMatchIdx]);

	const totalRows = useMemo(() => {
		if (!buffer) return 0;
		return Math.ceil(buffer.length / prefs.bytesPerRow);
	}, [buffer, prefs.bytesPerRow]);

	const [viewportHeight, setViewportHeight] = useState(480);

	useEffect(() => {
		const el = viewportRef.current;
		if (!el) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) setViewportHeight(entry.contentRect.height);
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, [buffer]);

	const firstVisibleRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
	const lastVisibleRow = Math.min(
		totalRows,
		Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS
	);

	const visibleRows = useMemo(() => {
		if (!buffer) return [] as readonly { readonly offset: number; readonly bytes: Uint8Array }[];
		const rows: { readonly offset: number; readonly bytes: Uint8Array }[] = [];
		for (let row = firstVisibleRow; row < lastVisibleRow; row += 1) {
			const start = row * prefs.bytesPerRow;
			if (start >= buffer.length) break;
			const end = Math.min(buffer.length, start + prefs.bytesPerRow);
			rows.push({ offset: start, bytes: buffer.subarray(start, end) });
		}
		return rows;
	}, [buffer, firstVisibleRow, lastVisibleRow, prefs.bytesPerRow]);

	const scrollToOffset = useCallback(
		(offset: number) => {
			const el = scrollRef.current;
			if (!el) return;
			const row = Math.floor(offset / prefs.bytesPerRow);
			const target = Math.max(0, row * ROW_HEIGHT - viewportHeight / 2);
			el.scrollTop = target;
			setScrollTop(target);
		},
		[prefs.bytesPerRow, viewportHeight]
	);

	const handleJump = useCallback(() => {
		if (!buffer) return;
		const next = parseJumpOffset(jumpInput, selection?.start ?? 0, buffer.length);
		if (next === null) {
			toast.error('Could not parse offset');
			return;
		}
		setSelection({ start: next, end: next });
		scrollToOffset(next);
	}, [buffer, jumpInput, selection, scrollToOffset]);

	const handleQuickJump = useCallback(
		(fraction: number) => {
			if (!buffer || buffer.length === 0) return;
			const offset = Math.min(buffer.length - 1, Math.floor(buffer.length * fraction));
			setSelection({ start: offset, end: offset });
			scrollToOffset(offset);
		},
		[buffer, scrollToOffset]
	);

	const findNext = useCallback(() => {
		if (matches.length === 0) return;
		const next = (activeMatchIdx + 1) % matches.length;
		setActiveMatchIdx(next);
		const offset = matches[next];
		if (offset !== undefined && searchPattern) {
			setSelection({ start: offset, end: offset + searchPattern.length - 1 });
			scrollToOffset(offset);
		}
	}, [matches, activeMatchIdx, searchPattern, scrollToOffset]);

	const findPrev = useCallback(() => {
		if (matches.length === 0) return;
		const prev = (activeMatchIdx - 1 + matches.length) % matches.length;
		setActiveMatchIdx(prev);
		const offset = matches[prev];
		if (offset !== undefined && searchPattern) {
			setSelection({ start: offset, end: offset + searchPattern.length - 1 });
			scrollToOffset(offset);
		}
	}, [matches, activeMatchIdx, searchPattern, scrollToOffset]);

	const matchSet = useMemo(() => {
		if (!searchPattern) return null;
		const set = new Set<number>();
		const len = searchPattern.length;
		for (const start of matches) {
			for (let i = 0; i < len; i += 1) set.add(start + i);
		}
		return set;
	}, [matches, searchPattern]);

	const pushHistory = useCallback((snapshot: Uint8Array) => {
		setUndoStack((prev) => {
			const next = [...prev, snapshot];
			if (next.length > UNDO_LIMIT) return next.slice(next.length - UNDO_LIMIT);
			return next;
		});
		setRedoStack([]);
	}, []);

	const commitByte = useCallback(
		(offset: number, value: number) => {
			if (!buffer) return;
			if (offset < 0 || offset >= buffer.length) return;
			const current = buffer[offset];
			if (current === undefined || current === value) {
				setEditingByte(null);
				return;
			}
			pushHistory(buffer);
			const next = new Uint8Array(buffer);
			next[offset] = value;
			setBuffer(next);
			setPendingOps((prev) => [
				...prev,
				{
					offset,
					original: new Uint8Array([current]),
					replacement: new Uint8Array([value]),
					kind: 'patch',
				},
			]);
			setEditingByte(null);
		},
		[buffer, pushHistory]
	);

	const handleUndo = useCallback(() => {
		if (undoStack.length === 0 || !buffer) return;
		const previous = undoStack[undoStack.length - 1];
		if (!previous) return;
		setUndoStack(undoStack.slice(0, -1));
		setRedoStack((stack) => [...stack, buffer]);
		setBuffer(previous);
		// Drop the latest pending op to mirror the snapshot rollback.
		setPendingOps((prev) => prev.slice(0, -1));
	}, [undoStack, buffer]);

	const handleRedo = useCallback(() => {
		if (redoStack.length === 0 || !buffer) return;
		const next = redoStack[redoStack.length - 1];
		if (!next) return;
		setRedoStack(redoStack.slice(0, -1));
		setUndoStack((stack) => [...stack, buffer]);
		setBuffer(next);
	}, [redoStack, buffer]);

	const handleDiscard = useCallback(() => {
		if (!file) return;
		loadFromPath(file.path).catch(() => undefined);
	}, [file, loadFromPath]);

	const handleSave = useCallback(async () => {
		if (!file || pendingOps.length === 0) return;
		try {
			const newSize = await hexSave(file.path, pendingOps, prefs.backupOnSave);
			toast.success('File saved', { description: `${newSize} bytes written` });
			setPendingOps([]);
			setUndoStack([]);
			setRedoStack([]);
			// Re-stat to reflect new modified time.
			const info = await hexOpen(file.path);
			setFile(info);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to save', { description: message });
		}
	}, [file, pendingOps, prefs.backupOnSave]);

	const selectionBytes = useMemo<Uint8Array | null>(() => {
		if (!buffer || !selection) return null;
		const [lo, hi] =
			selection.start <= selection.end
				? [selection.start, selection.end]
				: [selection.end, selection.start];
		const slice = buffer.subarray(lo, Math.min(buffer.length, hi + 1));
		return slice.length > 0 ? slice : null;
	}, [buffer, selection]);

	const selectionLength = selectionBytes?.length ?? 0;
	const interpretation = useMemo(
		() => (selectionBytes ? interpretBytes(selectionBytes) : null),
		[selectionBytes]
	);

	const onCellMouseDown = (offset: number) => (e: MouseEvent<HTMLButtonElement>) => {
		if (editingByte) return;
		dragAnchorRef.current = offset;
		setSelection({ start: offset, end: offset });
		e.preventDefault();
	};
	const onCellMouseEnter = (offset: number) => () => {
		if (dragAnchorRef.current === null) return;
		setSelection({ start: dragAnchorRef.current, end: offset });
	};

	// Window-level mouseup so a drag started inside the viewport still
	// resolves when the cursor leaves the bounds. A div onMouseUp would
	// fire on the wrapper, but biome rejects interactivity on a non-semantic
	// container; the window listener avoids the rule without rewrapping in
	// a button/grid that does not match the visual structure.
	useEffect(() => {
		const handler = () => {
			dragAnchorRef.current = null;
		};
		window.addEventListener('mouseup', handler);
		return () => window.removeEventListener('mouseup', handler);
	}, []);

	const startEdit = (offset: number) => {
		if (!editable || !buffer) return;
		const b = buffer[offset];
		if (b === undefined) return;
		setEditingByte({ offset, draft: '' });
	};

	const tryParseEditDraft = (draft: string): number | null => {
		const trimmed = draft.trim();
		if (trimmed.length !== 2 || !/^[0-9a-fA-F]{2}$/.test(trimmed)) return null;
		return Number.parseInt(trimmed, 16);
	};

	const advanceEditCursor = (offset: number, shift: boolean) => {
		if (!buffer) return;
		const next = shift ? offset - 1 : offset + 1;
		if (next < 0 || next >= buffer.length) return;
		setSelection({ start: next, end: next });
		setEditingByte({ offset: next, draft: '' });
	};

	const handleEditKeyDown = (offset: number) => (e: KeyboardEvent<HTMLInputElement>) => {
		if (!editingByte) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			setEditingByte(null);
			return;
		}
		if (e.key !== 'Enter' && e.key !== 'Tab') return;
		e.preventDefault();
		const value = tryParseEditDraft(editingByte.draft);
		if (value === null) {
			toast.error('Enter two hex characters');
			return;
		}
		commitByte(offset, value);
		if (e.key === 'Tab') advanceEditCursor(offset, e.shiftKey);
	};

	const hasFile = file !== null;

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			valid={hasFile ? true : null}
			error={error ?? undefined}
			statusContent={
				hasFile && file ? (
					<>
						<StatItem label="Size" value={humanSize(file.sizeBytes)} />
						<StatItem label="Offset" value={formatOffset(selection?.start ?? 0)} />
						<StatItem
							label="Selection"
							value={selectionLength > 0 ? `${selectionLength} B` : '—'}
						/>
						<StatItem label="Modified" value={dirty ? `${pendingOps.length} pending` : 'No'} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Open">
						<div className="flex flex-col gap-2">
							<Button variant="default" size="sm" onClick={handlePickFile} disabled={loading}>
								<FolderOpen className="h-3.5 w-3.5" />
								{hasFile ? 'Choose another' : 'Open file…'}
							</Button>
							{hasFile ? (
								<Button variant="outline" size="sm" onClick={handleClear}>
									<Trash2 className="h-3.5 w-3.5" />
									Clear
								</Button>
							) : null}
						</div>
					</FormSection>

					<FormSection title="Search">
						<FormMode<SearchMode>
							label="Pattern"
							value={searchMode}
							options={[
								{ value: 'hex', label: 'Hex' },
								{ value: 'text', label: 'Text' },
							]}
							onValueChange={setSearchMode}
						/>
						<FormInput
							label={searchMode === 'hex' ? 'Hex pattern (e.g. 89 50 4E 47)' : 'Text to find'}
							value={searchInput}
							onValueChange={setSearchInput}
							placeholder={searchMode === 'hex' ? '89 50 4E 47' : 'PNG'}
							size="compact"
						/>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={findPrev}
								disabled={matches.length === 0}
							>
								<ChevronLeft className="h-3.5 w-3.5" />
								Prev
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={findNext}
								disabled={matches.length === 0}
							>
								<ChevronRight className="h-3.5 w-3.5" />
								Next
							</Button>
							<Badge variant="outline" className="ml-auto font-mono text-2xs">
								<Search className="h-3 w-3" />
								{matches.length > 0 ? `${activeMatchIdx + 1} / ${matches.length}` : '0'}
							</Badge>
						</div>
					</FormSection>

					<FormSection title="Jump to offset">
						<FormInput
							label="Offset (dec / 0xHEX / ±rel)"
							value={jumpInput}
							onValueChange={setJumpInput}
							placeholder="0x400 or +256"
							size="compact"
						/>
						<div className="flex flex-wrap gap-1.5">
							<Button variant="outline" size="sm" onClick={handleJump}>
								Go
							</Button>
							<Button variant="outline" size="sm" onClick={() => handleQuickJump(0)}>
								Start
							</Button>
							<Button variant="outline" size="sm" onClick={() => handleQuickJump(0.5)}>
								50%
							</Button>
							<Button variant="outline" size="sm" onClick={() => handleQuickJump(0.75)}>
								75%
							</Button>
							<Button variant="outline" size="sm" onClick={() => handleQuickJump(0.9999)}>
								End
							</Button>
						</div>
					</FormSection>

					<FormSection title="Display">
						<FormMode<string>
							label="Bytes per row"
							value={String(prefs.bytesPerRow)}
							options={[
								{ value: '16', label: '16' },
								{ value: '32', label: '32' },
							]}
							onValueChange={(v) => patch({ bytesPerRow: v === '32' ? 32 : 16 })}
						/>
						<FormCheckbox
							label="Uppercase hex"
							checked={prefs.uppercase}
							onCheckedChange={(checked) => patch({ uppercase: checked })}
							size="compact"
						/>
						<FormCheckbox
							label="Show ASCII gutter"
							checked={prefs.showAscii}
							onCheckedChange={(checked) => patch({ showAscii: checked })}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Mode">
						<FormCheckbox
							label="Read-only"
							checked={prefs.readOnly}
							onCheckedChange={(checked) => {
								patch({ readOnly: checked });
								if (checked) setEditingByte(null);
							}}
							size="compact"
						/>
						{!prefs.readOnly ? (
							<div className="flex flex-wrap gap-1.5">
								<Button
									variant="outline"
									size="sm"
									onClick={handleUndo}
									disabled={undoStack.length === 0}
								>
									<Undo2 className="h-3.5 w-3.5" />
									Undo
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={handleRedo}
									disabled={redoStack.length === 0}
								>
									<Redo2 className="h-3.5 w-3.5" />
									Redo
								</Button>
								<Button variant="outline" size="sm" onClick={handleDiscard} disabled={!dirty}>
									<Trash2 className="h-3.5 w-3.5" />
									Discard
								</Button>
							</div>
						) : null}
					</FormSection>

					<FormSection title="Save">
						<FormCheckbox
							label="Create .bak backup"
							checked={prefs.backupOnSave}
							onCheckedChange={(checked) => patch({ backupOnSave: checked })}
							size="compact"
						/>
						<Button
							variant="default"
							size="sm"
							onClick={handleSave}
							disabled={!dirty || prefs.readOnly}
						>
							<Save className="h-3.5 w-3.5" />
							Save
						</Button>
					</FormSection>

					<FormSection title="Related">
						<RelatedTools
							items={[
								{ id: 'file-inspector', reason: 'Inspect metadata' },
								{ id: 'mime-types', reason: 'Decode magic bytes' },
							]}
						/>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							Virtual scrolling renders only visible rows. Backup .bak is written on save when
							enabled. Insert / delete operations that change file length are deferred to a future
							iteration.
						</FormInfo>
					</FormSection>
				</>
			}
		>
			{hasFile && file && buffer ? (
				<HexView
					file={file}
					detectedMime={detectedMime}
					magicHex={mimeInfo?.matchedBytes ?? null}
					prefs={prefs}
					selection={selection}
					matchSet={matchSet}
					activeMatchOffset={matches[activeMatchIdx] ?? null}
					patternLength={searchPattern?.length ?? 0}
					editable={editable}
					editingByte={editingByte}
					interpretation={interpretation}
					selectionBytes={selectionBytes}
					selectionLength={selectionLength}
					totalRows={totalRows}
					firstVisibleRow={firstVisibleRow}
					visibleRows={visibleRows}
					dirty={dirty}
					pendingCount={pendingOps.length}
					onScrollChange={setScrollTop}
					scrollRef={scrollRef}
					viewportRef={viewportRef}
					onCellMouseDown={onCellMouseDown}
					onCellMouseEnter={onCellMouseEnter}
					onStartEdit={startEdit}
					onDraftChange={(draft) =>
						setEditingByte((prev) => (prev ? { offset: prev.offset, draft } : prev))
					}
					onEditKeyDown={handleEditKeyDown}
				/>
			) : (
				<DropZone
					loading={loading}
					isDragOver={isDragOver}
					onDrop={handleDrop}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onPick={handlePickFile}
				/>
			)}
		</ToolShell>
	);
}

interface DropZoneProps {
	readonly loading: boolean;
	readonly isDragOver: boolean;
	readonly onDrop: (e: DragEvent<HTMLDivElement>) => void;
	readonly onDragOver: (e: DragEvent<HTMLDivElement>) => void;
	readonly onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
	readonly onPick: () => void;
}

function DropZone({ loading, isDragOver, onDrop, onDragOver, onDragLeave, onPick }: DropZoneProps) {
	return (
		<section
			aria-label="File drop zone"
			onDrop={onDrop}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			className={cn(
				'flex h-full items-center justify-center p-6 transition-colors',
				isDragOver && 'bg-primary/5'
			)}
		>
			<div
				className={cn(
					'flex w-full max-w-xl flex-col items-center gap-4 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
					isDragOver ? 'border-primary bg-primary/10' : 'border-border'
				)}
			>
				<EmbeddedEmptyState
					icon={FileSearch}
					title="Open a binary file"
					description="Drop a file here or click to browse."
				/>
				<Button variant="default" size="sm" onClick={onPick} disabled={loading}>
					{loading ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<FolderOpen className="h-3.5 w-3.5" />
					)}
					{loading ? 'Loading…' : 'Open file…'}
				</Button>
			</div>
		</section>
	);
}

interface HexViewProps {
	readonly file: HexFileInfo;
	readonly detectedMime: string | null;
	readonly magicHex: string | null;
	readonly prefs: HexEditorPrefs;
	readonly selection: Selection | null;
	readonly matchSet: ReadonlySet<number> | null;
	readonly activeMatchOffset: number | null;
	readonly patternLength: number;
	readonly editable: boolean;
	readonly editingByte: { readonly offset: number; readonly draft: string } | null;
	readonly interpretation: ReturnType<typeof interpretBytes> | null;
	readonly selectionBytes: Uint8Array | null;
	readonly selectionLength: number;
	readonly totalRows: number;
	readonly firstVisibleRow: number;
	readonly visibleRows: readonly { readonly offset: number; readonly bytes: Uint8Array }[];
	readonly dirty: boolean;
	readonly pendingCount: number;
	readonly onScrollChange: (top: number) => void;
	readonly scrollRef: React.RefObject<HTMLDivElement | null>;
	readonly viewportRef: React.RefObject<HTMLDivElement | null>;
	readonly onCellMouseDown: (offset: number) => (e: MouseEvent<HTMLButtonElement>) => void;
	readonly onCellMouseEnter: (offset: number) => () => void;
	readonly onStartEdit: (offset: number) => void;
	readonly onDraftChange: (draft: string) => void;
	readonly onEditKeyDown: (offset: number) => (e: KeyboardEvent<HTMLInputElement>) => void;
}

function HexView({
	file,
	detectedMime,
	magicHex,
	prefs,
	selection,
	matchSet,
	activeMatchOffset,
	patternLength,
	editable,
	editingByte,
	interpretation,
	selectionBytes,
	selectionLength,
	totalRows,
	firstVisibleRow,
	visibleRows,
	dirty,
	pendingCount,
	onScrollChange,
	scrollRef,
	viewportRef,
	onCellMouseDown,
	onCellMouseEnter,
	onStartEdit,
	onDraftChange,
	onEditKeyDown,
}: HexViewProps) {
	const selectionRange = useMemo(() => {
		if (!selection) return null;
		return selection.start <= selection.end
			? { lo: selection.start, hi: selection.end }
			: { lo: selection.end, hi: selection.start };
	}, [selection]);

	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="shrink-0 border-b p-3">
				<FileBanner
					file={file}
					detectedMime={detectedMime}
					magicHex={magicHex}
					dirty={dirty}
					pendingCount={pendingCount}
				/>
			</div>

			<div
				ref={viewportRef}
				className="relative flex-1 overflow-hidden bg-muted/30 font-mono text-xs"
			>
				<div
					ref={scrollRef}
					className="h-full overflow-auto"
					onScroll={(e) => onScrollChange(e.currentTarget.scrollTop)}
				>
					<div style={{ height: totalRows * ROW_HEIGHT }} className="relative">
						<div
							style={{ transform: `translateY(${firstVisibleRow * ROW_HEIGHT}px)` }}
							className="absolute left-0 right-0 top-0"
						>
							{visibleRows.map((row) => (
								<HexRow
									key={row.offset}
									offset={row.offset}
									bytes={row.bytes}
									bytesPerRow={prefs.bytesPerRow}
									uppercase={prefs.uppercase}
									showAscii={prefs.showAscii}
									selectionRange={selectionRange}
									matchSet={matchSet}
									activeMatchOffset={activeMatchOffset}
									patternLength={patternLength}
									isMagicRow={row.offset < MAGIC_BYTES_HIGHLIGHT && magicHex !== null}
									editable={editable}
									editingByte={editingByte}
									onCellMouseDown={onCellMouseDown}
									onCellMouseEnter={onCellMouseEnter}
									onStartEdit={onStartEdit}
									onDraftChange={onDraftChange}
									onEditKeyDown={onEditKeyDown}
								/>
							))}
						</div>
					</div>
				</div>
			</div>

			{selectionBytes && interpretation && selectionRange ? (
				<SelectionPanel
					range={selectionRange}
					length={selectionLength}
					interpretation={interpretation}
				/>
			) : null}
		</div>
	);
}

interface FileBannerProps {
	readonly file: HexFileInfo;
	readonly detectedMime: string | null;
	readonly magicHex: string | null;
	readonly dirty: boolean;
	readonly pendingCount: number;
}

function FileBanner({ file, detectedMime, magicHex, dirty, pendingCount }: FileBannerProps) {
	const filename = basename(file.path);
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm">
					<span className="truncate font-mono">{filename}</span>
					{dirty ? (
						<Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning">
							{pendingCount} pending edit{pendingCount > 1 ? 's' : ''}
						</Badge>
					) : null}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
					<dt className="text-muted-foreground">Size</dt>
					<dd className="font-mono">
						{humanSize(file.sizeBytes)} ({file.sizeBytes.toLocaleString()} B)
					</dd>
					<dt className="text-muted-foreground">Modified</dt>
					<dd className="font-mono">
						{file.modifiedMs ? new Date(file.modifiedMs).toLocaleString() : '—'}
					</dd>
					<dt className="text-muted-foreground">Detected MIME</dt>
					<dd className="font-mono">{detectedMime ?? '(unknown)'}</dd>
					{magicHex ? (
						<>
							<dt className="text-muted-foreground">Magic bytes</dt>
							<dd className="font-mono">{magicHex}</dd>
						</>
					) : null}
				</dl>
			</CardContent>
		</Card>
	);
}

interface HexRowProps {
	readonly offset: number;
	readonly bytes: Uint8Array;
	readonly bytesPerRow: BytesPerRow;
	readonly uppercase: boolean;
	readonly showAscii: boolean;
	readonly selectionRange: { readonly lo: number; readonly hi: number } | null;
	readonly matchSet: ReadonlySet<number> | null;
	readonly activeMatchOffset: number | null;
	readonly patternLength: number;
	readonly isMagicRow: boolean;
	readonly editable: boolean;
	readonly editingByte: { readonly offset: number; readonly draft: string } | null;
	readonly onCellMouseDown: (offset: number) => (e: MouseEvent<HTMLButtonElement>) => void;
	readonly onCellMouseEnter: (offset: number) => () => void;
	readonly onStartEdit: (offset: number) => void;
	readonly onDraftChange: (draft: string) => void;
	readonly onEditKeyDown: (offset: number) => (e: KeyboardEvent<HTMLInputElement>) => void;
}

function HexRow({
	offset,
	bytes,
	bytesPerRow,
	uppercase,
	showAscii,
	selectionRange,
	matchSet,
	activeMatchOffset,
	patternLength,
	isMagicRow,
	editable,
	editingByte,
	onCellMouseDown,
	onCellMouseEnter,
	onStartEdit,
	onDraftChange,
	onEditKeyDown,
}: HexRowProps) {
	const offsetStr = uppercase ? formatOffset(offset) : formatOffset(offset).toLowerCase();

	const ascii = bytesToAscii(bytes);
	const groupSize = bytesPerRow / 2;

	return (
		<div
			style={{ height: ROW_HEIGHT } as CSSProperties}
			className="flex items-center gap-3 px-3 leading-none"
		>
			<span className="shrink-0 text-muted-foreground">{offsetStr}</span>
			<div className="flex flex-1 items-center gap-2">
				<HexGroup
					bytes={bytes.subarray(0, groupSize)}
					rowOffset={offset}
					groupOffset={0}
					uppercase={uppercase}
					selectionRange={selectionRange}
					matchSet={matchSet}
					activeMatchOffset={activeMatchOffset}
					patternLength={patternLength}
					isMagicRow={isMagicRow}
					magicHighlightCount={MAGIC_BYTES_HIGHLIGHT}
					editable={editable}
					editingByte={editingByte}
					onCellMouseDown={onCellMouseDown}
					onCellMouseEnter={onCellMouseEnter}
					onStartEdit={onStartEdit}
					onDraftChange={onDraftChange}
					onEditKeyDown={onEditKeyDown}
				/>
				{bytes.length > groupSize ? (
					<HexGroup
						bytes={bytes.subarray(groupSize)}
						rowOffset={offset}
						groupOffset={groupSize}
						uppercase={uppercase}
						selectionRange={selectionRange}
						matchSet={matchSet}
						activeMatchOffset={activeMatchOffset}
						patternLength={patternLength}
						isMagicRow={isMagicRow}
						magicHighlightCount={MAGIC_BYTES_HIGHLIGHT}
						editable={editable}
						editingByte={editingByte}
						onCellMouseDown={onCellMouseDown}
						onCellMouseEnter={onCellMouseEnter}
						onStartEdit={onStartEdit}
						onDraftChange={onDraftChange}
						onEditKeyDown={onEditKeyDown}
					/>
				) : null}
			</div>
			{showAscii ? (
				<span className="shrink-0 whitespace-pre text-muted-foreground/80">{ascii}</span>
			) : null}
		</div>
	);
}

interface HexGroupProps {
	readonly bytes: Uint8Array;
	readonly rowOffset: number;
	readonly groupOffset: number;
	readonly uppercase: boolean;
	readonly selectionRange: { readonly lo: number; readonly hi: number } | null;
	readonly matchSet: ReadonlySet<number> | null;
	readonly activeMatchOffset: number | null;
	readonly patternLength: number;
	readonly isMagicRow: boolean;
	readonly magicHighlightCount: number;
	readonly editable: boolean;
	readonly editingByte: { readonly offset: number; readonly draft: string } | null;
	readonly onCellMouseDown: (offset: number) => (e: MouseEvent<HTMLButtonElement>) => void;
	readonly onCellMouseEnter: (offset: number) => () => void;
	readonly onStartEdit: (offset: number) => void;
	readonly onDraftChange: (draft: string) => void;
	readonly onEditKeyDown: (offset: number) => (e: KeyboardEvent<HTMLInputElement>) => void;
}

function HexGroup({
	bytes,
	rowOffset,
	groupOffset,
	uppercase,
	selectionRange,
	matchSet,
	activeMatchOffset,
	patternLength,
	isMagicRow,
	magicHighlightCount,
	editable,
	editingByte,
	onCellMouseDown,
	onCellMouseEnter,
	onStartEdit,
	onDraftChange,
	onEditKeyDown,
}: HexGroupProps) {
	const cells: React.ReactNode[] = [];
	for (let i = 0; i < bytes.length; i += 1) {
		const absoluteOffset = rowOffset + groupOffset + i;
		const byte = bytes[i];
		if (byte === undefined) continue;
		const selected =
			selectionRange && absoluteOffset >= selectionRange.lo && absoluteOffset <= selectionRange.hi;
		const isMatch = matchSet?.has(absoluteOffset) ?? false;
		const isActiveMatch =
			activeMatchOffset !== null &&
			absoluteOffset >= activeMatchOffset &&
			absoluteOffset < activeMatchOffset + patternLength;
		const isMagic = isMagicRow && absoluteOffset - rowOffset + groupOffset < magicHighlightCount;
		const editing = editingByte?.offset === absoluteOffset;
		cells.push(
			<HexCell
				key={absoluteOffset}
				offset={absoluteOffset}
				byte={byte}
				uppercase={uppercase}
				selected={selected ?? false}
				match={isMatch}
				activeMatch={isActiveMatch}
				magic={isMagic}
				editable={editable}
				editing={editing}
				draft={editing ? (editingByte?.draft ?? '') : ''}
				onMouseDown={onCellMouseDown(absoluteOffset)}
				onMouseEnter={onCellMouseEnter(absoluteOffset)}
				onStartEdit={() => onStartEdit(absoluteOffset)}
				onDraftChange={onDraftChange}
				onKeyDown={onEditKeyDown(absoluteOffset)}
			/>
		);
	}
	return <div className="flex gap-1">{cells}</div>;
}

interface HexCellProps {
	readonly offset: number;
	readonly byte: number;
	readonly uppercase: boolean;
	readonly selected: boolean;
	readonly match: boolean;
	readonly activeMatch: boolean;
	readonly magic: boolean;
	readonly editable: boolean;
	readonly editing: boolean;
	readonly draft: string;
	readonly onMouseDown: (e: MouseEvent<HTMLButtonElement>) => void;
	readonly onMouseEnter: () => void;
	readonly onStartEdit: () => void;
	readonly onDraftChange: (draft: string) => void;
	readonly onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

function HexCell({
	byte,
	uppercase,
	selected,
	match,
	activeMatch,
	magic,
	editable,
	editing,
	draft,
	onMouseDown,
	onMouseEnter,
	onStartEdit,
	onDraftChange,
	onKeyDown,
}: HexCellProps) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	useEffect(() => {
		if (editing) inputRef.current?.focus();
	}, [editing]);

	if (editing) {
		return (
			<input
				ref={inputRef}
				className={cn(
					'w-7 rounded-sm border border-primary bg-background px-1 text-center font-mono uppercase outline-none'
				)}
				value={draft}
				maxLength={2}
				onChange={(e) => onDraftChange(e.target.value)}
				onKeyDown={onKeyDown}
			/>
		);
	}
	return (
		<button
			type="button"
			tabIndex={editable ? 0 : -1}
			onMouseDown={onMouseDown}
			onMouseEnter={onMouseEnter}
			onDoubleClick={editable ? onStartEdit : undefined}
			className={cn(
				'inline-block w-6 cursor-pointer select-none rounded-sm bg-transparent text-center transition-colors',
				selected && 'bg-primary/20',
				match && 'bg-warning/30',
				activeMatch && 'ring-1 ring-warning',
				magic && 'border border-info text-info'
			)}
		>
			{formatHexByte(byte, uppercase)}
		</button>
	);
}

interface SelectionPanelProps {
	readonly range: { readonly lo: number; readonly hi: number };
	readonly length: number;
	readonly interpretation: ReturnType<typeof interpretBytes>;
}

function SelectionPanel({ range, length, interpretation }: SelectionPanelProps) {
	const rows: { readonly label: string; readonly value: string }[] = [];
	const push = (label: string, value: number | bigint | string | undefined) => {
		if (value === undefined || value === null) return;
		rows.push({ label, value: typeof value === 'bigint' ? value.toString() : String(value) });
	};
	push('u8', interpretation.u8);
	push('i8', interpretation.i8);
	push('u16 LE', interpretation.u16le);
	push('u16 BE', interpretation.u16be);
	push('i16 LE', interpretation.i16le);
	push('i16 BE', interpretation.i16be);
	push('u32 LE', interpretation.u32le);
	push('u32 BE', interpretation.u32be);
	push('i32 LE', interpretation.i32le);
	push('i32 BE', interpretation.i32be);
	push('u64 LE', interpretation.u64le);
	push('u64 BE', interpretation.u64be);
	push('f32 LE', interpretation.f32le);
	push('f32 BE', interpretation.f32be);
	push('f64 LE', interpretation.f64le);
	push('f64 BE', interpretation.f64be);

	return (
		<div className="shrink-0 border-t bg-surface-2 p-3">
			<div className="mb-2 flex items-center gap-4 text-2xs text-muted-foreground">
				<span>
					Start <span className="font-mono text-foreground">{formatOffset(range.lo)}</span>
				</span>
				<span>
					End <span className="font-mono text-foreground">{formatOffset(range.hi)}</span>
				</span>
				<span>
					Length <span className="font-mono text-foreground">{length} B</span>
				</span>
			</div>
			<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-2xs sm:grid-cols-3 xl:grid-cols-4">
				{rows.map((row) => (
					<div key={row.label} className="flex items-baseline gap-2">
						<span className="w-16 shrink-0 text-muted-foreground">{row.label}</span>
						<span className="min-w-0 flex-1 truncate font-mono">{row.value}</span>
					</div>
				))}
				{interpretation.ascii ? (
					<div className="col-span-full flex items-baseline gap-2">
						<span className="w-16 shrink-0 text-muted-foreground">ASCII</span>
						<span className="min-w-0 flex-1 truncate whitespace-pre font-mono">
							{interpretation.ascii}
						</span>
					</div>
				) : null}
				{interpretation.utf8 ? (
					<div className="col-span-full flex items-baseline gap-2">
						<span className="w-16 shrink-0 text-muted-foreground">UTF-8</span>
						<span className="min-w-0 flex-1 truncate font-mono">{interpretation.utf8}</span>
					</div>
				) : null}
				{interpretation.utf16le ? (
					<div className="col-span-full flex items-baseline gap-2">
						<span className="w-16 shrink-0 text-muted-foreground">UTF-16 LE</span>
						<span className="min-w-0 flex-1 truncate font-mono">{interpretation.utf16le}</span>
					</div>
				) : null}
			</div>
		</div>
	);
}
