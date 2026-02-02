<script lang="ts">
	import { Key, Lock, Terminal, Unlock, User } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ActionButton, CopyButton } from '$lib/components/action';
	import { FormCheckbox, FormInfo, FormInput, FormSection, FormSelect } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { ToolShell } from '$lib/components/shell';
	import { EmptyState, ErrorDisplay, LoadingOverlay, StatItem } from '$lib/components/status';
	import {
		buildGpgUserId,
		cancelWorkerOperation,
		type CliAvailability,
		checkCliAvailability,
		type GenerationMethod,
		GPG_ALGORITHMS,
		type GpgKeyAlgorithm,
		type GpgKeyResult,
		generateGpgKeyPair,
		isValidEmail,
	} from '$lib/services/generators.js';

	// State
	let name = $state('');
	let email = $state('');
	let comment = $state('');
	let algorithm = $state<GpgKeyAlgorithm>('rsa4096');
	let passphrase = $state('');
	let method = $state<GenerationMethod>('library');

	let keyResult = $state<GpgKeyResult | null>(null);
	let isGenerating = $state(false);
	let isCancelled = $state(false);
	let error = $state<string | null>(null);

	let cliAvailability = $state<CliAvailability | null>(null);

	// UI options
	let showOptions = $state(true);
	let showKeyInfo = $state(true);
	let showGpgCommands = $state(true);

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

	// Check CLI availability on mount
	$effect(() => {
		checkCliAvailability()
			.then((result) => {
				cliAvailability = result;
			})
			.catch(() => {
				cliAvailability = { ssh_keygen: false, gpg: false };
			});
	});

	// Derived
	const selectedAlgorithm = $derived(GPG_ALGORITHMS.find((a) => a.value === algorithm));
	const userIdPreview = $derived(buildGpgUserId(name, email, comment));
	const canGenerate = $derived(name.trim().length > 0 && isValidEmail(email));
	const gpgAvailable = $derived(cliAvailability?.gpg ?? false);
	const elapsedTimeDisplay = $derived(formatElapsedTime(elapsedMs));

	// Handlers
	const handleGenerate = async () => {
		if (!canGenerate) return;

		isGenerating = true;
		isCancelled = false;
		error = null;
		keyResult = null;
		startTimer();

		try {
			const result = await generateGpgKeyPair({
				name: name.trim(),
				email: email.trim(),
				comment: comment.trim() || undefined,
				algorithm,
				passphrase: passphrase || undefined,
				method,
			});
			if (!isCancelled) {
				keyResult = result;
				toast.success('GPG key pair generated successfully');
			}
		} catch (e) {
			if (!isCancelled) {
				error = e instanceof Error ? e.message : String(e);
				toast.error('Failed to generate GPG key', { description: error });
			}
		} finally {
			stopTimer();
			isGenerating = false;
		}
	};

	const handleCancel = async () => {
		isCancelled = true;
		await cancelWorkerOperation();
		stopTimer();
		isGenerating = false;
		toast.info('Key generation cancelled');
	};

	const handleClear = () => {
		keyResult = null;
		error = null;
	};
</script>

<svelte:head>
	<title>GPG Key Generator - Kogu</title>
</svelte:head>

