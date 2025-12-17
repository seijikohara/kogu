<script lang="ts">
	import { PageHeader } from '$lib/components/layout/index.js';
	import { EditorPane } from '$lib/components/tool/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		Copy,
		FileUp,
		CheckCircle,
		XCircle,
		ShieldAlert,
		ShieldCheck,
		Trash2,
		Text,
		File as FileIcon,
		GitCompare,
	} from '@lucide/svelte';
	import {
		generateAllHashes,
		generateAllFileHashes,
		compareHashes,
		HASH_ALGORITHMS,
		SAMPLE_TEXT_FOR_HASH,
		formatBytes,
		type HashResult,
	} from '$lib/services/encoders.js';

	type Tab = 'text' | 'file' | 'compare';

	// Tab definitions for PageHeader
	const hashTabs = [
		{ id: 'text', label: 'Text Hash', icon: Text },
		{ id: 'file', label: 'File Hash', icon: FileIcon },
		{ id: 'compare', label: 'Compare', icon: GitCompare },
	] as const;

	// State
	let activeTab = $state<Tab>('text');
	let textInput = $state('');
	let fileInput = $state<File | null>(null);
	let fileHashes = $state<HashResult[]>([]);
	let isProcessingFile = $state(false);

	// Compare state
	let hash1 = $state('');
	let hash2 = $state('');

	// Computed text hashes
	const textHashes = $derived.by((): HashResult[] => {
		if (!textInput.trim()) return [];
		return generateAllHashes(textInput);
	});

	// Compare result
	const hashesMatch = $derived.by((): boolean | null => {
		if (!hash1.trim() || !hash2.trim()) return null;
		return compareHashes(hash1, hash2);
	});

	// Stats
	const textStats = $derived.by(() => {
		const text = textInput || '';
		const bytes = new TextEncoder().encode(text).length;
		return {
			chars: text.length,
			bytes,
			size: formatBytes(bytes),
		};
	});

	// Handlers
	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) textInput = text;
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => {
		textInput = '';
	};

	const handleSample = () => {
		textInput = SAMPLE_TEXT_FOR_HASH;
	};

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleFileSelect = async (event: Event) => {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		// Limit file size to 100MB
		if (file.size > 100 * 1024 * 1024) {
			alert('File size must be less than 100MB');
			return;
		}

		fileInput = file;
		isProcessingFile = true;

		try {
			fileHashes = await generateAllFileHashes(file);
		} catch (e) {
			console.error('Failed to generate file hashes:', e);
			fileHashes = [];
		} finally {
			isProcessingFile = false;
		}
	};

	const clearFile = () => {
		fileInput = null;
		fileHashes = [];
	};

	// Get security badge for algorithm
	const getSecurityBadge = (algorithm: string) => {
		const algo = HASH_ALGORITHMS.find((a) => a.algorithm === algorithm);
		return algo?.secure ?? false;
	};
</script>

<svelte:head>
	<title>Hash Generator - Kogu</title>
</svelte:head>

