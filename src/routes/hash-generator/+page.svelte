<script lang="ts">
	import { Hash, ShieldAlert, ShieldCheck } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { CodeEditor } from '$lib/components/editor';
	import { FormInfo, FormSection } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { ToolShell } from '$lib/components/shell';
	import { EmptyState, StatItem } from '$lib/components/status';
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

<ToolShell valid={textInput.trim() ? true : null} bind:showRail={showOptions}>
	{#snippet statusContent()}
		{#if textInput.trim()}
			<StatItem label="Chars" value={textStats.chars} />
			<StatItem label="Size" value={textStats.size} />
		{/if}
	{/snippet}

	{#snippet rail()}
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
						<ShieldCheck class="h-3 w-3 text-success" />
						<span class="text-success">Secure:</span>
						<span>SHA-256, SHA-384, SHA-512</span>
					</div>
					<div class="flex items-center gap-2">
						<ShieldAlert class="h-3 w-3 text-warning" />
						<span class="text-warning">Weak:</span>
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
			<SectionHeader title="Hash Results" />
			<div class="flex-1 overflow-auto p-4">
				{#if textHashes.length > 0}
					<div class="space-y-3">
						{#each textHashes as result}
							<div class="rounded-lg border bg-surface-3 p-3">
								<div class="mb-2 flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="font-mono text-sm font-medium">{result.algorithm}</span>
										<span class="text-xs text-muted-foreground">({result.bits} bits)</span>
										{#if getSecurityBadge(result.algorithm)}
											<span class="flex items-center gap-1 text-xs text-success">
												<ShieldCheck class="h-3 w-3" />
												Secure
											</span>
										{:else}
											<span class="flex items-center gap-1 text-xs text-warning">
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
					<EmptyState icon={Hash} title="Enter text to generate hashes" />
				{/if}
			</div>
		</div>
	</div>
</ToolShell>
