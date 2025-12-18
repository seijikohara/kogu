<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Copy, Key, Lock, Terminal, Unlock } from '@lucide/svelte';
	import { PageHeader } from '$lib/components/layout/index.js';
	import {
		OptionCheckbox,
		OptionInput,
		OptionSelect,
		OptionsInfo,
		OptionsPanel,
		OptionsSection,
	} from '$lib/components/options/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		SSH_ALGORITHMS,
		generateSshKeyPair,
		checkCliAvailability,
		type SshKeyAlgorithm,
		type SshKeyResult,
		type GenerationMethod,
		type CliAvailability,
	} from '$lib/services/generators.js';

	// State
	let algorithm = $state<SshKeyAlgorithm>('ed25519');
	let comment = $state('');
	let passphrase = $state('');
	let method = $state<GenerationMethod>('library');

	let keyResult = $state<SshKeyResult | null>(null);
	let isGenerating = $state(false);
	let error = $state<string | null>(null);

	let cliAvailability = $state<CliAvailability | null>(null);

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
		error = null;
		keyResult = null;

		try {
			keyResult = await generateSshKeyPair({
				algorithm,
				comment: comment.trim() || undefined,
				passphrase: passphrase || undefined,
				method,
			});
			toast.success('SSH key pair generated successfully');
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			toast.error('Failed to generate SSH key', { description: error });
		} finally {
			isGenerating = false;
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

	const handleClear = () => {
		keyResult = null;
		error = null;
	};
</script>

<svelte:head>
	<title>SSH Key Generator - Kogu</title>
</svelte:head>

<div class="flex h-full flex-col overflow-hidden">
	<PageHeader valid={keyResult ? true : null}>
		{#snippet statusContent()}
			{#if keyResult}
				<span class="text-muted-foreground">
					Algorithm: <strong class="text-foreground">{keyResult.algorithm}</strong>
				</span>
				<span class="text-muted-foreground">
					Method: <strong class="text-foreground">{keyResult.method_used}</strong>
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
			<OptionsSection title="Algorithm">
				<OptionSelect
					label="Type"
					bind:value={algorithm}
					options={SSH_ALGORITHMS.map((a) => ({
						value: a.value,
						label: a.recommended ? `${a.label} (Recommended)` : a.label,
					}))}
				/>
			</OptionsSection>

			<OptionsSection title="Key Details">
				<div class="space-y-2">
					<OptionInput
						label="Comment (optional)"
						bind:value={comment}
						placeholder="user@hostname or email"
						hint="Typically your email address or user@host"
					/>
					<OptionInput
						label="Passphrase (optional)"
						type="password"
						showToggle
						bind:value={passphrase}
						placeholder="Enter passphrase..."
						hint="Leave empty for no passphrase protection"
					/>
				</div>
			</OptionsSection>

			<OptionsSection title="Generation Method">
				<OptionSelect
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
					<p class="mt-1 text-[10px] text-muted-foreground">{cliAvailability.ssh_keygen_version}</p>
				{/if}
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
							<Key class="mr-2 h-4 w-4" />
							Generate Key Pair
						{/if}
					</Button>
					{#if keyResult}
						<Button variant="outline" class="w-full" onclick={handleClear}>Clear Result</Button>
					{/if}
				</div>
			</OptionsSection>

			<OptionsSection title="Display">
				<div class="space-y-1">
					<OptionCheckbox label="Show fingerprint" bind:checked={showFingerprint} />
					<OptionCheckbox label="Show ssh-keygen command" bind:checked={showEquivalentCommand} />
				</div>
			</OptionsSection>

			<OptionsSection title="About SSH Keys">
				<OptionsInfo>
					<ul class="list-inside list-disc space-y-0.5">
						<li>Ed25519: Modern, fast, compact (recommended)</li>
						<li>ECDSA: Good balance of security and compatibility</li>
						<li>RSA: Wide compatibility, larger key sizes</li>
						<li>Passphrase encrypts private key at rest</li>
					</ul>
				</OptionsInfo>
			</OptionsSection>

			<OptionsSection title="Algorithm Comparison">
				<OptionsInfo showIcon={false}>
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
				</OptionsInfo>
			</OptionsSection>
		</OptionsPanel>

		<!-- Results Panel -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<div class="flex h-9 shrink-0 items-center border-b bg-muted/30 px-3">
				<span class="text-xs font-medium text-muted-foreground">Generated Keys</span>
			</div>

			<div class="flex-1 overflow-auto p-4">
				{#if keyResult}
					<div class="space-y-4">
						<!-- Fingerprint -->
						{#if showFingerprint}
							<div class="rounded-lg border bg-muted/30 p-4">
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-medium">Fingerprint (SHA-256)</span>
									<Button
										variant="ghost"
										size="sm"
										class="h-7 gap-1 px-2 text-xs"
										onclick={() => copyToClipboard(keyResult!.fingerprint, 'Fingerprint')}
									>
										<Copy class="h-3 w-3" />
										Copy
									</Button>
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
									<Unlock class="h-4 w-4 text-green-600 dark:text-green-400" />
									<span class="text-sm font-medium">Public Key</span>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class="h-7 gap-1 px-2 text-xs"
									onclick={() => copyToClipboard(keyResult!.public_key, 'Public key')}
								>
									<Copy class="h-3 w-3" />
									Copy
								</Button>
							</div>
							<pre
								class="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs">{keyResult.public_key}</pre>
							<p class="mt-2 text-xs text-muted-foreground">
								Add this to <code>~/.ssh/authorized_keys</code> on remote servers
							</p>
						</div>

						<!-- Private Key -->
						<div class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
							<div class="mb-2 flex items-center justify-between">
								<div class="flex items-center gap-2">
									<Lock class="h-4 w-4 text-amber-600 dark:text-amber-400" />
									<span class="text-sm font-medium">Private Key</span>
									<span class="text-xs text-amber-600 dark:text-amber-400">(Keep Secret!)</span>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class="h-7 gap-1 px-2 text-xs"
									onclick={() => copyToClipboard(keyResult!.private_key, 'Private key')}
								>
									<Copy class="h-3 w-3" />
									Copy
								</Button>
							</div>
							<pre
								class="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs">{keyResult.private_key}</pre>
							<p class="mt-2 text-xs text-amber-600 dark:text-amber-400">
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
									<Button
										variant="ghost"
										size="sm"
										class="h-7 gap-1 px-2 text-xs"
										onclick={() => copyToClipboard(keyResult!.ssh_keygen_command, 'Command')}
									>
										<Copy class="h-3 w-3" />
										Copy
									</Button>
								</div>
								<code class="block rounded bg-muted p-2 font-mono text-xs">
									{keyResult.ssh_keygen_command}
								</code>
							</div>
						{/if}
					</div>
				{:else if error}
					<div class="flex h-full items-center justify-center">
						<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
							<p class="text-sm text-destructive">{error}</p>
						</div>
					</div>
				{:else}
					<div class="flex h-full items-center justify-center text-muted-foreground">
						<div class="text-center">
							<Key class="mx-auto mb-2 h-12 w-12 opacity-50" />
							<p class="text-sm">Configure options and generate an SSH key pair</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
