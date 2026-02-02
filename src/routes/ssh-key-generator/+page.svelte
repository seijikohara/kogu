<script lang="ts">
	import { Key, Lock, Terminal, Unlock } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ActionButton, CopyButton } from '$lib/components/action';
	import { FormCheckbox, FormInfo, FormInput, FormSection, FormSelect } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { ToolShell } from '$lib/components/shell';
	import { EmptyState, ErrorDisplay, LoadingOverlay, StatItem } from '$lib/components/status';
	import {
		cancelWorkerOperation,
		type CliAvailability,
		checkCliAvailability,
		type GenerationMethod,
		generateSshKeyPair,
		SSH_ALGORITHMS,
		type SshKeyAlgorithm,
		type SshKeyResult,
	} from '$lib/services/generators.js';

	// State
	let algorithm = $state<SshKeyAlgorithm>('ed25519');
	let comment = $state('');
	let passphrase = $state('');
	let method = $state<GenerationMethod>('library');

	let keyResult = $state<SshKeyResult | null>(null);
	let isGenerating = $state(false);
	let isCancelled = $state(false);
	let error = $state<string | null>(null);

	let cliAvailability = $state<CliAvailability | null>(null);

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

	// UI options
	let showOptions = $state(true);
	let showFingerprint = $state(true);
	let showEquivalentCommand = $state(true);

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
	const selectedAlgorithm = $derived(SSH_ALGORITHMS.find((a) => a.value === algorithm));
	const canGenerate = $derived(true);
	const sshKeygenAvailable = $derived(cliAvailability?.ssh_keygen ?? false);
	const elapsedTimeDisplay = $derived(formatElapsedTime(elapsedMs));

	// Get algorithm description
	const algorithmDescription = $derived.by(() => {
		switch (algorithm) {
			case 'ed25519':
				return 'Modern, fast, and secure. Best choice for most use cases.';
			case 'ecdsa_p256':
				return 'Good security with NIST P-256 curve. Widely supported.';
			case 'ecdsa_p384':
				return 'Higher security with NIST P-384 curve.';
			case 'rsa2048':
				return 'Legacy compatibility. Minimum recommended RSA size.';
			case 'rsa3072':
				return 'Better security than RSA-2048. Good for long-term use.';
			case 'rsa4096':
				return 'Maximum RSA security. Slower key generation.';
			default:
				return '';
		}
	});

	// Handlers
	const handleGenerate = async () => {
		isGenerating = true;
		isCancelled = false;
		error = null;
		keyResult = null;
		startTimer();

		try {
			const result = await generateSshKeyPair({
				algorithm,
				comment: comment.trim() || undefined,
				passphrase: passphrase || undefined,
				method,
			});
			if (!isCancelled) {
				keyResult = result;
				toast.success('SSH key pair generated successfully');
			}
		} catch (e) {
			if (!isCancelled) {
				error = e instanceof Error ? e.message : String(e);
				toast.error('Failed to generate SSH key', { description: error });
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
	<title>SSH Key Generator - Kogu</title>
</svelte:head>

<ToolShell valid={keyResult ? true : null} bind:showRail={showOptions}>
	{#snippet statusContent()}
		{#if keyResult}
			<StatItem label="Algorithm" value={keyResult.algorithm} />
			<StatItem label="Method" value={keyResult.method_used} />
		{/if}
	{/snippet}

	{#snippet rail()}
		<FormSection title="Algorithm">
			<FormSelect
				label="Type"
				bind:value={algorithm}
				options={SSH_ALGORITHMS.map((a) => ({
					value: a.value,
					label: a.recommended ? `${a.label} (Recommended)` : a.label,
				}))}
			/>
		</FormSection>

		<FormSection title="Key Details">
			<div class="space-y-2">
				<FormInput
					label="Comment (optional)"
					bind:value={comment}
					placeholder="user@hostname or email"
					hint="Typically your email address or user@host"
				/>
				<FormInput
					label="Passphrase (optional)"
					type="password"
					showToggle
					bind:value={passphrase}
					placeholder="Enter passphrase..."
					hint="Leave empty for no passphrase protection"
				/>
			</div>
		</FormSection>

		<FormSection title="Generation Method">
			<FormSelect
				label="Method"
				bind:value={method}
				options={[
					{ value: 'library', label: 'Library (ssh-key)' },
					{
						value: 'cli',
						label: sshKeygenAvailable ? 'CLI (ssh-keygen)' : 'CLI (not available)',
					},
				]}
			/>
			{#if cliAvailability?.ssh_keygen_version}
				<p class="mt-1 text-2xs text-muted-foreground">{cliAvailability.ssh_keygen_version}</p>
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
				<FormCheckbox label="Show fingerprint" bind:checked={showFingerprint} />
				<FormCheckbox label="Show ssh-keygen command" bind:checked={showEquivalentCommand} />
			</div>
		</FormSection>

		<FormSection title="About SSH Keys">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li>Ed25519: Modern, fast, compact (recommended)</li>
					<li>ECDSA: Good balance of security and compatibility</li>
					<li>RSA: Wide compatibility, larger key sizes</li>
					<li>Passphrase encrypts private key at rest</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Algorithm Comparison">
			<FormInfo showIcon={false}>
				<div class="space-y-0.5">
					<div class="flex justify-between">
						<span>Ed25519:</span>
						<span>256-bit, fastest</span>
					</div>
					<div class="flex justify-between">
						<span>ECDSA P-256:</span>
						<span>256-bit, fast</span>
					</div>
					<div class="flex justify-between">
						<span>ECDSA P-384:</span>
						<span>384-bit, moderate</span>
					</div>
					<div class="flex justify-between">
						<span>RSA-2048:</span>
						<span>2048-bit, slower</span>
					</div>
					<div class="flex justify-between">
						<span>RSA-4096:</span>
						<span>4096-bit, slowest</span>
					</div>
				</div>
			</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Results Panel -->
	<div class="relative flex h-full flex-col overflow-hidden">
		<LoadingOverlay
			show={isGenerating}
			title="Generating SSH Key..."
			message="Key generation in progress"
			elapsedTime={elapsedTimeDisplay}
			oncancel={handleCancel}
		/>
		<SectionHeader title="Generated Keys" />

		<div class="flex-1 overflow-auto p-4">
			{#if keyResult}
				<div class="space-y-4">
					<!-- Fingerprint -->
					{#if showFingerprint}
						<div class="rounded-lg border bg-muted/30 p-4">
							<div class="mb-2 flex items-center justify-between">
								<span class="text-sm font-medium">Fingerprint (SHA-256)</span>
								<CopyButton
									text={keyResult.fingerprint}
									toastLabel="Fingerprint"
									size="sm"
									showLabel
									class="h-7"
								/>
							</div>
							<code class="block rounded bg-muted p-2 font-mono text-sm">
								{keyResult.fingerprint}
							</code>
						</div>
					{/if}

					<!-- Public Key -->
					<div class="rounded-lg border bg-muted/30 p-4">
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Unlock class="h-4 w-4 text-success" />
								<span class="text-sm font-medium">Public Key</span>
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
							class="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs">{keyResult.public_key}</pre>
						<p class="mt-2 text-xs text-muted-foreground">
							Add this to <code>~/.ssh/authorized_keys</code> on remote servers
						</p>
					</div>

					<!-- Private Key -->
					<div class="rounded-lg border border-warning/30 bg-amber-500/5 p-4">
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Lock class="h-4 w-4 text-warning" />
								<span class="text-sm font-medium">Private Key</span>
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
							Save this to <code
								>~/.ssh/{algorithm === 'ed25519'
									? 'id_ed25519'
									: algorithm.startsWith('ecdsa')
										? 'id_ecdsa'
										: 'id_rsa'}</code
							> with permissions 600
						</p>
					</div>

					<!-- ssh-keygen Command -->
					{#if showEquivalentCommand}
						<div class="rounded-lg border bg-muted/30 p-4">
							<div class="mb-2 flex items-center justify-between">
								<div class="flex items-center gap-2">
									<Terminal class="h-4 w-4" />
									<span class="text-sm font-medium">Equivalent ssh-keygen Command</span>
								</div>
								<CopyButton
									text={keyResult.ssh_keygen_command}
									toastLabel="Command"
									size="sm"
									showLabel
									class="h-7"
								/>
							</div>
							<code class="block rounded bg-muted p-2 font-mono text-xs">
								{keyResult.ssh_keygen_command}
							</code>
						</div>
					{/if}
				</div>
			{:else if error}
				<ErrorDisplay variant="centered" message={error} />
			{:else}
				<EmptyState icon={Key} title="Configure options and generate an SSH key pair" />
			{/if}
		</div>
	</div>
</ToolShell>
