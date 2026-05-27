import { createFileRoute } from '@tanstack/react-router';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
	ArrowDownNarrowWide,
	ArrowUpNarrowWide,
	ChevronDown,
	ChevronRight,
	FileSearch,
	FolderOpen,
	Loader2,
	Package,
	PackageOpen,
	Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { toast } from 'sonner';

import {
	FormFolderPicker,
	FormInfo,
	FormInput,
	FormMode,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { RelatedTools, SectionLabel } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Checkbox } from '@/lib/components/ui/checkbox';
import { useDocumentTitle } from '@/lib/hooks';
import {
	ancestorPaths,
	archiveExtract,
	archiveOpen,
	archiveReadEntry,
	type ArchiveEntry,
	type ArchiveInfo,
	type ConflictPolicy,
	decodeTextPreview,
	entryDepth,
	entryDisplayName,
	formatHexPreview,
	formatRatio,
	formatTimestamp,
	humanSize,
	matchGlob,
	type PreviewKind,
	previewKindFor,
} from '@/lib/services/archive';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import { cn } from '@/lib/utils';

type SortColumn = 'path' | 'size' | 'compressed' | 'modified';
type SortDirection = 'asc' | 'desc';

interface ArchiveInspectorPrefs {
	readonly globFilter: string;
	readonly sortColumn: SortColumn;
	readonly sortDir: SortDirection;
	readonly conflictPolicy: ConflictPolicy;
}

const DEFAULT_PREFS: ArchiveInspectorPrefs = {
	globFilter: '',
	sortColumn: 'path',
	sortDir: 'asc',
	conflictPolicy: 'rename',
};

const useArchiveInspectorPrefs = createToolOptionsStore<ArchiveInspectorPrefs>(
	'archive-inspector',
	DEFAULT_PREFS
);

const PREVIEW_CAP_BYTES = 256 * 1024;

const SORT_OPTIONS: readonly { readonly value: SortColumn; readonly label: string }[] = [
	{ value: 'path', label: 'Path' },
	{ value: 'size', label: 'Size' },
	{ value: 'compressed', label: 'Compressed' },
	{ value: 'modified', label: 'Modified' },
];

const CONFLICT_OPTIONS: readonly { readonly value: ConflictPolicy; readonly label: string }[] = [
	{ value: 'skip', label: 'Skip if exists' },
	{ value: 'overwrite', label: 'Overwrite' },
	{ value: 'rename', label: 'Rename' },
];

export const Route = createFileRoute('/archive-inspector')({
	component: ArchiveInspectorPage,
});

