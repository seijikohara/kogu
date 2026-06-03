import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Code2 } from 'lucide-react';
import { toast } from 'sonner';

import { CodeEditor } from '@/lib/components/editor';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormMode,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { SplitPane } from '@/lib/components/layout';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { DetectedInfo, EmptyOutputPane, StatItem } from '@/lib/components/status';
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks';
import { useBase64Worker } from '@/lib/hooks/use-base64-worker';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import {
	BASE64_MIME_TYPES,
	type Base64DecodeOptions,
	type Base64EncodeOptions,
	type Base64LineBreak,
	type Base64Variant,
	calculateBase64Stats,
	defaultBase64DecodeOptions,
	defaultBase64EncodeOptions,
	detectBase64Variant,
	extractMimeType,
	isDataUrl,
	SAMPLE_TEXT_FOR_BASE64,
} from '@/lib/services/encoders';

type Mode = 'encode' | 'decode';

interface Base64Prefs {
	readonly mode: Mode;
	readonly variant: Base64Variant;
	readonly padding: boolean;
	readonly lineBreak: Base64LineBreak;
	readonly dataUrl: boolean;
	readonly mimeType: string;
	readonly ignoreWhitespace: boolean;
	readonly ignoreInvalidChars: boolean;
	readonly autoDetectVariant: boolean;
}

const useBase64Prefs = createToolOptionsStore<Base64Prefs>('base64-encoder', {
	mode: 'encode',
	variant: defaultBase64EncodeOptions.variant,
	padding: defaultBase64EncodeOptions.padding,
	lineBreak: defaultBase64EncodeOptions.lineBreak,
	dataUrl: defaultBase64EncodeOptions.dataUrl,
	mimeType: defaultBase64EncodeOptions.mimeType,
	ignoreWhitespace: defaultBase64DecodeOptions.ignoreWhitespace,
	ignoreInvalidChars: defaultBase64DecodeOptions.ignoreInvalidChars,
	autoDetectVariant: defaultBase64DecodeOptions.autoDetectVariant,
});

export const Route = createFileRoute('/base64-encoder')({
	component: Base64EncoderPage,
});

function Base64EncoderPage() {
	const { value: prefs, patch } = useBase64Prefs();
	const {
		mode,
		variant,
		padding,
		lineBreak,
		dataUrl,
		mimeType,
		ignoreWhitespace,
		ignoreInvalidChars,
		autoDetectVariant,
	} = prefs;

	const [input, setInput] = useState('');
	const [showOptions, setShowOptions] = usePersistedRail('base64-encoder');

	useDocumentTitle('Base64 Encoder');

	const encodeOptions = useMemo<Partial<Base64EncodeOptions>>(
		() => ({ variant, padding, lineBreak, dataUrl, mimeType }),
		[variant, padding, lineBreak, dataUrl, mimeType]
	);

	const decodeOptions = useMemo<Partial<Base64DecodeOptions>>(
		() => ({ ignoreWhitespace, ignoreInvalidChars, autoDetectVariant }),
		[ignoreWhitespace, ignoreInvalidChars, autoDetectVariant]
	);

	// Debounce the input feeding the encode / decode pipeline so typing
	// large payloads (data URLs, base64 blobs) does not retrigger the
	// transform on every keystroke. 100ms is invisible to typing but
	// collapses fast bursts.
	const debouncedInput = useDebouncedValue(input, 100);

	const detectedVariant =
		mode === 'decode' && debouncedInput.trim() ? detectBase64Variant(debouncedInput) : null;
	const detectedDataUrl =
		mode === 'decode' && debouncedInput.trim() ? isDataUrl(debouncedInput) : false;
	const detectedMimeType = detectedDataUrl ? extractMimeType(debouncedInput) : null;

	// Encoding / decoding runs in a worker so a large Data URL never freezes typing.
	const { output, error } = useBase64Worker({
		mode,
		input: debouncedInput,
		encodeOptions,
		decodeOptions,
	});

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
			toast.success('Output copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const handleSample = () => setInput(SAMPLE_TEXT_FOR_BASE64);

	const handleModeChange = (newMode: Mode) => {
		patch({ mode: newMode });
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
									onValueChange={(v) => patch({ variant: v as Base64Variant })}
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
									onValueChange={(v) => patch({ lineBreak: v as Base64LineBreak })}
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
										onCheckedChange={(v) => patch({ padding: v })}
										size="compact"
									/>
								</div>
							</FormSection>

							<FormSection title="Data URL">
								<FormCheckbox
									label="Output as Data URL"
									checked={dataUrl}
									onCheckedChange={(v) => patch({ dataUrl: v })}
									size="compact"
								/>
								{dataUrl ? (
									<div className="pt-1">
										<FormSelect
											label="MIME Type"
											value={mimeType}
											onValueChange={(v) => patch({ mimeType: v })}
											options={[...BASE64_MIME_TYPES]}
											size="compact"
										/>
									</div>
								) : null}
							</FormSection>
						</>
					) : (
						<>
							<FormSection title="Decoding">
								<FormCheckboxGroup>
									<FormCheckbox
										label="Ignore whitespace"
										checked={ignoreWhitespace}
										onCheckedChange={(v) => patch({ ignoreWhitespace: v })}
										size="compact"
									/>
									<FormCheckbox
										label="Ignore invalid characters"
										checked={ignoreInvalidChars}
										onCheckedChange={(v) => patch({ ignoreInvalidChars: v })}
										size="compact"
									/>
									<FormCheckbox
										label="Auto-detect URL-safe variant"
										checked={autoDetectVariant}
										onCheckedChange={(v) => patch({ autoDetectVariant: v })}
										size="compact"
									/>
								</FormCheckboxGroup>
							</FormSection>

							<DetectedInfo
								items={[
									{
										show: Boolean(detectedVariant),
										label: 'Variant',
										value: detectedVariant === 'url-safe' ? 'URL-safe (-_)' : 'Standard (+/)',
									},
									{ show: detectedDataUrl, label: 'Format', value: 'Data URL' },
									{
										show: detectedDataUrl && Boolean(detectedMimeType),
										label: 'MIME',
										value: detectedMimeType ?? '',
									},
								]}
							/>
						</>
					)}

					<ToolFooter
						relatedItems={[
							{ id: 'url-encoder', reason: 'Percent-encode text for URLs' },
							{ id: 'jwt-decoder', reason: 'Decode Base64URL-encoded JWT segments' },
							{ id: 'hash-generator', reason: 'Hash text or files' },
							{ id: 'escape-tool', reason: 'Escape text in JSON/HTML' },
						]}
						aboutText={
							<>
								Encodes and decodes Base64 with UTF-8 support. The Standard variant uses{' '}
								<code>+</code> and <code>/</code> (RFC 4648 §4); the URL-safe variant uses{' '}
								<code>-</code> and <code>_</code> (RFC 4648 §5), safe for URLs and filenames. Output
								can be wrapped at PEM (64) or MIME (76) line widths and emitted as a Data URL with a
								selectable MIME type.
							</>
						}
					/>
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
						<EmptyOutputPane
							headerTitle={mode === 'encode' ? 'Base64 Output' : 'Decoded Text'}
							icon={Code2}
							title={mode === 'encode' ? 'Enter text to encode' : 'Paste Base64 to decode'}
							description={
								mode === 'encode'
									? 'The Base64-encoded result will appear here.'
									: 'The decoded plain text will appear here.'
							}
						/>
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
