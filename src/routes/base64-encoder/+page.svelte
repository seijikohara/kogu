<script lang="ts">
	import { PageHeader, SplitPane } from '$lib/components/layout/index.js';
	import OptionSelect from '$lib/components/options/option-select.svelte';
	import OptionsPanel from '$lib/components/options/options-panel.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import { EditorPane } from '$lib/components/tool/index.js';
	import {
		type Base64Stats,
		calculateBase64Stats,
		decodeFromBase64,
		encodeToBase64,
		SAMPLE_TEXT_FOR_BASE64,
	} from '$lib/services/encoders.js';

	type Mode = 'encode' | 'decode';

	// State
	let mode = $state<Mode>('encode');
	let input = $state('');
	let showOptions = $state(true);

	// Computed output and error
	const encodeResult = $derived.by((): { output: string; error: string } => {
		if (!input.trim()) {
			return { output: '', error: '' };
		}

		try {
			const result = mode === 'encode' ? encodeToBase64(input) : decodeFromBase64(input);
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

	const handleDownload = () => {
		const filename = mode === 'encode' ? 'encoded.txt' : 'decoded.txt';
		const blob = new Blob([output], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleSample = () => {
		input = SAMPLE_TEXT_FOR_BASE64;
	};
</script>

<svelte:head>
	<title>Base64 Encoder - Kogu</title>
</svelte:head>

<div class="flex h-full flex-col overflow-hidden">
	<PageHeader {valid} {error}>
		{#snippet statusContent()}
			{#if stats}
				<span class="text-muted-foreground">
					Input: <strong class="text-foreground">{stats.inputChars}</strong> chars
				</span>
				<span class="text-muted-foreground">
					Output: <strong class="text-foreground">{stats.outputChars}</strong> chars
				</span>
				<span class="text-muted-foreground">
					Ratio: <strong class="text-foreground">{stats.ratio}</strong>
				</span>
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Content -->
	<div class="flex flex-1 overflow-hidden">
		<OptionsPanel
			show={showOptions}
			onclose={() => (showOptions = false)}
			onopen={() => (showOptions = true)}
		>
			<OptionsSection title="Mode">
				<OptionSelect
					label="Operation"
					value={mode}
					onchange={(v) => {
						mode = v as Mode;
						input = '';
					}}
					options={[
						{ value: 'encode', label: 'Encode' },
						{ value: 'decode', label: 'Decode' },
					]}
				/>
			</OptionsSection>
		</OptionsPanel>

		<SplitPane class="h-full flex-1">
			{#snippet left()}
				<EditorPane
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
				<EditorPane
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
	</div>
</div>