<ToolShell valid={keyResult ? true : null} bind:showRail={showOptions}>
	{#snippet statusContent()}
		{#if keyResult}
			<StatItem label="Algorithm" value={keyResult.algorithm} />
			<StatItem label="Method" value={keyResult.method_used} />
		{/if}
	{/snippet}

	{#snippet rail()}
		<FormSection title="Identity">
			<div class="space-y-2">
				<FormInput
					label="Name *"
					bind:value={name}
					placeholder="John Doe"
					hint="Your real name or identity"
				/>
				<FormInput label="Email *" type="email" bind:value={email} placeholder="john@example.com" />
				{#if email && !isValidEmail(email)}
					<p class="text-2xs text-destructive">Please enter a valid email address</p>
				{/if}
				<FormInput label="Comment (optional)" bind:value={comment} placeholder="Work key" />
			</div>
		</FormSection>

		{#if name || email}
			<FormSection title="User ID Preview">
				<div class="rounded-md border bg-muted/30 p-2">
					<div class="mb-1 flex items-center gap-1.5 text-2xs text-muted-foreground">
						<User class="h-3 w-3" />
						Preview
					</div>
					<code class="text-xs">{userIdPreview}</code>
				</div>
			</FormSection>
		{/if}

		<FormSection title="Algorithm">
			<FormSelect
				label="Type"
				bind:value={algorithm}
				options={GPG_ALGORITHMS.map((a) => ({ value: a.value, label: a.label }))}
			/>
		</FormSection>

		<FormSection title="Security">
			<FormInput
				label="Passphrase (optional)"
				type="password"
				showToggle
				bind:value={passphrase}
				placeholder="Enter passphrase..."
				hint="Recommended for key protection"
			/>
		</FormSection>

		<FormSection title="Generation Method">
			<FormSelect
				label="Method"
				bind:value={method}
				options={[
					{ value: 'library', label: 'Library (pgp)' },
					{ value: 'cli', label: gpgAvailable ? 'CLI (gpg)' : 'CLI (not available)' },
				]}
			/>
			{#if cliAvailability?.gpg_version}
				<p class="mt-1 text-2xs text-muted-foreground">{cliAvailability.gpg_version}</p>
			{/if}
		</FormSection>

		<FormSection title="Actions">
			<div class="space-y-2">
				<ActionButton
					label="Generate Key Pair"
					icon={Key}
					loading={isGenerating}
					loadingLabel="Generating..."
					disabled={!canGenerate}
					onclick={handleGenerate}
				/>
				{#if keyResult}
					<ActionButton label="Clear Result" variant="outline" onclick={handleClear} />
				{/if}
			</div>
		</FormSection>

		<FormSection title="Display">
			<div class="space-y-1">
				<FormCheckbox label="Show key information" bind:checked={showKeyInfo} />
				<FormCheckbox label="Show GPG commands" bind:checked={showGpgCommands} />
			</div>
		</FormSection>

		<FormSection title="About GPG Keys">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li>GPG keys enable encryption and digital signatures</li>
					<li>RSA: Wide compatibility, proven security</li>
					<li>ECDSA: Smaller keys, faster operations</li>
					<li>Passphrase protects private key at rest</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Algorithm Comparison">
			<FormInfo showIcon={false}>
				<div class="space-y-0.5">
					<div class="flex justify-between">
						<span>RSA-2048:</span>
						<span>Minimum, legacy compatible</span>
					</div>
					<div class="flex justify-between">
						<span>RSA-3072:</span>
						<span>128-bit security</span>
					</div>
					<div class="flex justify-between">
						<span>RSA-4096:</span>
						<span>Maximum RSA security</span>
					</div>
					<div class="flex justify-between">
						<span>ECDSA P-256:</span>
						<span>128-bit, compact</span>
					</div>
					<div class="flex justify-between">
						<span>ECDSA P-384:</span>
						<span>192-bit, high security</span>
					</div>
				</div>
			</FormInfo>
		</FormSection>

		<FormSection title="User ID Format">
			<FormInfo showIcon={false}>
				<code class="block rounded bg-muted p-1.5 font-mono text-2xs">
					Name (Comment) &lt;email@example.com&gt;
				</code>
				<p class="mt-1.5">The User ID identifies the key owner. Comment is optional.</p>
			</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Results Panel -->
	<div class="relative flex h-full flex-col overflow-hidden">
		<LoadingOverlay
			show={isGenerating}
			title="Generating GPG Key..."
			message="Key generation in progress"
			elapsedTime={elapsedTimeDisplay}
			oncancel={handleCancel}
		/>
		<SectionHeader title="Generated Keys" />

		<div class="flex-1 overflow-auto p-4">
			{#if keyResult}
				<div class="space-y-4">
					<!-- User ID & Fingerprint -->
					{#if showKeyInfo}
						<div class="rounded-lg border bg-muted/30 p-4">
							<div class="mb-3 flex items-center gap-2">
								<User class="h-4 w-4" />
								<span class="text-sm font-medium">Key Information</span>
							</div>
							<div class="space-y-2">
								<div class="flex items-start justify-between">
									<span class="text-xs text-muted-foreground">User ID</span>
									<code class="text-xs">{keyResult.user_id}</code>
								</div>
								<div class="flex items-start justify-between">
									<span class="text-xs text-muted-foreground">Fingerprint</span>
									<div class="flex items-center gap-2">
										<code class="text-xs">{keyResult.fingerprint}</code>
										<CopyButton
											text={keyResult.fingerprint}
											toastLabel="Fingerprint"
											size="icon"
											class="h-6 w-6"
										/>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Public Key -->
					<div class="rounded-lg border bg-muted/30 p-4">
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Unlock class="h-4 w-4 text-success" />
								<span class="text-sm font-medium">Public Key (PGP Armor)</span>
							</div>
							<CopyButton
								text={keyResult.public_key}
								toastLabel="Public key"
								size="sm"
								showLabel
								class="h-7"
							/>
						</div>
						<pre
							class="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs">{keyResult.public_key}</pre>
						<p class="mt-2 text-xs text-muted-foreground">
							Share this key with others so they can encrypt messages to you
						</p>
					</div>

					<!-- Private Key -->
					<div class="rounded-lg border border-warning/30 bg-amber-500/5 p-4">
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Lock class="h-4 w-4 text-warning" />
								<span class="text-sm font-medium">Private Key (PGP Armor)</span>
								<span class="text-xs text-warning">(Keep Secret!)</span>
							</div>
							<CopyButton
								text={keyResult.private_key}
								toastLabel="Private key"
								size="sm"
								showLabel
								class="h-7"
							/>
						</div>
						<pre
							class="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs">{keyResult.private_key}</pre>
						<p class="mt-2 text-xs text-warning">
							Never share this key. Import with: <code>gpg --import private-key.asc</code>
						</p>
					</div>

					<!-- GPG Commands -->
					{#if showGpgCommands}
						<div class="rounded-lg border bg-muted/30 p-4">
							<div class="mb-3 flex items-center gap-2">
								<Terminal class="h-4 w-4" />
								<span class="text-sm font-medium">Equivalent GPG Commands</span>
							</div>

							<div class="space-y-3">
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="text-xs text-muted-foreground">Interactive</span>
										<CopyButton
											text={keyResult.gpg_command_interactive}
											toastLabel="Command"
											size="icon"
											class="h-6 w-6"
										/>
									</div>
									<code class="block rounded bg-muted p-2 font-mono text-xs">
										{keyResult.gpg_command_interactive}
									</code>
								</div>

								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="text-xs text-muted-foreground">Batch Mode</span>
										<CopyButton
											text={keyResult.gpg_command_batch}
											toastLabel="Command"
											size="icon"
											class="h-6 w-6"
										/>
									</div>
									<pre
										class="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs">{keyResult.gpg_command_batch}</pre>
								</div>
							</div>
						</div>
					{/if}
				</div>
			{:else if error}
				<ErrorDisplay variant="centered" message={error} />
			{:else}
				<EmptyState
					icon={Key}
					title="Enter your details and generate a GPG key pair"
					description="Name and email are required"
				/>
			{/if}
		</div>
	</div>
</ToolShell>
