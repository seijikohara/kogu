<script lang="ts">
	import { Hash, ShieldAlert, ShieldCheck } from '@lucide/svelte';
	import { PageLayout } from '$lib/components/layout';
	import { CopyButton } from '$lib/components/action';
	import { FormInfo, FormSection } from '$lib/components/form';
	import { CodeEditor } from '$lib/components/editor';
	import {
		formatBytes,
		generateAllHashes,
		HASH_ALGORITHMS,
		type HashResult,
		SAMPLE_TEXT_FOR_HASH,
	} from '$lib/services/encoders.js';

	// State
	let textInput = $state('');
	let showOptions = $state(true);

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

	// Get security badge for algorithm
	const getSecurityBadge = (algorithm: string) => {
		const algo = HASH_ALGORITHMS.find((a) => a.algorithm === algorithm);
		return algo?.secure ?? false;
	};
</script>

<svelte:head>
	<title>Hash Generator - Kogu</title>
</svelte:head>

<PageLayout valid={textInput.trim() ? true : null} bind:showOptions>
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

	{#snippet options()}
		<FormSection title="About Hash">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li>One-way cryptographic function</li>
					<li>Same input always produces same output</li>
					<li>Cannot be reversed to original data</li>
					<li>Small change in input = completely different hash</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Security">
			<FormInfo showIcon={false}>
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<ShieldCheck class="h-3 w-3 text-green-600 dark:text-green-400" />
						<span class="text-green-600 dark:text-green-400">Secure:</span>
						<span>SHA-256, SHA-384, SHA-512</span>
					</div>
					<div class="flex items-center gap-2">
						<ShieldAlert class="h-3 w-3 text-amber-600 dark:text-amber-400" />
						<span class="text-amber-600 dark:text-amber-400">Weak:</span>
						<span>MD5, SHA-1</span>
					</div>
				</div>
			</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Main Content: Input + Results -->
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Input Editor -->
		<div class="h-1/3 shrink-0 border-b">
			<CodeEditor
				title="Input Text"
				bind:value={textInput}
				mode="input"
				editorMode="plain"
				placeholder="Enter text to hash..."
				showViewToggle={false}
				onpaste={handlePaste}
				onclear={handleClear}
				onsample={handleSample}
			/>
		</div>

		<!-- Hash Results -->
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
									<CopyButton
										text={result.hash}
										toastLabel={result.algorithm}
										size="sm"
										showLabel
										class="h-6"
									/>
								</div>
								<code class="block break-all rounded bg-muted p-2 font-mono text-xs"
									>{result.hash}</code
								>
							</div>
						{/each}
					</div>
				{:else}
					<div class="flex h-full items-center justify-center text-muted-foreground">
						<div class="text-center">
							<Hash class="mx-auto mb-2 h-12 w-12 opacity-50" />
							<p class="text-sm">Enter text to generate hashes</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</PageLayout>
