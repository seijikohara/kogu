<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Check, Copy, Hash, ShieldCheck, X } from '@lucide/svelte';
	import { PageHeader } from '$lib/components/layout/index.js';
	import {
		OptionInput,
		OptionSlider,
		OptionsInfo,
		OptionsPanel,
		OptionsSection,
	} from '$lib/components/options/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		DEFAULT_BCRYPT_COST,
		generateBcryptHash,
		getBcryptCostInfo,
		MAX_BCRYPT_COST,
		MIN_BCRYPT_COST,
		verifyBcryptHash,
		type BcryptCostInfo,
		type BcryptHashResult,
		type BcryptVerifyResult,
	} from '$lib/services/generators.js';

	// State - Generate tab
	let password = $state('');
	let cost = $state(DEFAULT_BCRYPT_COST);
	let hashResult = $state<BcryptHashResult | null>(null);
	let isGenerating = $state(false);
	let generateError = $state<string | null>(null);

	// State - Verify tab
	let verifyPassword = $state('');
	let verifyHash = $state('');
	let verifyResult = $state<BcryptVerifyResult | null>(null);
	let isVerifying = $state(false);
	let verifyError = $state<string | null>(null);

	// UI state
	let showOptions = $state(true);
	let costInfo = $state<BcryptCostInfo | null>(null);
	let activeTab = $state<'generate' | 'verify'>('generate');

	// Load cost info
	$effect(() => {
		getBcryptCostInfo(cost)
			.then((info) => {
				costInfo = info;
			})
			.catch(() => {
				costInfo = null;
			});
	});

	// Derived
	const canGenerate = $derived(password.trim().length > 0);
	const canVerify = $derived(verifyPassword.trim().length > 0 && verifyHash.trim().length > 0);

	const estimatedTime = $derived.by(() => {
		if (!costInfo) return 'Unknown';
		const ms = costInfo.estimated_time_ms;
		if (ms < 1000) return `~${Math.round(ms)}ms`;
		return `~${(ms / 1000).toFixed(1)}s`;
	});

	// Handlers
	const handleGenerate = async () => {
		if (!canGenerate) return;

		isGenerating = true;
		generateError = null;
		hashResult = null;

		try {
			hashResult = await generateBcryptHash(password, cost);
			toast.success('BCrypt hash generated successfully');
		} catch (e) {
			generateError = e instanceof Error ? e.message : String(e);
			toast.error('Failed to generate hash', { description: generateError });
		} finally {
			isGenerating = false;
		}
	};

	const handleVerify = async () => {
		if (!canVerify) return;

		isVerifying = true;
		verifyError = null;
		verifyResult = null;

		try {
			verifyResult = await verifyBcryptHash(verifyPassword, verifyHash);
			if (verifyResult.valid) {
				toast.success('Password matches the hash');
			} else {
				toast.error('Password does not match the hash');
			}
		} catch (e) {
			verifyError = e instanceof Error ? e.message : String(e);
			toast.error('Verification failed', { description: verifyError });
		} finally {
			isVerifying = false;
		}
	};

	const copyToClipboard = async (text: string, label: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${label} copied to clipboard`);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const handleClearGenerate = () => {
		password = '';
		hashResult = null;
		generateError = null;
	};

	const handleClearVerify = () => {
		verifyPassword = '';
		verifyHash = '';
		verifyResult = null;
		verifyError = null;
	};
</script>

<svelte:head>
	<title>BCrypt Generator - Kogu</title>
</svelte:head>

<div class="flex h-full flex-col overflow-hidden">
	<PageHeader
		valid={activeTab === 'generate'
			? hashResult
				? true
				: null
			: verifyResult
				? verifyResult.valid
				: null}
	>
		{#snippet statusContent()}
			{#if activeTab === 'generate' && hashResult}
				<span class="text-muted-foreground">
					Cost: <strong class="text-foreground">{hashResult.cost}</strong>
				</span>
				<span class="text-muted-foreground">
					Algorithm: <strong class="text-foreground">$2b$</strong>
				</span>
			{:else if activeTab === 'verify' && verifyResult}
				<span class="flex items-center gap-1">
					{#if verifyResult.valid}
						<Check class="h-3 w-3 text-green-600" />
						<span class="text-green-600 dark:text-green-400">Valid</span>
					{:else}
						<X class="h-3 w-3 text-red-600" />
						<span class="text-red-600 dark:text-red-400">Invalid</span>
					{/if}
				</span>
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Content -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Options Panel -->
		<OptionsPanel
			show={showOptions}
			onclose={() => (showOptions = false)}
			onopen={() => (showOptions = true)}
		>
			<OptionsSection title="Mode">
				<div class="flex gap-1">
					<Button
						variant={activeTab === 'generate' ? 'default' : 'outline'}
						size="sm"
						class="flex-1"
						onclick={() => (activeTab = 'generate')}
					>
						<Hash class="mr-1 h-3 w-3" />
						Generate
					</Button>
					<Button
						variant={activeTab === 'verify' ? 'default' : 'outline'}
						size="sm"
						class="flex-1"
						onclick={() => (activeTab = 'verify')}
					>
						<ShieldCheck class="mr-1 h-3 w-3" />
						Verify
					</Button>
				</div>
			</OptionsSection>

			{#if activeTab === 'generate'}
				<OptionsSection title="Password">
					<OptionInput
						label="Password"
						type="password"
						showToggle
						bind:value={password}
						placeholder="Enter password to hash..."
					/>
				</OptionsSection>

				<OptionsSection title="Cost Factor">
					<OptionSlider
						label="Cost"
						bind:value={cost}
						min={MIN_BCRYPT_COST}
						max={MAX_BCRYPT_COST}
						step={1}
						valueLabel={`${cost} (${costInfo?.security_level ?? '...'})`}
						hint={`Estimated time: ${estimatedTime}`}
					/>
				</OptionsSection>

				<OptionsSection title="Actions">
					<div class="space-y-2">
						<Button class="w-full" onclick={handleGenerate} disabled={!canGenerate || isGenerating}>
							{#if isGenerating}
								<div
									class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
								></div>
								Generating...
							{:else}
								<Hash class="mr-2 h-4 w-4" />
								Generate Hash
							{/if}
						</Button>
						{#if hashResult || password}
							<Button variant="outline" class="w-full" onclick={handleClearGenerate}>Clear</Button>
						{/if}
					</div>
				</OptionsSection>
			{:else}
				<OptionsSection title="Password">
					<OptionInput
						label="Password"
						type="password"
						showToggle
						bind:value={verifyPassword}
						placeholder="Enter password to verify..."
					/>
				</OptionsSection>

				<OptionsSection title="Hash">
					<OptionInput label="BCrypt Hash" bind:value={verifyHash} placeholder="$2b$10$..." />
				</OptionsSection>

				<OptionsSection title="Actions">
					<div class="space-y-2">
						<Button class="w-full" onclick={handleVerify} disabled={!canVerify || isVerifying}>
							{#if isVerifying}
								<div
									class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
								></div>
								Verifying...
							{:else}
								<ShieldCheck class="mr-2 h-4 w-4" />
								Verify Hash
							{/if}
						</Button>
						{#if verifyResult || verifyPassword || verifyHash}
							<Button variant="outline" class="w-full" onclick={handleClearVerify}>Clear</Button>
						{/if}
					</div>
				</OptionsSection>
			{/if}

			<OptionsSection title="About BCrypt">
				<OptionsInfo>
					<ul class="list-inside list-disc space-y-0.5">
						<li>Password hashing algorithm</li>
						<li>Salted and adaptive</li>
						<li>Cost factor controls security/speed tradeoff</li>
						<li>Recommended cost: 10-12 for most use cases</li>
					</ul>
				</OptionsInfo>
			</OptionsSection>

			<OptionsSection title="Cost Recommendations">
				<OptionsInfo showIcon={false}>
					<div class="space-y-0.5">
						<div class="flex justify-between">
							<span>4-7:</span>
							<span class="text-amber-600 dark:text-amber-400">Development only</span>
						</div>
						<div class="flex justify-between">
							<span>8-9:</span>
							<span>Low security</span>
						</div>
						<div class="flex justify-between">
							<span>10-11:</span>
							<span class="text-green-600 dark:text-green-400">Standard</span>
						</div>
						<div class="flex justify-between">
							<span>12-13:</span>
							<span>High security</span>
						</div>
						<div class="flex justify-between">
							<span>14+:</span>
							<span>Very high security</span>
						</div>
					</div>
				</OptionsInfo>
			</OptionsSection>
		</OptionsPanel>

		<!-- Results Panel -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<div class="flex h-9 shrink-0 items-center border-b bg-muted/30 px-3">
				<span class="text-xs font-medium text-muted-foreground">
					{activeTab === 'generate' ? 'Generated Hash' : 'Verification Result'}
				</span>
			</div>

			<div class="flex-1 overflow-auto p-4">
				{#if activeTab === 'generate'}
					{#if hashResult}
						<div class="space-y-4">
							<!-- Hash Result -->
							<div class="rounded-lg border bg-muted/30 p-4">
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-medium">BCrypt Hash</span>
									<Button
										variant="ghost"
										size="sm"
										class="h-7 gap-1 px-2 text-xs"
										onclick={() => copyToClipboard(hashResult!.hash, 'Hash')}
									>
										<Copy class="h-3 w-3" />
										Copy
									</Button>
								</div>
								<code class="block break-all rounded bg-muted p-3 font-mono text-sm">
									{hashResult.hash}
								</code>
							</div>

							<!-- Hash Details -->
							<div class="rounded-lg border bg-muted/30 p-4">
								<span class="mb-3 block text-sm font-medium">Hash Details</span>
								<div class="space-y-2 text-sm">
									<div class="flex justify-between">
										<span class="text-muted-foreground">Algorithm</span>
										<span class="font-mono">${hashResult.algorithm}$</span>
									</div>
									<div class="flex justify-between">
										<span class="text-muted-foreground">Cost Factor</span>
										<span class="font-mono">{hashResult.cost}</span>
									</div>
									<div class="flex justify-between">
										<span class="text-muted-foreground">Security Level</span>
										<span>{costInfo?.security_level ?? 'Unknown'}</span>
									</div>
									<div class="flex justify-between">
										<span class="text-muted-foreground">Hash Length</span>
										<span class="font-mono">{hashResult.hash.length} chars</span>
									</div>
								</div>
							</div>
						</div>
					{:else if generateError}
						<div class="flex h-full items-center justify-center">
							<div
								class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center"
							>
								<p class="text-sm text-destructive">{generateError}</p>
							</div>
						</div>
					{:else}
						<div class="flex h-full items-center justify-center text-muted-foreground">
							<div class="text-center">
								<Hash class="mx-auto mb-2 h-12 w-12 opacity-50" />
								<p class="text-sm">Enter a password and generate a BCrypt hash</p>
							</div>
						</div>
					{/if}
				{:else if verifyResult}
					<div class="space-y-4">
						<!-- Verification Result -->
						<div
							class={`rounded-lg border p-6 ${verifyResult.valid ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}
						>
							<div class="flex items-center justify-center gap-3">
								{#if verifyResult.valid}
									<Check class="h-8 w-8 text-green-600 dark:text-green-400" />
									<div class="text-center">
										<p class="text-lg font-semibold text-green-600 dark:text-green-400">
											Password Valid
										</p>
										<p class="text-sm text-muted-foreground">The password matches the hash</p>
									</div>
								{:else}
									<X class="h-8 w-8 text-red-600 dark:text-red-400" />
									<div class="text-center">
										<p class="text-lg font-semibold text-red-600 dark:text-red-400">
											Password Invalid
										</p>
										<p class="text-sm text-muted-foreground">
											The password does not match the hash
										</p>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{:else if verifyError}
					<div class="flex h-full items-center justify-center">
						<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
							<p class="text-sm text-destructive">{verifyError}</p>
						</div>
					</div>
				{:else}
					<div class="flex h-full items-center justify-center text-muted-foreground">
						<div class="text-center">
							<ShieldCheck class="mx-auto mb-2 h-12 w-12 opacity-50" />
							<p class="text-sm">Enter a password and hash to verify</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
