import { createFileRoute } from '@tanstack/react-router';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Copy, FolderOpen, Link2, Loader2, Play, Square, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { FormInput, FormInfo, FormMode, FormSection, FormSlider } from '@/lib/components/form';
import { RelatedTools } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Checkbox } from '@/lib/components/ui/checkbox';
import { Progress } from '@/lib/components/ui/progress';
import { useDocumentTitle } from '@/lib/hooks';
import {
	deleteFiles,
	formatTimestamp,
	humanSize,
	onScanProgress,
	pickKeeper,
	replaceWithSymlink,
	scanForDuplicates,
	selectDeletablePaths,
	type DuplicateEntry,
	type DuplicateGroup,
	type HashAlgorithm,
	type KeepStrategy,
	type ScanProgress,
	type ScanResult,
} from '@/lib/services/duplicate-finder';
import { getPlatform } from '@/lib/services/platform';
import { createToolOptionsStore } from '@/lib/stores';

// Size threshold sliders use a log-style mapping so the user can pick a
// few bytes or a few gigabytes from the same control. We store the raw
// byte value and surface the readable label through `valueLabel`.
const MIN_SIZE_STEPS = [
	0,
	256,
	512,
	1024,
	4 * 1024,
	16 * 1024,
	64 * 1024,
	256 * 1024,
	1024 * 1024,
	4 * 1024 * 1024,
	16 * 1024 * 1024,
] as const;

const MAX_SIZE_STEPS = [
	1024 * 1024,
	16 * 1024 * 1024,
	64 * 1024 * 1024,
	256 * 1024 * 1024,
	1024 * 1024 * 1024,
	4 * 1024 * 1024 * 1024,
	16 * 1024 * 1024 * 1024,
] as const;

interface DuplicateFinderPrefs {
	readonly includeGlob: string;
	readonly excludeGlob: string;
	readonly minSizeIdx: number;
	readonly maxSizeIdx: number;
	readonly algorithm: HashAlgorithm;
}

const DEFAULT_PREFS: DuplicateFinderPrefs = {
	includeGlob: '',
	excludeGlob: 'node_modules,.git,.cache,.DS_Store',
	minSizeIdx: 3, // 1 KB
	maxSizeIdx: 4, // 1 GB
	algorithm: 'sha256',
};

const useDuplicateFinderPrefs = createToolOptionsStore<DuplicateFinderPrefs>(
	'duplicate-finder',
	DEFAULT_PREFS
);

export const Route = createFileRoute('/duplicate-finder')({
	component: DuplicateFinderPage,
});

const splitPatterns = (raw: string): readonly string[] =>
	raw
		.split(/[\s,]+/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);

const phaseLabel: Record<ScanProgress['phase'], string> = {
	scanning: 'Scanning files…',
	'hashing-partial': 'Hashing (partial)…',
	'hashing-full': 'Hashing (full)…',
	done: 'Done',
};

/**
 * Recompute `ScanResult` after a batch delete by removing the given
 * paths from each group, dropping groups that no longer have duplicates,
 * and refreshing `totalWastedBytes` accordingly. `totalFiles` and
 * `elapsedMs` reflect the original scan and are preserved.
 */
function dropDeletedFromResult(prev: ScanResult, deletedPaths: readonly string[]): ScanResult {
	const deletedSet = new Set(deletedPaths);
	const groups = prev.groups
		.map((g) => ({
			...g,
			paths: g.paths.filter((e) => !deletedSet.has(e.path)),
		}))
		.filter((g) => g.paths.length > 1);
	const totalWastedBytes = groups.reduce((sum, g) => sum + g.sizeBytes * (g.paths.length - 1), 0);
	return {
		groups,
		totalFiles: prev.totalFiles,
		totalWastedBytes,
		elapsedMs: prev.elapsedMs,
	};
}

/**
 * Replace every `selected` path with a symlink pointing at the keeper
 * for its duplicate group. The keeper is the first entry whose path is
 * not in `selected`, which mirrors the backend's shortest-path-first
 * ordering. Returns the number of successful replacements and a list of
 * per-path error messages so the caller can surface both.
 */
