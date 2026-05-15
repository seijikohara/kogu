<script lang="ts">
	import { AlertTriangle, CheckCircle, Clock, Info, KeyRound } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { CodeEditor } from '$lib/components/editor';
	import { FormInfo, FormSection } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { ToolShell } from '$lib/components/shell';
	import { EmptyState } from '$lib/components/status';
	import * as Card from '$lib/components/ui/card';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		decodeJwt,
		JWT_STANDARD_CLAIMS,
		type JwtDecoded,
		SAMPLE_JWT,
		validateJwt,
	} from '$lib/services/encoders.js';

	// State
	let input = $state('');
	let showOptions = $state(true);

	// Computed decoded JWT and error
	const decodeResult = $derived.by((): { decoded: JwtDecoded | null; error: string } => {
		if (!input.trim()) {
			return { decoded: null, error: '' };
		}

		const validation = validateJwt(input);
		if (!validation.valid) {
			return { decoded: null, error: validation.error || 'Invalid JWT' };
		}

		const result = decodeJwt(input);
		if (!result) {
			return { decoded: null, error: 'Failed to decode JWT' };
		}

		return { decoded: result, error: '' };
	});

	// Derived values from result
	const decoded = $derived(decodeResult.decoded);
	const error = $derived(decodeResult.error);

	// Validation state
	const valid = $derived.by((): boolean | null => {
		if (!input.trim()) return null;
		return !error;
	});

	// Format JSON for display
	const formatJson = (obj: unknown): string => {
		return JSON.stringify(obj, null, 2);
	};

	// Format date
	const formatDate = (date: Date | undefined): string => {
		if (!date) return 'N/A';
		return date.toLocaleString();
	};

	// Get time remaining until expiration
	const getTimeRemaining = (expDate: Date | undefined): string | null => {
		if (!expDate) return null;
		const now = Date.now();
		const exp = expDate.getTime();
		const diff = exp - now;

		if (diff <= 0) return 'Expired';

		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

		if (days > 0) return `${days}d ${hours}h remaining`;
		if (hours > 0) return `${hours}h ${minutes}m remaining`;
		return `${minutes}m remaining`;
	};

	// Handlers
	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) input = text;
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => {
		input = '';
	};

	const handleSample = () => {
		input = SAMPLE_JWT;
	};

	// Get claim description
	const getClaimDescription = (claim: string): string | undefined => {
		return JWT_STANDARD_CLAIMS.find((c) => c.claim === claim)?.name;
	};

	// JWT signing-algorithm descriptions. Returns null for unknown alg values
	// so the UI can omit the hint icon rather than display the raw string.
	const ALG_DESCRIPTIONS: Readonly<Record<string, string>> = {
		HS256: 'HMAC + SHA-256 (symmetric)',
		HS384: 'HMAC + SHA-384 (symmetric)',
		HS512: 'HMAC + SHA-512 (symmetric)',
		RS256: 'RSA + SHA-256 (asymmetric)',
		RS384: 'RSA + SHA-384 (asymmetric)',
		RS512: 'RSA + SHA-512 (asymmetric)',
		ES256: 'ECDSA + SHA-256 over P-256 (asymmetric)',
		ES384: 'ECDSA + SHA-384 over P-384 (asymmetric)',
		ES512: 'ECDSA + SHA-512 over P-521 (asymmetric)',
		PS256: 'RSASSA-PSS + SHA-256',
		none: 'No signature — INSECURE',
	};

	const getAlgDescription = (alg: string): string | null => ALG_DESCRIPTIONS[alg] ?? null;

	const headerAlg = $derived.by((): string | null => {
		const alg = decoded?.header.alg;
		return typeof alg === 'string' ? alg : null;
	});

	const algDescription = $derived(headerAlg ? getAlgDescription(headerAlg) : null);
</script>

<svelte:head>
	<title>JWT Decoder - Kogu</title>
</svelte:head>

