<script lang="ts">
	import { Fingerprint, RefreshCw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ActionButton, CopyButton } from '$lib/components/action';
	import {
		FormCheckbox,
		FormCheckboxGroup,
		FormInfo,
		FormInput,
		FormSection,
		FormSelect,
		FormSlider,
	} from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { ToolShell } from '$lib/components/shell';
	import { EmptyState, StatItem } from '$lib/components/status';
	import {
		DEFAULT_COUNT,
		DEFAULT_FORMAT_OPTIONS,
		generateUuids,
		isUuidVersion,
		MAX_COUNT,
		MIN_COUNT,
		NAMESPACE_DNS,
		NAMESPACE_PRESETS,
		requiresNamespace,
		UUID_VERSIONS,
		type UuidFormatOptions,
		type UuidVersion,
	} from '$lib/services/uuid.js';

	// State
	let version = $state<UuidVersion>('v4');
	let count = $state<number>(DEFAULT_COUNT);
	let namespace = $state<string>(NAMESPACE_DNS);
	let nameInput = $state<string>('');
	let format = $state<UuidFormatOptions>({ ...DEFAULT_FORMAT_OPTIONS });
	let results = $state<readonly string[]>([]);
	let error = $state<string | null>(null);
	let showOptions = $state(true);

	// Derived
	const needsNamespace = $derived(requiresNamespace(version));
	const canGenerate = $derived(!needsNamespace || (namespace.length > 0 && nameInput.length > 0));

	const versionOptions = UUID_VERSIONS.map((info) => ({
		value: info.version,
		label: `${info.label} - ${info.description}`,
	}));

	const namespaceOptions = NAMESPACE_PRESETS.map((preset) => ({
		value: preset.value,
		label: `${preset.label} (${preset.value})`,
	}));

	// Handlers
	const handleVersionChange = (value: string) => {
		if (isUuidVersion(value)) version = value;
	};

	const handleNamespaceChange = (value: string) => {
		namespace = value;
	};

	const handleGenerate = () => {
		error = null;
		try {
			results = generateUuids({
				version,
				count,
				namespace: needsNamespace ? namespace : undefined,
				name: needsNamespace ? nameInput : undefined,
				format,
			});
			toast.success(`Generated ${results.length} UUID${results.length > 1 ? 's' : ''}`);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			error = message;
			results = [];
			toast.error('Failed to generate UUID', { description: message });
		}
	};

	const handleClear = () => {
		results = [];
		error = null;
	};
</script>

<svelte:head>
	<title>UUID Generator - Kogu</title>
</svelte:head>

<ToolShell
	valid={results.length > 0 ? true : null}
	error={error ?? undefined}
	bind:showRail={showOptions}
>
	{#snippet statusContent()}
		{#if results.length > 0}
			<StatItem label="Count" value={results.length} />
			<StatItem label="Version" value={version === 'nil' ? 'NIL' : version.toUpperCase()} />
		{/if}
	{/snippet}

	{#snippet rail()}
		<FormSection title="Version">
			<FormSelect
				label="UUID Version"
				value={version}
				options={versionOptions}
				onchange={handleVersionChange}
			/>
		</FormSection>

		{#if needsNamespace}
			<FormSection title="Namespace & Name">
				<FormSelect
					label="Namespace Preset"
					value={namespace}
					options={namespaceOptions}
					onchange={handleNamespaceChange}
				/>
				<FormInput
					label="Custom Namespace UUID"
					bind:value={namespace}
					placeholder="Or enter a custom UUID..."
					size="compact"
				/>
				<FormInput
					label="Name"
					bind:value={nameInput}
					placeholder="e.g., example.com"
					size="compact"
				/>
			</FormSection>
		{/if}

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

		<FormSection title="Format">
			<FormCheckboxGroup>
				<FormCheckbox label="Uppercase" bind:checked={format.uppercase} />
				<FormCheckbox label="Hyphens" bind:checked={format.hyphens} />
				<FormCheckbox label="Wrap in braces" bind:checked={format.braces} />
			</FormCheckboxGroup>
		</FormSection>

		<FormSection title="Actions">
			<div class="space-y-2">
				<ActionButton
					label="Generate"
					icon={Fingerprint}
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

		<FormSection title="About UUID">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li>Universally Unique Identifier (RFC 9562)</li>
					<li>v4 random is the most common choice</li>
					<li>v7 is time-ordered, ideal for DB primary keys</li>
					<li>v3 / v5 are deterministic from namespace + name</li>
				</ul>
			</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Results Panel -->
	<div class="flex h-full flex-col overflow-hidden">
		<SectionHeader title="Generated UUIDs" count={results.length || undefined}>
			{#snippet trailing()}
				{#if results.length > 0}
					<CopyButton
						text={results.join('\n')}
						label="Copy All"
						toastLabel={`${results.length} UUID${results.length > 1 ? 's' : ''}`}
						size="sm"
						class="h-7"
					/>
				{/if}
			{/snippet}
		</SectionHeader>

		<div class="flex-1 overflow-auto p-4">
			{#if results.length > 0}
				<div class="space-y-2">
					{#each results as uuid, idx (`${idx}-${uuid}`)}
						<div class="flex items-center gap-2 rounded-lg border bg-surface-3 p-3">
							<code class="flex-1 break-all font-mono text-sm">{uuid}</code>
							<CopyButton text={uuid} toastLabel="UUID" size="sm" showLabel={false} />
						</div>
					{/each}
				</div>
			{:else}
				<EmptyState icon={Fingerprint} title="Click Generate to create UUIDs" />
			{/if}
		</div>
	</div>
</ToolShell>