function ArchiveInspectorPage() {
	useDocumentTitle('Archive Inspector');

	const { value: prefs, patch } = useArchiveInspectorPrefs();

	const [archive, setArchive] = useState<ArchiveInfo | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [showRail, setShowRail] = usePersistedRail('archive-inspector');
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
	const [previewEntry, setPreviewEntry] = useState<ArchiveEntry | null>(null);
	const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [extracting, setExtracting] = useState(false);

	const handleClear = useCallback(() => {
		setArchive(null);
		setError(null);
		setSelected(new Set());
		setExpanded(new Set());
		setPreviewEntry(null);
		setPreviewBytes(null);
	}, []);

	const loadFromPath = useCallback(async (path: string) => {
		setLoading(true);
		setError(null);
		try {
			const info = await archiveOpen(path);
			setArchive(info);
			setSelected(new Set());
			setExpanded(new Set());
			setPreviewEntry(null);
			setPreviewBytes(null);
			if (info.format === '7z' && info.entries.length === 0) {
				toast.info('7z format detected', {
					description: 'Listing and extraction are deferred to a follow-up.',
				});
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message);
			toast.error('Failed to open archive', { description: message });
		} finally {
			setLoading(false);
		}
	}, []);

	const handlePickFile = async () => {
		try {
			const picked = await openDialog({ multiple: false, directory: false });
			if (typeof picked === 'string' && picked.length > 0) {
				await loadFromPath(picked);
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
			description: 'Use the Open archive button to pick the file.',
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

	const filteredEntries = useMemo(() => {
		if (!archive) return [];
		const pattern = prefs.globFilter.trim();
		if (pattern.length === 0) return archive.entries;
		return archive.entries.filter((entry) => matchGlob(entry.path, pattern));
	}, [archive, prefs.globFilter]);

	const sortedEntries = useMemo(() => {
		const compareBy = (a: ArchiveEntry, b: ArchiveEntry): number => {
			switch (prefs.sortColumn) {
				case 'size':
					return a.sizeBytes - b.sizeBytes;
				case 'compressed':
					return a.compressedSize - b.compressedSize;
				case 'modified':
					return (a.modifiedMs ?? 0) - (b.modifiedMs ?? 0);
				default:
					return a.path.localeCompare(b.path);
			}
		};
		const dir = prefs.sortDir === 'asc' ? 1 : -1;
		return [...filteredEntries].sort((a, b) => dir * compareBy(a, b));
	}, [filteredEntries, prefs.sortColumn, prefs.sortDir]);

	// Build the visible row list: hide entries inside collapsed folders.
	const visibleEntries = useMemo(() => {
		if (expanded.size === 0 && prefs.globFilter.trim().length === 0) {
			// Default view: show only depth-0 entries until folders are expanded.
			return sortedEntries.filter((entry) => entryDepth(entry.path) === 0);
		}
		return sortedEntries.filter((entry) => {
			const ancestors = ancestorPaths(entry.path);
			if (ancestors.length === 0) return true;
			return ancestors.every((p) => expanded.has(p));
		});
	}, [sortedEntries, expanded, prefs.globFilter]);

	const folderSet = useMemo(() => {
		const folders = new Set<string>();
		for (const entry of sortedEntries) {
			if (entry.isDir) folders.add(entry.path.replace(/\/$/, ''));
			for (const ancestor of ancestorPaths(entry.path)) folders.add(ancestor);
		}
		return folders;
	}, [sortedEntries]);

	const toggleExpanded = (path: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	};

	const expandAll = () => {
		setExpanded(new Set(folderSet));
	};
	const collapseAll = () => {
		setExpanded(new Set());
	};

	const toggleSelected = (path: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	};

	const selectAll = () => {
		setSelected(new Set(sortedEntries.filter((e) => !e.isDir).map((e) => e.path)));
	};
	const selectNone = () => {
		setSelected(new Set());
	};
	const invertSelection = () => {
		setSelected((prev) => {
			const next = new Set<string>();
			for (const entry of sortedEntries) {
				if (entry.isDir) continue;
				if (!prev.has(entry.path)) next.add(entry.path);
			}
			return next;
		});
	};

	const handlePreview = useCallback(
		async (entry: ArchiveEntry) => {
			if (!archive) return;
			if (entry.isDir) return;
			setPreviewEntry(entry);
			setPreviewBytes(null);
			const kind = previewKindFor(entry);
			if (kind === 'too-large' || kind === 'unsupported') return;
			setPreviewLoading(true);
			try {
				const bytes = await archiveReadEntry(archive.path, entry.path, PREVIEW_CAP_BYTES);
				setPreviewBytes(bytes);
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				toast.error('Failed to read entry', { description: message });
			} finally {
				setPreviewLoading(false);
			}
		},
		[archive]
	);

	const pickDestination = async (): Promise<string | null> => {
		try {
			const picked = await openDialog({ multiple: false, directory: true });
			return typeof picked === 'string' && picked.length > 0 ? picked : null;
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to open folder dialog', { description: message });
			return null;
		}
	};

	const runExtract = useCallback(
		async (entries: readonly string[]) => {
			if (!archive) return;
			const destination = await pickDestination();
			if (!destination) return;
			setExtracting(true);
			try {
				const count = await archiveExtract({
					archivePath: archive.path,
					entries,
					destinationDir: destination,
					conflict: prefs.conflictPolicy,
				});
				toast.success('Extraction complete', {
					description: `${count} file${count === 1 ? '' : 's'} written to ${destination}`,
				});
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				toast.error('Extraction failed', { description: message });
			} finally {
				setExtracting(false);
			}
		},
		[archive, prefs.conflictPolicy]
	);

	const handleExtractSelected = () => {
		if (selected.size === 0) {
			toast.error('Select at least one entry to extract.');
			return;
		}
		runExtract(Array.from(selected)).catch(() => undefined);
	};

	const handleExtractAll = () => {
		runExtract([]).catch(() => undefined);
	};

	const hasArchive = archive !== null;
	const filename = archive?.path.split('/').pop() ?? '';
	const selectedCount = selected.size;
	const totalEntries = archive?.entries.length ?? 0;
	const filteredCount = filteredEntries.length;

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			valid={hasArchive ? true : null}
			error={error ?? undefined}
			statusContent={
				hasArchive && archive ? (
					<>
						<StatItem
							label="Entries"
							value={
								filteredCount === totalEntries
									? totalEntries.toLocaleString()
									: `${filteredCount.toLocaleString()} / ${totalEntries.toLocaleString()}`
							}
						/>
						<StatItem label="Selected" value={selectedCount.toLocaleString()} />
						<StatItem label="Total size" value={humanSize(archive.totalUncompressed)} />
						<StatItem
							label="Ratio"
							value={formatRatio(archive.totalUncompressed, archive.totalCompressed)}
						/>
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Open">
						<div className="flex flex-col gap-2">
							<FormFolderPicker
								picked={hasArchive}
								onPick={handlePickFile}
								disabled={loading}
								emptyLabel="Open archive…"
							/>
							{hasArchive ? (
								<Button variant="outline" size="sm" onClick={handleClear}>
									<Trash2 className="h-3.5 w-3.5" />
									Clear
								</Button>
							) : null}
						</div>
					</FormSection>

					<FormSection title="Filter">
						<FormInput
							label="Glob pattern"
							value={prefs.globFilter}
							onValueChange={(v) => patch({ globFilter: v })}
							placeholder="*.png or src/**/*.ts"
							size="compact"
						/>
					</FormSection>

					<FormSection title="Sort">
						<FormSelect
							label="Column"
							value={prefs.sortColumn}
							options={SORT_OPTIONS}
							size="compact"
							onValueChange={(v) => patch({ sortColumn: v as SortColumn })}
						/>
						<FormMode<SortDirection>
							label="Direction"
							value={prefs.sortDir}
							options={[
								{ value: 'asc', label: 'Ascending' },
								{ value: 'desc', label: 'Descending' },
							]}
							onValueChange={(v) => patch({ sortDir: v })}
						/>
					</FormSection>

					<FormSection title="Selection">
						<div className="flex flex-wrap gap-1.5">
							<Button
								variant="outline"
								size="sm"
								onClick={selectAll}
								disabled={!hasArchive || totalEntries === 0}
							>
								All
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={selectNone}
								disabled={selectedCount === 0}
							>
								None
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={invertSelection}
								disabled={!hasArchive || totalEntries === 0}
							>
								Invert
							</Button>
						</div>
					</FormSection>

					<FormSection title="Extract">
						<FormSelect
							label="On conflict"
							value={prefs.conflictPolicy}
							options={CONFLICT_OPTIONS}
							size="compact"
							onValueChange={(v) => patch({ conflictPolicy: v as ConflictPolicy })}
						/>
						<div className="flex flex-col gap-2">
							<Button
								variant="default"
								size="sm"
								onClick={handleExtractSelected}
								disabled={!hasArchive || extracting || selectedCount === 0}
							>
								{extracting ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<PackageOpen className="h-3.5 w-3.5" />
								)}
								Extract selected…
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleExtractAll}
								disabled={!hasArchive || extracting || totalEntries === 0}
							>
								<PackageOpen className="h-3.5 w-3.5" />
								Extract all…
							</Button>
						</div>
					</FormSection>

					<FormSection title="Tree">
						<div className="flex flex-wrap gap-1.5">
							<Button
								variant="outline"
								size="sm"
								onClick={expandAll}
								disabled={folderSet.size === 0}
							>
								Expand all
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={collapseAll}
								disabled={expanded.size === 0}
							>
								Collapse all
							</Button>
						</div>
					</FormSection>

					<FormSection title="Related">
						<RelatedTools
							items={[
								{ id: 'file-inspector', reason: 'Inspect a single file' },
								{ id: 'hex-editor', reason: 'View binary content' },
							]}
						/>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							Read-only browsing plus selective extract. Supports .zip / .tar / .tar.gz / .tar.bz2 /
							.tar.xz, and identifies .7z (full 7z browsing is deferred).
						</FormInfo>
					</FormSection>
				</>
			}
		>
			{hasArchive && archive ? (
				<ArchiveView
					archive={archive}
					filename={filename}
					filteredCount={filteredCount}
					visibleEntries={visibleEntries}
					selected={selected}
					expanded={expanded}
					folderSet={folderSet}
					sortColumn={prefs.sortColumn}
					sortDir={prefs.sortDir}
					previewEntry={previewEntry}
					previewBytes={previewBytes}
					previewLoading={previewLoading}
					onToggleSelected={toggleSelected}
					onToggleExpanded={toggleExpanded}
					onSortChange={(column) => {
						if (column === prefs.sortColumn) {
							patch({ sortDir: prefs.sortDir === 'asc' ? 'desc' : 'asc' });
						} else {
							patch({ sortColumn: column, sortDir: 'asc' });
						}
					}}
					onPreview={handlePreview}
					onClosePreview={() => {
						setPreviewEntry(null);
						setPreviewBytes(null);
					}}
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
			aria-label="Archive drop zone"
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
					icon={Package}
					title="Open an archive"
					description="Drop a .zip / .tar / .gz / .bz2 / .xz / .7z file here or click to browse."
				/>
				<Button variant="default" size="sm" onClick={onPick} disabled={loading}>
					{loading ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<FolderOpen className="h-3.5 w-3.5" />
					)}
					{loading ? 'Loading…' : 'Open archive…'}
				</Button>
			</div>
		</section>
	);
}

interface ArchiveViewProps {
	readonly archive: ArchiveInfo;
	readonly filename: string;
	readonly filteredCount: number;
	readonly visibleEntries: readonly ArchiveEntry[];
	readonly selected: ReadonlySet<string>;
	readonly expanded: ReadonlySet<string>;
	readonly folderSet: ReadonlySet<string>;
	readonly sortColumn: SortColumn;
	readonly sortDir: SortDirection;
	readonly previewEntry: ArchiveEntry | null;
	readonly previewBytes: Uint8Array | null;
	readonly previewLoading: boolean;
	readonly onToggleSelected: (path: string) => void;
	readonly onToggleExpanded: (path: string) => void;
	readonly onSortChange: (column: SortColumn) => void;
	readonly onPreview: (entry: ArchiveEntry) => void;
	readonly onClosePreview: () => void;
}

function ArchiveView({
	archive,
	filename,
	filteredCount,
	visibleEntries,
	selected,
	expanded,
	folderSet,
	sortColumn,
	sortDir,
	previewEntry,
	previewBytes,
	previewLoading,
	onToggleSelected,
	onToggleExpanded,
	onSortChange,
	onPreview,
	onClosePreview,
}: ArchiveViewProps) {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="shrink-0 border-b p-3">
				<ArchiveBanner archive={archive} filename={filename} filteredCount={filteredCount} />
			</div>
			<div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden p-3">
				<EntryTable
					entries={visibleEntries}
					selected={selected}
					expanded={expanded}
					folderSet={folderSet}
					sortColumn={sortColumn}
					sortDir={sortDir}
					previewEntry={previewEntry}
					onToggleSelected={onToggleSelected}
					onToggleExpanded={onToggleExpanded}
					onSortChange={onSortChange}
					onPreview={onPreview}
				/>
				{previewEntry ? (
					<PreviewPane
						entry={previewEntry}
						bytes={previewBytes}
						loading={previewLoading}
						onClose={onClosePreview}
					/>
				) : null}
			</div>
		</div>
	);
}

interface ArchiveBannerProps {
	readonly archive: ArchiveInfo;
	readonly filename: string;
	readonly filteredCount: number;
}

function ArchiveBanner({ archive, filename, filteredCount }: ArchiveBannerProps) {
	const ratio = formatRatio(archive.totalUncompressed, archive.totalCompressed);
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm">
					<Package className="h-4 w-4 text-amber-700" />
					<span className="truncate font-mono">{filename}</span>
					<Badge variant="outline" className="text-2xs uppercase">
						{archive.format}
					</Badge>
					<Badge
						variant="outline"
						className="border-info/40 bg-info/10 text-info text-2xs"
						title="Overall compression ratio"
					>
						{ratio} saved
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-xs">
					<dt className="text-muted-foreground">Entries</dt>
					<dd className="font-mono">
						{archive.entries.length.toLocaleString()}
						{filteredCount !== archive.entries.length
							? ` (${filteredCount.toLocaleString()} shown)`
							: ''}
					</dd>
					<dt className="text-muted-foreground">Uncompressed</dt>
					<dd className="font-mono">
						{humanSize(archive.totalUncompressed)} ({archive.totalUncompressed.toLocaleString()} B)
					</dd>
					<dt className="text-muted-foreground">Compressed</dt>
					<dd className="font-mono">
						{humanSize(archive.totalCompressed)} ({archive.totalCompressed.toLocaleString()} B)
					</dd>
				</dl>
			</CardContent>
		</Card>
	);
}

