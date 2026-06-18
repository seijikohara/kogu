import { createFileRoute } from '@tanstack/react-router';
import { Download, RotateCw, Sparkles, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { toast } from 'sonner';

import { ActionButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormInput,
	FormSection,
	FormSlider,
} from '@/lib/components/form';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, ErrorDisplay, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import { useDocumentTitle } from '@/lib/hooks';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import {
	ALL_FORMATS,
	buildOutputFilename,
	convertMany,
	FORMAT_LABEL,
	FORMAT_SUPPORTS_QUALITY,
	generateDemoImage,
	humanBytes,
	type ImageFormat,
	loadSource,
	type MultiConvertOutcome,
	RESIZE_PRESETS,
	type RotationDeg,
	type SourceImage,
	triggerDownload,
} from '@/lib/services/image-convert';
import { cn } from '@/lib/utils';

interface ImageConverterPrefs {
	readonly targets: readonly ImageFormat[];
	readonly quality: number;
	readonly backgroundFill: string;
	readonly stripExif: boolean;
	readonly lockAspect: boolean;
}

const DEFAULT_PREFS: ImageConverterPrefs = {
	targets: ['png', 'jpeg', 'webp'],
	quality: 80,
	backgroundFill: '#ffffff',
	stripExif: true,
	lockAspect: true,
};

const useImageConverterPrefs = createToolOptionsStore<ImageConverterPrefs>(
	'image-converter',
	DEFAULT_PREFS
);

const ROTATIONS: readonly RotationDeg[] = [0, 90, 180, 270];

const nextRotation = (current: RotationDeg, delta: 90 | 180 | 270): RotationDeg => {
	const idx = ROTATIONS.indexOf(current);
	const stepIdx = ROTATIONS.indexOf(delta as RotationDeg);
	return ROTATIONS[(idx + stepIdx) % 4] ?? 0;
};

export const Route = createFileRoute('/image-converter')({
	component: ImageConverterPage,
});

function ImageConverterPage() {
	useDocumentTitle('Image Converter');

	const { value: prefs, patch } = useImageConverterPrefs();

	const [source, setSource] = useState<SourceImage | null>(null);
	const [sourceUrl, setSourceUrl] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);
	const [width, setWidth] = useState(0);
	const [height, setHeight] = useState(0);
	const [rotation, setRotation] = useState<RotationDeg>(0);
	const [flipH, setFlipH] = useState(false);
	const [flipV, setFlipV] = useState(false);
	const [results, setResults] = useState<readonly MultiConvertOutcome[]>([]);
	const [activeFormat, setActiveFormat] = useState<ImageFormat | null>(null);
	const [converting, setConverting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showRail, setShowRail] = usePersistedRail('image-converter');

	const fileInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (!source) return;
		setWidth(source.width);
		setHeight(source.height);
		setRotation(0);
		setFlipH(false);
		setFlipV(false);
	}, [source]);

	useEffect(() => {
		return () => {
			results.forEach((r) => {
				if (r.ok) URL.revokeObjectURL(r.converted.url);
			});
		};
	}, [results]);

	useEffect(() => {
		if (!source) {
			setSourceUrl(null);
			return;
		}
		const url = URL.createObjectURL(source.blob);
		setSourceUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [source]);

	const aspect = source ? source.width / source.height : 1;

	const updateWidth = (next: number) => {
		const clamped = Math.max(1, Math.min(10000, Math.round(next)));
		setWidth(clamped);
		if (prefs.lockAspect && aspect > 0) setHeight(Math.max(1, Math.round(clamped / aspect)));
	};

	const updateHeight = (next: number) => {
		const clamped = Math.max(1, Math.min(10000, Math.round(next)));
		setHeight(clamped);
		if (prefs.lockAspect && aspect > 0) setWidth(Math.max(1, Math.round(clamped * aspect)));
	};

	const acceptFile = async (file: File) => {
		setError(null);
		try {
			const next = await loadSource(file);
			setSource(next);
			setResults([]);
			setActiveFormat(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load image');
			toast.error('Failed to load image');
		}
	};

	const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) acceptFile(file).catch(() => undefined);
		e.target.value = '';
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setDragOver(false);
		const file = e.dataTransfer.files?.[0];
		if (file?.type.startsWith('image/')) acceptFile(file).catch(() => undefined);
		else if (file) toast.error('Only image files are supported');
	};

	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setDragOver(true);
	};

	const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setDragOver(false);
	};

	const handleLoadDemo = async () => {
		const demo = await generateDemoImage();
		await acceptFile(demo);
	};

	const handleConvert = async () => {
		if (!source || prefs.targets.length === 0) return;
		setConverting(true);
		setError(null);
		results.forEach((r) => {
			if (r.ok) URL.revokeObjectURL(r.converted.url);
		});
		try {
			const outcomes = await convertMany(source, prefs.targets, (format) => ({
				format,
				quality: prefs.quality,
				width,
				height,
				rotation,
				flip: { h: flipH, v: flipV },
				backgroundFill: prefs.backgroundFill,
			}));
			setResults(outcomes);
			const firstOk = outcomes.find((o): o is Extract<MultiConvertOutcome, { ok: true }> => o.ok);
			setActiveFormat(firstOk?.format ?? null);
			const failures = outcomes.filter((o) => !o.ok);
			if (failures.length > 0) {
				toast.warning(`Converted ${outcomes.length - failures.length}/${outcomes.length} formats`, {
					description: failures
						.map((f) => `${FORMAT_LABEL[f.format]}: ${f.ok ? '' : f.error}`)
						.join(', '),
				});
			} else {
				toast.success(`Converted ${outcomes.length} format${outcomes.length === 1 ? '' : 's'}`);
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Conversion failed');
			toast.error('Conversion failed');
		} finally {
			setConverting(false);
		}
	};

	const handleDownload = (outcome: MultiConvertOutcome) => {
		if (!outcome.ok || !source) return;
		triggerDownload(outcome.converted.blob, buildOutputFilename(source.filename, outcome.format));
	};

	const handleClearSource = () => {
		setSource(null);
		setResults([]);
		setActiveFormat(null);
		setError(null);
	};

	const toggleTarget = (format: ImageFormat, checked: boolean) => {
		const next = checked
			? [...new Set([...prefs.targets, format])]
			: prefs.targets.filter((f) => f !== format);
		patch({ targets: next as readonly ImageFormat[] });
	};

	const someTargetLossy = prefs.targets.some((f) => FORMAT_SUPPORTS_QUALITY[f]);
	const scalePercent = source && source.width > 0 ? Math.round((width / source.width) * 100) : 100;

	const bestRatio = useMemo(() => {
		if (!source || results.length === 0) return null;
		const okResults = results.filter((r): r is Extract<MultiConvertOutcome, { ok: true }> => r.ok);
		if (okResults.length === 0) return null;
		const smallest = okResults.reduce((acc, r) =>
			r.converted.bytes < acc.converted.bytes ? r : acc
		);
		return Math.round((smallest.converted.bytes / source.bytes) * 100);
	}, [results, source]);

	const okResults = useMemo(
		() => results.filter((r): r is Extract<MultiConvertOutcome, { ok: true }> => r.ok),
		[results]
	);

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			primaryAction={{
				run: () => handleConvert().catch(() => undefined),
				canRun: Boolean(source) && prefs.targets.length > 0 && !converting,
			}}
			statusContent={
				<>
					<StatItem label="Source" value={source ? `${source.width}×${source.height}` : '—'} />
					<StatItem label="Targets" value={prefs.targets.length} />
					<StatItem label="Best ratio" value={bestRatio !== null ? `${bestRatio}%` : '—'} />
				</>
			}
			rail={
				<>
					<FormSection title="Target Formats">
						<FormCheckboxGroup>
							{ALL_FORMATS.map((format) => {
								const isAvif = format === 'avif';
								return (
									<FormCheckbox
										key={format}
										label={FORMAT_LABEL[format] + (isAvif ? ' (coming soon)' : '')}
										checked={prefs.targets.includes(format)}
										onCheckedChange={(c) => toggleTarget(format, c)}
										disabled={isAvif}
										size="compact"
									/>
								);
							})}
						</FormCheckboxGroup>
					</FormSection>

					{someTargetLossy ? (
						<FormSection title="Quality">
							<FormSlider
								label="Lossy quality"
								value={prefs.quality}
								onValueChange={(v) => patch({ quality: v })}
								min={1}
								max={100}
								step={1}
								valueLabel={`${prefs.quality}%`}
								size="compact"
							/>
						</FormSection>
					) : null}

					<FormSection title="Resize">
						<FormCheckbox
							label="Lock aspect ratio"
							checked={prefs.lockAspect}
							onCheckedChange={(c) => patch({ lockAspect: c })}
							size="compact"
						/>
						{source ? (
							<>
								<div className="grid grid-cols-2 gap-2">
									<FormInput
										label="Width"
										value={String(width)}
										onValueChange={(v) => {
											const n = Number(v);
											if (!Number.isNaN(n)) updateWidth(n);
										}}
										size="compact"
									/>
									<FormInput
										label="Height"
										value={String(height)}
										onValueChange={(v) => {
											const n = Number(v);
											if (!Number.isNaN(n)) updateHeight(n);
										}}
										size="compact"
									/>
								</div>
								<FormSlider
									label="Scale"
									value={scalePercent}
									onValueChange={(v) => updateWidth(Math.round((source.width * v) / 100))}
									min={10}
									max={200}
									step={1}
									valueLabel={`${scalePercent}%`}
									size="compact"
								/>
							</>
						) : (
							<p className="text-xs text-muted-foreground">
								Drop an image to enable resize controls.
							</p>
						)}
						<div className="flex flex-wrap gap-1.5">
							{RESIZE_PRESETS.map((p) => (
								<Button
									key={p}
									type="button"
									variant="outline"
									size="sm"
									onClick={() => updateWidth(p)}
									disabled={!source}
								>
									{p}px
								</Button>
							))}
						</div>
					</FormSection>

					<FormSection title="Transform">
						<div className="flex flex-wrap gap-1.5">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setRotation(nextRotation(rotation, 90))}
								disabled={!source}
							>
								<RotateCw className="size-3.5" /> 90°
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setRotation(nextRotation(rotation, 180))}
								disabled={!source}
							>
								180°
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setRotation(nextRotation(rotation, 270))}
								disabled={!source}
							>
								270°
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setRotation(0)}
								disabled={!source}
							>
								Reset
							</Button>
						</div>
						<FormCheckbox
							label="Flip horizontal"
							checked={flipH}
							onCheckedChange={setFlipH}
							size="compact"
						/>
						<FormCheckbox
							label="Flip vertical"
							checked={flipV}
							onCheckedChange={setFlipV}
							size="compact"
						/>
					</FormSection>

					<FormSection title="JPEG Background">
						<label className="flex items-center gap-2 text-xs text-muted-foreground">
							<input
								type="color"
								value={prefs.backgroundFill}
								onChange={(e) => patch({ backgroundFill: e.target.value })}
								className="h-7 w-10 cursor-pointer rounded border border-border bg-background"
							/>
							<span className="font-mono">{prefs.backgroundFill}</span>
						</label>
						<FormInfo>
							Fills transparent pixels when the source has an alpha channel and the target is JPEG.
						</FormInfo>
					</FormSection>

					<FormSection title="Privacy">
						<FormCheckbox
							label="Strip EXIF metadata"
							checked={prefs.stripExif}
							onCheckedChange={(c) => patch({ stripExif: c })}
							hint="Canvas re-render already removes it"
							size="compact"
						/>
					</FormSection>

					<FormSection title="Actions">
						<div className="flex flex-col gap-2">
							<ActionButton
								label={converting ? 'Converting…' : 'Convert'}
								icon={Sparkles}
								disabled={!source || prefs.targets.length === 0 || converting}
								shortcutHint
								onClick={() => {
									handleConvert().catch(() => undefined);
								}}
							/>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									handleLoadDemo().catch(() => undefined);
								}}
								size="sm"
							>
								<Upload className="size-3.5" /> Load demo image
							</Button>
							{source ? (
								<Button type="button" variant="outline" onClick={handleClearSource} size="sm">
									<Trash2 className="size-3.5" /> Clear source
								</Button>
							) : null}
						</div>
					</FormSection>

					<ToolFooter
						aboutText={
							<>
								All processing happens in your browser. Nothing is uploaded. Canvas re-render strips
								EXIF metadata inherently.
							</>
						}
					/>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden p-4">
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					onChange={handleFileInput}
					className="hidden"
				/>
				{!source ? (
					<section
						aria-label="Image drop zone"
						className={cn(
							'flex h-full flex-1 items-center justify-center rounded-xl border-2 border-dashed transition-colors',
							dragOver ? 'border-primary bg-primary/5' : 'border-border bg-surface-1'
						)}
						onDrop={handleDrop}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
					>
						<div className="flex flex-col items-center gap-3 p-8">
							<EmbeddedEmptyState
								icon={Upload}
								title="Drop an image here"
								description="PNG, JPEG, WebP, or GIF (first frame). You can also use the file picker."
							/>
							<div className="flex gap-2">
								<Button type="button" onClick={() => fileInputRef.current?.click()} size="sm">
									Choose file
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										handleLoadDemo().catch(() => undefined);
									}}
									size="sm"
								>
									Load demo image
								</Button>
							</div>
						</div>
					</section>
				) : (
					<div className="flex flex-col gap-4 overflow-auto">
						{error ? <ErrorDisplay variant="banner" message={error} /> : null}
						<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
							<Card density="compact">
								<CardHeader>
									<CardTitle className="text-sm">Source</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="flex flex-col gap-2">
										{sourceUrl ? (
											<img
												src={sourceUrl}
												alt="Source"
												className="max-h-72 w-full rounded border border-border bg-surface-2 object-contain"
											/>
										) : null}
										<div className="flex flex-wrap gap-1.5">
											<Badge variant="outline">
												{source.mime.replace('image/', '').toUpperCase()}
											</Badge>
											<Badge variant="outline">
												{source.width}×{source.height}
											</Badge>
											<Badge variant="outline">{humanBytes(source.bytes)}</Badge>
										</div>
									</div>
								</CardContent>
							</Card>
							<Card density="compact">
								<CardHeader>
									<CardTitle className="text-sm">Converted</CardTitle>
								</CardHeader>
								<CardContent>
									{okResults.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											Configure targets and click <span className="font-medium">Convert</span> to
											generate previews.
										</p>
									) : (
										<Tabs
											value={activeFormat ?? okResults[0]?.format ?? 'png'}
											onValueChange={(v) => setActiveFormat(v as ImageFormat)}
										>
											<TabsList>
												{okResults.map((r) => (
													<TabsTrigger key={r.format} value={r.format}>
														{FORMAT_LABEL[r.format]}
													</TabsTrigger>
												))}
											</TabsList>
											{okResults.map((r) => {
												const deltaPct = Math.round((r.converted.bytes / source.bytes) * 100);
												return (
													<TabsContent key={r.format} value={r.format}>
														<div className="flex flex-col gap-2 pt-2">
															<img
																src={r.converted.url}
																alt={FORMAT_LABEL[r.format]}
																className="max-h-72 w-full rounded border border-border bg-surface-2 object-contain"
															/>
															<div className="flex flex-wrap items-center gap-2">
																<Badge variant="outline">
																	{r.converted.width}×{r.converted.height}
																</Badge>
																<Badge variant="outline">{humanBytes(r.converted.bytes)}</Badge>
																<Badge
																	variant="outline"
																	className={cn(
																		deltaPct < 100
																			? 'border-success/30 bg-success/10 text-success'
																			: 'border-warning/30 bg-warning/10 text-warning'
																	)}
																>
																	{deltaPct < 100 ? '−' : '+'}
																	{Math.abs(100 - deltaPct)}% vs source
																</Badge>
																<Button
																	type="button"
																	size="sm"
																	variant="outline"
																	onClick={() => handleDownload(r)}
																>
																	<Download className="size-3.5" /> Download
																</Button>
															</div>
														</div>
													</TabsContent>
												);
											})}
										</Tabs>
									)}
								</CardContent>
							</Card>
						</div>
						{results.some((r) => !r.ok) ? (
							<Card density="compact">
								<CardHeader>
									<CardTitle className="text-sm">Conversion errors</CardTitle>
								</CardHeader>
								<CardContent>
									<ul className="space-y-1 text-sm text-destructive">
										{results
											.filter((r) => !r.ok)
											.map((r) =>
												r.ok ? null : (
													<li key={r.format}>
														<span className="font-medium">{FORMAT_LABEL[r.format]}:</span> {r.error}
													</li>
												)
											)}
									</ul>
								</CardContent>
							</Card>
						) : null}
					</div>
				)}
			</div>
		</ToolShell>
	);
}
