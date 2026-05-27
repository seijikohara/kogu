import { createFileRoute } from '@tanstack/react-router';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
	AlertTriangle,
	Check,
	CheckCircle2,
	ClipboardCopy,
	FileDigit,
	FilePlus,
	FolderOpen,
	Hash,
	Loader2,
	ShieldAlert,
	ShieldCheck,
	Trash2,
	Type,
	X,
} from 'lucide-react';
import { type DragEvent, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import { CodeEditor } from '@/lib/components/editor';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormMode,
	FormSection,
	FormTextarea,
} from '@/lib/components/form';
import { SectionHeader, SectionLabel } from '@/lib/components/layout';
import { StatusBar, ToolShell } from '@/lib/components/shell';
import { Rail } from '@/lib/components/ui/rail';
import { EmbeddedEmptyState, LiveStatusRegion, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { CodeBlock } from '@/lib/components/ui/code-block';
import { ToneBadge } from '@/lib/components/ui/tone-badge';
import { useDocumentTitle } from '@/lib/hooks';
import {
	BATCH_HASH_ALGO_LABELS,
	BATCH_HASH_ALGO_SECURE,
	BATCH_HASH_ALGOS,
	type BatchHashAlgo,
	basename,
	buildShasumBlock,
	type FileHashResult,
	generateAllHashes,
	HASH_ALGORITHMS,
	hashFileBatch,
	humanSize,
	parseShasumBlock,
	SAMPLE_TEXT_FOR_HASH,
	type VerifyOutcome,
	verifyShasum,
} from '@/lib/services/encoders';
import { createToolOptionsStore, useActiveTab, useTabStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

type HashTab = 'text' | 'batch';

const TABS = [
	{ id: 'text' as const, label: 'Text', icon: Type },
	{ id: 'batch' as const, label: 'Batch', icon: FileDigit },
] as const;

const PERSIST_KEY = 'hash-generator';

const FILE_MODES = [
	{ value: 'compute', label: 'Compute' },
	{ value: 'verify', label: 'Verify' },
] as const;

type FileMode = (typeof FILE_MODES)[number]['value'];

interface HashGeneratorPrefs {
	readonly enabledHashes: readonly BatchHashAlgo[];
	readonly fileMode: FileMode;
	readonly shasumAlgorithm: BatchHashAlgo;
}

const DEFAULT_PREFS: HashGeneratorPrefs = {
	enabledHashes: ['md5', 'sha1', 'sha256', 'sha512'],
	fileMode: 'compute',
	shasumAlgorithm: 'sha256',
};

const useHashGeneratorPrefs = createToolOptionsStore<HashGeneratorPrefs>(
	'hash-generator',
	DEFAULT_PREFS
);

const isFileMode = (value: string): value is FileMode => FILE_MODES.some((m) => m.value === value);

export const Route = createFileRoute('/hash-generator')({
	component: HashGeneratorPage,
});

function HashGeneratorPage() {
	useDocumentTitle('Hash Generator');

	const persistedTab = useActiveTab(PERSIST_KEY);
	const setActive = useTabStore((s) => s.setActive);
	const activeTab: HashTab = (persistedTab as HashTab | undefined) ?? 'text';
	const handleTabChange = (tab: string) => {
		if (tab === 'text' || tab === 'batch') setActive(PERSIST_KEY, tab);
	};

	const [showRail, setShowRail] = useState(true);

	return (
		<ToolShell
			layout="tabbed"
			tabs={TABS}
			activeTab={activeTab}
			onTabChange={handleTabChange}
			showRail={showRail}
			onShowRailChange={setShowRail}
			renderTabContent={(tab) => (tab === 'text' ? <TextHashTab /> : <BatchHashTab />)}
		/>
	);
}

// =============================================================================
// Text tab
// =============================================================================

function TextHashTab() {
	const [textInput, setTextInput] = useState('');

	const textHashes = useMemo(() => {
		if (!textInput.trim()) return [];
		return generateAllHashes(textInput);
	}, [textInput]);

	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) setTextInput(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => setTextInput('');
	const handleSample = () => setTextInput(SAMPLE_TEXT_FOR_HASH);

	const isSecure = (algorithm: string): boolean =>
		HASH_ALGORITHMS.find((a) => a.algorithm === algorithm)?.secure ?? false;

	return (
		<ToolShellTextContent
			textInput={textInput}
			onTextChange={setTextInput}
			onPaste={handlePaste}
			onClear={handleClear}
			onSample={handleSample}
			textHashes={textHashes}
			isSecure={isSecure}
		/>
	);
}

interface TextHashResult {
	readonly algorithm: string;
	readonly hash: string;
	readonly bits: number;
}

interface ToolShellTextContentProps {
	readonly textInput: string;
	readonly onTextChange: (value: string) => void;
	readonly onPaste: () => void;
	readonly onClear: () => void;
	readonly onSample: () => void;
	readonly textHashes: readonly TextHashResult[];
	readonly isSecure: (algorithm: string) => boolean;
}

function ToolShellTextContent({
	textInput,
	onTextChange,
	onPaste,
	onClear,
	onSample,
	textHashes,
	isSecure,
}: ToolShellTextContentProps) {
	// Rail / status content for the Text tab is intentionally absent here:
	// the outer ToolShell owns those slots and the Text tab keeps the rail
	// empty so the editor + results occupy the full vertical run.
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="h-1/3 shrink-0 border-b">
				<CodeEditor
					title="Input Text"
					value={textInput}
					onChange={onTextChange}
					mode="input"
					editorMode="plain"
					placeholder="Enter text to hash..."
					showViewToggle={false}
					onPaste={onPaste}
					onClear={onClear}
					onSample={onSample}
				/>
			</div>
			<div className="flex flex-1 flex-col overflow-hidden">
				<SectionHeader title="Hash Results" />
				<LiveStatusRegion className="flex-1 overflow-auto p-4">
					{textHashes.length > 0 ? (
						<div className="space-y-3">
							{textHashes.map((result) => (
								<Card key={result.algorithm} density="compact">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
										<div className="flex items-center gap-2">
											<CardTitle className="font-mono text-sm">{result.algorithm}</CardTitle>
											<span className="text-xs tabular-nums text-muted-foreground">
												({result.bits} bits)
											</span>
											{isSecure(result.algorithm) ? (
												<ToneBadge tone="success" icon={ShieldCheck}>
													Secure
												</ToneBadge>
											) : (
												<ToneBadge tone="warning" icon={ShieldAlert}>
													Weak
												</ToneBadge>
											)}
										</div>
										<CopyButton
											text={result.hash}
											toastLabel={result.algorithm}
											size="sm"
											showLabel
											className="h-7"
										/>
									</CardHeader>
									<CardContent>
										<CodeBlock>{result.hash}</CodeBlock>
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<EmbeddedEmptyState
							icon={Hash}
							title="Enter text to hash"
							description="Type or paste content above to compute MD5, SHA-1, SHA-256, and more."
							fillHeight
						/>
					)}
				</LiveStatusRegion>
			</div>
		</div>
	);
}

// =============================================================================
// Batch tab — multi-file streaming hash computation
// =============================================================================

interface FileEntry {
	readonly id: string;
	readonly path: string;
	readonly name: string;
	readonly status: 'pending' | 'hashing' | 'done' | 'error';
	readonly result: FileHashResult | null;
}

let entryIdCounter = 0;
const nextEntryId = (): string => {
	entryIdCounter += 1;
	return `entry-${entryIdCounter}`;
};

const SHASUM_PLACEHOLDER =
	'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  example.txt';

function BatchHashTab() {
	const { value: prefs, patch } = useHashGeneratorPrefs();

	const [entries, setEntries] = useState<readonly FileEntry[]>([]);
	const [busy, setBusy] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);
	const [expectedText, setExpectedText] = useState('');

	const toggleAlgorithm = useCallback(
		(algo: BatchHashAlgo, checked: boolean) => {
			const next = checked
				? Array.from(new Set([...prefs.enabledHashes, algo]))
				: prefs.enabledHashes.filter((a) => a !== algo);
			// Always keep at least one algorithm enabled; otherwise the batch
			// command would reject the request and produce a generic error.
			if (next.length === 0) return;
			patch({ enabledHashes: next });
		},
		[patch, prefs.enabledHashes]
	);

	const addPaths = useCallback((paths: readonly string[]) => {
		if (paths.length === 0) return;
		setEntries((prev) => {
			const seen = new Set(prev.map((e) => e.path));
			const additions: FileEntry[] = [];
			for (const p of paths) {
				if (!seen.has(p)) {
					additions.push({
						id: nextEntryId(),
						path: p,
						name: basename(p),
						status: 'pending',
						result: null,
					});
					seen.add(p);
				}
			}
			return [...prev, ...additions];
		});
	}, []);

	const handlePickFiles = async () => {
		try {
			// `open({ multiple: true })` returns `string[] | null` — `null`
			// when the user cancels the dialog. The plugin never returns a
			// bare string in multi-select mode, so a simple null-check is
			// sufficient before forwarding to `addPaths`.
			const selected = await openDialog({ multiple: true, directory: false });
			if (selected !== null) {
				addPaths(selected);
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to open file dialog', { description: message });
		}
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
		const dropped = Array.from(e.dataTransfer.files) as (File & {
			readonly path?: string;
		})[];
		const paths = dropped.map((f) => f.path ?? '').filter((p) => p.length > 0);
		if (paths.length === 0) {
			toast.error('Could not determine file paths', {
				description: 'Use the Open files button to pick files instead.',
			});
			return;
		}
		addPaths(paths);
	};
	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
	};
	const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
	};

	const handleRemove = (id: string) => {
		setEntries((prev) => prev.filter((e) => e.id !== id));
	};
	const handleClear = () => {
		setEntries([]);
		setExpectedText('');
	};

	const handleRunHash = useCallback(async () => {
		if (entries.length === 0 || prefs.enabledHashes.length === 0) return;
		setBusy(true);

		// Flip every pending entry to "hashing" before invoking the backend
		// so the UI surfaces the in-flight state for every row, not only
		// the row whose hash completed first.
		setEntries((prev) =>
			prev.map((e) => ({
				...e,
				status: e.status === 'done' ? 'done' : ('hashing' as const),
				result: e.status === 'done' ? e.result : null,
			}))
		);

		try {
			const paths = entries.map((e) => e.path);
			const results = await hashFileBatch(paths, prefs.enabledHashes);
			setEntries((prev) =>
				prev.map((entry) => {
					const match = results.find((r) => r.path === entry.path);
					if (!match) return entry;
					return {
						...entry,
						status: match.error ? ('error' as const) : ('done' as const),
						result: match,
					};
				})
			);
			const errored = results.filter((r) => r.error).length;
			if (errored === 0) {
				toast.success(`Hashed ${results.length} file${results.length === 1 ? '' : 's'}`);
			} else {
				toast.error(`Hashed ${results.length - errored} of ${results.length} files`, {
					description: `${errored} file${errored === 1 ? '' : 's'} failed`,
				});
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Hash batch failed', { description: message });
			setEntries((prev) =>
				prev.map((entry) =>
					entry.status === 'hashing' ? { ...entry, status: 'error' as const } : entry
				)
			);
		} finally {
			setBusy(false);
		}
	}, [entries, prefs.enabledHashes]);

	const allDone =
		entries.length > 0 && entries.every((e) => e.status === 'done' || e.status === 'error');
	const completedResults = useMemo(
		() => entries.map((e) => e.result).filter((r): r is FileHashResult => r !== null),
		[entries]
	);

	const shasumBlock = useMemo(
		() => buildShasumBlock(completedResults, prefs.shasumAlgorithm),
		[completedResults, prefs.shasumAlgorithm]
	);

	const verifyOutcomes = useMemo<readonly VerifyOutcome[]>(() => {
		if (prefs.fileMode !== 'verify') return [];
		const parsed = parseShasumBlock(expectedText);
		if (parsed.length === 0) return [];
		return verifyShasum(completedResults, parsed, prefs.shasumAlgorithm);
	}, [completedResults, expectedText, prefs.fileMode, prefs.shasumAlgorithm]);

	const verifySummary = useMemo(() => {
		if (verifyOutcomes.length === 0) return null;
		const matches = verifyOutcomes.filter((o) => o.match).length;
		return { matches, total: verifyOutcomes.length };
	}, [verifyOutcomes]);

	const totalBytes = useMemo(
		() => entries.reduce((sum, e) => sum + (e.result?.sizeBytes ?? 0), 0),
		[entries]
	);
	const completedCount = entries.filter((e) => e.status === 'done').length;
	const errorCount = entries.filter((e) => e.status === 'error').length;

	const handleCopyShasum = async () => {
		try {
			await navigator.clipboard.writeText(shasumBlock);
			toast.success(`Copied ${prefs.shasumAlgorithm.toUpperCase()} block`);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to copy', { description: message });
		}
	};

	const valid = entries.length > 0 ? allDone : null;
	const hasFiles = entries.length > 0;

	return (
		<FileTabLayout
			rail={
				<FileHashRail
					prefs={prefs}
					onToggleAlgorithm={toggleAlgorithm}
					onModeChange={(m) => patch({ fileMode: m })}
					onShasumAlgoChange={(a) => patch({ shasumAlgorithm: a })}
					onPickFiles={handlePickFiles}
					onClear={handleClear}
					onRun={handleRunHash}
					busy={busy}
					hasFiles={hasFiles}
				/>
			}
			statusContent={
				hasFiles ? (
					<>
						<StatItem label="Files" value={entries.length} />
						<StatItem label="Completed" value={completedCount} />
						{errorCount > 0 ? <StatItem label="Errors" value={errorCount} /> : null}
						<StatItem label="Total size" value={humanSize(totalBytes)} />
					</>
				) : null
			}
			valid={valid}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="flex-1 overflow-auto p-4">
					<div className="mx-auto flex max-w-5xl flex-col gap-4">
						<DropZoneCard
							isDragOver={isDragOver}
							busy={busy}
							hasFiles={hasFiles}
							onPick={handlePickFiles}
							onDrop={handleDrop}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
						/>

						{hasFiles ? (
							<FileListCard
								entries={entries}
								enabledHashes={prefs.enabledHashes}
								busy={busy}
								onRemove={handleRemove}
							/>
						) : null}

						{prefs.fileMode === 'compute' && allDone && completedResults.length > 0 ? (
							<ShasumBlockCard
								algorithm={prefs.shasumAlgorithm}
								block={shasumBlock}
								onCopy={handleCopyShasum}
							/>
						) : null}

						{prefs.fileMode === 'verify' ? (
							<VerifyCard
								algorithm={prefs.shasumAlgorithm}
								expectedText={expectedText}
								onExpectedChange={setExpectedText}
								outcomes={verifyOutcomes}
								summary={verifySummary}
								hasResults={allDone}
							/>
						) : null}
					</div>
				</div>
			</div>
		</FileTabLayout>
	);
}

// Render rail + content + status as a grid that sits inside the outer
// ToolShell's tab content area. The outer ToolShell already provides
// the page title and tab strip; nesting another ToolShell here would
// duplicate them.
interface FileTabLayoutProps {
	readonly rail: React.ReactNode;
	readonly statusContent: React.ReactNode;
	readonly valid: boolean | null;
	readonly children: React.ReactNode;
}

function FileTabLayout({ rail, statusContent, valid, children }: FileTabLayoutProps) {
	const [showRail, setShowRail] = useState(true);
	return (
		<div className="grid h-full min-h-0 grid-rows-[1fr_var(--status-h)] overflow-hidden">
			<div className="flex min-h-0 overflow-hidden">
				<Rail
					show={showRail}
					title="File options"
					onShowChange={setShowRail}
					onClose={() => setShowRail(false)}
					onOpen={() => setShowRail(true)}
				>
					{rail}
				</Rail>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
			</div>
			<StatusBar valid={valid}>{statusContent}</StatusBar>
		</div>
	);
}

// ---------------------------------------------------------------------
// File tab — sub-components
// ---------------------------------------------------------------------

interface FileHashRailProps {
	readonly prefs: HashGeneratorPrefs;
	readonly onToggleAlgorithm: (algo: BatchHashAlgo, checked: boolean) => void;
	readonly onModeChange: (mode: FileMode) => void;
	readonly onShasumAlgoChange: (algo: BatchHashAlgo) => void;
	readonly onPickFiles: () => void;
	readonly onClear: () => void;
	readonly onRun: () => void;
	readonly busy: boolean;
	readonly hasFiles: boolean;
}

function FileHashRail({
	prefs,
	onToggleAlgorithm,
	onModeChange,
	onShasumAlgoChange,
	onPickFiles,
	onClear,
	onRun,
	busy,
	hasFiles,
}: FileHashRailProps) {
	const mode = prefs.fileMode;
	return (
		<>
			<FormSection title="Files">
				<div className="flex flex-col gap-2">
					<Button variant="default" size="sm" onClick={onPickFiles} disabled={busy}>
						<FolderOpen className="h-3.5 w-3.5" />
						Add files…
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={onRun}
						disabled={busy || !hasFiles || prefs.enabledHashes.length === 0}
					>
						{busy ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Hash className="h-3.5 w-3.5" />
						)}
						{busy ? 'Hashing…' : 'Compute hashes'}
					</Button>
					<Button variant="outline" size="sm" onClick={onClear} disabled={busy || !hasFiles}>
						<Trash2 className="h-3.5 w-3.5" />
						Clear list
					</Button>
				</div>
			</FormSection>

			<FormSection title="Algorithms">
				<FormCheckboxGroup>
					{BATCH_HASH_ALGOS.map((algo) => (
						<FormCheckbox
							key={algo}
							label={BATCH_HASH_ALGO_LABELS[algo]}
							checked={prefs.enabledHashes.includes(algo)}
							onCheckedChange={(checked) => onToggleAlgorithm(algo, checked)}
							size="compact"
						/>
					))}
				</FormCheckboxGroup>
			</FormSection>

			<FormSection title="Sum block">
				<FormMode
					value={mode}
					options={FILE_MODES}
					onValueChange={(v) => {
						if (isFileMode(v)) onModeChange(v);
					}}
				/>
				<div className="mt-2 grid grid-cols-2 gap-1">
					{BATCH_HASH_ALGOS.map((algo) => (
						<Button
							key={algo}
							variant={prefs.shasumAlgorithm === algo ? 'default' : 'outline'}
							size="sm"
							className="h-7 text-xs"
							onClick={() => onShasumAlgoChange(algo)}
						>
							{BATCH_HASH_ALGO_LABELS[algo]}
						</Button>
					))}
				</div>
			</FormSection>

			<FormSection title="About">
				<FormInfo>
					<ul className="list-inside list-disc space-y-0.5">
						<li>Drop files or pick them from the dialog.</li>
						<li>All algorithms compute together via one streaming read per file.</li>
						<li>
							Verify mode reads a `&lt;hash&gt; &lt;filename&gt;` block and matches by basename.
						</li>
					</ul>
				</FormInfo>
			</FormSection>

			<FormSection title="Security">
				<FormInfo showIcon={false}>
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<ShieldCheck className="h-3 w-3 text-success" />
							<span className="text-success">Secure:</span>
							<span>SHA-256, SHA-512</span>
						</div>
						<div className="flex items-center gap-2">
							<ShieldAlert className="h-3 w-3 text-warning" />
							<span className="text-warning">Weak:</span>
							<span>MD5, SHA-1</span>
						</div>
					</div>
				</FormInfo>
			</FormSection>
		</>
	);
}

interface DropZoneCardProps {
	readonly isDragOver: boolean;
	readonly busy: boolean;
	readonly hasFiles: boolean;
	readonly onPick: () => void;
	readonly onDrop: (e: DragEvent<HTMLDivElement>) => void;
	readonly onDragOver: (e: DragEvent<HTMLDivElement>) => void;
	readonly onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
}

function DropZoneCard({
	isDragOver,
	busy,
	hasFiles,
	onPick,
	onDrop,
	onDragOver,
	onDragLeave,
}: DropZoneCardProps) {
	return (
		<Card density="compact">
			<CardContent
				role="region"
				aria-label="Drop files to hash"
				onDrop={onDrop}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				className={cn(
					'flex flex-col items-center gap-3 rounded-md border-2 border-dashed py-8 text-center transition-colors',
					isDragOver ? 'border-primary bg-primary/10' : 'border-border'
				)}
			>
				<FilePlus className="h-8 w-8 text-muted-foreground" />
				<div className="space-y-1">
					<p className="text-sm font-medium">
						{hasFiles ? 'Drop more files to add to the batch' : 'Drop files to hash'}
					</p>
					<p className="text-xs text-muted-foreground">
						Or use the picker — multi-select is supported.
					</p>
				</div>
				<Button variant="default" size="sm" onClick={onPick} disabled={busy}>
					<FolderOpen className="h-3.5 w-3.5" />
					Open files…
				</Button>
			</CardContent>
		</Card>
	);
}

interface FileListCardProps {
	readonly entries: readonly FileEntry[];
	readonly enabledHashes: readonly BatchHashAlgo[];
	readonly busy: boolean;
	readonly onRemove: (id: string) => void;
}

function FileListCard({ entries, enabledHashes, busy, onRemove }: FileListCardProps) {
	return (
		<Card density="compact">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
				<CardTitle className="text-sm font-medium">Files ({entries.length})</CardTitle>
				<span className="text-xs text-muted-foreground">
					{enabledHashes.length} algorithm{enabledHashes.length === 1 ? '' : 's'} selected
				</span>
			</CardHeader>
			<CardContent className="space-y-2">
				{entries.map((entry) => (
					<FileRow
						key={entry.id}
						entry={entry}
						enabledHashes={enabledHashes}
						busy={busy}
						onRemove={() => onRemove(entry.id)}
					/>
				))}
			</CardContent>
		</Card>
	);
}

interface FileRowProps {
	readonly entry: FileEntry;
	readonly enabledHashes: readonly BatchHashAlgo[];
	readonly busy: boolean;
	readonly onRemove: () => void;
}

function FileRow({ entry, enabledHashes, busy, onRemove }: FileRowProps) {
	return (
		<div className="rounded-md border bg-card p-3">
			<div className="mb-2 flex items-center gap-2">
				<FileStatusBadge status={entry.status} />
				<span className="min-w-0 flex-1 break-all font-mono text-xs">{entry.name}</span>
				{entry.result ? (
					<span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
						{humanSize(entry.result.sizeBytes)}
					</span>
				) : null}
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7 shrink-0"
					onClick={onRemove}
					disabled={busy}
					aria-label="Remove file"
				>
					<X className="h-3.5 w-3.5" />
				</Button>
			</div>
			<div className="break-all font-mono text-2xs text-muted-foreground">{entry.path}</div>

			{entry.result?.error ? (
				<div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-2xs text-destructive">
					<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
					<span>{entry.result.error}</span>
				</div>
			) : null}

			{entry.result && !entry.result.error ? (
				<div className="mt-2 space-y-1.5">
					{enabledHashes.map((algo) => {
						const hash = entry.result?.hashes[algo];
						if (!hash) return null;
						const secure = BATCH_HASH_ALGO_SECURE[algo];
						return (
							<div key={algo} className="flex items-start gap-2 text-xs">
								<span className="flex w-20 shrink-0 items-center gap-1.5 font-mono text-muted-foreground">
									{BATCH_HASH_ALGO_LABELS[algo]}
									{secure ? (
										<ShieldCheck className="h-3 w-3 text-success" />
									) : (
										<ShieldAlert className="h-3 w-3 text-warning" />
									)}
								</span>
								<code className="min-w-0 flex-1 break-all font-mono text-2xs">{hash}</code>
								<CopyButton
									text={hash}
									toastLabel={`${BATCH_HASH_ALGO_LABELS[algo]} hash`}
									size="sm"
								/>
							</div>
						);
					})}
				</div>
			) : null}
		</div>
	);
}

function FileStatusBadge({ status }: { readonly status: FileEntry['status'] }) {
	if (status === 'hashing') {
		return (
			<Badge variant="outline" className="gap-1 text-2xs">
				<Loader2 className="h-3 w-3 animate-spin" />
				Hashing
			</Badge>
		);
	}
	if (status === 'done') {
		return (
			<Badge className="gap-1 border-success/30 bg-success/10 text-2xs text-success">
				<Check className="h-3 w-3" />
				Done
			</Badge>
		);
	}
	if (status === 'error') {
		return (
			<Badge className="gap-1 border-destructive/30 bg-destructive/10 text-2xs text-destructive">
				<X className="h-3 w-3" />
				Error
			</Badge>
		);
	}
	return (
		<Badge variant="outline" className="gap-1 text-2xs text-muted-foreground">
			Pending
		</Badge>
	);
}

interface ShasumBlockCardProps {
	readonly algorithm: BatchHashAlgo;
	readonly block: string;
	readonly onCopy: () => void;
}

function ShasumBlockCard({ algorithm, block, onCopy }: ShasumBlockCardProps) {
	if (!block) return null;
	return (
		<Card density="compact">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
				<div className="flex items-center gap-2">
					<CardTitle className="text-sm font-medium">
						{BATCH_HASH_ALGO_LABELS[algorithm]}sum block
					</CardTitle>
					<span className="text-2xs text-muted-foreground">
						Compatible with <code className="font-mono">{algorithm}sum -c</code>
					</span>
				</div>
				<Button variant="outline" size="sm" onClick={onCopy}>
					<ClipboardCopy className="h-3.5 w-3.5" />
					Copy block
				</Button>
			</CardHeader>
			<CardContent>
				<CodeBlock as="pre" padding="md" size="xs" maxHeight="md">
					{block}
				</CodeBlock>
			</CardContent>
		</Card>
	);
}

interface VerifyCardProps {
	readonly algorithm: BatchHashAlgo;
	readonly expectedText: string;
	readonly onExpectedChange: (value: string) => void;
	readonly outcomes: readonly VerifyOutcome[];
	readonly summary: { readonly matches: number; readonly total: number } | null;
	readonly hasResults: boolean;
}

function VerifyCard({
	algorithm,
	expectedText,
	onExpectedChange,
	outcomes,
	summary,
	hasResults,
}: VerifyCardProps) {
	return (
		<Card density="compact">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm font-medium">
						Verify against {BATCH_HASH_ALGO_LABELS[algorithm]}
					</CardTitle>
					{summary ? (
						<Badge
							className={cn(
								'gap-1 text-2xs',
								summary.matches === summary.total
									? 'border-success/30 bg-success/10 text-success'
									: 'border-destructive/30 bg-destructive/10 text-destructive'
							)}
						>
							{summary.matches === summary.total ? (
								<CheckCircle2 className="h-3 w-3" />
							) : (
								<AlertTriangle className="h-3 w-3" />
							)}
							{summary.matches} / {summary.total} matched
						</Badge>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<FormTextarea
					label="Expected sums"
					value={expectedText}
					onValueChange={onExpectedChange}
					placeholder={SHASUM_PLACEHOLDER}
					rows={6}
					hint="One line per file. Comments starting with `#` are ignored."
				/>

				{outcomes.length > 0 ? (
					<div>
						<SectionLabel>Outcomes</SectionLabel>
						<ul className="space-y-1.5">
							{outcomes.map((outcome) => (
								<VerifyOutcomeRow
									key={outcome.filename}
									outcome={outcome}
									hasResults={hasResults}
								/>
							))}
						</ul>
					</div>
				) : (
					<p className="text-xs text-muted-foreground">
						{expectedText.trim().length === 0
							? 'Paste a sum block to verify the computed hashes against it.'
							: 'No parseable lines yet. Use `<hash>  <filename>` per line.'}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function VerifyOutcomeRow({
	outcome,
	hasResults,
}: {
	readonly outcome: VerifyOutcome;
	readonly hasResults: boolean;
}) {
	const status =
		outcome.actual === null
			? hasResults
				? 'missing'
				: 'pending'
			: outcome.match
				? 'match'
				: 'mismatch';

	return (
		<li className="flex items-start gap-2 rounded-md border bg-card px-3 py-2 text-xs">
			<VerifyStatusBadge status={status} />
			<div className="min-w-0 flex-1 space-y-1">
				<div className="break-all font-mono text-xs">{outcome.filename}</div>
				<div className="grid grid-cols-[60px_1fr] gap-x-2 text-2xs">
					<span className="text-muted-foreground">Expected</span>
					<code className="break-all font-mono">{outcome.expected}</code>
					<span className="text-muted-foreground">Actual</span>
					<code className={cn('break-all font-mono', !outcome.match && 'text-destructive')}>
						{outcome.actual ?? '(no result)'}
					</code>
				</div>
			</div>
		</li>
	);
}

function VerifyStatusBadge({
	status,
}: {
	readonly status: 'match' | 'mismatch' | 'missing' | 'pending';
}) {
	if (status === 'match') {
		return (
			<Badge className="shrink-0 gap-1 border-success/30 bg-success/10 text-2xs text-success">
				<Check className="h-3 w-3" />
				Match
			</Badge>
		);
	}
	if (status === 'mismatch') {
		return (
			<Badge className="shrink-0 gap-1 border-destructive/30 bg-destructive/10 text-2xs text-destructive">
				<X className="h-3 w-3" />
				Mismatch
			</Badge>
		);
	}
	if (status === 'missing') {
		return (
			<Badge className="shrink-0 gap-1 border-warning/30 bg-warning/10 text-2xs text-warning">
				<AlertTriangle className="h-3 w-3" />
				Missing
			</Badge>
		);
	}
	return (
		<Badge variant="outline" className="shrink-0 gap-1 text-2xs text-muted-foreground">
			Pending
		</Badge>
	);
}
