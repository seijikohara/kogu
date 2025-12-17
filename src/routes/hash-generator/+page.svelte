<script lang="ts">
	import { Copy, ShieldAlert, ShieldCheck } from '@lucide/svelte';
	import { PageHeader } from '$lib/components/layout/index.js';
	import { EditorPane } from '$lib/components/tool/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		formatBytes,
		generateAllHashes,
		HASH_ALGORITHMS,
		type HashResult,
		SAMPLE_TEXT_FOR_HASH,
	} from '$lib/services/encoders.js';

	// State
	let textInput = $state('');

	// Computed text hashes
	const textHashes = $derived.by((): HashResult[] => {
		if (!textInput.trim()) return [];
		return generateAllHashes(textInput);
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
	<PageHeader valid={textInput.trim() ? true : null}>
		{#snippet statusContent()}
			{#if textInput.trim()}
				<span class="text-muted-foreground">
					<strong class="text-foreground">{textStats.chars}</strong> chars
				</span>
				<span class="text-muted-foreground">
					<strong class="text-foreground">{textStats.size}</strong>
				</span>
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Content -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Input -->
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
	</div>
</div>
