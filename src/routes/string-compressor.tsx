import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { FileText, Terminal } from 'lucide-react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormError,
	FormMode,
	FormSection,
	FormSelect,
	FormSlider,
	FormTextarea,
} from '@/lib/components/form';
import { SplitPane } from '@/lib/components/layout';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Textarea } from '@/lib/components/ui/textarea';
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks';
import {
	type CompressionAlgorithm,
	type CompressResult,
	DEFAULT_LEVEL,
	LEVEL_RANGE,
	type OutputFormat,
	SAMPLE_TEXT,
	base64ToBytes,
	bytesToBase64,
	bytesToDataUri,
	bytesToHex,
	clampLevel,
	compressText,
	dataUriToBytes,
	decompressBytes,
	extractCurlDataRaw,
	hexToBytes,
} from '@/lib/services/compression';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import { cn, formatBytes } from '@/lib/utils';

type Direction = 'compress' | 'decompress';

interface StringCompressorOptions {
	readonly algorithm: CompressionAlgorithm;
	readonly level: number;
	readonly outputFormat: OutputFormat;
	readonly autoDetect: boolean;
}

const DEFAULTS: StringCompressorOptions = {
	algorithm: 'gzip',
	level: DEFAULT_LEVEL.gzip,
	outputFormat: 'base64',
	autoDetect: true,
};

const useStringCompressorOptions = createToolOptionsStore<StringCompressorOptions>(
	'string-compressor',
	DEFAULTS
);

const HEX_GROUP_SIZE = 1;
const HEX_SEPARATOR = ':';
const DEBOUNCE_MS = 200;

const isOutputFormat = (v: string): v is OutputFormat =>
	v === 'base64' || v === 'hex' || v === 'data-uri';

const decodeInputForDecompress = (input: string): Uint8Array => {
	const trimmed = input.trim();
	if (trimmed.length === 0) return new Uint8Array(0);
	if (trimmed.toLowerCase().startsWith('data:')) return dataUriToBytes(trimmed);

	// Heuristic: if the payload contains only hex chars plus common separators,
	// treat it as hex; otherwise interpret as base64 (standard or URL-safe).
	const isHexLike =
		/^[0-9a-fA-F\s:_-]+$/.test(trimmed) && trimmed.replace(/[\s:_-]/g, '').length % 2 === 0;
	if (isHexLike && /[a-fA-F0-9]{2,}/.test(trimmed)) {
		try {
			return hexToBytes(trimmed);
		} catch {
			return base64ToBytes(trimmed);
		}
	}
	return base64ToBytes(trimmed);
};

const formatCompressedBytes = (bytes: Uint8Array, format: OutputFormat): string => {
	if (format === 'hex')
		return bytesToHex(bytes, { upper: true, group: HEX_GROUP_SIZE, separator: HEX_SEPARATOR });
	if (format === 'data-uri') return bytesToDataUri(bytes, 'application/octet-stream');
	return bytesToBase64(bytes);
};

interface DerivedState {
	readonly output: string;
	readonly error: string | null;
	readonly result: CompressResult | null;
	readonly detectedAlgorithm: CompressionAlgorithm | null;
}

const EMPTY_DERIVED: DerivedState = {
	output: '',
	error: null,
	result: null,
	detectedAlgorithm: null,
};

const errorState = (message: string): DerivedState => ({
	output: '',
	error: message,
	result: null,
	detectedAlgorithm: null,
});

const runCompress = async (
	text: string,
	algorithm: CompressionAlgorithm,
	level: number,
	outputFormat: OutputFormat
): Promise<DerivedState> => {
	const result = await compressText(text, { algorithm, level });
	if (!result.ok) return errorState(result.error);
	return {
		output: formatCompressedBytes(result.bytes, outputFormat),
		error: null,
		result,
		detectedAlgorithm: null,
	};
};

const runDecompress = async (
	text: string,
	algorithm: CompressionAlgorithm,
	autoDetect: boolean
): Promise<DerivedState> => {
	let bytes: Uint8Array;
	try {
		bytes = decodeInputForDecompress(text);
	} catch (e) {
		return errorState(e instanceof Error ? e.message : 'Failed to decode input');
	}
	if (bytes.byteLength === 0) {
		return errorState('Could not decode input as base64 / hex / data URI');
	}
	const result = await decompressBytes(bytes, autoDetect ? 'auto' : algorithm);
	if (!result.ok) return errorState(result.error);
	return {
		output: result.text,
		error: null,
		detectedAlgorithm: result.algorithm,
		result: {
			ok: true,
			inputBytes: result.outputBytes,
			outputBytes: result.inputBytes,
			ratio: result.outputBytes === 0 ? 0 : result.inputBytes / result.outputBytes,
			bytesSaved: result.outputBytes - result.inputBytes,
			bytes,
		},
	};
};

