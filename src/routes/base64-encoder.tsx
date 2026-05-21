import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Code2 } from 'lucide-react';
import { toast } from 'sonner';

import { CodeEditor } from '@/lib/components/editor';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormMode,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { SectionHeader, SplitPane } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import {
	BASE64_MIME_TYPES,
	type Base64DecodeOptions,
	type Base64EncodeOptions,
	type Base64LineBreak,
	type Base64Variant,
	calculateBase64Stats,
	decodeFromBase64,
	defaultBase64DecodeOptions,
	defaultBase64EncodeOptions,
	detectBase64Variant,
	encodeToBase64,
	extractMimeType,
	isDataUrl,
	SAMPLE_TEXT_FOR_BASE64,
} from '@/lib/services/encoders';

type Mode = 'encode' | 'decode';

export const Route = createFileRoute('/base64-encoder')({
	component: Base64EncoderPage,
});

function Base64EncoderPage() {
	const [mode, setMode] = useState<Mode>('encode');
	const [input, setInput] = useState('');
	const [showOptions, setShowOptions] = useState(true);

	const [variant, setVariant] = useState<Base64Variant>(defaultBase64EncodeOptions.variant);
	const [padding, setPadding] = useState(defaultBase64EncodeOptions.padding);
	const [lineBreak, setLineBreak] = useState<Base64LineBreak>(defaultBase64EncodeOptions.lineBreak);
	const [dataUrl, setDataUrl] = useState(defaultBase64EncodeOptions.dataUrl);
	const [mimeType, setMimeType] = useState(defaultBase64EncodeOptions.mimeType);

	const [ignoreWhitespace, setIgnoreWhitespace] = useState(
		defaultBase64DecodeOptions.ignoreWhitespace
	);
	const [ignoreInvalidChars, setIgnoreInvalidChars] = useState(
		defaultBase64DecodeOptions.ignoreInvalidChars
	);
	const [autoDetectVariant, setAutoDetectVariant] = useState(
		defaultBase64DecodeOptions.autoDetectVariant
	);

	useEffect(() => {
		document.title = 'Base64 Encoder — Kogu';
	}, []);

	const encodeOptions: Partial<Base64EncodeOptions> = {
		variant,
		padding,
		lineBreak,
		dataUrl,
		mimeType,
	};

	const decodeOptions: Partial<Base64DecodeOptions> = {
		ignoreWhitespace,
		ignoreInvalidChars,
		autoDetectVariant,
	};

	const detectedVariant = mode === 'decode' && input.trim() ? detectBase64Variant(input) : null;
	const detectedDataUrl = mode === 'decode' && input.trim() ? isDataUrl(input) : false;
	const detectedMimeType = detectedDataUrl ? extractMimeType(input) : null;

	const { output, error } = ((): { output: string; error: string } => {
		if (!input.trim()) return { output: '', error: '' };
		try {
			const result =
				mode === 'encode'
					? encodeToBase64(input, encodeOptions)
					: decodeFromBase64(input, decodeOptions);
			return { output: result, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid input' };
		}
	})();

	const stats =
		input.trim() && output
			? mode === 'encode'
				? calculateBase64Stats(input, output)
				: calculateBase64Stats(output, input)
			: null;

	const valid: boolean | null = !input.trim() ? null : !error;

	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) setInput(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => setInput('');

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(output);
			toast.success('Copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const handleSample = () => setInput(SAMPLE_TEXT_FOR_BASE64);

	const handleModeChange = (newMode: Mode) => {
		setMode(newMode);
		setInput('');
	};

	return (
		<ToolShell
			valid={valid}
			error={error || undefined}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				stats ? (
					<>
						<StatItem
							label="Input"
							value={`${stats.inputChars} chars (${stats.inputBytes} bytes)`}
						/>
						<StatItem label="Output" value={`${stats.outputChars} chars`} />
						<StatItem label="Ratio" value={stats.ratio} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Mode">
						<FormMode
							value={mode}
							onValueChange={handleModeChange}
							options={[
								{ value: 'encode', label: 'Encode' },
								{ value: 'decode', label: 'Decode' },
							]}
						/>
					</FormSection>

					{mode === 'encode' ? (
						<>
							<FormSection title="Encoding">
								<FormSelect
									label="Variant"
									value={variant}
									onValueChange={(v) => setVariant(v as Base64Variant)}
									options={[
										{
											value: 'standard',
											label: 'Standard',
											description: 'Uses + and / (RFC 4648 §4)',
										},
										{
											value: 'url-safe',
											label: 'URL-safe',
											description: 'Uses - and _ (RFC 4648 §5)',
										},
									]}
									size="compact"
								/>
								<FormSelect
									label="Line Break"
									value={lineBreak}
									onValueChange={(v) => setLineBreak(v as Base64LineBreak)}
									options={[
										{ value: 'none', label: 'None', description: 'Single continuous line' },
										{ value: '64', label: '64 chars', description: 'PEM convention' },
										{ value: '76', label: '76 chars', description: 'MIME / RFC 2045' },
									]}
									size="compact"
								/>
								<div className="pt-1">
									<FormCheckbox
										label="Include padding (=)"
										checked={padding}
										onCheckedChange={setPadding}
										size="compact"
									/>
								</div>
							</FormSection>

							<FormSection title="Data URL">
								<FormCheckbox
									label="Output as Data URL"
									checked={dataUrl}
									onCheckedChange={setDataUrl}
									size="compact"
								/>
								{dataUrl ? (
									<div className="pt-1">
										<FormSelect
											label="MIME Type"
											value={mimeType}
											onValueChange={setMimeType}
											options={[...BASE64_MIME_TYPES]}
											size="compact"
										/>
									</div>
								) : null}
							</FormSection>

							<FormSection title="Info" open={false}>
								<FormInfo title="Standard vs URL-safe">
									<p>
										<strong>Standard:</strong> Uses <code>+</code> and <code>/</code> characters.
									</p>
									<p className="mt-1">
										<strong>URL-safe:</strong> Uses <code>-</code> and <code>_</code> instead, safe
										for URLs and filenames.
									</p>
								</FormInfo>
							</FormSection>
						</>
					) : (
						<>
							<FormSection title="Decoding">
								<FormCheckboxGroup>
									<FormCheckbox
										label="Ignore whitespace"
										checked={ignoreWhitespace}
										onCheckedChange={setIgnoreWhitespace}
										size="compact"
									/>
									<FormCheckbox
										label="Ignore invalid characters"
										checked={ignoreInvalidChars}
										onCheckedChange={setIgnoreInvalidChars}
										size="compact"
									/>
									<FormCheckbox
										label="Auto-detect URL-safe variant"
										checked={autoDetectVariant}
										onCheckedChange={setAutoDetectVariant}
										size="compact"
									/>
								</FormCheckboxGroup>
							</FormSection>

							{detectedVariant || detectedDataUrl ? (
								<FormSection title="Detected">
									<FormInfo showIcon={false}>
										{detectedVariant ? (
											<p>
												<strong>Variant:</strong>{' '}
												{detectedVariant === 'url-safe' ? 'URL-safe (-_)' : 'Standard (+/)'}
											</p>
										) : null}
										{detectedDataUrl ? (
											<>
												<p className="mt-1">
													<strong>Format:</strong> Data URL
												</p>
												{detectedMimeType ? (
													<p className="mt-1">
														<strong>MIME:</strong> {detectedMimeType}
													</p>
												) : null}
											</>
										) : null}
									</FormInfo>
								</FormSection>
							) : null}
						</>
					)}
				</>
			}
		>
			<SplitPane
				className="h-full flex-1"
				left={
					<CodeEditor
						title={mode === 'encode' ? 'Text Input' : 'Base64 Input'}
						value={input}
						onChange={setInput}
						mode="input"
						editorMode="plain"
						placeholder={
							mode === 'encode' ? 'Enter text to encode...' : 'Enter Base64 to decode...'
						}
						onSample={handleSample}
						onPaste={handlePaste}
						onClear={handleClear}
						showViewToggle={false}
					/>
				}
				right={
					!input.trim() ? (
						<div className="flex h-full flex-col overflow-hidden">
							<SectionHeader title={mode === 'encode' ? 'Base64 Output' : 'Decoded Text'} />
							<div className="flex-1">
								<EmbeddedEmptyState
									icon={Code2}
									title={mode === 'encode' ? 'Enter text to encode' : 'Paste Base64 to decode'}
									description={
										mode === 'encode'
											? 'The Base64-encoded result will appear here.'
											: 'The decoded plain text will appear here.'
									}
									fillHeight
								/>
							</div>
						</div>
					) : (
						<CodeEditor
							title={mode === 'encode' ? 'Base64 Output' : 'Decoded Text'}
							value={output}
							mode="readonly"
							editorMode="plain"
							placeholder={mode === 'encode' ? 'Encoded output...' : 'Decoded output...'}
							onCopy={handleCopy}
							showViewToggle={false}
						/>
					)
				}
			/>
		</ToolShell>
	);
}