interface EntryTableProps {
	readonly entries: readonly ArchiveEntry[];
	readonly selected: ReadonlySet<string>;
	readonly expanded: ReadonlySet<string>;
	readonly folderSet: ReadonlySet<string>;
	readonly sortColumn: SortColumn;
	readonly sortDir: SortDirection;
	readonly previewEntry: ArchiveEntry | null;
	readonly onToggleSelected: (path: string) => void;
	readonly onToggleExpanded: (path: string) => void;
	readonly onSortChange: (column: SortColumn) => void;
	readonly onPreview: (entry: ArchiveEntry) => void;
}

function EntryTable({
	entries,
	selected,
	expanded,
	folderSet,
	sortColumn,
	sortDir,
	previewEntry,
	onToggleSelected,
	onToggleExpanded,
	onSortChange,
	onPreview,
}: EntryTableProps) {
	if (entries.length === 0) {
		return (
			<div className="flex-1">
				<EmbeddedEmptyState
					icon={FileSearch}
					title="No entries to display"
					description="Adjust the glob filter or expand a folder to see contents."
					fillHeight
				/>
			</div>
		);
	}
	return (
		<div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-md border bg-card">
			<TableHeader sortColumn={sortColumn} sortDir={sortDir} onSortChange={onSortChange} />
			<div className="flex-1 overflow-auto font-mono text-xs">
				<ul className="divide-y divide-border">
					{entries.map((entry) => (
						<EntryRow
							key={entry.path}
							entry={entry}
							isSelected={selected.has(entry.path)}
							isExpanded={expanded.has(entry.path.replace(/\/$/, ''))}
							isFolder={entry.isDir || folderSet.has(entry.path.replace(/\/$/, ''))}
							isActive={previewEntry?.path === entry.path}
							onToggleSelected={onToggleSelected}
							onToggleExpanded={onToggleExpanded}
							onPreview={onPreview}
						/>
					))}
				</ul>
			</div>
		</div>
	);
}

