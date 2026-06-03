import { createFileRoute } from '@tanstack/react-router';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
	ChevronDown,
	ChevronRight,
	File as FileIcon,
	FileCode,
	FileText,
	Folder,
	FolderOpen,
	FolderTree,
	Image as ImageIcon,
	Loader2,
	RefreshCw,
	Square,
	Trash2,
	TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormFolderPicker,
	FormGlobFilters,
	FormMode,
	FormSection,
	FormSlider,
} from '@/lib/components/form';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { useDocumentTitle } from '@/lib/hooks';
import {
	cancelFolderScan,
	countEntries,
	exportAsJson,
	exportAsText,
	findLargestFiles,
	flattenTree,
	formatTimestamp,
	humanSize,
	ratioToHeatClass,
	sortTree,
	walkFolder,
	type FlatRow,
	type LargestFile,
	type SortDir,
	type SortKey,
	type TreeNode,
} from '@/lib/services/folder-tree';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import { basename, cn } from '@/lib/utils';

const TOP_N = 20;

interface FolderTreeVisualizerPrefs {
	readonly includeGlobs: string;
	readonly excludeGlobs: string;
	readonly showHidden: boolean;
	readonly maxDepth: number;
	readonly sortKey: SortKey;
	readonly sortDir: SortDir;
}

const DEFAULT_PREFS: FolderTreeVisualizerPrefs = {
	includeGlobs: '',
	excludeGlobs: 'node_modules,.git,.DS_Store',
	showHidden: false,
	maxDepth: 3,
	sortKey: 'size',
	sortDir: 'desc',
};

const usePrefs = createToolOptionsStore<FolderTreeVisualizerPrefs>(
	'folder-tree-visualizer',
	DEFAULT_PREFS
);

