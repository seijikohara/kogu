<script lang="ts">
	import { CodeEditor } from '$lib/components/editor';
	import { FormCheckbox, FormInfo, FormMode, FormSection, FormSelect } from '$lib/components/form';
	import { SplitPane } from '$lib/components/layout';
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
	import {
		BASE64_MIME_TYPES,
		type Base64DecodeOptions,
		type Base64EncodeOptions,
		type Base64LineBreak,
		type Base64Stats,
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
	} from '$lib/services/encoders.js';

	type Mode = 'encode' | 'decode';

	// State
	let mode = $state<Mode>('encode');
	let input = $state('');
	let showOptions = $state(true);

	// Encode options
	let variant = $state<Base64Variant>(defaultBase64EncodeOptions.variant);
	let padding = $state(defaultBase64EncodeOptions.padding);
	let lineBreak = $state<Base64LineBreak>(defaultBase64EncodeOptions.lineBreak);
	let dataUrl = $state(defaultBase64EncodeOptions.dataUrl);
	let mimeType = $state(defaultBase64EncodeOptions.mimeType);

	// Decode options
	let ignoreWhitespace = $state(defaultBase64DecodeOptions.ignoreWhitespace);
	let ignoreInvalidChars = $state(defaultBase64DecodeOptions.ignoreInvalidChars);
	let autoDetectVariant = $state(defaultBase64DecodeOptions.autoDetectVariant);

	// Derived encode options object
	const encodeOptions = $derived<Partial<Base64EncodeOptions>>({
		variant,
		padding,
		lineBreak,
		dataUrl,
		mimeType,
	});

	// Derived decode options object
	const decodeOptions = $derived<Partial<Base64DecodeOptions>>({
		ignoreWhitespace,
		ignoreInvalidChars,
		autoDetectVariant,
	});

	// Detected info for decode mode
	const detectedVariant = $derived(
		mode === 'decode' && input.trim() ? detectBase64Variant(input) : null
	);
	const detectedDataUrl = $derived(mode === 'decode' && input.trim() ? isDataUrl(input) : false);
	const detectedMimeType = $derived(detectedDataUrl ? extractMimeType(input) : null);

	// Computed output and error
	const encodeResult = $derived.by((): { output: string; error: string } => {
		if (!input.trim()) {
			return { output: '', error: '' };
		}

		try {
			const result =
				mode === 'encode'
					? encodeToBase64(input, encodeOptions)
					: decodeFromBase64(input, decodeOptions);
			return { output: result, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid input' };
		}
	});

	// Derived values from result
	const output = $derived(encodeResult.output);
	const error = $derived(encodeResult.error);

	// Stats calculation
	const stats = $derived.by((): Base64Stats | null => {
		if (!input.trim() || !output) return null;
		return mode === 'encode'
			? calculateBase64Stats(input, output)
			: calculateBase64Stats(output, input);
	});

	// Validation state
	const valid = $derived.by((): boolean | null => {
		if (!input.trim()) return null;
		return !error;
	});

	// Handlers
	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) input = text;
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => {
		input = '';
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(output);
		} catch {
			// Clipboard access denied
		}
	};

	const handleSample = () => {
		input = SAMPLE_TEXT_FOR_BASE64;
	};

	const handleModeChange = (newMode: string) => {
		mode = newMode as Mode;
		input = '';
	};
</script>

<svelte:head>
	<title>Base64 Encoder - Kogu</title>
</svelte:head>

<ToolShell {valid} {error} bind:showRail={showOptions}>
	{#snippet statusContent()}
		{#if stats}
			<StatItem label="Input" value="{stats.inputChars} chars ({stats.inputBytes} bytes)" />
			<StatItem label="Output" value="{stats.outputChars} chars" />
			<StatItem label="Ratio" value={stats.ratio} />
		{/if}
	{/snippet}

	{#snippet rail()}
		<FormSection title="Mode">
			<FormMode
				value={mode}
				onchange={handleModeChange}
				options={[
					{ value: 'encode', label: 'Encode' },
					{ value: 'decode', label: 'Decode' },
				]}
			/>
		</FormSection>

		{#if mode === 'encode'}
			<FormSection title="Encoding">
				<FormSelect
					label="Variant"
					bind:value={variant}
					options={[
						{ value: 'standard', label: 'Standard (+/)' },
						{ value: 'url-safe', label: 'URL-safe (-_)' },
					]}
				/>
				<FormSelect
					label="Line Break"
					bind:value={lineBreak}
					options={[
						{ value: 'none', label: 'None' },
						{ value: '64', label: '64 chars (PEM)' },
						{ value: '76', label: '76 chars (MIME)' },
					]}
				/>
				<div class="pt-1">
					<FormCheckbox label="Include padding (=)" bind:checked={padding} />
				</div>
			</FormSection>

			<FormSection title="Data URL">
				<FormCheckbox label="Output as Data URL" bind:checked={dataUrl} />
				{#if dataUrl}
					<div class="pt-1">
						<FormSelect label="MIME Type" bind:value={mimeType} options={[...BASE64_MIME_TYPES]} />
					</div>
				{/if}
			</FormSection>

			<FormSection title="Info" open={false}>
				<FormInfo title="Standard vs URL-safe">
					<p><strong>Standard:</strong> Uses <code>+</code> and <code>/</code> characters.</p>
					<p class="mt-1">
						<strong>URL-safe:</strong> Uses <code>-</code> and <code>_</code> instead, safe for URLs and
						filenames.
					</p>
				</FormInfo>
			</FormSection>
		{:else}
			<FormSection title="Decoding">
				<FormCheckbox label="Ignore whitespace" bind:checked={ignoreWhitespace} />
				<FormCheckbox label="Ignore invalid characters" bind:checked={ignoreInvalidChars} />
				<FormCheckbox label="Auto-detect URL-safe variant" bind:checked={autoDetectVariant} />
			</FormSection>

			{#if detectedVariant || detectedDataUrl}
				<FormSection title="Detected">
					<FormInfo showIcon={false}>
						{#if detectedVariant}
							<p>
								<strong>Variant:</strong>
								{detectedVariant === 'url-safe' ? 'URL-safe (-_)' : 'Standard (+/)'}
							</p>
						{/if}
						{#if detectedDataUrl}
							<p class="mt-1"><strong>Format:</strong> Data URL</p>
							{#if detectedMimeType}
								<p class="mt-1"><strong>MIME:</strong> {detectedMimeType}</p>
							{/if}
						{/if}
					</FormInfo>
				</FormSection>
			{/if}
		{/if}
	{/snippet}

	<SplitPane class="h-full flex-1">
		{#snippet left()}
			<CodeEditor
				title={mode === 'encode' ? 'Text Input' : 'Base64 Input'}
				value={input}
				onchange={(v) => (input = v)}
				mode="input"
				editorMode="plain"
				placeholder={mode === 'encode' ? 'Enter text to encode...' : 'Enter Base64 to decode...'}
				onsample={handleSample}
				onpaste={handlePaste}
				onclear={handleClear}
				showViewToggle={false}
			/>
		{/snippet}
		{#snippet right()}
			<CodeEditor
				title={mode === 'encode' ? 'Base64 Output' : 'Decoded Text'}
				value={output}
				mode="readonly"
				editorMode="plain"
				placeholder={mode === 'encode' ? 'Encoded output...' : 'Decoded output...'}
				oncopy={handleCopy}
				showViewToggle={false}
			/>
		{/snippet}
	</SplitPane>
</ToolShell>
