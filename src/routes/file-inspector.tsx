import { createFileRoute } from '@tanstack/react-router';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import exifr from 'exifr';
import {
	AlertTriangle,
	ClipboardCopy,
	FileSearch,
	FolderOpen,
	Image as ImageIcon,
	Loader2,
	ScanLine,
	ShieldAlert,
	ShieldCheck,
	Square,
	Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import { FormCheckbox, FormCheckboxGroup, FormSection, FormSlider } from '@/lib/components/form';
import { DefinitionList, SectionLabel } from '@/lib/components/layout';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { useDocumentTitle, useFileInspectWorker } from '@/lib/hooks';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import {
	base64ToBytes,
	decodeTextPreview,
	detectMimeFromMagic,
	formatHexPreview,
	formatTimestamp,
	HASH_ALGO_LABELS,
	HASH_ALGO_SECURE,
	MAX_FULL_BYTES,
	type HashAlgo,
	cancelFileInspect,
	humanSize,
	type FileInspectResult,
	inspectFile,
	isAudioMime,
	isImageMime,
	isTextLikeMime,
} from '@/lib/services/file-inspect';
import { cn } from '@/lib/utils';

const ALL_HASH_ALGOS: readonly HashAlgo[] = ['md5', 'sha1', 'sha256', 'sha512'];

interface FileInspectorPrefs {
	readonly enabledHashes: readonly HashAlgo[];
	readonly hexPreviewRows: number;
	readonly textPreviewChars: number;
}

const DEFAULT_PREFS: FileInspectorPrefs = {
	enabledHashes: ['md5', 'sha1', 'sha256', 'sha512'],
	hexPreviewRows: 16,
	textPreviewChars: 2048,
};

const useFileInspectorPrefs = createToolOptionsStore<FileInspectorPrefs>(
	'file-inspector',
	DEFAULT_PREFS
);

interface ImagePreview {
	readonly url: string;
	readonly width: number;
	readonly height: number;
	readonly exif: Record<string, unknown> | null;
}

export const Route = createFileRoute('/file-inspector')({
	component: FileInspectorPage,
});

function FileInspectorPage() {
	useDocumentTitle('File Inspector');

	const { value: prefs, patch } = useFileInspectorPrefs();

	const [result, setResult] = useState<FileInspectResult | null>(null);
	const [bytes, setBytes] = useState<Uint8Array | null>(null);
	const [loading, setLoading] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const inspectOpIdRef = useRef<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Decoding and hashing run in a worker so a large file never freezes the UI.
	const {
		output: { hashes, hashing },
		decode: decodeFile,
		hash: hashBuffer,
		reset: resetHashWorker,
	} = useFileInspectWorker();
	const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
	const [audioInfo, setAudioInfo] = useState<{
		readonly duration: number;
		readonly sampleRate: number;
		readonly channels: number;
	} | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [showRail, setShowRail] = usePersistedRail('file-inspector');

	const headBytes = useMemo<Uint8Array | null>(() => {
		if (!result) return null;
		return base64ToBytes(result.headBytesB64);
	}, [result]);

	const mimeInfo = useMemo(() => {
		if (!result || !headBytes) return null;
		return detectMimeFromMagic(headBytes, result.filename);
	}, [headBytes, result]);

	const detectedMime = mimeInfo?.mime ?? mimeInfo?.expectedFromExtension ?? null;

	const mimeMismatch = useMemo(() => {
		if (!mimeInfo) return false;
		const { mime, expectedFromExtension } = mimeInfo;
		if (!mime || !expectedFromExtension) return false;
		return mime !== expectedFromExtension;
	}, [mimeInfo]);

	const handleClear = useCallback(() => {
		// Discard any in-flight worker response for the previous file.
		resetHashWorker();
		setResult(null);
		setBytes(null);
		setError(null);
		setImagePreview(null);
		setAudioInfo(null);
	}, [resetHashWorker]);

	const loadFromPath = useCallback(
		async (path: string) => {
			const opId = crypto.randomUUID();
			inspectOpIdRef.current = opId;
			// Drop any in-flight worker response so the previous file's decoded
			// bytes cannot be applied once this file's request resolves.
			resetHashWorker();
			setBytes(null);
			setLoading(true);
			setCancelling(false);
			setError(null);
			setImagePreview(null);
			setAudioInfo(null);
			try {
				const next = await inspectFile(opId, path);
				setResult(next);
				if (next.fullBytesB64) {
					// Decode off-thread; onBuffer hands the decoded bytes back for the
					// image / audio preview. Hashing is driven by the effect below.
					decodeFile(next.fullBytesB64, (buffer) => {
						setBytes(new Uint8Array(buffer));
					});
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				// Cancellation is a user action, not a failure.
				if (message.includes('cancelled')) {
					toast.info('Inspection cancelled');
				} else {
					setError(message);
					toast.error('Failed to inspect file', { description: message });
				}
			} finally {
				inspectOpIdRef.current = null;
				setLoading(false);
				setCancelling(false);
			}
		},
		[decodeFile, resetHashWorker]
	);

	const handleCancel = useCallback(() => {
		const opId = inspectOpIdRef.current;
		if (!opId) return;
		setCancelling(true);
		cancelFileInspect(opId).catch(() => undefined);
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
		// Tauri's webview exposes the absolute path on dropped files
		// via the non-standard `path` property. When present, the
		// custom command can read the file straight from disk so the
		// hash hits the full content rather than the browser-sliced
		// preview only.
		const file = e.dataTransfer.files[0] as (File & { readonly path?: string }) | undefined;
		if (!file) return;
		if (file.path) {
			loadFromPath(file.path).catch(() => undefined);
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

	// Hash the decoded bytes off-thread — on initial decode and whenever the
	// user toggles algorithms. A copy of the buffer goes to the worker as a
	// transferable so hashing never blocks the main thread and the preview's
	// own `bytes` copy is untouched. Keyed on bytes + enabledHashes only (never
	// on the hash results), which is what avoids the old render-churn loop.
	useEffect(() => {
		if (!bytes) return;
		hashBuffer(bytes.buffer.slice(0) as ArrayBuffer, prefs.enabledHashes);
	}, [bytes, prefs.enabledHashes, hashBuffer]);

	// Image-format extraction: dimensions, EXIF. Audio-format
	// extraction: duration, sample rate, channel count.
	useEffect(() => {
		if (!result || !bytes || !detectedMime) {
			setImagePreview(null);
			setAudioInfo(null);
			return;
		}

		let revokeUrl: string | null = null;
		let cancelled = false;

		if (isImageMime(detectedMime)) {
			const blob = new Blob([bytes as BlobPart], { type: detectedMime });
			const url = URL.createObjectURL(blob);
			revokeUrl = url;
			const img = new Image();
			img.onload = () => {
				if (cancelled) return;
				exifr
					.parse(blob, { translateValues: true })
					.then((exif) => {
						if (cancelled) return;
						setImagePreview({
							url,
							width: img.naturalWidth,
							height: img.naturalHeight,
							exif: (exif as Record<string, unknown> | null) ?? null,
						});
					})
					.catch(() => {
						if (cancelled) return;
						setImagePreview({
							url,
							width: img.naturalWidth,
							height: img.naturalHeight,
							exif: null,
						});
					});
			};
			img.onerror = () => {
				if (cancelled) return;
				setImagePreview(null);
			};
			img.src = url;
		} else if (isAudioMime(detectedMime)) {
			const AudioCtor =
				globalThis.AudioContext ??
				(globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (AudioCtor) {
				const ctx = new AudioCtor();
				ctx
					.decodeAudioData(bytes.slice().buffer as ArrayBuffer)
					.then((decoded) => {
						if (cancelled) return;
						setAudioInfo({
							duration: decoded.duration,
							sampleRate: decoded.sampleRate,
							channels: decoded.numberOfChannels,
						});
					})
					.catch(() => {
						if (cancelled) return;
						setAudioInfo(null);
					})
					.finally(() => {
						ctx.close().catch(() => undefined);
					});
			}
		}

		return () => {
			cancelled = true;
			if (revokeUrl) URL.revokeObjectURL(revokeUrl);
		};
	}, [bytes, detectedMime, result]);

	const hexRows = useMemo(() => {
		if (!headBytes) return [];
		return formatHexPreview(headBytes, prefs.hexPreviewRows);
	}, [headBytes, prefs.hexPreviewRows]);

	const textPreview = useMemo(() => {
		if (!headBytes) return '';
		if (!isTextLikeMime(detectedMime)) return '';
		return decodeTextPreview(headBytes, prefs.textPreviewChars);
	}, [headBytes, detectedMime, prefs.textPreviewChars]);

	const handleRevealInFinder = useCallback(async () => {
		if (!result) return;
		try {
			const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
			await revealItemInDir(result.path);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to reveal in Finder', { description: message });
		}
	}, [result]);

	const handleCopyAsJson = useCallback(async () => {
		if (!result) return;
		const payload = {
			path: result.path,
			filename: result.filename,
			extension: result.extension,
			sizeBytes: result.sizeBytes,
			sizeHuman: humanSize(result.sizeBytes),
			createdMs: result.createdMs,
			modifiedMs: result.modifiedMs,
			accessedMs: result.accessedMs,
			permissionsOctal: result.permissionsOctal,
			permissionsString: result.permissionsString,
			readonly: result.readonly,
			detectedMime,
			magicBytes: mimeInfo?.matchedBytes ?? null,
			expectedMimeFromExtension: mimeInfo?.expectedFromExtension ?? null,
			hashes,
			image: imagePreview
				? { width: imagePreview.width, height: imagePreview.height, exif: imagePreview.exif }
				: null,
			audio: audioInfo,
		};
		try {
			await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
			toast.success('Metadata copied to clipboard');
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to copy to clipboard', { description: message });
		}
	}, [audioInfo, detectedMime, hashes, imagePreview, mimeInfo, result]);

	const hasResult = result !== null;

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			valid={hasResult ? true : null}
			error={error ?? undefined}
			statusContent={
				hasResult && result ? (
					<>
						<StatItem label="Size" value={humanSize(result.sizeBytes)} />
						<StatItem label="MIME" value={detectedMime ?? '—'} />
						<StatItem
							label="Modified"
							value={result.modifiedMs ? new Date(result.modifiedMs).toLocaleDateString() : '—'}
						/>
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Open">
						<div className="flex flex-col gap-2">
							<Button variant="default" size="sm" onClick={handlePickFile} disabled={loading}>
								<FolderOpen className="h-3.5 w-3.5" />
								{hasResult ? 'Choose another' : 'Open file…'}
							</Button>
							{loading ? (
								<Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
									<Square className="h-3.5 w-3.5" />
									{cancelling ? 'Cancelling…' : 'Cancel'}
								</Button>
							) : null}
							{hasResult ? (
								<Button variant="outline" size="sm" onClick={handleClear}>
									<Trash2 className="h-3.5 w-3.5" />
									Clear
								</Button>
							) : null}
						</div>
					</FormSection>

					<FormSection title="Hashes">
						<FormCheckboxGroup>
							{ALL_HASH_ALGOS.map((algo) => (
								<FormCheckbox
									key={algo}
									label={HASH_ALGO_LABELS[algo]}
									checked={prefs.enabledHashes.includes(algo)}
									onCheckedChange={(checked) => {
										const next = new Set(prefs.enabledHashes);
										if (checked) next.add(algo);
										else next.delete(algo);
										patch({ enabledHashes: Array.from(next) });
									}}
									size="compact"
								/>
							))}
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Display">
						<FormSlider
							label="Hex preview rows"
							value={prefs.hexPreviewRows}
							min={4}
							max={32}
							step={2}
							onValueChange={(v) => patch({ hexPreviewRows: v })}
						/>
						<FormSlider
							label="Text preview chars"
							value={prefs.textPreviewChars}
							min={256}
							max={8192}
							step={256}
							onValueChange={(v) => patch({ textPreviewChars: v })}
						/>
					</FormSection>

					<FormSection title="Actions">
						<div className="flex flex-col gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleRevealInFinder}
								disabled={!hasResult}
							>
								<FolderOpen className="h-3.5 w-3.5" />
								Reveal in Finder
							</Button>
							<Button variant="outline" size="sm" onClick={handleCopyAsJson} disabled={!hasResult}>
								<ClipboardCopy className="h-3.5 w-3.5" />
								Copy as JSON
							</Button>
						</div>
					</FormSection>

					<ToolFooter
						relatedItems={[
							{ id: 'mime-types', reason: "Look up an extension's MIME" },
							{ id: 'hash-generator', reason: 'Hash arbitrary text' },
							{ id: 'x509-decoder', reason: "Decode if it's a cert" },
							{ id: 'hex-editor', reason: 'View raw bytes' },
						]}
						aboutText={
							<>
								Pure local inspection. No upload. Magic-byte detection uses the MIME Type Explorer
								catalog. Files larger than 500 MB fall back to head-only hashing.
							</>
						}
					/>
				</>
			}
		>
			{hasResult ? (
				<ResultView
					result={result}
					headBytes={headBytes}
					detectedMime={detectedMime}
					mimeInfo={mimeInfo}
					mimeMismatch={mimeMismatch}
					hashes={hashes}
					hashing={hashing}
					enabledHashes={prefs.enabledHashes}
					hexRows={hexRows}
					textPreview={textPreview}
					imagePreview={imagePreview}
					audioInfo={audioInfo}
					onCopyJson={handleCopyAsJson}
					onReveal={handleRevealInFinder}
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
					title="Open a file to inspect"
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

interface ResultViewProps {
	readonly result: FileInspectResult;
	readonly headBytes: Uint8Array | null;
	readonly detectedMime: string | null;
	readonly mimeInfo: {
		readonly matchedBytes: string | null;
		readonly expectedFromExtension: string | null;
	} | null;
	readonly mimeMismatch: boolean;
	readonly hashes: Partial<Record<HashAlgo, string>>;
	readonly hashing: ReadonlySet<HashAlgo>;
	readonly enabledHashes: readonly HashAlgo[];
	readonly hexRows: readonly {
		readonly offset: number;
		readonly hex: string;
		readonly ascii: string;
	}[];
	readonly textPreview: string;
	readonly imagePreview: ImagePreview | null;
	readonly audioInfo: {
		readonly duration: number;
		readonly sampleRate: number;
		readonly channels: number;
	} | null;
	readonly onCopyJson: () => void;
	readonly onReveal: () => void;
}

function ResultView({
	result,
	headBytes,
	detectedMime,
	mimeInfo,
	mimeMismatch,
	hashes,
	hashing,
	enabledHashes,
	hexRows,
	textPreview,
	imagePreview,
	audioInfo,
	onCopyJson,
	onReveal,
}: ResultViewProps) {
	const isLargeFile = result.sizeBytes > MAX_FULL_BYTES;

	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex-1 overflow-auto p-4">
				<div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
					<GeneralCard result={result} />
					<TypeCard
						detectedMime={detectedMime}
						matchedBytes={mimeInfo?.matchedBytes ?? null}
						expectedFromExtension={mimeInfo?.expectedFromExtension ?? null}
						mismatch={mimeMismatch}
					/>
					<HashesCard
						hashes={hashes}
						hashing={hashing}
						enabledHashes={enabledHashes}
						isLarge={isLargeFile}
					/>
					<HexPreviewCard rows={hexRows} headBytes={headBytes} />
					{imagePreview ? <ImagePreviewCard preview={imagePreview} /> : null}
					{audioInfo ? <AudioInfoCard info={audioInfo} /> : null}
					{textPreview ? <TextPreviewCard text={textPreview} /> : null}
				</div>
			</div>

			<div className="flex shrink-0 items-center justify-end gap-2 border-t bg-surface-2 px-4 py-2">
				<Button variant="outline" size="sm" onClick={onReveal}>
					<FolderOpen className="h-3.5 w-3.5" />
					Reveal in Finder
				</Button>
				<Button variant="outline" size="sm" onClick={onCopyJson}>
					<ClipboardCopy className="h-3.5 w-3.5" />
					Copy as JSON
				</Button>
			</div>
		</div>
	);
}

interface FieldRowProps {
	readonly label: string;
	readonly value: string;
	readonly mono?: boolean;
	readonly copyable?: boolean;
	readonly copyLabel?: string;
}

function FieldRow({ label, value, mono = false, copyable = false, copyLabel }: FieldRowProps) {
	return (
		<div className="flex items-start gap-2 text-xs">
			<span className="w-28 shrink-0 text-muted-foreground">{label}</span>
			<span className={cn('min-w-0 flex-1 break-all', mono && 'font-mono')}>{value}</span>
			{copyable ? <CopyButton text={value} toastLabel={copyLabel ?? label} size="sm" /> : null}
		</div>
	);
}

function GeneralCard({ result }: { readonly result: FileInspectResult }) {
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="text-sm">General</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1.5">
				<FieldRow label="Filename" value={result.filename} mono copyable copyLabel="Filename" />
				<FieldRow label="Path" value={result.path} mono copyable copyLabel="Path" />
				<FieldRow label="Extension" value={result.extension || '(none)'} mono />
				<FieldRow
					label="Size"
					value={`${humanSize(result.sizeBytes)} (${result.sizeBytes.toLocaleString()} B)`}
				/>
				<FieldRow label="Created" value={formatTimestamp(result.createdMs)} />
				<FieldRow label="Modified" value={formatTimestamp(result.modifiedMs)} />
				<FieldRow label="Accessed" value={formatTimestamp(result.accessedMs)} />
				{result.permissionsString ? (
					<FieldRow
						label="Permissions"
						value={`${result.permissionsString} (${result.permissionsOctal ?? '—'})`}
						mono
					/>
				) : null}
				{result.readonly ? (
					<div className="pt-1">
						<Badge variant="outline" className="font-mono text-2xs">
							Read only
						</Badge>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

interface TypeCardProps {
	readonly detectedMime: string | null;
	readonly matchedBytes: string | null;
	readonly expectedFromExtension: string | null;
	readonly mismatch: boolean;
}

function TypeCard({ detectedMime, matchedBytes, expectedFromExtension, mismatch }: TypeCardProps) {
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm">
					<ScanLine className="h-4 w-4 text-muted-foreground" />
					Type
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1.5">
				<FieldRow
					label="Detected"
					value={detectedMime ?? '(unknown)'}
					mono
					copyable={!!detectedMime}
					copyLabel="MIME"
				/>
				{matchedBytes ? (
					<FieldRow label="Magic" value={matchedBytes} mono />
				) : (
					<FieldRow label="Magic" value="(no match in catalog)" />
				)}
				<FieldRow label="From extension" value={expectedFromExtension ?? '(unknown)'} mono />
				{mismatch ? (
					<div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-2xs text-warning">
						<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						<span>
							Magic-byte MIME differs from the extension-implied MIME. The file may have been
							renamed or its extension is misleading.
						</span>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

interface HashesCardProps {
	readonly hashes: Partial<Record<HashAlgo, string>>;
	readonly hashing: ReadonlySet<HashAlgo>;
	readonly enabledHashes: readonly HashAlgo[];
	readonly isLarge: boolean;
}

function HashesCard({ hashes, hashing, enabledHashes, isLarge }: HashesCardProps) {
	if (enabledHashes.length === 0) {
		return (
			<Card density="compact">
				<CardHeader>
					<CardTitle className="text-sm">Hashes</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-2xs text-muted-foreground">
						Enable at least one algorithm in the rail.
					</p>
				</CardContent>
			</Card>
		);
	}
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="text-sm">Hashes</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{isLarge ? (
					<div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-2xs text-warning">
						<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						<span>File larger than 500 MB. Hashing is unavailable for the full content.</span>
					</div>
				) : null}
				{enabledHashes.map((algo) => {
					const hash = hashes[algo];
					const pending = hashing.has(algo);
					const secure = HASH_ALGO_SECURE[algo];
					return (
						<div key={algo} className="flex items-start gap-2 text-xs">
							<span className="flex w-20 shrink-0 items-center gap-1.5 font-mono text-muted-foreground">
								{HASH_ALGO_LABELS[algo]}
								{secure ? (
									<ShieldCheck className="h-3 w-3 text-success" />
								) : (
									<ShieldAlert className="h-3 w-3 text-warning" />
								)}
							</span>
							<code className="min-w-0 flex-1 break-all font-mono text-2xs">
								{hash ? hash : pending ? 'Computing…' : isLarge ? '—' : 'Pending…'}
							</code>
							{hash ? (
								<CopyButton text={hash} toastLabel={`${HASH_ALGO_LABELS[algo]} hash`} size="sm" />
							) : pending ? (
								<Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
							) : null}
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}

interface HexPreviewCardProps {
	readonly rows: readonly {
		readonly offset: number;
		readonly hex: string;
		readonly ascii: string;
	}[];
	readonly headBytes: Uint8Array | null;
}

function HexPreviewCard({ rows, headBytes }: HexPreviewCardProps) {
	if (!headBytes || headBytes.length === 0) return null;
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="text-sm">Hex preview</CardTitle>
			</CardHeader>
			<CardContent>
				<pre className="overflow-auto rounded-md border bg-muted p-2 font-mono text-2xs">
					{rows
						.map(
							(row) =>
								`${row.offset.toString(16).padStart(8, '0')}  ${row.hex.padEnd(16 * 3 - 1, ' ')}  ${row.ascii}`
						)
						.join('\n')}
				</pre>
			</CardContent>
		</Card>
	);
}

function TextPreviewCard({ text }: { readonly text: string }) {
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="text-sm">Text preview</CardTitle>
			</CardHeader>
			<CardContent>
				<pre className="max-h-64 overflow-auto rounded-md border bg-muted p-2 font-mono text-2xs">
					{text || '(empty)'}
				</pre>
			</CardContent>
		</Card>
	);
}

function ImagePreviewCard({ preview }: { readonly preview: ImagePreview }) {
	const exifEntries = preview.exif
		? Object.entries(preview.exif).filter(([, v]) => v !== undefined && v !== null && v !== '')
		: [];
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm">
					<ImageIcon className="h-4 w-4 text-muted-foreground" />
					Image preview
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				<div className="flex justify-center">
					<img
						src={preview.url}
						alt="File preview"
						className="max-h-64 max-w-full rounded-md border bg-muted object-contain"
					/>
				</div>
				<DefinitionList
					keyColumn="100px"
					items={[{ key: 'Dimensions', value: `${preview.width} × ${preview.height}` }]}
				/>
				{exifEntries.length > 0 ? (
					<div>
						<SectionLabel>EXIF ({exifEntries.length})</SectionLabel>
						<DefinitionList
							keyColumn="140px"
							size="2xs"
							items={exifEntries.slice(0, 32).map(([k, v]) => ({
								key: k,
								value: stringifyExifValue(v),
								break: true,
							}))}
						/>
						{exifEntries.length > 32 ? (
							<p className="mt-1 text-2xs text-muted-foreground">
								Showing first 32 fields of {exifEntries.length}.
							</p>
						) : null}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

function stringifyExifValue(value: unknown): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return String(value);
	if (value instanceof Date) return value.toISOString();
	return JSON.stringify(value);
}

interface AudioInfo {
	readonly duration: number;
	readonly sampleRate: number;
	readonly channels: number;
}

function AudioInfoCard({ info }: { readonly info: AudioInfo }) {
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="text-sm">Audio</CardTitle>
			</CardHeader>
			<CardContent>
				<DefinitionList
					keyColumn="100px"
					items={[
						{ key: 'Duration', value: `${info.duration.toFixed(2)} s` },
						{ key: 'Sample rate', value: `${info.sampleRate.toLocaleString()} Hz` },
						{ key: 'Channels', value: String(info.channels) },
					]}
				/>
			</CardContent>
		</Card>
	);
}