async function runSymlinkReplacement(
	groups: readonly DuplicateGroup[],
	selected: ReadonlySet<string>
): Promise<{ readonly replaced: number; readonly errors: readonly string[] }> {
	const groupByPath = new Map<string, DuplicateGroup>();
	for (const group of groups) {
		for (const entry of group.paths) {
			groupByPath.set(entry.path, group);
		}
	}

	let replaced = 0;
	const errors: string[] = [];
	for (const source of selected) {
		const group = groupByPath.get(source);
		if (!group) continue;
		const keeper = group.paths.find((e) => !selected.has(e.path));
		if (!keeper) {
			errors.push(`${source}: no keeper available in group`);
			continue;
		}
		try {
			await replaceWithSymlink(source, keeper.path);
			replaced += 1;
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			errors.push(`${source}: ${message}`);
		}
	}
	return { replaced, errors };
}

function DuplicateFinderPage() {
	useDocumentTitle('Duplicate Finder');

	const { value: prefs, patch } = useDuplicateFinderPrefs();

	const [root, setRoot] = useState<string | null>(null);
	const [result, setResult] = useState<ScanResult | null>(null);
	const [scanning, setScanning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState<ScanProgress | null>(null);
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const [showRail, setShowRail] = useState(true);
	const [supportsSymlink, setSupportsSymlink] = useState(true);

	const minSize = MIN_SIZE_STEPS[prefs.minSizeIdx] ?? MIN_SIZE_STEPS[3] ?? 1024;
	const maxSize = MAX_SIZE_STEPS[prefs.maxSizeIdx] ?? MAX_SIZE_STEPS[4] ?? 1024 * 1024 * 1024;

	// Decide symlink support once at mount; Windows shows the action as
	// disabled with a tooltip explaining why.
	useEffect(() => {
		getPlatform()
			.then((p) => setSupportsSymlink(p !== 'windows'))
			.catch(() => setSupportsSymlink(true));
	}, []);

	// Subscribe to progress events for the duration of the page. The
	// unlisten function is captured in a ref so it remains stable across
	// renders.
	const unlistenRef = useRef<(() => void) | null>(null);
	useEffect(() => {
		let cancelled = false;
		onScanProgress((p) => {
			if (!cancelled) setProgress(p);
		}).then((unlisten) => {
			if (cancelled) {
				unlisten();
				return;
			}
			unlistenRef.current = unlisten;
		});
		return () => {
			cancelled = true;
			unlistenRef.current?.();
			unlistenRef.current = null;
		};
	}, []);

	const handlePickFolder = useCallback(async () => {
		try {
			const picked = await openDialog({ directory: true, multiple: false });
			if (typeof picked === 'string' && picked.length > 0) {
				setRoot(picked);
				setResult(null);
				setSelected(new Set());
				setError(null);
				setProgress(null);
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to open folder dialog', { description: message });
		}
	}, []);

	const handleScan = useCallback(async () => {
		if (!root) {
			toast.error('Pick a folder first');
			return;
		}
		setScanning(true);
		setError(null);
		setResult(null);
		setSelected(new Set());
		setProgress({ phase: 'scanning', current: root, done: 0, total: 0 });
		try {
			const next = await scanForDuplicates({
				root,
				includeGlobs: splitPatterns(prefs.includeGlob),
				excludeGlobs: splitPatterns(prefs.excludeGlob),
				minSize,
				maxSize,
				algorithm: prefs.algorithm,
			});
			setResult(next);
			if (next.groups.length === 0) {
				toast.success('No duplicates found', {
					description: `Scanned ${next.totalFiles.toLocaleString()} files in ${next.elapsedMs} ms.`,
				});
			} else {
				toast.success(
					`Found ${next.groups.length} duplicate group${next.groups.length === 1 ? '' : 's'}`,
					{
						description: `Potential to reclaim ${humanSize(next.totalWastedBytes)}.`,
					}
				);
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message);
			toast.error('Scan failed', { description: message });
		} finally {
			setScanning(false);
			setProgress(null);
		}
	}, [root, prefs.includeGlob, prefs.excludeGlob, prefs.algorithm, minSize, maxSize]);

	const togglePath = useCallback((path: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	}, []);

	const applyKeepStrategy = useCallback(
		(strategy: KeepStrategy) => {
			if (!result) return;
			setSelected(selectDeletablePaths(result.groups, strategy));
		},
		[result]
	);

	const handleDelete = useCallback(async () => {
		if (selected.size === 0) {
			toast.error('No files selected');
			return;
		}
		const paths = Array.from(selected);
		try {
			const freed = await deleteFiles(paths);
			toast.success(`Deleted ${paths.length} file${paths.length === 1 ? '' : 's'}`, {
				description: `Freed ${humanSize(freed)}.`,
			});
			// Drop deleted entries from the in-memory result so the UI stays
			// in sync without re-running the scan.
			setResult((prev) => (prev ? dropDeletedFromResult(prev, paths) : prev));
			setSelected(new Set());
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Delete failed', { description: message });
		}
	}, [selected]);

	const handleReplaceWithSymlink = useCallback(async () => {
		if (!result || selected.size === 0) {
			toast.error('No files selected');
			return;
		}
		const { replaced, errors } = await runSymlinkReplacement(result.groups, selected);
		if (replaced > 0) {
			toast.success(`Replaced ${replaced} file${replaced === 1 ? '' : 's'} with symlinks`);
		}
		if (errors.length > 0) {
			toast.error(`${errors.length} failure${errors.length === 1 ? '' : 's'}`, {
				description: errors.slice(0, 3).join('\n'),
			});
		}
		setSelected(new Set());
	}, [result, selected]);

	const handleClear = useCallback(() => {
		setResult(null);
		setSelected(new Set());
		setError(null);
		setProgress(null);
	}, []);

	const totalGroups = result?.groups.length ?? 0;
	const totalWasted = result?.totalWastedBytes ?? 0;
	const totalFiles = result?.totalFiles ?? 0;
	const elapsedMs = result?.elapsedMs ?? 0;

	const progressPercent = useMemo(() => {
		if (!progress || progress.total === 0) return null;
		return Math.min(100, Math.round((progress.done / progress.total) * 100));
	}, [progress]);

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			valid={result ? totalGroups > 0 : null}
			error={error ?? undefined}
			statusContent={
				result ? (
					<>
						<StatItem label="Groups" value={totalGroups.toLocaleString()} />
						<StatItem label="Wasted" value={humanSize(totalWasted)} />
						<StatItem label="Files" value={totalFiles.toLocaleString()} />
						<StatItem label="Elapsed" value={`${elapsedMs} ms`} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Folder">
						<div className="flex flex-col gap-2">
							<Button variant="default" size="sm" onClick={handlePickFolder} disabled={scanning}>
								<FolderOpen className="h-3.5 w-3.5" />
								{root ? 'Choose another' : 'Pick folder…'}
							</Button>
							{root ? (
								<div className="rounded-md border bg-muted/30 p-2 font-mono text-2xs break-all">
									{root}
								</div>
							) : null}
						</div>
					</FormSection>

					<FormSection title="Filters">
						<FormInput
							label="Include globs"
							value={prefs.includeGlob}
							placeholder="*.jpg,*.png (empty = all)"
							size="compact"
							onValueChange={(v) => patch({ includeGlob: v })}
							hint="Comma- or whitespace-separated; matched against file name and path components."
						/>
						<FormInput
							label="Exclude globs"
							value={prefs.excludeGlob}
							placeholder="node_modules,.git"
							size="compact"
							onValueChange={(v) => patch({ excludeGlob: v })}
							hint="Skip files / directories matching any pattern."
						/>
						<FormSlider
							label="Min size"
							value={prefs.minSizeIdx}
							min={0}
							max={MIN_SIZE_STEPS.length - 1}
							step={1}
							valueLabel={humanSize(minSize)}
							onValueChange={(v) => patch({ minSizeIdx: v })}
						/>
						<FormSlider
							label="Max size"
							value={prefs.maxSizeIdx}
							min={0}
							max={MAX_SIZE_STEPS.length - 1}
							step={1}
							valueLabel={humanSize(maxSize)}
							onValueChange={(v) => patch({ maxSizeIdx: v })}
						/>
					</FormSection>

					<FormSection title="Algorithm">
						<FormMode
							layout="stacked"
							value={prefs.algorithm}
							onValueChange={(v: HashAlgorithm) => patch({ algorithm: v })}
							options={[
								{
									value: 'sha256',
									label: 'SHA-256',
									description: 'Standard, widely available.',
								},
								{
									value: 'blake3',
									label: 'BLAKE3',
									description: 'Significantly faster on large files.',
								},
							]}
						/>
					</FormSection>

					<FormSection title="Run">
						<div className="flex flex-col gap-2">
							<Button variant="default" size="sm" onClick={handleScan} disabled={scanning || !root}>
								{scanning ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<Play className="h-3.5 w-3.5" />
								)}
								{scanning ? 'Scanning…' : 'Scan'}
							</Button>
							{result ? (
								<Button variant="outline" size="sm" onClick={handleClear} disabled={scanning}>
									<Square className="h-3.5 w-3.5" />
									Clear results
								</Button>
							) : null}
						</div>
					</FormSection>

					<FormSection title="Actions">
						<div className="flex flex-col gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => applyKeepStrategy('oldest')}
								disabled={!result || totalGroups === 0}
							>
								Keep oldest
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => applyKeepStrategy('newest')}
								disabled={!result || totalGroups === 0}
							>
								Keep newest
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => applyKeepStrategy('shortest-path')}
								disabled={!result || totalGroups === 0}
							>
								Keep shortest path
							</Button>
							<Button
								variant="destructive"
								size="sm"
								onClick={handleDelete}
								disabled={selected.size === 0}
							>
								<Trash2 className="h-3.5 w-3.5" />
								Delete selected ({selected.size})
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleReplaceWithSymlink}
								disabled={!supportsSymlink || selected.size === 0}
								title={
									supportsSymlink
										? 'Replace selected duplicates with symlinks to the kept file'
										: 'Symlinks are not supported on Windows'
								}
							>
								<Link2 className="h-3.5 w-3.5" />
								Replace with symlink
							</Button>
						</div>
					</FormSection>

					<FormSection title="Related">
						<RelatedTools
							items={[
								{ id: 'file-inspector', reason: 'Inspect a single file in depth' },
								{ id: 'hash-generator', reason: 'Hash arbitrary text or bytes' },
								{ id: 'hex-editor', reason: 'View raw bytes of a file' },
							]}
						/>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							Files are bucketed by size, then by the SHA-256 / BLAKE3 hash of the first 8 KiB, then
							by their full-content hash. Scanning, partial hashing, and full hashing all run
							locally; nothing leaves your machine. Symlink replacement is Unix-only.
						</FormInfo>
					</FormSection>
				</>
			}
		>
			{scanning ? (
				<ScanningView progress={progress} percent={progressPercent} />
			) : result ? (
				result.groups.length === 0 ? (
					<EmbeddedEmptyState
						icon={Copy}
						title="No duplicates found"
						description={`Scanned ${totalFiles.toLocaleString()} files in ${elapsedMs} ms.`}
						fillHeight
					/>
				) : (
					<ResultsView result={result} selected={selected} onTogglePath={togglePath} />
				)
			) : root ? (
				<EmbeddedEmptyState
					icon={Play}
					title="Ready to scan"
					description={`Press Scan to look for duplicates inside ${root}.`}
					fillHeight
				/>
			) : (
				<EmbeddedEmptyState
					icon={FolderOpen}
					title="Pick a folder to scan"
					description="Use the Folder section in the side rail to choose a starting directory."
					fillHeight
				/>
			)}
		</ToolShell>
	);
}

