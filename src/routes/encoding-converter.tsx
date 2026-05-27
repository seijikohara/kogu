import { createFileRoute } from '@tanstack/react-router';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { ClipboardCopy, FolderOpen, Languages, Loader2, Save, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';

import {
	FormInfo,
	FormMode,
	FormSection,
	FormSelect,
	type SelectOption,
} from '@/lib/components/form';
import { RelatedTools } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { useDocumentTitle } from '@/lib/hooks';
import {
	applyBomAction,
	bytesToBase64,
	decodeBytes,
	detectEncoding,
	encodeText,
	ENCODING_META,
	formatHexDump,
	getEncodingMeta,
	getMojibakeCandidates,
	humanBytes,
	isWritableEncoding,
	SAMPLE_BYTES_SJIS,
	SAMPLE_BYTES_UTF8,
	type BomAction,
	type DetectedEncoding,
	type Encoding,
	type LineEnding,
} from '@/lib/services/encoding-converter';
import { createToolOptionsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface EncodingConverterPrefs {
	readonly targetEncoding: Encoding;
	readonly lineEnding: LineEnding;
	readonly bomAction: BomAction;
}

const DEFAULT_PREFS: EncodingConverterPrefs = {
	targetEncoding: 'utf-8',
	lineEnding: 'keep',
	bomAction: 'keep',
};

const useEncodingConverterPrefs = createToolOptionsStore<EncodingConverterPrefs>(
	'encoding-converter',
	DEFAULT_PREFS
);

const ENCODING_SELECT_OPTIONS: readonly SelectOption[] = ENCODING_META.map((meta) => ({
	value: meta.id,
	label: meta.writable ? meta.label : `${meta.label} (read-only)`,
	disabled: false,
}));

const REINTERPRET_SELECT_OPTIONS: readonly SelectOption[] = ENCODING_META.map((meta) => ({
	value: meta.id,
	label: meta.label,
}));

const LINE_ENDING_OPTIONS = [
	{ value: 'keep' as const, label: 'Keep' },
	{ value: 'lf' as const, label: 'LF' },
	{ value: 'crlf' as const, label: 'CRLF' },
	{ value: 'cr' as const, label: 'CR' },
];

const BOM_ACTION_OPTIONS = [
	{ value: 'keep' as const, label: 'Keep' },
	{ value: 'add' as const, label: 'Add' },
	{ value: 'remove' as const, label: 'Remove' },
];

export const Route = createFileRoute('/encoding-converter')({
	component: EncodingConverterPage,
});

function EncodingConverterPage() {
	useDocumentTitle('Encoding Converter');

	const { value: prefs, patch } = useEncodingConverterPrefs();

	const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null);
	const [sourceName, setSourceName] = useState<string | null>(null);
	const [overrideEncoding, setOverrideEncoding] = useState<Encoding | null>(null);
	const [loading, setLoading] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);
	const [showRail, setShowRail] = useState(true);

	const detected = useMemo<DetectedEncoding | null>(() => {
		if (!sourceBytes) return null;
		return detectEncoding(sourceBytes);
	}, [sourceBytes]);

	const effectiveSourceEncoding = overrideEncoding ?? detected?.encoding ?? 'utf-8';

	const decodedText = useMemo<string | null>(() => {
		if (!sourceBytes) return null;
		return decodeBytes(sourceBytes, effectiveSourceEncoding);
	}, [sourceBytes, effectiveSourceEncoding]);

	const targetBytes = useMemo<Uint8Array | null>(() => {
		if (decodedText === null) return null;
		const encoded = encodeText(decodedText, prefs.targetEncoding, prefs.lineEnding);
		return applyBomAction(encoded, prefs.targetEncoding, prefs.bomAction);
	}, [decodedText, prefs.targetEncoding, prefs.lineEnding, prefs.bomAction]);

	const targetText = useMemo<string | null>(() => {
		if (!targetBytes) return null;
		return decodeBytes(targetBytes, prefs.targetEncoding);
	}, [targetBytes, prefs.targetEncoding]);

	const hasContent = sourceBytes !== null;
	const targetWritable = isWritableEncoding(prefs.targetEncoding);

	const handleClear = useCallback(() => {
		setSourceBytes(null);
		setSourceName(null);
		setOverrideEncoding(null);
	}, []);

	const loadBytesFromPath = useCallback(async (path: string) => {
		setLoading(true);
		try {
			const bytes = await readFile(path);
			setSourceBytes(bytes);
			setSourceName(path.split(/[\\/]/).pop() ?? path);
			setOverrideEncoding(null);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to read file', { description: message });
		} finally {
			setLoading(false);
		}
	}, []);

	const loadSampleUtf8 = () => {
		setSourceBytes(new Uint8Array(SAMPLE_BYTES_UTF8));
		setSourceName('sample.utf8.txt');
		setOverrideEncoding(null);
	};

	const loadSampleSjis = () => {
		setSourceBytes(new Uint8Array(SAMPLE_BYTES_SJIS));
		setSourceName('sample.sjis.txt');
		setOverrideEncoding(null);
	};

	const handlePickFile = async () => {
		try {
			const selected = await openDialog({ multiple: false, directory: false });
			if (typeof selected === 'string' && selected.length > 0) {
				await loadBytesFromPath(selected);
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
			loadBytesFromPath(dropped.path).catch(() => undefined);
			return;
		}
		// Fall back to in-memory read when running outside Tauri (e.g. dev preview).
		dropped
			.arrayBuffer()
			.then((buf) => {
				setSourceBytes(new Uint8Array(buf));
				setSourceName(dropped.name);
				setOverrideEncoding(null);
			})
			.catch((err: unknown) => {
				const message = err instanceof Error ? err.message : String(err);
				toast.error('Failed to read file', { description: message });
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

	const handleCopyBase64 = async () => {
		if (!targetBytes) return;
		try {
			await navigator.clipboard.writeText(bytesToBase64(targetBytes));
			toast.success('Copied base64 to clipboard');
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to copy', { description: message });
		}
	};

	const handleSave = async () => {
		if (!targetBytes) return;
		try {
			const defaultName = sourceName
				? `${sourceName.replace(/(\.[^./\\]+)?$/, '')}.converted.txt`
				: 'converted.txt';
			const selected = await saveDialog({ defaultPath: defaultName });
			if (typeof selected !== 'string' || selected.length === 0) return;
			await writeFile(selected, targetBytes);
			toast.success('File saved', { description: `${targetBytes.length} bytes written` });
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to save file', { description: message });
		}
	};

	const cycleReinterpret = () => {
		if (!detected) return;
		const candidates = getMojibakeCandidates(effectiveSourceEncoding);
		const next = candidates[0];
		if (next) setOverrideEncoding(next);
	};

	const sizeIn = sourceBytes?.length ?? 0;
	const sizeOut = targetBytes?.length ?? 0;
	const sizeDelta = sizeOut - sizeIn;

	const detectedLabel = detected ? getEncodingMeta(detected.encoding).label : '—';
	const overrideLabel = overrideEncoding ? getEncodingMeta(overrideEncoding).label : null;
	const targetLabel = getEncodingMeta(prefs.targetEncoding).label;

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			valid={hasContent ? true : null}
			statusContent={
				hasContent ? (
					<>
						<StatItem label="Detected" value={detectedLabel} />
						<StatItem label="Size in" value={humanBytes(sizeIn)} />
						<StatItem label="Size out" value={humanBytes(sizeOut)} />
						<StatItem
							label="Δ"
							value={`${sizeDelta >= 0 ? '+' : ''}${sizeDelta} B`}
							variant={sizeDelta === 0 ? 'default' : sizeDelta > 0 ? 'warning' : 'success'}
						/>
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Input">
						<div className="flex flex-col gap-2">
							<Button variant="default" size="sm" onClick={handlePickFile} disabled={loading}>
								<FolderOpen className="h-3.5 w-3.5" />
								{hasContent ? 'Choose another' : 'Open file…'}
							</Button>
							<div className="grid grid-cols-2 gap-1.5">
								<Button variant="outline" size="sm" onClick={loadSampleUtf8}>
									Sample UTF-8
								</Button>
								<Button variant="outline" size="sm" onClick={loadSampleSjis}>
									Sample SJIS
								</Button>
							</div>
							{hasContent ? (
								<Button variant="outline" size="sm" onClick={handleClear}>
									<Trash2 className="h-3.5 w-3.5" />
									Clear
								</Button>
							) : null}
						</div>
					</FormSection>

					{hasContent && detected ? (
						<FormSection title="Detected">
							<DetectedSummary
								detected={detected}
								overrideLabel={overrideLabel}
								filename={sourceName}
							/>
						</FormSection>
					) : null}

					{hasContent ? (
						<FormSection title="Re-interpret as">
							<FormSelect
								label="Source encoding"
								value={effectiveSourceEncoding}
								options={REINTERPRET_SELECT_OPTIONS}
								onValueChange={(v) => setOverrideEncoding(v as Encoding)}
								size="compact"
							/>
							<Button variant="outline" size="sm" onClick={cycleReinterpret} disabled={!detected}>
								Try next likely candidate
							</Button>
							<FormInfo>
								Use when the source pane shows mojibake. Each click rotates through plausible
								encodings ordered by likelihood for the current pick.
							</FormInfo>
						</FormSection>
					) : null}

					<FormSection title="Target">
						<FormSelect
							label="Encoding"
							value={prefs.targetEncoding}
							options={ENCODING_SELECT_OPTIONS}
							onValueChange={(v) => patch({ targetEncoding: v as Encoding })}
							size="compact"
						/>
						<FormMode<LineEnding>
							label="Line ending"
							layout="stacked"
							value={prefs.lineEnding}
							options={LINE_ENDING_OPTIONS}
							onValueChange={(v) => patch({ lineEnding: v })}
						/>
						<FormMode<BomAction>
							label="Byte order mark"
							layout="stacked"
							value={prefs.bomAction}
							options={BOM_ACTION_OPTIONS}
							onValueChange={(v) => patch({ bomAction: v })}
						/>
						{!targetWritable ? (
							<FormInfo>
								{`${targetLabel} write is best-effort. ASCII characters are preserved verbatim; characters outside the code page are replaced with "?".`}
							</FormInfo>
						) : null}
					</FormSection>

					<FormSection title="Save">
						<div className="flex flex-col gap-2">
							<Button
								variant="default"
								size="sm"
								onClick={handleSave}
								disabled={!hasContent || !targetBytes}
							>
								<Save className="h-3.5 w-3.5" />
								Save bytes…
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleCopyBase64}
								disabled={!hasContent || !targetBytes}
							>
								<ClipboardCopy className="h-3.5 w-3.5" />
								Copy as base64
							</Button>
						</div>
					</FormSection>

					<FormSection title="Related">
						<RelatedTools
							items={[
								{ id: 'file-inspector', reason: 'Inspect file metadata and MIME' },
								{ id: 'hex-editor', reason: 'Edit raw bytes side-by-side' },
							]}
						/>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							Detection sniffs BOM first, then attempts strict UTF-8, then runs the jschardet
							heuristic. Shift-JIS, EUC-JP, GBK, and Big5 are read via the platform decoder; their
							encoders fall back to ASCII-safe placeholders for unmappable characters.
						</FormInfo>
					</FormSection>
				</>
			}
		>
			{hasContent && sourceBytes && decodedText !== null && targetBytes && targetText !== null ? (
				<ConversionView
					sourceBytes={sourceBytes}
					targetBytes={targetBytes}
					sourceText={decodedText}
					targetText={targetText}
					sourceEncodingLabel={overrideLabel ? `${overrideLabel} (overridden)` : detectedLabel}
					targetEncodingLabel={targetLabel}
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
					icon={Languages}
					title="Open a text file"
					description="Drop a text file here or click to browse. Sample buttons load a known UTF-8 / Shift-JIS payload."
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

interface DetectedSummaryProps {
	readonly detected: DetectedEncoding;
	readonly overrideLabel: string | null;
	readonly filename: string | null;
}

function DetectedSummary({ detected, overrideLabel, filename }: DetectedSummaryProps) {
	const confidencePct = Math.round(detected.confidence * 100);
	const { lf, crlf, cr } = detected.lineEndings;
	const total = lf + crlf + cr;
	const mixed = [lf > 0, crlf > 0, cr > 0].filter(Boolean).length > 1;

	return (
		<div className="space-y-2">
			{filename ? (
				<div className="truncate font-mono text-xs text-muted-foreground">{filename}</div>
			) : null}
			<div className="flex flex-wrap gap-1.5">
				<Badge variant="outline" className="font-mono text-2xs">
					{getEncodingMeta(detected.encoding).label}
				</Badge>
				<Badge variant="outline" className="font-mono text-2xs">
					{confidencePct}% conf.
				</Badge>
				{detected.hasBom ? (
					<Badge variant="outline" className="border-info/40 text-info text-2xs">
						BOM
					</Badge>
				) : null}
				{overrideLabel ? (
					<Badge variant="outline" className="border-warning/40 text-warning text-2xs">
						Overridden
					</Badge>
				) : null}
			</div>
			<div className="flex flex-wrap gap-1.5">
				<Badge
					variant="outline"
					className={cn('font-mono text-2xs', mixed && 'border-warning/40 text-warning')}
				>
					LF {lf}
				</Badge>
				<Badge
					variant="outline"
					className={cn('font-mono text-2xs', mixed && 'border-warning/40 text-warning')}
				>
					CRLF {crlf}
				</Badge>
				<Badge
					variant="outline"
					className={cn('font-mono text-2xs', mixed && 'border-warning/40 text-warning')}
				>
					CR {cr}
				</Badge>
				{total === 0 ? (
					<Badge variant="outline" className="font-mono text-2xs">
						No line breaks
					</Badge>
				) : null}
			</div>
		</div>
	);
}

interface ConversionViewProps {
	readonly sourceBytes: Uint8Array;
	readonly targetBytes: Uint8Array;
	readonly sourceText: string;
	readonly targetText: string;
	readonly sourceEncodingLabel: string;
	readonly targetEncodingLabel: string;
}

function ConversionView({
	sourceBytes,
	targetBytes,
	sourceText,
	targetText,
	sourceEncodingLabel,
	targetEncodingLabel,
}: ConversionViewProps) {
	return (
		<div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-2">
			<TextPane
				title="Source"
				subtitle={sourceEncodingLabel}
				text={sourceText}
				bytes={sourceBytes}
			/>
			<TextPane
				title="Target"
				subtitle={targetEncodingLabel}
				text={targetText}
				bytes={targetBytes}
			/>
		</div>
	);
}

interface TextPaneProps {
	readonly title: string;
	readonly subtitle: string;
	readonly text: string;
	readonly bytes: Uint8Array;
}

function TextPane({ title, subtitle, text, bytes }: TextPaneProps) {
	const hexDump = useMemo(() => formatHexDump(bytes), [bytes]);
	return (
		<Card density="compact" className="flex min-h-0 flex-col gap-2">
			<CardHeader>
				<CardTitle className="flex items-center justify-between gap-2 text-sm">
					<span>{title}</span>
					<Badge variant="outline" className="font-mono text-2xs">
						{subtitle}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex min-h-0 flex-1 flex-col gap-2">
				<div className="rounded-md border bg-background">
					<textarea
						readOnly
						value={text}
						spellCheck={false}
						className="h-64 w-full resize-none rounded-md bg-transparent px-2.5 py-2 font-mono text-xs outline-none"
					/>
				</div>
				<div className="overflow-hidden rounded-md border bg-surface-2">
					<pre className="max-h-48 overflow-auto p-2 font-mono text-2xs leading-snug text-muted-foreground">
						{hexDump}
					</pre>
				</div>
			</CardContent>
		</Card>
	);
}