const splitPatterns = (value: string): readonly string[] =>
	value
		.split(/[\s,]+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

export const Route = createFileRoute('/folder-tree-visualizer')({
	component: FolderTreeVisualizerPage,
});

function FolderTreeVisualizerPage() {
	useDocumentTitle('Folder Tree');

	const { value: prefs, patch } = usePrefs();

	const [root, setRoot] = useState<TreeNode | null>(null);
	const [largest, setLargest] = useState<readonly LargestFile[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showRail, setShowRail] = usePersistedRail('folder-tree-visualizer');
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
	const [scanTimeMs, setScanTimeMs] = useState<number | null>(null);
	const [rootPath, setRootPath] = useState<string | null>(null);
	const [cancelling, setCancelling] = useState(false);

	// The folder walk and the largest-files ranking run concurrently, so each
	// registers under its own op id. Cancelling must signal both.
	const scanOpIdsRef = useRef<{ readonly walk: string; readonly largest: string } | null>(null);

	const includes = useMemo(() => splitPatterns(prefs.includeGlobs), [prefs.includeGlobs]);
	const excludes = useMemo(() => splitPatterns(prefs.excludeGlobs), [prefs.excludeGlobs]);

	const sortedRoot = useMemo<TreeNode | null>(() => {
		if (!root) return null;
		return sortTree(root, prefs.sortKey, prefs.sortDir);
	}, [root, prefs.sortKey, prefs.sortDir]);

	const rows = useMemo<readonly FlatRow[]>(
		() => (sortedRoot ? flattenTree(sortedRoot, expanded) : []),
		[sortedRoot, expanded]
	);

	// Memoize the export strings so the CopyButton text props do not rebuild a
	// multi-MB string on every render (scroll, hover, expand) — only when the
	// sorted tree itself changes.
	const exportText = useMemo(() => (sortedRoot ? exportAsText(sortedRoot) : ''), [sortedRoot]);
	const exportJson = useMemo(() => (sortedRoot ? exportAsJson(sortedRoot) : ''), [sortedRoot]);

	const totals = useMemo(
		() => (sortedRoot ? countEntries(sortedRoot) : { files: 0, dirs: 0 }),
		[sortedRoot]
	);

	const runScan = useCallback(
		async (path: string) => {
			const walkOpId = crypto.randomUUID();
			const largestOpId = crypto.randomUUID();
			scanOpIdsRef.current = { walk: walkOpId, largest: largestOpId };
			setLoading(true);
			setCancelling(false);
			setError(null);
			const startedAt = performance.now();
			try {
				const [walked, top] = await Promise.all([
					walkFolder(walkOpId, {
						root: path,
						includeGlobs: includes,
						excludeGlobs: excludes,
						maxDepth: prefs.maxDepth,
						showHidden: prefs.showHidden,
					}),
					findLargestFiles(largestOpId, path, TOP_N, includes, excludes),
				]);
				setRoot(walked);
				setLargest(top);
				setRootPath(path);
				// Auto-expand the root so users see something immediately.
				setExpanded(new Set([walked.path]));
				setScanTimeMs(performance.now() - startedAt);
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				// Cancellation is a user action, not a failure: keep the panel clean.
				if (message.includes('cancelled')) {
					toast.info('Scan cancelled');
				} else {
					setError(message);
					toast.error('Failed to scan folder', { description: message });
				}
			} finally {
				scanOpIdsRef.current = null;
				setLoading(false);
				setCancelling(false);
			}
		},
		[includes, excludes, prefs.maxDepth, prefs.showHidden]
	);

	const handleCancel = useCallback(() => {
		const ids = scanOpIdsRef.current;
		if (!ids) return;
		setCancelling(true);
		// Signal both concurrent operations so the Rust backend stops walking
		// the tree and ranking the largest files at their next check point.
		cancelFolderScan(ids.walk).catch(() => undefined);
		cancelFolderScan(ids.largest).catch(() => undefined);
	}, []);

	const handlePickFolder = useCallback(async () => {
		try {
			const selected = await openDialog({ multiple: false, directory: true });
			if (typeof selected === 'string' && selected.length > 0) {
				await runScan(selected);
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to open folder dialog', { description: message });
		}
	}, [runScan]);

	const handleRefresh = useCallback(() => {
		if (rootPath) {
			runScan(rootPath).catch(() => undefined);
		}
	}, [rootPath, runScan]);

	const handleClear = useCallback(() => {
		setRoot(null);
		setLargest([]);
		setRootPath(null);
		setExpanded(new Set());
		setScanTimeMs(null);
		setError(null);
	}, []);

	// Re-scan automatically when filters / depth / hidden flag change after
	// the initial scan. Without this the rail looks unresponsive: filters
	// would only apply after the user manually hits Refresh.
	useEffect(() => {
		if (!rootPath) return;
		// Avoid scanning during the initial mount before the user has
		// picked a folder; only re-scan once we already have a root.
		runScan(rootPath).catch(() => undefined);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [prefs.includeGlobs, prefs.excludeGlobs, prefs.maxDepth, prefs.showHidden]);

	const toggleExpanded = useCallback((path: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	}, []);

	const handleExpandAll = useCallback(() => {
		if (!sortedRoot) return;
		const all = new Set<string>();
		const visit = (node: TreeNode) => {
			if (node.isDir) {
				all.add(node.path);
				node.children.forEach(visit);
			}
		};
		visit(sortedRoot);
		setExpanded(all);
	}, [sortedRoot]);

	const handleCollapseAll = useCallback(() => {
		if (!sortedRoot) {
			setExpanded(new Set());
			return;
		}
		// Keep the root open so the user can still see the tree exists.
		setExpanded(new Set([sortedRoot.path]));
	}, [sortedRoot]);

	const handleRevealNode = useCallback(async (path: string) => {
		try {
			const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
			await revealItemInDir(path);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to reveal in Finder', { description: message });
		}
	}, []);

	const hasRoot = sortedRoot !== null;

	const sortOptions = useMemo(
		() => [
			{ value: 'name' as const, label: 'Name', description: 'Alphabetical, directories first' },
			{ value: 'size' as const, label: 'Size', description: 'Cumulative bytes per node' },
			{
				value: 'modified' as const,
				label: 'Modified',
				description: 'Most recent change time',
			},
		],
		[]
	);

	const dirOptions = useMemo(
		() => [
			{ value: 'desc' as const, label: 'Descending' },
			{ value: 'asc' as const, label: 'Ascending' },
		],
		[]
	);

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			valid={hasRoot ? true : null}
			error={error ?? undefined}
			statusContent={
				hasRoot && sortedRoot ? (
					<>
						<StatItem label="Files" value={totals.files.toLocaleString()} />
						<StatItem label="Dirs" value={totals.dirs.toLocaleString()} />
						<StatItem label="Total" value={humanSize(sortedRoot.sizeBytes)} />
						{scanTimeMs !== null ? (
							<StatItem label="Scan" value={`${Math.round(scanTimeMs)} ms`} />
						) : null}
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Folder">
						<div className="flex flex-col gap-2">
							<FormFolderPicker
								picked={hasRoot}
								path={rootPath}
								onPick={handlePickFolder}
								disabled={loading}
							/>
							{loading ? (
								<Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
									<Square className="h-3.5 w-3.5" />
									{cancelling ? 'Cancelling…' : 'Cancel'}
								</Button>
							) : null}
							{hasRoot ? (
								<>
									<Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
										<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
										Refresh
									</Button>
									<Button variant="outline" size="sm" onClick={handleClear}>
										<Trash2 className="h-3.5 w-3.5" />
										Clear
									</Button>
								</>
							) : null}
						</div>
					</FormSection>

					<FormSection title="Filters">
						<FormGlobFilters
							include={prefs.includeGlobs}
							exclude={prefs.excludeGlobs}
							onIncludeChange={(v) => patch({ includeGlobs: v })}
							onExcludeChange={(v) => patch({ excludeGlobs: v })}
							includePlaceholder="e.g. *.png, *.jpg"
							excludePlaceholder="e.g. node_modules, .git"
							includeHint="Comma or space separated. Leave empty for all files."
							excludeHint="Pruned directories never enter the walk."
						/>
						<FormCheckbox
							size="compact"
							label="Show hidden entries (dotfiles)"
							checked={prefs.showHidden}
							onCheckedChange={(checked) => patch({ showHidden: checked })}
						/>
					</FormSection>

					<FormSection title="Depth">
						<FormSlider
							label="Maximum depth"
							value={prefs.maxDepth}
							min={1}
							max={10}
							step={1}
							valueLabel={`${prefs.maxDepth} level${prefs.maxDepth === 1 ? '' : 's'}`}
							onValueChange={(v) => patch({ maxDepth: v })}
							hint="Deeper levels collapse with an ellipsis."
						/>
					</FormSection>

					<FormSection title="Sort">
						<FormMode
							label="Sort key"
							layout="stacked"
							value={prefs.sortKey}
							options={sortOptions}
							onValueChange={(v) => patch({ sortKey: v })}
						/>
						<FormMode
							label="Direction"
							value={prefs.sortDir}
							options={dirOptions}
							onValueChange={(v) => patch({ sortDir: v })}
						/>
					</FormSection>

					<FormSection title="Export">
						<div className="flex flex-col gap-2">
							<CopyButton
								text={exportText}
								label="Copy as text"
								toastLabel="tree as text"
								className="w-full justify-center"
								disabled={!hasRoot}
							/>
							<CopyButton
								text={exportJson}
								label="Copy as JSON"
								toastLabel="tree as JSON"
								className="w-full justify-center"
								disabled={!hasRoot}
							/>
						</div>
					</FormSection>

					<ToolFooter
						relatedItems={[
							{ id: 'duplicate-finder', reason: 'Eliminate duplicates inside the tree' },
							{ id: 'drive-info', reason: 'See total drive capacity and usage' },
							{ id: 'file-inspector', reason: 'Drill into a single file' },
						]}
						aboutText={
							<>
								All scanning happens locally. Symlinks are never followed. Filters apply to
								filenames; excluded directories are pruned before descent so deep `node_modules`
								trees never enter the walk. Files outside the active filter are also excluded from
								cumulative sizes, so totals reflect the visible tree.
							</>
						}
					/>
				</>
			}
		>
			{hasRoot && sortedRoot ? (
				<ResultView
					root={sortedRoot}
					rows={rows}
					largest={largest}
					expanded={expanded}
					onToggleExpand={toggleExpanded}
					onReveal={handleRevealNode}
					onExpandAll={handleExpandAll}
					onCollapseAll={handleCollapseAll}
				/>
			) : (
				<EmptyView loading={loading} onPick={handlePickFolder} />
			)}
		</ToolShell>
	);
}

interface EmptyViewProps {
	readonly loading: boolean;
	readonly onPick: () => void;
}

function EmptyView({ loading, onPick }: EmptyViewProps) {
	return (
		<section aria-label="Folder picker" className="flex h-full items-center justify-center p-6">
			<div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border p-10 text-center">
				<EmbeddedEmptyState
					icon={FolderTree}
					title="Pick a folder to visualize"
					description="Cumulative sizes, glob filters, and the 20 largest files all render locally."
				/>
				<Button variant="default" size="sm" onClick={onPick} disabled={loading}>
					{loading ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<FolderOpen className="h-3.5 w-3.5" />
					)}
					{loading ? 'Scanning…' : 'Pick folder…'}
				</Button>
			</div>
		</section>
	);
}

interface ResultViewProps {
	readonly root: TreeNode;
	readonly rows: readonly FlatRow[];
	readonly largest: readonly LargestFile[];
	readonly expanded: ReadonlySet<string>;
	readonly onToggleExpand: (path: string) => void;
	readonly onReveal: (path: string) => void;
	readonly onExpandAll: () => void;
	readonly onCollapseAll: () => void;
}

function ResultView({
	root,
	rows,
	largest,
	expanded,
	onToggleExpand,
	onReveal,
	onExpandAll,
	onCollapseAll,
}: ResultViewProps) {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<header className="flex shrink-0 items-center justify-between gap-3 border-b bg-surface-2 px-4 py-2">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<FolderTree className="h-4 w-4 shrink-0 text-amber-600" />
					<span className="truncate font-mono text-xs" title={root.path}>
						{root.path}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Badge variant="outline" className="font-mono text-2xs">
						{humanSize(root.sizeBytes)}
					</Badge>
					<Button variant="outline" size="sm" onClick={onExpandAll}>
						<ChevronDown className="h-3.5 w-3.5" />
						Expand all
					</Button>
					<Button variant="outline" size="sm" onClick={onCollapseAll}>
						<ChevronRight className="h-3.5 w-3.5" />
						Collapse all
					</Button>
				</div>
			</header>

			<div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[1fr_320px]">
				<div className="flex min-h-0 flex-col overflow-hidden border-r">
					<TreeView rows={rows} expanded={expanded} onToggle={onToggleExpand} onReveal={onReveal} />
				</div>
				<div className="flex min-h-0 flex-col overflow-hidden">
					<LargestFilesPanel files={largest} onReveal={onReveal} />
				</div>
			</div>
		</div>
	);
}

interface TreeViewProps {
	readonly rows: readonly FlatRow[];
	readonly expanded: ReadonlySet<string>;
	readonly onToggle: (path: string) => void;
	readonly onReveal: (path: string) => void;
}

function TreeView({ rows, expanded, onToggle, onReveal }: TreeViewProps) {
	if (rows.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center p-6">
				<EmbeddedEmptyState
					icon={FolderTree}
					title="Nothing to show"
					description="The selected filters produced an empty tree. Adjust the rail and try again."
				/>
			</div>
		);
	}
	return (
		<div className="flex-1 overflow-auto" role="tree" aria-label="Folder contents">
			<ul className="flex flex-col py-2">
				{rows.map((row) => (
					<TreeRow
						key={row.node.path}
						row={row}
						isExpanded={expanded.has(row.node.path)}
						onToggle={onToggle}
						onReveal={onReveal}
					/>
				))}
			</ul>
		</div>
	);
}