export const Route = createFileRoute('/string-compressor')({
	component: StringCompressorPage,
});

function StringCompressorPage() {
	useDocumentTitle('String Compressor');

	const { value: options, patch } = useStringCompressorOptions();
	const { algorithm, level, outputFormat, autoDetect } = options;

	const [direction, setDirection] = useState<Direction>('compress');
	const [inputText, setInputText] = useState('');
	const [curlInput, setCurlInput] = useState('');
	const [showCurlPanel, setShowCurlPanel] = useState(false);
	const [outputText, setOutputText] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [lastResult, setLastResult] = useState<CompressResult | null>(null);
	const [detectedAlgorithm, setDetectedAlgorithm] = useState<CompressionAlgorithm | null>(null);
	const [busy, setBusy] = useState(false);
	const [showRail, setShowRail] = usePersistedRail('string-compressor');

	const handleAlgorithmChange = (next: CompressionAlgorithm) => {
		// Re-clamp level into the new algorithm's range so the slider stays valid.
		patch({ algorithm: next, level: clampLevel(level, next) });
	};

	const handleDirectionChange = (next: Direction) => {
		setDirection(next);
		setOutputText('');
		setError(null);
		setLastResult(null);
		setDetectedAlgorithm(null);
	};

	const handleLoadSample = () => {
		setDirection('compress');
		setInputText(SAMPLE_TEXT);
	};

	const handleApplyCurl = () => {
		const extracted = extractCurlDataRaw(curlInput);
		if (extracted === null) {
			toast.error('No --data-raw payload found in the curl command');
			return;
		}
		setDirection('compress');
		setInputText(extracted);
		setShowCurlPanel(false);
		setCurlInput('');
		toast.success(`Extracted ${extracted.length} characters from curl`);
	};

	const handleClearInput = () => {
		setInputText('');
		setOutputText('');
		setError(null);
		setLastResult(null);
		setDetectedAlgorithm(null);
	};

	// Debounce the input through the shared hook so compress / decompress
	// only fire after the user pauses typing. Option toggles (direction /
	// algorithm / level / outputFormat / autoDetect) flow through the same
	// effect but do not need debouncing — they change once per click.
	const debouncedInput = useDebouncedValue(inputText, DEBOUNCE_MS);

	useEffect(() => {
		const trimmed = debouncedInput.trim();
		const apply = (state: DerivedState) => {
			setOutputText(state.output);
			setError(state.error);
			setLastResult(state.result);
			setDetectedAlgorithm(state.detectedAlgorithm);
			setBusy(false);
		};

		if (trimmed.length === 0) {
			apply(EMPTY_DERIVED);
			return;
		}

		let cancelled = false;
		setBusy(true);

		(async () => {
			const next =
				direction === 'compress'
					? await runCompress(debouncedInput, algorithm, level, outputFormat)
					: await runDecompress(debouncedInput, algorithm, autoDetect);
			if (cancelled) return;
			apply(next);
		})();

		return () => {
			cancelled = true;
		};
	}, [debouncedInput, direction, algorithm, level, outputFormat, autoDetect]);

	const valid: boolean | null = inputText.trim().length === 0 ? null : error === null;

	const { min: levelMin, max: levelMax } = LEVEL_RANGE[algorithm];

	const inputBytes = lastResult?.inputBytes ?? 0;
	const outputBytesValue = lastResult?.outputBytes ?? 0;
	const ratioPercent =
		lastResult && lastResult.inputBytes > 0
			? (lastResult.outputBytes / lastResult.inputBytes) * 100
			: 0;
	const savings = lastResult ? lastResult.inputBytes - lastResult.outputBytes : 0;
	const savingsPercent =
		lastResult && lastResult.inputBytes > 0 ? (savings / lastResult.inputBytes) * 100 : 0;
	// Fill width is clamped to 100% so an expansion (ratio > 1, e.g. gzipping
	// a 4-byte input) does not break the bar layout.
	const fillPercent = Math.min(100, Math.max(0, ratioPercent));
	const fillSavings = savings >= 0;

	return (
		<ToolShell
			valid={valid}
			error={error ?? undefined}
			showRail={showRail}
			onShowRailChange={setShowRail}
			statusContent={
				lastResult ? (
					<>
						<StatItem label="Algorithm" value={detectedAlgorithm ?? algorithm} />
						<StatItem label="Input" value={formatBytes(inputBytes)} />
						<StatItem label="Output" value={formatBytes(outputBytesValue)} />
						<StatItem
							label="Ratio"
							value={`${ratioPercent.toFixed(1)}%`}
							variant={ratioPercent <= 100 ? 'success' : 'warning'}
						/>
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Direction">
						<FormMode<Direction>
							value={direction}
							onValueChange={handleDirectionChange}
							layout="stacked"
							options={[
								{ value: 'compress', label: 'Compress', description: 'Text -> bytes' },
								{ value: 'decompress', label: 'Decompress', description: 'Bytes -> text' },
							]}
						/>
					</FormSection>

					<FormSection title="Algorithm">
						<FormMode<CompressionAlgorithm>
							value={algorithm}
							onValueChange={handleAlgorithmChange}
							layout="stacked"
							options={[
								{ value: 'gzip', label: 'GZIP', description: 'RFC 1952' },
								{ value: 'brotli', label: 'Brotli', description: 'RFC 7932' },
							]}
						/>
						{direction === 'decompress' ? (
							<div className="pt-2">
								<FormCheckbox
									label="Auto-detect from magic bytes"
									checked={autoDetect}
									onCheckedChange={(v) => patch({ autoDetect: v })}
									size="compact"
								/>
							</div>
						) : null}
					</FormSection>

					<FormSection title="Level">
						<FormSlider
							label={algorithm === 'brotli' ? 'Brotli quality' : 'GZIP level'}
							value={level}
							onValueChange={(v) => patch({ level: clampLevel(v, algorithm) })}
							min={levelMin}
							max={levelMax}
							step={1}
							size="compact"
							hint={
								algorithm === 'gzip'
									? 'CompressionStream uses the platform default; level is informational.'
									: 'Higher values produce smaller output at the cost of CPU.'
							}
						/>
					</FormSection>

					{direction === 'compress' ? (
						<FormSection title="Output Format">
							<FormSelect
								label="Format"
								value={outputFormat}
								onValueChange={(v) => {
									if (isOutputFormat(v)) patch({ outputFormat: v });
								}}
								options={[
									{ value: 'base64', label: 'Base64', description: 'RFC 4648 standard' },
									{ value: 'hex', label: 'Hex', description: 'Colon-grouped pairs (FF:E0:...)' },
									{
										value: 'data-uri',
										label: 'Data URI',
										description: 'data:application/octet-stream;base64,...',
									},
								]}
								size="compact"
							/>
						</FormSection>
					) : null}

					<FormSection title="Helpers">
						<div className="flex flex-col gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="justify-start"
								onClick={handleLoadSample}
							>
								<FileText className="h-3.5 w-3.5" />
								Load sample text
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="justify-start"
								onClick={() => setShowCurlPanel((s) => !s)}
								aria-expanded={showCurlPanel}
							>
								<Terminal className="h-3.5 w-3.5" />
								{showCurlPanel ? 'Hide curl panel' : 'Paste from curl'}
							</Button>
						</div>
						{showCurlPanel ? (
							<div className="space-y-2 pt-2">
								<FormTextarea
									label="curl command"
									placeholder={'curl \'https://example.com\' --data-raw \'{"hello":"world"}\''}
									value={curlInput}
									onValueChange={setCurlInput}
									rows={4}
									size="compact"
								/>
								<div className="flex gap-2">
									<Button
										type="button"
										size="sm"
										onClick={handleApplyCurl}
										disabled={!curlInput.trim()}
									>
										Extract data
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => {
											setCurlInput('');
											setShowCurlPanel(false);
										}}
									>
										Cancel
									</Button>
								</div>
							</div>
						) : null}
					</FormSection>

					<ToolFooter
						relatedItems={[
							{ id: 'base64-encoder', reason: 'Encode and decode Base64 text' },
							{ id: 'url-encoder', reason: 'Percent-encode and decode URLs' },
							{ id: 'escape-tool', reason: 'Escape and unescape multi-flavor text' },
						]}
						aboutText={
							<>
								<p>
									GZIP runs through the browser <code>CompressionStream</code> API, which does not
									expose a compression-level parameter. Brotli uses a WebAssembly module with a
									configurable quality from 0 (fastest) to 11 (smallest).
								</p>
								<p className="mt-1.5">
									Text is encoded as UTF-8 before compression. On decompress, auto-detect uses the
									gzip magic bytes (<code>1F 8B</code>); inputs that do not match are routed to
									brotli.
								</p>
							</>
						}
					/>
				</>
			}
		>
			<div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-3">
				<Card density="compact" className="mb-3 shrink-0 border-l-2 border-l-info/40">
					<CardContent>
						<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
							<div className="flex items-center gap-3">
								<span className="text-muted-foreground">
									Input:{' '}
									<strong className="font-semibold text-foreground tabular-nums">
										{formatBytes(inputBytes)}
									</strong>
								</span>
								<span className="text-muted-foreground">
									Output:{' '}
									<strong className="font-semibold text-foreground tabular-nums">
										{formatBytes(outputBytesValue)}
									</strong>
								</span>
							</div>
							<div className="flex items-center gap-2">
								<Badge
									variant="outline"
									className={cn(
										'font-mono tabular-nums',
										fillSavings
											? 'border-success/40 bg-success/10 text-success'
											: 'border-warning/40 bg-warning/10 text-warning'
									)}
								>
									{fillSavings ? '−' : '+'}
									{formatBytes(Math.abs(savings))} ({fillSavings ? '−' : '+'}
									{Math.abs(savingsPercent).toFixed(1)}%)
								</Badge>
								<Badge variant="outline" className="font-mono tabular-nums">
									Ratio {ratioPercent.toFixed(1)}%
								</Badge>
							</div>
						</div>
						<div
							className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/70"
							role="progressbar"
							aria-label="Compression ratio"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={Math.round(fillPercent)}
						>
							<div
								className={cn('h-full transition-all', fillSavings ? 'bg-success' : 'bg-warning')}
								style={{ width: `${fillPercent}%` }}
							/>
						</div>
					</CardContent>
				</Card>

				<SplitPane
					direction="horizontal"
					defaultSizes={[50, 50]}
					minSizes={[25, 25]}
					className="flex-1 gap-3 overflow-hidden"
					left={
						<Card density="compact" className="flex h-full min-h-0 flex-col">
							<CardHeader className="flex flex-row items-center justify-between space-y-0">
								<div className="flex flex-col gap-0.5">
									<CardTitle className="text-sm font-medium">Input</CardTitle>
									<span className="text-xs text-muted-foreground">
										{direction === 'compress'
											? 'Plain text to compress (UTF-8).'
											: `Compressed payload encoded as base64 / hex / data: URI.`}
									</span>
								</div>
								<div className="flex items-center gap-1">
									<Badge variant="outline" className="font-mono">
										{inputText.length} chars
									</Badge>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={handleClearInput}
										disabled={!inputText}
									>
										Clear
									</Button>
								</div>
							</CardHeader>
							<CardContent className="flex min-h-0 flex-1 flex-col">
								<Textarea
									placeholder={
										direction === 'compress'
											? 'Paste text here...'
											: 'Paste base64-encoded compressed payload here...'
									}
									value={inputText}
									onChange={(e) => setInputText(e.target.value)}
									className="flex-1 resize-none font-mono text-xs"
									aria-label="Input"
								/>
							</CardContent>
						</Card>
					}
					right={
						<Card density="compact" className="flex h-full min-h-0 flex-col">
							<CardHeader className="flex flex-row items-center justify-between space-y-0">
								<div className="flex flex-col gap-0.5">
									<CardTitle className="text-sm font-medium">Output</CardTitle>
									<span className="text-xs text-muted-foreground">
										{direction === 'compress'
											? `Compressed bytes as ${outputFormat === 'data-uri' ? 'data: URI' : outputFormat}.`
											: 'Decompressed text (UTF-8).'}
										{detectedAlgorithm && direction === 'decompress' ? (
											<span className="ml-2 text-info">Detected: {detectedAlgorithm}</span>
										) : null}
									</span>
								</div>
								<div className="flex items-center gap-1">
									{busy ? (
										<Badge variant="outline" className="font-mono text-muted-foreground">
											Working...
										</Badge>
									) : null}
									<CopyButton text={outputText} toastLabel="Output" disabled={!outputText} />
								</div>
							</CardHeader>
							<CardContent className="flex min-h-0 flex-1 flex-col">
								<Textarea
									placeholder={
										direction === 'compress'
											? 'Compressed output will appear here...'
											: 'Decompressed text will appear here...'
									}
									value={outputText}
									readOnly
									className="flex-1 resize-none font-mono text-xs"
									aria-label="Output"
								/>
								<FormError message={error} className="pt-2" />
							</CardContent>
						</Card>
					}
				/>
			</div>
		</ToolShell>
	);
}