<div class="flex h-full flex-col overflow-hidden">
	<PageHeader
		tabs={hashTabs}
		{activeTab}
		ontabchange={(tab) => (activeTab = tab as Tab)}
		valid={activeTab === 'text'
			? textInput.trim()
				? true
				: null
			: activeTab === 'file'
				? fileHashes.length > 0
					? true
					: null
				: undefined}
	>
		{#snippet statusContent()}
			{#if activeTab === 'text'}
				{#if textInput.trim()}
					<span class="text-muted-foreground">
						<strong class="text-foreground">{textStats.chars}</strong> chars
					</span>
					<span class="text-muted-foreground">
						<strong class="text-foreground">{textStats.size}</strong>
					</span>
				{/if}
			{:else if activeTab === 'file'}
				{#if fileInput}
					<span class="text-muted-foreground">
						<strong class="text-foreground">{fileInput.name}</strong>
					</span>
					<span class="text-muted-foreground">
						<strong class="text-foreground">{formatBytes(fileInput.size)}</strong>
					</span>
				{/if}
			{:else if activeTab === 'compare'}
				{#if hashesMatch !== null}
					{#if hashesMatch}
						<span class="flex items-center gap-1 text-green-600 dark:text-green-400">
							<CheckCircle class="h-3 w-3" />
							Hashes match
						</span>
					{:else}
						<span class="flex items-center gap-1 text-destructive">
							<XCircle class="h-3 w-3" />
							Hashes do not match
						</span>
					{/if}
				{/if}
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Content -->
	<div class="flex flex-1 overflow-hidden">
		{#if activeTab === 'text'}
			<!-- Text Hash Tab -->
			<div class="w-2/5 border-r">
				<EditorPane
					title="Input Text"
					bind:value={textInput}
					mode="input"
					editorMode="plain"
					placeholder="Enter text to hash..."
					onpaste={handlePaste}
					onclear={handleClear}
					onsample={handleSample}
					showViewToggle={false}
				/>
			</div>

			<!-- Hash results -->
			<div class="flex flex-1 flex-col overflow-hidden">
				<div class="flex h-9 shrink-0 items-center border-b bg-muted/30 px-3">
					<span class="text-xs font-medium text-muted-foreground">Hash Results</span>
				</div>
				<div class="flex-1 overflow-auto p-4">
					{#if textHashes.length > 0}
						<div class="space-y-3">
							{#each textHashes as result}
								<div class="rounded-lg border bg-muted/30 p-3">
									<div class="mb-2 flex items-center justify-between">
										<div class="flex items-center gap-2">
											<span class="font-mono text-sm font-medium">{result.algorithm}</span>
											<span class="text-xs text-muted-foreground">({result.bits} bits)</span>
											{#if getSecurityBadge(result.algorithm)}
												<span
													class="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"
												>
													<ShieldCheck class="h-3 w-3" />
													Secure
												</span>
											{:else}
												<span
													class="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
												>
													<ShieldAlert class="h-3 w-3" />
													Weak
												</span>
											{/if}
										</div>
										<Button
											variant="ghost"
											size="sm"
											class="h-6 gap-1 px-2 text-xs"
											onclick={() => copyToClipboard(result.hash)}
										>
											<Copy class="h-3 w-3" />
											Copy
										</Button>
									</div>
									<code class="block break-all rounded bg-muted p-2 font-mono text-xs"
										>{result.hash}</code
									>
								</div>
							{/each}
						</div>
					{:else}
						<div class="flex h-full items-center justify-center text-muted-foreground">
							<p class="text-sm">Enter text to generate hashes</p>
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'file'}
			<!-- File Hash Tab -->
			<div class="flex flex-1 flex-col overflow-hidden p-4">
				<!-- File input -->
				<div class="mb-4">
					<label
						class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
					>
						<FileUp class="mb-2 h-8 w-8 text-muted-foreground" />
						<span class="mb-1 text-sm font-medium">Drop file here or click to select</span>
						<span class="text-xs text-muted-foreground">Maximum file size: 100MB</span>
						<input type="file" class="hidden" onchange={handleFileSelect} />
					</label>
				</div>

				{#if fileInput}
					<!-- File info -->
					<div class="mb-4 flex items-center justify-between rounded-lg border bg-muted/30 p-3">
						<div>
							<p class="font-medium">{fileInput.name}</p>
							<p class="text-xs text-muted-foreground">
								{formatBytes(fileInput.size)} • {fileInput.type || 'Unknown type'}
							</p>
						</div>
						<Button variant="outline" size="sm" onclick={clearFile}>
							<Trash2 class="mr-1 h-3 w-3" />
							Clear
						</Button>
					</div>

					<!-- Hash results -->
					{#if isProcessingFile}
						<div class="flex flex-1 items-center justify-center">
							<div class="text-center">
								<div
									class="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"
								></div>
								<p class="text-sm text-muted-foreground">Generating hashes...</p>
							</div>
						</div>
					{:else if fileHashes.length > 0}
						<div class="flex-1 space-y-3 overflow-auto">
							{#each fileHashes as result}
								<div class="rounded-lg border bg-muted/30 p-3">
									<div class="mb-2 flex items-center justify-between">
										<div class="flex items-center gap-2">
											<span class="font-mono text-sm font-medium">{result.algorithm}</span>
											<span class="text-xs text-muted-foreground">({result.bits} bits)</span>
											{#if getSecurityBadge(result.algorithm)}
												<span
													class="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"
												>
													<ShieldCheck class="h-3 w-3" />
													Secure
												</span>
											{:else}
												<span
													class="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
												>
													<ShieldAlert class="h-3 w-3" />
													Weak
												</span>
											{/if}
										</div>
										<Button
											variant="ghost"
											size="sm"
											class="h-6 gap-1 px-2 text-xs"
											onclick={() => copyToClipboard(result.hash)}
										>
											<Copy class="h-3 w-3" />
											Copy
										</Button>
									</div>
									<code class="block break-all rounded bg-muted p-2 font-mono text-xs"
										>{result.hash}</code
									>
								</div>
							{/each}
						</div>
					{/if}
				{:else}
					<div class="flex flex-1 items-center justify-center text-muted-foreground">
						<p class="text-sm">Select a file to generate hashes</p>
					</div>
				{/if}
			</div>
		{:else if activeTab === 'compare'}
			<!-- Compare Tab -->
			<div class="flex flex-1 flex-col overflow-hidden p-4">
				<div class="space-y-4">
					<div>
						<label for="hash-compare-1" class="mb-1 block text-xs font-medium text-muted-foreground"
							>Hash 1</label
						>
						<Input
							id="hash-compare-1"
							type="text"
							placeholder="Enter first hash..."
							value={hash1}
							oninput={(e) => (hash1 = e.currentTarget.value)}
							class="font-mono text-sm"
						/>
					</div>
					<div>
						<label for="hash-compare-2" class="mb-1 block text-xs font-medium text-muted-foreground"
							>Hash 2</label
						>
						<Input
							id="hash-compare-2"
							type="text"
							placeholder="Enter second hash..."
							value={hash2}
							oninput={(e) => (hash2 = e.currentTarget.value)}
							class="font-mono text-sm"
						/>
					</div>
				</div>

				{#if hashesMatch !== null}
					<div
						class="mt-6 rounded-lg border p-6 text-center {hashesMatch
							? 'border-green-500/50 bg-green-500/10'
							: 'border-destructive/50 bg-destructive/10'}"
					>
						{#if hashesMatch}
							<CheckCircle class="mx-auto mb-2 h-12 w-12 text-green-600 dark:text-green-400" />
							<h3 class="text-lg font-medium text-green-600 dark:text-green-400">Hashes Match</h3>
							<p class="mt-1 text-sm text-muted-foreground">The two hash values are identical.</p>
						{:else}
							<XCircle class="mx-auto mb-2 h-12 w-12 text-destructive" />
							<h3 class="text-lg font-medium text-destructive">Hashes Do Not Match</h3>
							<p class="mt-1 text-sm text-muted-foreground">The two hash values are different.</p>
						{/if}
					</div>
				{/if}

				<!-- Algorithm reference -->
				<div class="mt-6 rounded-lg border bg-muted/30 p-4">
					<h3 class="mb-3 text-sm font-medium">Supported Algorithms</h3>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each HASH_ALGORITHMS as algo}
							<div class="flex items-center gap-2 rounded bg-muted/50 p-2 text-xs">
								<span class="font-mono font-medium">{algo.algorithm}</span>
								<span class="text-muted-foreground">({algo.bits} bits)</span>
								{#if algo.secure}
									<ShieldCheck class="h-3 w-3 text-green-600 dark:text-green-400" />
								{:else}
									<ShieldAlert class="h-3 w-3 text-amber-600 dark:text-amber-400" />
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