interface TreeRowProps {
	readonly row: FlatRow;
	readonly isExpanded: boolean;
	readonly onToggle: (path: string) => void;
	readonly onReveal: (path: string) => void;
}

function TreeRow({ row, isExpanded, onToggle, onReveal }: TreeRowProps) {
	const { node, depth, siblingRatio } = row;
	const heatClass = node.isDir ? '' : ratioToHeatClass(siblingRatio);
	const FileTypeIcon = pickFileIcon(node);
	const handleClick = () => {
		if (node.isDir) onToggle(node.path);
	};
	const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		if (!node.isDir) return;
		if (e.key === 'ArrowRight' && !isExpanded) {
			e.preventDefault();
			onToggle(node.path);
			return;
		}
		if (e.key === 'ArrowLeft' && isExpanded) {
			e.preventDefault();
			onToggle(node.path);
		}
	};
	return (
		<li role="none">
			<div
				className={cn(
					'group flex items-center gap-2 px-3 py-1 text-xs transition-colors',
					heatClass,
					'hover:bg-muted/40'
				)}
				style={{ '--depth': depth } as CSSProperties}
			>
				<button
					type="button"
					role="treeitem"
					aria-expanded={node.isDir ? isExpanded : undefined}
					aria-selected={false}
					onClick={handleClick}
					onKeyDown={handleKeyDown}
					tabIndex={depth === 0 ? 0 : -1}
					className={cn(
						'flex min-w-0 flex-1 items-center gap-1.5 rounded-sm py-0.5 pl-[calc(var(--depth)*14px)] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
						node.isDir ? 'cursor-pointer' : 'cursor-default'
					)}
				>
					{node.isDir ? (
						isExpanded ? (
							<ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						) : (
							<ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						)
					) : (
						<span aria-hidden className="inline-block h-3.5 w-3.5 shrink-0" />
					)}
					{node.isDir ? (
						isExpanded ? (
							<FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-600" />
						) : (
							<Folder className="h-3.5 w-3.5 shrink-0 text-amber-600" />
						)
					) : (
						<FileTypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					)}
					<span className="min-w-0 flex-1 truncate font-mono">
						{node.name || '/'}
						{node.isDir ? '/' : ''}
					</span>
					{node.truncated ? (
						<Badge variant="outline" className="font-mono text-2xs">
							…
						</Badge>
					) : null}
				</button>
				<span
					className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground"
					title={`${node.sizeBytes.toLocaleString()} B`}
				>
					{humanSize(node.sizeBytes)}
				</span>
				<span
					className="hidden shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/70 lg:inline"
					title={formatTimestamp(node.modifiedMs)}
				>
					{shortDate(node.modifiedMs)}
				</span>
				<RowSizeBar ratio={siblingRatio} />
				<Button
					variant="ghost"
					size="icon-sm"
					className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
					onClick={(e) => {
						e.stopPropagation();
						onReveal(node.path);
					}}
				>
					<FolderOpen className="h-3 w-3" />
					<span className="sr-only">Reveal in Finder</span>
				</Button>
			</div>
		</li>
	);
}

