<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Key, Lock, Terminal, Unlock, User } from '@lucide/svelte';
	import { PageLayout } from '$lib/components/layout';
	import { ActionButton, CopyButton } from '$lib/components/action';
	import { FormCheckbox, FormInfo, FormInput, FormSection, FormSelect } from '$lib/components/form';
	import {
		GPG_ALGORITHMS,
		generateGpgKeyPair,
		checkCliAvailability,
		buildGpgUserId,
		isValidEmail,
		type GpgKeyAlgorithm,
		type GpgKeyResult,
		type GenerationMethod,
		type CliAvailability,
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
	let error = $state<string | null>(null);

	let cliAvailability = $state<CliAvailability | null>(null);

	// UI options
	let showOptions = $state(true);
	let showKeyInfo = $state(true);
	let showGpgCommands = $state(true);

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

	// Handlers
	const handleGenerate = async () => {
		if (!canGenerate) return;

		isGenerating = true;
		error = null;
		keyResult = null;

		try {
			keyResult = await generateGpgKeyPair({
				name: name.trim(),
				email: email.trim(),
				comment: comment.trim() || undefined,
				algorithm,
				passphrase: passphrase || undefined,
				method,
			});
			toast.success('GPG key pair generated successfully');
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			toast.error('Failed to generate GPG key', { description: error });
		} finally {
			isGenerating = false;
		}
	};

	const handleClear = () => {
		keyResult = null;
		error = null;
	};
</script>

<svelte:head>
	<title>GPG Key Generator - Kogu</title>
</svelte:head>

<PageLayout valid={keyResult ? true : null} bind:showOptions>
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

	{#snippet options()}
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
					<p class="text-[10px] text-destructive">Please enter a valid email address</p>
				{/if}
				<FormInput label="Comment (optional)" bind:value={comment} placeholder="Work key" />
			</div>
		</FormSection>

		{#if name || email}
			<FormSection title="User ID Preview">
				<div class="rounded-md border bg-muted/30 p-2">
					<div class="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
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
				<p class="mt-1 text-[10px] text-muted-foreground">{cliAvailability.gpg_version}</p>
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
				<code class="block rounded bg-muted p-1.5 font-mono text-[10px]">
					Name (Comment) &lt;email@example.com&gt;
				</code>
				<p class="mt-1.5">The User ID identifies the key owner. Comment is optional.</p>
			</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Results Panel -->
	<div class="flex h-full flex-col overflow-hidden">
		<div class="flex h-9 shrink-0 items-center border-b bg-muted/30 px-3">
			<span class="text-xs font-medium text-muted-foreground">Generated Keys</span>
		</div>

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
								<Unlock class="h-4 w-4 text-green-600 dark:text-green-400" />
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
					<div class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Lock class="h-4 w-4 text-amber-600 dark:text-amber-400" />
								<span class="text-sm font-medium">Private Key (PGP Armor)</span>
								<span class="text-xs text-amber-600 dark:text-amber-400">(Keep Secret!)</span>
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
						<p class="mt-2 text-xs text-amber-600 dark:text-amber-400">
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
				<div class="flex h-full items-center justify-center">
					<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
						<p class="text-sm text-destructive">{error}</p>
					</div>
				</div>
			{:else}
				<div class="flex h-full items-center justify-center text-muted-foreground">
					<div class="text-center">
						<Key class="mx-auto mb-2 h-12 w-12 opacity-50" />
						<p class="text-sm">Enter your details and generate a GPG key pair</p>
						<p class="mt-1 text-xs">Name and email are required</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</PageLayout>