interface TableHeaderProps {
	readonly sortColumn: SortColumn;
	readonly sortDir: SortDirection;
	readonly onSortChange: (column: SortColumn) => void;
}

function TableHeader({ sortColumn, sortDir, onSortChange }: TableHeaderProps) {
	return (
		<div className="sticky top-0 z-10 grid grid-cols-[24px_24px_1fr_90px_90px_60px_140px] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
			<span className="sr-only">Select</span>
			<span className="sr-only">Expand</span>
			<SortHeader
				column="path"
				label="Path"
				sortColumn={sortColumn}
				sortDir={sortDir}
				onSortChange={onSortChange}
				align="left"
			/>
			<SortHeader
				column="size"
				label="Size"
				sortColumn={sortColumn}
				sortDir={sortDir}
				onSortChange={onSortChange}
				align="right"
			/>
			<SortHeader
				column="compressed"
				label="Compressed"
				sortColumn={sortColumn}
				sortDir={sortDir}
				onSortChange={onSortChange}
				align="right"
			/>
			<span className="text-right">Ratio</span>
			<SortHeader
				column="modified"
				label="Modified"
				sortColumn={sortColumn}
				sortDir={sortDir}
				onSortChange={onSortChange}
				align="right"
			/>
		</div>
	);
}

interface SortHeaderProps {
	readonly column: SortColumn;
	readonly label: string;
	readonly sortColumn: SortColumn;
	readonly sortDir: SortDirection;
	readonly onSortChange: (column: SortColumn) => void;
	readonly align: 'left' | 'right';
}