function RowSizeBar({ ratio }: { readonly ratio: number }) {
	const pct = Math.min(100, Math.max(0, Math.round(ratio * 100)));
	return (
		<span
			aria-hidden
			className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted xl:inline-block"
		>
			<span className="block h-full rounded-full bg-info/60" style={{ width: `${pct}%` }} />
		</span>
	);
}

function shortDate(ms: number | null): string {
	if (ms == null || !Number.isFinite(ms)) return '—';
	const d = new Date(ms);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

const IMAGE_EXTS = new Set([
	'png',
	'jpg',
	'jpeg',
	'gif',
	'webp',
	'svg',
	'bmp',
	'ico',
	'heic',
	'avif',
]);
const TEXT_EXTS = new Set([
	'txt',
	'md',
	'markdown',
	'log',
	'rst',
	'csv',
	'tsv',
	'yaml',
	'yml',
	'toml',
	'json',
	'xml',
	'html',
	'htm',
	'css',
	'env',
	'lock',
	'ini',
	'conf',
]);
const CODE_EXTS = new Set([
	'ts',
	'tsx',
	'js',
	'jsx',
	'mjs',
	'cjs',
	'rs',
	'go',
	'py',
	'rb',
	'java',
	'kt',
	'swift',
	'c',
	'cc',
	'cpp',
	'h',
	'hpp',
	'sh',
	'bash',
	'zsh',
	'fish',
	'sql',
	'php',
	'cs',
	'fs',
	'vue',
	'svelte',
]);

function pickFileIcon(node: TreeNode): typeof FileIcon {
	if (node.isDir) return Folder;
	const lastDot = node.name.lastIndexOf('.');
	if (lastDot < 0) return FileIcon;
	const ext = node.name.slice(lastDot + 1).toLowerCase();
	if (IMAGE_EXTS.has(ext)) return ImageIcon;
	if (CODE_EXTS.has(ext)) return FileCode;
	if (TEXT_EXTS.has(ext)) return FileText;
	return FileIcon;
}

interface LargestFilesPanelProps {
	readonly files: readonly LargestFile[];
	readonly onReveal: (path: string) => void;
}

function LargestFilesPanel({ files, onReveal }: LargestFilesPanelProps) {
	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden">
			<Card density="compact" className="m-3 flex min-h-0 flex-1 flex-col">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-sm">
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
						Largest files
						<Badge variant="outline" className="font-mono text-2xs">
							Top {files.length}
						</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent className="min-h-0 flex-1 overflow-auto">
					{files.length === 0 ? (
						<p className="text-2xs text-muted-foreground">No files matched the active filter.</p>
					) : (
						<ul className="flex flex-col gap-1.5">
							{files.map((file, idx) => (
								<LargestFileRow
									key={file.path}
									file={file}
									rank={idx + 1}
									biggest={files[0]?.sizeBytes ?? 0}
									onReveal={onReveal}
								/>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

interface LargestFileRowProps {
	readonly file: LargestFile;
	readonly rank: number;
	readonly biggest: number;
	readonly onReveal: (path: string) => void;
}

function LargestFileRow({ file, rank, biggest, onReveal }: LargestFileRowProps) {
	const ratio = biggest > 0 ? file.sizeBytes / biggest : 0;
	const pct = Math.max(2, Math.round(ratio * 100));
	const name = basename(file.path);
	return (
		<li className="group flex flex-col gap-1 rounded-md border border-border bg-background p-2 text-xs transition-colors hover:bg-muted/40">
			<div className="flex items-center gap-2">
				<span className="w-5 shrink-0 text-2xs tabular-nums text-muted-foreground">#{rank}</span>
				<span className="min-w-0 flex-1 truncate font-mono" title={file.path}>
					{name}
				</span>
				<span className="shrink-0 font-mono text-2xs tabular-nums">
					{humanSize(file.sizeBytes)}
				</span>
				<Button
					variant="ghost"
					size="icon-sm"
					className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
					onClick={() => onReveal(file.path)}
				>
					<FolderOpen className="h-3 w-3" />
					<span className="sr-only">Reveal in Finder</span>
				</Button>
			</div>
			<div className="truncate font-mono text-2xs text-muted-foreground/70" title={file.path}>
				{file.path}
			</div>
			<span aria-hidden className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
				<span className="block h-full rounded-full bg-info/60" style={{ width: `${pct}%` }} />
			</span>
		</li>
	);
}