interface ScanningViewProps {
	readonly progress: ScanProgress | null;
	readonly percent: number | null;
}

function ScanningView({ progress, percent }: ScanningViewProps) {
	const label = progress ? phaseLabel[progress.phase] : 'Scanning files…';
	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 p-6">
			<div className="flex w-full max-w-xl flex-col gap-3">
				<div className="flex items-center gap-2 text-sm font-medium">
					<Loader2 className="h-4 w-4 animate-spin text-primary" />
					{label}
				</div>
				<Progress value={percent ?? undefined} className="h-2" />
				{progress ? (
					<div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
						<span className="min-w-0 flex-1 truncate font-mono">{progress.current || '…'}</span>
						<span className="shrink-0 tabular-nums">
							{progress.done.toLocaleString()}
							{progress.total > 0 ? ` / ${progress.total.toLocaleString()}` : ''}
						</span>
					</div>
				) : null}
			</div>
		</div>
	);
}

interface ResultsViewProps {
	readonly result: ScanResult;
	readonly selected: ReadonlySet<string>;
	readonly onTogglePath: (path: string) => void;
}

function ResultsView({ result, selected, onTogglePath }: ResultsViewProps) {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex shrink-0 items-center justify-between gap-2 border-b bg-surface-2 px-4 py-2 text-xs">
				<div className="flex items-center gap-2 text-muted-foreground">
					<span>
						<span className="font-medium text-foreground">
							{result.groups.length.toLocaleString()}
						</span>{' '}
						duplicate groups
					</span>
					<span>•</span>
					<span>
						<span className="font-medium text-foreground">
							{humanSize(result.totalWastedBytes)}
						</span>{' '}
						wasted
					</span>
					<span>•</span>
					<span>
						scanned {result.totalFiles.toLocaleString()} files in {result.elapsedMs} ms
					</span>
				</div>
				<div className="text-muted-foreground">
					{selected.size > 0 ? (
						<Badge variant="outline" className="font-mono text-2xs">
							{selected.size.toLocaleString()} selected
						</Badge>
					) : null}
				</div>
			</div>
			<div className="flex-1 overflow-auto p-4">
				<div className="flex flex-col gap-3">
					{result.groups.map((group) => (
						<GroupCard
							key={group.hash}
							group={group}
							selected={selected}
							onTogglePath={onTogglePath}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

interface GroupCardProps {
	readonly group: DuplicateGroup;
	readonly selected: ReadonlySet<string>;
	readonly onTogglePath: (path: string) => void;
}

function GroupCard({ group, selected, onTogglePath }: GroupCardProps) {
	const wasted = group.sizeBytes * (group.paths.length - 1);
	const keeper = pickKeeper(group, 'shortest-path');

	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center justify-between gap-2 text-sm">
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<Copy className="h-4 w-4 text-amber-500" />
						<span className="font-mono text-xs truncate" title={group.hash}>
							{group.hash.slice(0, 16)}…
						</span>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<Badge variant="outline" className="font-mono text-2xs">
							{group.paths.length} copies
						</Badge>
						<Badge variant="outline" className="font-mono text-2xs">
							{humanSize(group.sizeBytes)} each
						</Badge>
						<Badge variant="outline" className="font-mono text-2xs">
							{humanSize(wasted)} wasted
						</Badge>
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-col gap-1">
					{group.paths.map((entry) => (
						<GroupRow
							key={entry.path}
							entry={entry}
							isKeeper={keeper?.path === entry.path}
							isSelected={selected.has(entry.path)}
							onToggle={() => onTogglePath(entry.path)}
						/>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

interface GroupRowProps {
	readonly entry: DuplicateEntry;
	readonly isKeeper: boolean;
	readonly isSelected: boolean;
	readonly onToggle: () => void;
}

function GroupRow({ entry, isKeeper, isSelected, onToggle }: GroupRowProps) {
	const handleReveal = useCallback(async () => {
		try {
			const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
			await revealItemInDir(entry.path);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to reveal in Finder', { description: message });
		}
	}, [entry.path]);

	return (
		<li className="flex items-center gap-2 rounded-md border bg-background p-2 text-xs">
			<Checkbox checked={isSelected} onCheckedChange={onToggle} aria-label="Mark for deletion" />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="min-w-0 flex-1 truncate font-mono" title={entry.path}>
						{entry.path}
					</span>
					{isKeeper ? (
						<Badge variant="outline" className="shrink-0 font-mono text-2xs text-success">
							Keeper
						</Badge>
					) : null}
				</div>
				<div className="text-2xs text-muted-foreground">
					Modified {formatTimestamp(entry.modifiedMs)}
				</div>
			</div>
			<Button variant="ghost" size="sm" onClick={handleReveal} title="Reveal in Finder">
				<FolderOpen className="h-3.5 w-3.5" />
				<span className="sr-only">Reveal in Finder</span>
			</Button>
		</li>
	);
}