function SortHeader({ column, label, sortColumn, sortDir, onSortChange, align }: SortHeaderProps) {
	const isActive = sortColumn === column;
	return (
		<button
			type="button"
			onClick={() => onSortChange(column)}
			className={cn(
				'flex items-center gap-1 truncate transition-colors hover:text-foreground',
				align === 'right' && 'justify-end',
				isActive && 'text-foreground'
			)}
		>
			<span className="truncate">{label}</span>
			{isActive ? (
				sortDir === 'asc' ? (
					<ArrowUpNarrowWide className="h-3 w-3 shrink-0" />
				) : (
					<ArrowDownNarrowWide className="h-3 w-3 shrink-0" />
				)
			) : null}
		</button>
	);
}

interface EntryRowProps {
	readonly entry: ArchiveEntry;
	readonly isSelected: boolean;
	readonly isExpanded: boolean;
	readonly isFolder: boolean;
	readonly isActive: boolean;
	readonly onToggleSelected: (path: string) => void;
	readonly onToggleExpanded: (path: string) => void;
	readonly onPreview: (entry: ArchiveEntry) => void;
}

function EntryRow({
	entry,
	isSelected,
	isExpanded,
	isFolder,
	isActive,
	onToggleSelected,
	onToggleExpanded,
	onPreview,
}: EntryRowProps) {
	const depth = entryDepth(entry.path);
	const display = entryDisplayName(entry.path);
	const ratio = entry.isDir ? '—' : formatRatio(entry.sizeBytes, entry.compressedSize);
	const folderKey = entry.path.replace(/\/$/, '');
	return (
		<li
			className={cn(
				'grid grid-cols-[24px_24px_1fr_90px_90px_60px_140px] items-center gap-2 px-3 py-1.5 transition-colors hover:bg-muted/40',
				isActive && 'bg-primary/10'
			)}
			// CSS variable lets the indent track tree depth without inline math.
			style={{ paddingLeft: `calc(0.75rem + ${depth * 14}px)` }}
		>
			<Checkbox
				checked={isSelected}
				disabled={entry.isDir}
				onCheckedChange={() => onToggleSelected(entry.path)}
				aria-label={`Select ${entry.path}`}
				className="h-3.5 w-3.5"
			/>
			{isFolder && !entry.isDir ? (
				<span aria-hidden className="h-3 w-3" />
			) : isFolder ? (
				<button
					type="button"
					onClick={() => onToggleExpanded(folderKey)}
					className="flex h-4 w-4 items-center justify-center rounded hover:bg-muted"
					aria-label={isExpanded ? `Collapse ${display}` : `Expand ${display}`}
				>
					{isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
				</button>
			) : (
				<span aria-hidden className="h-3 w-3" />
			)}
			<button
				type="button"
				onClick={() => (entry.isDir ? onToggleExpanded(folderKey) : onPreview(entry))}
				className="truncate text-left text-foreground hover:underline"
				title={entry.path}
			>
				{display}
				{entry.isDir ? '/' : ''}
			</button>
			<span className="truncate text-right text-muted-foreground">
				{entry.isDir ? '—' : humanSize(entry.sizeBytes)}
			</span>
			<span className="truncate text-right text-muted-foreground">
				{entry.isDir ? '—' : humanSize(entry.compressedSize)}
			</span>
			<span className="truncate text-right text-muted-foreground">{ratio}</span>
			<span className="truncate text-right text-muted-foreground">
				{formatTimestamp(entry.modifiedMs)}
			</span>
		</li>
	);
}

interface PreviewPaneProps {
	readonly entry: ArchiveEntry;
	readonly bytes: Uint8Array | null;
	readonly loading: boolean;
	readonly onClose: () => void;
}

function PreviewPane({ entry, bytes, loading, onClose }: PreviewPaneProps) {
	const kind: PreviewKind = previewKindFor(entry);
	return (
		<Card density="compact" className="shrink-0">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm">
					<SectionLabel icon={FileSearch}>Preview</SectionLabel>
					<span className="ml-1 truncate font-mono text-xs text-muted-foreground">
						{entry.path}
					</span>
					<Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
						Close
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{loading ? (
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						Loading preview…
					</div>
				) : (
					<PreviewBody entry={entry} kind={kind} bytes={bytes} />
				)}
			</CardContent>
		</Card>
	);
}

interface PreviewBodyProps {
	readonly entry: ArchiveEntry;
	readonly kind: PreviewKind;
	readonly bytes: Uint8Array | null;
}

function PreviewBody({ entry, kind, bytes }: PreviewBodyProps) {
	if (kind === 'too-large') {
		return (
			<p className="text-xs text-muted-foreground">
				Entry is {humanSize(entry.sizeBytes)} — too large for inline preview. Extract it to inspect
				the contents.
			</p>
		);
	}
	if (kind === 'unsupported') {
		return (
			<p className="text-xs text-muted-foreground">Preview is not available for this entry.</p>
		);
	}
	if (!bytes) {
		return <p className="text-xs text-muted-foreground">No preview data.</p>;
	}
	if (kind === 'image') {
		// Copy into a fresh ArrayBuffer so the Blob constructor accepts
		// the buffer-backed view without TS complaining about
		// SharedArrayBuffer being a possible underlying buffer type.
		const copy = new Uint8Array(bytes.byteLength);
		copy.set(bytes);
		const blob = new Blob([copy.buffer]);
		const url = URL.createObjectURL(blob);
		return (
			<div className="flex flex-col gap-2">
				<ImagePreview url={url} alt={entry.path} />
				<p className="text-2xs text-muted-foreground">
					First {humanSize(bytes.length)} of {humanSize(entry.sizeBytes)}.
				</p>
			</div>
		);
	}
	if (kind === 'text') {
		const text = decodeTextPreview(bytes, 8192);
		return (
			<pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-2xs leading-relaxed">
				{text}
			</pre>
		);
	}
	const rows = formatHexPreview(bytes, 64);
	return (
		<div className="max-h-72 overflow-auto rounded bg-muted/40 p-2 font-mono text-2xs leading-relaxed">
			{rows.map((row) => (
				<div key={row.offset} className="flex gap-3">
					<span className="text-muted-foreground">{row.offset}</span>
					<span className="flex-1 truncate">{row.hex}</span>
					<span className="text-muted-foreground/80">{row.ascii}</span>
				</div>
			))}
		</div>
	);
}

interface ImagePreviewProps {
	readonly url: string;
	readonly alt: string;
}

function ImagePreview({ url, alt }: ImagePreviewProps) {
	useEffect(() => () => URL.revokeObjectURL(url), [url]);
	return (
		<img
			src={url}
			alt={alt}
			className="max-h-72 max-w-full rounded border border-border object-contain"
		/>
	);
}
