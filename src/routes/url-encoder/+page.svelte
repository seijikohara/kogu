<script lang="ts">
	import {
		ArrowRightLeft,
		BookOpen,
		ExternalLink,
		Hammer,
		Link2,
		Plus,
		Trash2,
	} from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { CodeEditor } from '$lib/components/editor';
	import {
		FormCheckbox,
		FormInfo,
		FormInput,
		FormMode,
		FormSection,
		FormSelect,
		FormSlider,
	} from '$lib/components/form';
	import { SplitPane } from '$lib/components/layout';
	import { OptionsPanel } from '$lib/components/panel';
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		buildUrl,
		decodeUrlWithOptions,
		defaultUrlDecodeOptions,
		defaultUrlEncodeOptions,
		encodeUrlWithOptions,
		getEncodingDepth,
		isDoubleEncoded,
		parseUrl,
		type QueryParameter,
		SAMPLE_URL,
		URL_ENCODING_EXAMPLES,
		type UrlDecodeOptions,
		type UrlEncodeMode,
		type UrlEncodeOptions,
		type UrlHexCase,
		type UrlInvalidHandling,
		type UrlNewlineHandling,
		type UrlSpaceEncoding,
	} from '$lib/services/encoders.js';
	import { useTabSync } from '$lib/utils';

	type Tab = 'encode' | 'parse' | 'build' | 'reference';
	type Mode = 'encode' | 'decode';

	// Tab definitions
	const tabs = [
		{ id: 'encode' as const, label: 'Encode/Decode', icon: ArrowRightLeft },
		{ id: 'parse' as const, label: 'Parse URL', icon: Link2 },
		{ id: 'build' as const, label: 'Build URL', icon: Hammer },
		{ id: 'reference' as const, label: 'Reference', icon: BookOpen },
	] as const;

	const tabIds = tabs.map((t) => t.id);

	// Tab sync with URL (keep as object reference to preserve reactivity)
	const tabSync = useTabSync({
		tabs: tabIds,
		defaultTab: 'encode',
	});

	// Type-safe tab change handler for ToolShell
	const handleTabChange = (tab: string) => tabSync.setActiveTab(tab as Tab);

	// Encode/Decode tab state
	let mode = $state<Mode>('encode');
	let input = $state('');
	let showOptions = $state(true);

	// Encode options
	let encodeMode = $state<UrlEncodeMode>(defaultUrlEncodeOptions.mode);
	let spaceEncoding = $state<UrlSpaceEncoding>(defaultUrlEncodeOptions.spaceEncoding);
	let hexCase = $state<UrlHexCase>(defaultUrlEncodeOptions.hexCase);
	let newlineHandling = $state<UrlNewlineHandling>(defaultUrlEncodeOptions.newlineHandling);
	let preserveChars = $state(defaultUrlEncodeOptions.preserveChars);
	let encodeNonAscii = $state(defaultUrlEncodeOptions.encodeNonAscii);

	// Decode options
	let plusAsSpace = $state(defaultUrlDecodeOptions.plusAsSpace);
	let invalidHandling = $state<UrlInvalidHandling>(defaultUrlDecodeOptions.invalidHandling);
	let decodeMultiple = $state(defaultUrlDecodeOptions.decodeMultiple);
	let maxIterations = $state(defaultUrlDecodeOptions.maxIterations);

	// Derived encode options object
	const encodeOptions = $derived<Partial<UrlEncodeOptions>>({
		mode: encodeMode,
		spaceEncoding,
		hexCase,
		newlineHandling,
		preserveChars,
		encodeNonAscii,
	});

	// Derived decode options object
	const decodeOptions = $derived<Partial<UrlDecodeOptions>>({
		plusAsSpace,
		invalidHandling,
		decodeMultiple,
		maxIterations,
	});

	// URL Parser state
	let parseInput = $state('');

	// URL Builder state
	let baseUrl = $state('https://example.com/path');
	let queryParams = $state<QueryParameter[]>([
		{ key: 'query', value: 'hello world' },
		{ key: 'name', value: 'test' },
	]);

	// Detected info for decode mode
	const detectedDoubleEncoded = $derived(
		mode === 'decode' && input.trim() ? isDoubleEncoded(input) : false
	);
	const detectedEncodingDepth = $derived(
		mode === 'decode' && input.trim() ? getEncodingDepth(input) : 0
	);

	// Computed output and error for encode/decode
	const encodeResult = $derived.by((): { output: string; error: string } => {
		if (!input.trim()) {
			return { output: '', error: '' };
		}

		try {
			const result =
				mode === 'encode'
					? encodeUrlWithOptions(input, encodeOptions)
					: decodeUrlWithOptions(input, decodeOptions);
			return { output: result, error: '' };
		} catch (e) {
			return { output: '', error: e instanceof Error ? e.message : 'Invalid input' };
		}
	});

	// Derived values from result
	const output = $derived(encodeResult.output);
	const error = $derived(encodeResult.error);

	// Parsed URL
	const parsedUrl = $derived.by(() => {
		if (!parseInput.trim()) return null;
		return parseUrl(parseInput);
	});

	// Built URL
	const builtUrl = $derived(buildUrl(baseUrl, queryParams));

	// Validation state per tab
	const valid = $derived.by((): boolean | null => {
		if (tabSync.activeTab === 'encode') {
			if (!input.trim()) return null;
			return !error;
		}
		if (tabSync.activeTab === 'parse') {
			if (!parseInput.trim()) return null;
			return parsedUrl !== null;
		}
		return null;
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
		input = SAMPLE_URL;
	};

	const handleParseSample = () => {
		parseInput = SAMPLE_URL;
	};

	const addQueryParam = () => {
		queryParams = [...queryParams, { key: '', value: '' }];
	};

	const removeQueryParam = (index: number) => {
		queryParams = queryParams.filter((_, i) => i !== index);
	};

	const updateQueryParam = (index: number, field: 'key' | 'value', value: string) => {
		queryParams = queryParams.map((param, i) =>
			i === index ? { ...param, [field]: value } : param
		);
	};
</script>

<svelte:head>
	<title>URL Encoder - Kogu</title>
</svelte:head>

<ToolShell
	layout="tabbed"
	{tabs}
	activeTab={tabSync.activeTab}
	ontabchange={handleTabChange}
	{valid}
	error={tabSync.activeTab === 'encode' ? error : undefined}
	preserveTabState
>
	{#snippet statusContent()}
		{#if tabSync.activeTab === 'encode'}
			{#if input.trim() && output}
				<StatItem label="Input" value="{input.length} chars" />
				<StatItem label="Output" value="{output.length} chars" />
			{/if}
		{:else if tabSync.activeTab === 'parse'}
			{#if parsedUrl}
				<StatItem label="Params" value={parsedUrl.params.length} />
			{/if}
		{:else if tabSync.activeTab === 'build'}
			<StatItem label="Params" value={queryParams.length} />
		{/if}
	{/snippet}

	{#snippet tabContent(tab)}
		{#if tab === 'encode'}
			<div class="flex flex-1 overflow-hidden">
				<OptionsPanel
					show={showOptions}
					onclose={() => (showOptions = false)}
					onopen={() => (showOptions = true)}
				>
					<FormSection title="Mode">
						<FormMode
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
					</FormSection>

					{#if mode === 'encode'}
						<FormSection title="Encoding">
							<FormSelect
								label="Mode"
								bind:value={encodeMode}
								options={[
									{ value: 'component', label: 'Component (strict)' },
									{ value: 'uri', label: 'URI (preserve structure)' },
									{ value: 'form', label: 'Form (x-www-form-urlencoded)' },
									{ value: 'path', label: 'Path segment' },
									{ value: 'custom', label: 'Custom' },
								]}
							/>
							<FormSelect
								label="Space Encoding"
								bind:value={spaceEncoding}
								options={[
									{ value: 'percent', label: '%20 (standard)' },
									{ value: 'plus', label: '+ (form data)' },
								]}
							/>
							<FormSelect
								label="Hex Case"
								bind:value={hexCase}
								options={[
									{ value: 'upper', label: 'Uppercase (%2F)' },
									{ value: 'lower', label: 'Lowercase (%2f)' },
								]}
							/>
							<FormSelect
								label="Newline Handling"
								bind:value={newlineHandling}
								options={[
									{ value: 'encode', label: 'Encode as-is' },
									{ value: 'crlf', label: 'Convert to CRLF' },
									{ value: 'lf', label: 'Convert to LF' },
									{ value: 'remove', label: 'Remove' },
								]}
							/>
							<div class="pt-1">
								<FormCheckbox label="Encode non-ASCII characters" bind:checked={encodeNonAscii} />
							</div>
						</FormSection>

						{#if encodeMode === 'custom'}
							<FormSection title="Custom Settings">
								<FormInput
									label="Preserve Characters"
									bind:value={preserveChars}
									placeholder="e.g., -_.~"
								/>
								<FormInfo>
									<p>Characters listed here will not be encoded.</p>
								</FormInfo>
							</FormSection>
						{/if}

						<FormSection title="Info" open={false}>
							<FormInfo title="Encoding Modes">
								<p><strong>Component:</strong> Encodes all special chars including /, ?, &, =, #</p>
								<p class="mt-1">
									<strong>URI:</strong> Preserves URL structure characters (/, ?, &, =, #, :)
								</p>
								<p class="mt-1"><strong>Form:</strong> Like component but uses + for spaces</p>
								<p class="mt-1">
									<strong>Path:</strong> Preserves / but encodes other special chars
								</p>
								<p class="mt-1"><strong>Custom:</strong> Configure preserved characters manually</p>
							</FormInfo>
						</FormSection>
					{:else}
						<FormSection title="Decoding">
							<FormCheckbox label="Treat + as space" bind:checked={plusAsSpace} />
							<FormSelect
								label="Invalid Sequences"
								bind:value={invalidHandling}
								options={[
									{ value: 'error', label: 'Throw error' },
									{ value: 'skip', label: 'Skip (remove)' },
									{ value: 'keep', label: 'Keep as-is' },
								]}
							/>
							<FormCheckbox label="Decode multiple layers" bind:checked={decodeMultiple} />
							{#if decodeMultiple}
								<div class="pt-1">
									<FormSlider
										label="Max Iterations"
										bind:value={maxIterations}
										min={1}
										max={10}
										step={1}
									/>
								</div>
							{/if}
						</FormSection>

						{#if detectedDoubleEncoded || detectedEncodingDepth > 1}
							<FormSection title="Detected">
								<FormInfo showIcon={false}>
									{#if detectedDoubleEncoded}
										<p><strong>Warning:</strong> Double-encoded content detected</p>
									{/if}
									{#if detectedEncodingDepth > 1}
										<p class="mt-1">
											<strong>Encoding Depth:</strong>
											{detectedEncodingDepth} layers
										</p>
									{/if}
								</FormInfo>
							</FormSection>
						{/if}

						<FormSection title="Info" open={false}>
							<FormInfo title="Decoding Options">
								<p><strong>+ as space:</strong> Treats + as space (form data format)</p>
								<p class="mt-1">
									<strong>Invalid sequences:</strong> How to handle malformed % sequences
								</p>
								<p class="mt-1">
									<strong>Multiple layers:</strong> Recursively decode double/triple encoded content
								</p>
							</FormInfo>
						</FormSection>
					{/if}
				</OptionsPanel>

				<SplitPane class="h-full flex-1">
					{#snippet left()}
						<CodeEditor
							title={mode === 'encode' ? 'Text Input' : 'URL Encoded Input'}
							value={input}
							onchange={(v) => (input = v)}
							mode="input"
							editorMode="plain"
							placeholder={mode === 'encode'
								? 'Enter text to encode...'
								: 'Enter URL encoded text to decode...'}
							onsample={handleSample}
							onpaste={handlePaste}
							onclear={handleClear}
							showViewToggle={false}
						/>
					{/snippet}
					{#snippet right()}
						<CodeEditor
							title={mode === 'encode' ? 'URL Encoded Output' : 'Decoded Text'}
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
		{:else if tab === 'parse'}
			<div class="flex flex-1 flex-col overflow-hidden p-4">
				<div class="mb-4">
					<label for="url-parse-input" class="mb-1 block text-xs font-medium text-muted-foreground"
						>URL to Parse</label
					>
					<div class="flex gap-2">
						<Input
							id="url-parse-input"
							type="text"
							placeholder="https://example.com/path?query=value"
							value={parseInput}
							oninput={(e) => (parseInput = e.currentTarget.value)}
							class="flex-1 font-mono text-sm"
						/>
						<Button variant="outline" size="sm" onclick={handleParseSample}>Sample</Button>
					</div>
				</div>

				{#if parsedUrl}
					<div class="flex-1 space-y-4 overflow-auto">
						<!-- URL Components -->
						<div class="rounded-lg border bg-muted/30 p-4">
							<h3 class="mb-3 text-sm font-medium">URL Components</h3>
							<div class="grid gap-2 text-xs">
								{#each Object.entries(parsedUrl.components).filter(([_, v]) => v) as [key, value]}
									<div class="flex items-center gap-2">
										<span class="w-24 font-medium text-muted-foreground">{key}:</span>
										<code class="flex-1 rounded bg-muted px-2 py-1 font-mono">{value}</code>
										<CopyButton text={String(value)} toastLabel={key} size="icon" class="h-6 w-6" />
									</div>
								{/each}
							</div>
						</div>

						<!-- Query Parameters -->
						{#if parsedUrl.params.length > 0}
							<div class="rounded-lg border bg-muted/30 p-4">
								<h3 class="mb-3 text-sm font-medium">
									Query Parameters ({parsedUrl.params.length})
								</h3>
								<div class="space-y-2">
									{#each parsedUrl.params as param}
										<div class="flex items-center gap-2 text-xs">
											<code class="rounded bg-primary/10 px-2 py-1 font-mono text-primary"
												>{param.key}</code
											>
											<span class="text-muted-foreground">=</span>
											<code class="flex-1 rounded bg-muted px-2 py-1 font-mono">{param.value}</code>
											<CopyButton
												text={param.value}
												toastLabel={param.key}
												size="icon"
												class="h-6 w-6"
											/>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{:else if parseInput.trim()}
					<div class="flex flex-1 items-center justify-center text-muted-foreground">
						Invalid URL format
					</div>
				{:else}
					<div class="flex flex-1 items-center justify-center text-muted-foreground">
						Enter a URL to parse
					</div>
				{/if}
			</div>
		{:else if tab === 'build'}
			<div class="flex flex-1 flex-col overflow-hidden p-4">
				<div class="mb-4">
					<label for="url-base-input" class="mb-1 block text-xs font-medium text-muted-foreground"
						>Base URL</label
					>
					<Input
						id="url-base-input"
						type="text"
						placeholder="https://example.com/path"
						value={baseUrl}
						oninput={(e) => (baseUrl = e.currentTarget.value)}
						class="font-mono text-sm"
					/>
				</div>

				<div class="mb-4 flex-1 overflow-auto">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-medium text-muted-foreground">Query Parameters</span>
						<Button variant="outline" size="sm" onclick={addQueryParam}>
							<Plus class="mr-1 h-3 w-3" />
							Add Parameter
						</Button>
					</div>
					<div class="space-y-2">
						{#each queryParams as param, index}
							<div class="flex items-center gap-2">
								<Input
									type="text"
									placeholder="Key"
									value={param.key}
									oninput={(e) => updateQueryParam(index, 'key', e.currentTarget.value)}
									class="w-1/3 font-mono text-sm"
								/>
								<span class="text-muted-foreground">=</span>
								<Input
									type="text"
									placeholder="Value"
									value={param.value}
									oninput={(e) => updateQueryParam(index, 'value', e.currentTarget.value)}
									class="flex-1 font-mono text-sm"
								/>
								<Button variant="ghost" size="icon" onclick={() => removeQueryParam(index)}>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						{/each}
					</div>
				</div>

				<div class="rounded-lg border bg-muted/30 p-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-medium text-muted-foreground">Generated URL</span>
						<div class="flex gap-1">
							<CopyButton text={builtUrl} toastLabel="URL" size="sm" showLabel class="h-7" />
							<Button variant="ghost" size="sm" onclick={() => window.open(builtUrl, '_blank')}>
								<ExternalLink class="mr-1 h-3 w-3" />
								Open
							</Button>
						</div>
					</div>
					<code class="block break-all rounded bg-muted p-3 font-mono text-sm">{builtUrl}</code>
				</div>
			</div>
		{:else if tab === 'reference'}
			<div class="flex-1 overflow-auto p-4">
				<div class="rounded-lg border bg-muted/30 p-4">
					<h3 class="mb-4 text-sm font-medium">Common URL Encoded Characters</h3>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
						{#each URL_ENCODING_EXAMPLES as example}
							<div class="flex items-center gap-2 rounded bg-muted/50 p-2 text-xs">
								<code class="rounded bg-background px-2 py-1 font-mono"
									>{example.char === ' ' ? '␣' : example.char}</code
								>
								<span class="text-muted-foreground">→</span>
								<code class="rounded bg-primary/10 px-2 py-1 font-mono text-primary"
									>{example.encoded}</code
								>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	{/snippet}
</ToolShell>
