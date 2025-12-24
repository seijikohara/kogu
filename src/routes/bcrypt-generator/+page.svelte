<script lang="ts">
	import { Check, Hash, ShieldCheck, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ActionButton, CopyButton } from '$lib/components/action';
	import { FormInfo, FormInput, FormMode, FormSection, FormSlider } from '$lib/components/form';
	import { PageLayout } from '$lib/components/layout';
	import { LoadingOverlay } from '$lib/components/status';
	import {
		type BcryptCostInfo,
		type BcryptHashResult,
		type BcryptVerifyResult,
		cancelWorkerOperation,
		DEFAULT_BCRYPT_COST,
		generateBcryptHash,
		getBcryptCostInfo,
		MAX_BCRYPT_COST,
		MIN_BCRYPT_COST,
		verifyBcryptHash,
	} from '$lib/services/generators.js';

	// State - Generate tab
	let password = $state('');
	let cost = $state(DEFAULT_BCRYPT_COST);
	let hashResult = $state<BcryptHashResult | null>(null);
	let isGenerating = $state(false);
	let generateError = $state<string | null>(null);
	let generateCancelled = $state(false);

	// State - Verify tab
	let verifyPassword = $state('');
	let verifyHash = $state('');
	let verifyResult = $state<BcryptVerifyResult | null>(null);
	let isVerifying = $state(false);
	let verifyError = $state<string | null>(null);
	let verifyCancelled = $state(false);

	// UI state
	let showOptions = $state(true);
	let costInfo = $state<BcryptCostInfo | null>(null);
	let activeTab = $state<'generate' | 'verify'>('generate');

	// Elapsed time tracking
	let elapsedMs = $state(0);
	let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);

	const startTimer = () => {
		elapsedMs = 0;
		timerInterval = setInterval(() => {
			elapsedMs += 100;
		}, 100);
	};

	const stopTimer = () => {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	};

	const formatElapsedTime = (ms: number): string => {
		if (ms < 1000) return `${Math.round(ms)}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	};

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

	const elapsedTimeDisplay = $derived(formatElapsedTime(elapsedMs));

	// Handlers
	const handleGenerate = async () => {
		if (!canGenerate) return;

		isGenerating = true;
		generateCancelled = false;
		generateError = null;
		hashResult = null;
		startTimer();

		try {
			const result = await generateBcryptHash(password, cost);
			if (!generateCancelled) {
				hashResult = result;
				toast.success('BCrypt hash generated successfully');
			}
		} catch (e) {
			if (!generateCancelled) {
				generateError = e instanceof Error ? e.message : String(e);
				toast.error('Failed to generate hash', { description: generateError });
			}
		} finally {
			stopTimer();
			isGenerating = false;
		}
	};

	const handleCancelGenerate = async () => {
		generateCancelled = true;
		await cancelWorkerOperation();
		stopTimer();
		isGenerating = false;
		toast.info('Hash generation cancelled');
	};

	const handleVerify = async () => {
		if (!canVerify) return;

		isVerifying = true;
		verifyCancelled = false;
		verifyError = null;
		verifyResult = null;
		startTimer();

		try {
			const result = await verifyBcryptHash(verifyPassword, verifyHash);
			if (!verifyCancelled) {
				verifyResult = result;
				if (result.valid) {
					toast.success('Password matches the hash');
				} else {
					toast.error('Password does not match the hash');
				}
			}
		} catch (e) {
			if (!verifyCancelled) {
				verifyError = e instanceof Error ? e.message : String(e);
				toast.error('Verification failed', { description: verifyError });
			}
		} finally {
			stopTimer();
			isVerifying = false;
		}
	};

	const handleCancelVerify = async () => {
		verifyCancelled = true;
		await cancelWorkerOperation();
		stopTimer();
		isVerifying = false;
		toast.info('Verification cancelled');
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

<PageLayout
	valid={activeTab === 'generate'
		? hashResult
			? true
			: null
		: verifyResult
			? verifyResult.valid
			: null}
	bind:showOptions
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

	{#snippet options()}
		<FormSection title="Mode">
			<FormMode
				value={activeTab}
				onchange={(v) => (activeTab = v as 'generate' | 'verify')}
				options={[
					{ value: 'generate', label: 'Generate', icon: Hash },
					{ value: 'verify', label: 'Verify', icon: ShieldCheck },
				]}
			/>
		</FormSection>

		{#if activeTab === 'generate'}
			<FormSection title="Password">
				<FormInput
					label="Password"
					type="password"
					showToggle
					bind:value={password}
					placeholder="Enter password to hash..."
				/>
			</FormSection>

			<FormSection title="Cost Factor">
				<FormSlider
					label="Cost"
					bind:value={cost}
					min={MIN_BCRYPT_COST}
					max={MAX_BCRYPT_COST}
					step={1}
					valueLabel={`${cost} (${costInfo?.security_level ?? '...'})`}
					hint={`Estimated time: ${estimatedTime}`}
				/>
			</FormSection>

			<FormSection title="Actions">
				<div class="space-y-2">
					<ActionButton
						label="Generate Hash"
						icon={Hash}
						loading={isGenerating}
						loadingLabel="Generating..."
						disabled={!canGenerate}
						onclick={handleGenerate}
					/>
					{#if hashResult || password}
						<ActionButton label="Clear" variant="outline" onclick={handleClearGenerate} />
					{/if}
				</div>
			</FormSection>
		{:else}
			<FormSection title="Password">
				<FormInput
					label="Password"
					type="password"
					showToggle
					bind:value={verifyPassword}
					placeholder="Enter password to verify..."
				/>
			</FormSection>

			<FormSection title="Hash">
				<FormInput label="BCrypt Hash" bind:value={verifyHash} placeholder="$2b$10$..." />
			</FormSection>

			<FormSection title="Actions">
				<div class="space-y-2">
					<ActionButton
						label="Verify Hash"
						icon={ShieldCheck}
						loading={isVerifying}
						loadingLabel="Verifying..."
						disabled={!canVerify}
						onclick={handleVerify}
					/>
					{#if verifyResult || verifyPassword || verifyHash}
						<ActionButton label="Clear" variant="outline" onclick={handleClearVerify} />
					{/if}
				</div>
			</FormSection>
		{/if}

		<FormSection title="About BCrypt">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li>Password hashing algorithm</li>
					<li>Salted and adaptive</li>
					<li>Cost factor controls security/speed tradeoff</li>
					<li>Recommended cost: 10-12 for most use cases</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Cost Recommendations">
			<FormInfo showIcon={false}>
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
			</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Results Panel -->
	<div class="relative flex h-full flex-col overflow-hidden">
		<LoadingOverlay
			show={isGenerating || isVerifying}
			title={isGenerating ? 'Generating Hash...' : 'Verifying Hash...'}
			message="BCrypt computation in progress"
			{estimatedTime}
			elapsedTime={elapsedTimeDisplay}
			oncancel={isGenerating ? handleCancelGenerate : handleCancelVerify}
		/>
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
								<CopyButton
									text={hashResult.hash}
									toastLabel="Hash"
									size="sm"
									showLabel
									class="h-7"
								/>
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
						<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
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
									<p class="text-sm text-muted-foreground">The password does not match the hash</p>
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
</PageLayout>
