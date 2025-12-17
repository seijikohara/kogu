<script lang="ts">
	import {
		ArrowRightLeft,
		BookOpen,
		Copy,
		ExternalLink,
		Hammer,
		Link2,
		Plus,
		Trash2,
	} from '@lucide/svelte';
	import { PageHeader, SplitPane } from '$lib/components/layout/index.js';
	import OptionSelect from '$lib/components/options/option-select.svelte';
	import OptionsPanel from '$lib/components/options/options-panel.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import { EditorPane } from '$lib/components/tool/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		buildUrl,
		decodeUrl,
		decodeUrlComponent,
		encodeUrl,
		encodeUrlComponent,
		parseUrl,
		type QueryParameter,
		SAMPLE_URL,
		URL_ENCODING_EXAMPLES,
		type UrlEncodeMode,
	} from '$lib/services/encoders.js';

	type Tab = 'encode' | 'parse' | 'build' | 'reference';
	type Mode = 'encode' | 'decode';

	// Tab definitions for PageHeader
	const urlTabs = [
		{ id: 'encode', label: 'Encode/Decode', icon: ArrowRightLeft },
		{ id: 'parse', label: 'Parse URL', icon: Link2 },
		{ id: 'build', label: 'Build URL', icon: Hammer },
		{ id: 'reference', label: 'Reference', icon: BookOpen },
	] as const;

	// State
	let activeTab = $state<Tab>('encode');
	let mode = $state<Mode>('encode');
	let encodeMode = $state<UrlEncodeMode>('component');
	let input = $state('');
	let showOptions = $state(true);

	// URL Parser state
	let parseInput = $state('');

	// URL Builder state
	let baseUrl = $state('https://example.com/path');
	let queryParams = $state<QueryParameter[]>([
		{ key: 'query', value: 'hello world' },
		{ key: 'name', value: 'test' },
	]);

	// Computed output and error for encode/decode
	const encodeResult = $derived.by((): { output: string; error: string } => {
		if (!input.trim()) {
			return { output: '', error: '' };
		}

		try {
			let result: string;
			if (mode === 'encode') {
				result = encodeMode === 'component' ? encodeUrlComponent(input) : encodeUrl(input);
			} else {
				result = encodeMode === 'component' ? decodeUrlComponent(input) : decodeUrl(input);
			}
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

	// Validation state
	const valid = $derived.by((): boolean | null => {
		if (activeTab !== 'encode') return null;
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

	const handleCopyBuiltUrl = async () => {
		try {
			await navigator.clipboard.writeText(builtUrl);
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

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Clipboard access denied
		}
	};
</script>

<svelte:head>
	<title>URL Encoder - Kogu</title>
</svelte:head>

<div class="flex h-full flex-col overflow-hidden">
	<PageHeader
		tabs={urlTabs}
		{activeTab}
		ontabchange={(tab) => (activeTab = tab as Tab)}
		valid={activeTab === 'encode'
			? valid
			: activeTab === 'parse'
				? parsedUrl
					? true
					: parseInput.trim()
						? false
						: null
				: undefined}
		error={activeTab === 'encode' ? error : undefined}
	>
		{#snippet statusContent()}
			{#if activeTab === 'encode'}
				{#if input.trim() && output}
					<span class="text-muted-foreground">
						Input: <strong class="text-foreground">{input.length}</strong> chars
					</span>
					<span class="text-muted-foreground">
						Output: <strong class="text-foreground">{output.length}</strong> chars
					</span>
				{/if}
			{:else if activeTab === 'parse'}
				{#if parsedUrl}
					<span class="text-muted-foreground">
						Params: <strong class="text-foreground">{parsedUrl.params.length}</strong>
					</span>
				{/if}
			{:else if activeTab === 'build'}
				<span class="text-muted-foreground">
					Params: <strong class="text-foreground">{queryParams.length}</strong>
				</span>
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Content -->
	<div class="flex flex-1 overflow-hidden">
		{#if activeTab === 'encode'}
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
					<OptionSelect
						label="Encoding Mode"
						value={encodeMode}
						onchange={(v) => (encodeMode = v as UrlEncodeMode)}
						options={[
							{ value: 'component', label: 'encodeURIComponent' },
							{ value: 'uri', label: 'encodeURI' },
						]}
					/>
				</OptionsSection>

				<OptionsSection title="Info">
					<div class="space-y-2 text-[11px] text-muted-foreground">
						<p>
							<strong class="text-foreground">encodeURIComponent:</strong> Encodes all special characters
							including /, ?, &, =, #
						</p>
						<p>
							<strong class="text-foreground">encodeURI:</strong> Preserves URL structure characters (/,
							?, &, =, #, :)
						</p>
					</div>
				</OptionsSection>
			</OptionsPanel>

			<SplitPane class="h-full flex-1">
				{#snippet left()}
					<EditorPane
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
					<EditorPane
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
		{:else if activeTab === 'parse'}
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
										<Button
											variant="ghost"
											size="icon"
											class="h-6 w-6"
											onclick={() => copyToClipboard(String(value))}
										>
											<Copy class="h-3 w-3" />
										</Button>
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
											<Button
												variant="ghost"
												size="icon"
												class="h-6 w-6"
												onclick={() => copyToClipboard(param.value)}
											>
												<Copy class="h-3 w-3" />
											</Button>
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
		{:else if activeTab === 'build'}
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
							<Button variant="ghost" size="sm" onclick={handleCopyBuiltUrl}>
								<Copy class="mr-1 h-3 w-3" />
								Copy
							</Button>
							<Button variant="ghost" size="sm" onclick={() => window.open(builtUrl, '_blank')}>
								<ExternalLink class="mr-1 h-3 w-3" />
								Open
							</Button>
						</div>
					</div>
					<code class="block break-all rounded bg-muted p-3 font-mono text-sm">{builtUrl}</code>
				</div>
			</div>
		{:else if activeTab === 'reference'}
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
	</div>
</div>
