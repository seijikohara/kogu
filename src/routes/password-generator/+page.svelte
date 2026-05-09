<script lang="ts">
	import { Lock, RefreshCw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ActionButton, CopyButton } from '$lib/components/action';
	import {
		FormCheckbox,
		FormCheckboxGroup,
		FormInfo,
		FormSection,
		FormSlider,
	} from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { ToolShell } from '$lib/components/shell';
	import { EmptyState, StatItem } from '$lib/components/status';
	import {
		buildCharacterPool,
		calculateEntropy,
		classifyEntropy,
		DEFAULT_COUNT,
		DEFAULT_PASSWORD_OPTIONS,
		generatePasswords,
		MAX_COUNT,
		MAX_LENGTH,
		MIN_COUNT,
		MIN_LENGTH,
		type PasswordOptions,
	} from '$lib/services/password.js';

	// State
	let options = $state<PasswordOptions>({ ...DEFAULT_PASSWORD_OPTIONS });
	let count = $state<number>(DEFAULT_COUNT);
	let results = $state<readonly string[]>([]);
	let error = $state<string | null>(null);
	let showOptions = $state(true);

	// Derived
	const pool = $derived(buildCharacterPool(options));
	const entropy = $derived(calculateEntropy(options.length, pool.length));
	const strength = $derived(classifyEntropy(entropy));
	const canGenerate = $derived(pool.length > 0);

	const strengthClass = $derived.by(() => {
		if (strength.tone === 'destructive') return 'text-destructive';
		if (strength.tone === 'warning') return 'text-warning';
		if (strength.tone === 'success') return 'text-success';
		return 'text-info';
	});

	const strengthBarClass = $derived.by(() => {
		if (strength.tone === 'destructive') return 'bg-destructive';
		if (strength.tone === 'warning') return 'bg-warning';
		if (strength.tone === 'success') return 'bg-success';
		return 'bg-info';
	});

	// Visualize entropy on a 0-128 bit scale; clamp above 128 to full.
	const strengthPercent = $derived(Math.min(100, (entropy / 128) * 100));

	// Handlers
	const handleGenerate = () => {
		error = null;
		try {
			results = generatePasswords(options, count);
			toast.success(`Generated ${results.length} password${results.length > 1 ? 's' : ''}`);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			error = message;
			results = [];
			toast.error('Failed to generate password', { description: message });
		}
	};

	const handleClear = () => {
		results = [];
		error = null;
	};
</script>

<svelte:head>
	<title>Password Generator - Kogu</title>
</svelte:head>

<ToolShell
	valid={results.length > 0 ? true : null}
	error={error ?? undefined}
	bind:showRail={showOptions}
>
	{#snippet statusContent()}
		{#if results.length > 0}
			<StatItem label="Count" value={results.length} />
			<StatItem label="Length" value={options.length} />
			<StatItem label="Entropy" value={`${entropy.toFixed(1)} bits`} />
		{/if}
	{/snippet}

	{#snippet rail()}
		<FormSection title="Length">
			<FormSlider
				label="Length"
				bind:value={options.length}
				min={MIN_LENGTH}
				max={MAX_LENGTH}
				step={1}
				valueLabel={String(options.length)}
			/>
		</FormSection>

		<FormSection title="Character Classes">
			<FormCheckboxGroup>
				<FormCheckbox label="Lowercase (a-z)" bind:checked={options.lowercase} />
				<FormCheckbox label="Uppercase (A-Z)" bind:checked={options.uppercase} />
				<FormCheckbox label="Numbers (0-9)" bind:checked={options.numbers} />
				<FormCheckbox label="Symbols (!@#$...)" bind:checked={options.symbols} />
			</FormCheckboxGroup>
		</FormSection>

		<FormSection title="Exclusions">
			<FormCheckboxGroup>
				<FormCheckbox
					label="Exclude similar characters"
					hint="0/O, 1/l/I, |"
					bind:checked={options.excludeSimilar}
				/>
				<FormCheckbox
					label="Exclude ambiguous symbols"
					hint="Brackets, quotes, slashes"
					bind:checked={options.excludeAmbiguous}
				/>
			</FormCheckboxGroup>
		</FormSection>

		<FormSection title="Quantity">
			<FormSlider
				label="Count"
				bind:value={count}
				min={MIN_COUNT}
				max={MAX_COUNT}
				step={1}
				valueLabel={String(count)}
			/>
		</FormSection>

		<FormSection title="Strength">
			<div class="space-y-2">
				<div class="flex items-center justify-between text-sm">
					<span class="text-muted-foreground">Pool size</span>
					<span class="font-mono tabular-nums">{pool.length}</span>
				</div>
				<div class="flex items-center justify-between text-sm">
					<span class="text-muted-foreground">Entropy</span>
					<span class="font-mono tabular-nums">{entropy.toFixed(1)} bits</span>
				</div>
				<div class="flex items-center justify-between text-sm">
					<span class="text-muted-foreground">Rating</span>
					<span class="font-medium {strengthClass}">{strength.label}</span>
				</div>
				<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
					<div
						class="h-full transition-all duration-300 {strengthBarClass}"
						style:width="{strengthPercent}%"
					></div>
				</div>
			</div>
		</FormSection>

		<FormSection title="Actions">
			<div class="space-y-2">
				<ActionButton
					label="Generate"
					icon={Lock}
					disabled={!canGenerate}
					shortcut
					onclick={handleGenerate}
				/>
				{#if results.length > 0}
					<ActionButton
						label="Regenerate"
						icon={RefreshCw}
						variant="outline"
						onclick={handleGenerate}
					/>
					<ActionButton label="Clear" variant="outline" onclick={handleClear} />
				{/if}
			</div>
		</FormSection>

		<FormSection title="About">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li>Cryptographically secure (Web Crypto)</li>
					<li>Entropy is log2(pool) × length</li>
					<li>≥ 60 bits resists offline attacks</li>
					<li>≥ 128 bits is overkill for human use</li>
				</ul>
			</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Results Panel -->
	<div class="flex h-full flex-col overflow-hidden">
		<SectionHeader title="Generated Passwords" count={results.length || undefined}>
			{#snippet trailing()}
				{#if results.length > 0}
					<CopyButton
						text={results.join('\n')}
						label="Copy All"
						toastLabel={`${results.length} password${results.length > 1 ? 's' : ''}`}
						size="sm"
						class="h-7"
					/>
				{/if}
			{/snippet}
		</SectionHeader>

		<div class="flex-1 overflow-auto p-4">
			{#if results.length > 0}
				<div class="space-y-2">
					{#each results as password, idx (`${idx}-${password}`)}
						<div class="flex items-center gap-2 rounded-lg border bg-surface-3 p-3">
							<code class="flex-1 break-all font-mono text-sm">{password}</code>
							<CopyButton text={password} toastLabel="Password" size="sm" showLabel={false} />
						</div>
					{/each}
				</div>
			{:else}
				<EmptyState icon={Lock} title="Click Generate to create passwords" />
			{/if}
		</div>
	</div>
</ToolShell>