<ToolShell {valid} {error} bind:showRail={showOptions}>
	{#snippet statusContent()}
		{#if decoded}
			{#if decoded.isExpired}
				<span class="flex items-center gap-1 text-destructive">
					<AlertTriangle class="h-3 w-3" />
					Expired
				</span>
			{:else}
				<span class="flex items-center gap-1 text-success">
					<CheckCircle class="h-3 w-3" />
					Valid
				</span>
				{#if decoded.expiresAt}
					<span class="flex items-center gap-1 text-muted-foreground">
						<Clock class="h-3 w-3" />
						{getTimeRemaining(decoded.expiresAt)}
					</span>
				{/if}
			{/if}
		{/if}
	{/snippet}

	{#snippet rail()}
		<FormSection title="About JWT">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li>JSON Web Token</li>
					<li>Compact, URL-safe format</li>
					<li>Three parts: Header.Payload.Signature</li>
					<li>Self-contained authentication</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Structure">
			<FormInfo showIcon={false}>
				<div class="space-y-1.5">
					<div class="flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-destructive"></span>
						<span class="text-destructive">Header:</span>
						<span>Algorithm & type</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-primary"></span>
						<span class="text-primary">Payload:</span>
						<span>Claims & data</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-info"></span>
						<span class="text-info">Signature:</span>
						<span>Verification hash</span>
					</div>
				</div>
			</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Main Content: Input + Results -->
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Input Editor -->
		<div class="h-1/4 shrink-0 border-b">
			<CodeEditor
				title="JWT Token"
				bind:value={input}
				mode="input"
				editorMode="plain"
				placeholder="Enter JWT token here..."
				showViewToggle={false}
				onpaste={handlePaste}
				onclear={handleClear}
				onsample={handleSample}
			/>
		</div>

		<!-- Decoded Results -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<SectionHeader title="Decoded Token" />
			{#if decoded}
				<!--
					aria-live announces newly decoded payloads / validity transitions as
					the user pastes or edits a JWT. `aria-atomic="false"` keeps re-reads
					focused on the changed region rather than the whole panel.
				-->
				<div
					class="flex-1 space-y-4 overflow-auto p-4"
					role="status"
					aria-live="polite"
					aria-atomic="false"
				>
					<!-- Expiration banner -->
					{#if decoded.isExpired}
						<div
							class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
						>
							<AlertTriangle class="h-4 w-4" />
							<span
								>This token has expired{decoded.expiresAt
									? ` on ${formatDate(decoded.expiresAt)}`
									: ''}</span
							>
						</div>
					{/if}

					<Card.Root density="compact">
						<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
							<Card.Title class="text-sm font-medium text-destructive">Header</Card.Title>
							<CopyButton
								text={formatJson(decoded.header)}
								toastLabel="Header"
								size="sm"
								showLabel
								class="h-6"
							/>
						</Card.Header>
						<Card.Content>
							{#if headerAlg}
								<div class="mb-2 flex items-center gap-2 text-xs">
									<span class="font-mono font-medium text-muted-foreground">alg:</span>
									<code class="rounded bg-muted px-1.5 py-0.5 font-mono">{headerAlg}</code>
									{#if algDescription}
										<Tooltip.Root>
											<Tooltip.Trigger>
												{#snippet child({ props })}
													<button
														{...props}
														type="button"
														class="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
													>
														<Info class="h-3.5 w-3.5" />
														<span class="sr-only">Algorithm details</span>
													</button>
												{/snippet}
											</Tooltip.Trigger>
											<Tooltip.Content>{algDescription}</Tooltip.Content>
										</Tooltip.Root>
									{/if}
								</div>
							{/if}
							<pre class="overflow-auto rounded bg-muted p-3 font-mono text-xs">{formatJson(
									decoded.header
								)}</pre>
						</Card.Content>
					</Card.Root>

					<Card.Root density="compact">
						<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
							<Card.Title class="text-sm font-medium text-primary">Payload</Card.Title>
							<CopyButton
								text={formatJson(decoded.payload)}
								toastLabel="Payload"
								size="sm"
								showLabel
								class="h-6"
							/>
						</Card.Header>
						<Card.Content>
							<pre class="overflow-auto rounded bg-muted p-3 font-mono text-xs">{formatJson(
									decoded.payload
								)}</pre>
						</Card.Content>
					</Card.Root>

					{#if Object.keys(decoded.payload).some( (k) => JWT_STANDARD_CLAIMS.some((c) => c.claim === k) )}
						<Card.Root density="compact">
							<Card.Header class="pb-3">
								<Card.Title class="text-sm font-medium">Standard Claims</Card.Title>
							</Card.Header>
							<Card.Content class="p-0">
								<div class="divide-y border-t">
									{#each Object.entries(decoded.payload).filter( ([k]) => JWT_STANDARD_CLAIMS.some((c) => c.claim === k) ) as [key, value]}
										<div class="flex items-center gap-4 px-4 py-2 text-xs">
											<span class="w-20 font-mono font-medium text-primary">{key}</span>
											<span class="w-32 text-muted-foreground">{getClaimDescription(key)}</span>
											<span class="flex-1 font-mono">
												{#if key === 'exp' || key === 'iat' || key === 'nbf'}
													{formatDate(new Date(Number(value) * 1000))}
													<span class="ml-2 text-muted-foreground">({value})</span>
												{:else}
													{JSON.stringify(value)}
												{/if}
											</span>
										</div>
									{/each}
								</div>
							</Card.Content>
						</Card.Root>
					{/if}

					<Card.Root density="compact">
						<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
							<Card.Title class="text-sm font-medium text-info">Signature</Card.Title>
							<CopyButton
								text={decoded.signature}
								toastLabel="Signature"
								size="sm"
								showLabel
								class="h-6"
							/>
						</Card.Header>
						<Card.Content>
							<code class="block break-all rounded bg-muted p-3 font-mono text-xs">
								{decoded.signature}
							</code>
							<p class="mt-2 text-xs text-muted-foreground">
								Note: Signature verification requires the secret key and is not performed
								client-side.
							</p>
						</Card.Content>
					</Card.Root>
				</div>
			{:else}
				<div class="flex-1">
					{#if error}
						<div class="flex h-full items-center justify-center text-muted-foreground">
							<div class="text-center">
								<AlertTriangle class="mx-auto mb-2 h-8 w-8 text-destructive" />
								<p class="text-sm">{error}</p>
							</div>
						</div>
					{:else}
						<EmptyState icon={KeyRound} title="Enter a JWT token to decode" />
					{/if}
				</div>
			{/if}
		</div>
	</div>
</ToolShell>
