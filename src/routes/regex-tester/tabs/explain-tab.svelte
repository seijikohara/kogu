<script lang="ts">
	import { Check, X } from '@lucide/svelte';
	import { FormCheckbox, FormCheckboxGroup, FormInput } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { EmbeddedEmptyState } from '$lib/components/status';
	import {
		compileRegex,
		countCaptureGroups,
		DEFAULT_FLAGS,
		findFeatures,
		FLAG_INFO,
		flagsToString,
		type RegexFlags,
	} from '$lib/services/regex.js';

	interface Props {
		onstatschange?: (info: { valid: boolean }) => void;
	}

	let { onstatschange }: Props = $props();

	let pattern = $state<string>('^(?<name>\\w+)\\s+\\d{2,4}$');
	let flags = $state<RegexFlags>({ ...DEFAULT_FLAGS });

	const compiled = $derived(compileRegex(pattern, flags));
	const groupCount = $derived(countCaptureGroups(pattern));
	const features = $derived(findFeatures(pattern));
	const flagString = $derived(flagsToString(flags));
	const activeFlags = $derived(FLAG_INFO.filter((info) => flags[info.id]));

	$effect(() => {
		onstatschange?.({ valid: compiled.ok });
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Explain" />

	<div class="flex-1 overflow-auto p-4">
		<div class="space-y-4">
			<div class="rounded-lg border bg-surface-3 p-4">
				<FormInput label="Pattern" bind:value={pattern} placeholder="\\d+" class="font-mono" />
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<span class="mb-2 block text-sm font-medium">Flags ({flagString || 'none'})</span>
				<FormCheckboxGroup>
					{#each FLAG_INFO as info (info.id)}
						<FormCheckbox
							label={`${info.char} - ${info.label}`}
							hint={info.description}
							bind:checked={flags[info.id]}
						/>
					{/each}
				</FormCheckboxGroup>
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<div class="mb-2 flex items-center gap-2">
					{#if compiled.ok}
						<Check class="h-4 w-4 text-success" />
						<span class="text-sm font-medium text-success">Pattern is valid</span>
					{:else}
						<X class="h-4 w-4 text-destructive" />
						<span class="text-sm font-medium text-destructive">Invalid pattern</span>
					{/if}
				</div>
				{#if !compiled.ok}
					<p class="text-sm text-destructive">{compiled.error}</p>
				{/if}
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<span class="mb-2 block text-sm font-medium">Capture groups</span>
				<p class="font-mono text-sm tabular-nums">{groupCount}</p>
			</div>

			{#if activeFlags.length > 0}
				<div class="rounded-lg border bg-surface-3 p-4">
					<span class="mb-2 block text-sm font-medium">Enabled flags</span>
					<ul class="space-y-1 text-sm">
						{#each activeFlags as info (info.id)}
							<li class="flex items-baseline gap-2">
								<code class="font-mono font-semibold">{info.char}</code>
								<span class="text-muted-foreground">{info.description}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="rounded-lg border bg-surface-3 p-4">
				<span class="mb-2 block text-sm font-medium">Detected features</span>
				{#if features.length > 0}
					<ul class="space-y-1 text-sm">
						{#each features as feature (feature.token)}
							<li class="flex items-baseline gap-2">
								<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{feature.token}</code
								>
								<span class="text-muted-foreground">{feature.description}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<EmbeddedEmptyState
						icon={Check}
						title="Plain text pattern"
						description="No regex metacharacters detected; pattern matches literally."
					/>
				{/if}
			</div>
		</div>
	</div>
</div>
