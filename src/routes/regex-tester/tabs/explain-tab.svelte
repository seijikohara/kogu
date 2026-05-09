<script lang="ts">
	import { Check, X } from '@lucide/svelte';
	import { FormCheckbox, FormCheckboxGroup, FormInput } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
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
		<div class="mx-auto flex max-w-5xl flex-col gap-4">
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Pattern</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-3">
					<FormInput label="" bind:value={pattern} placeholder="\\d+" class="font-mono" />
					<FormCheckboxGroup>
						{#each FLAG_INFO as info (info.id)}
							<FormCheckbox
								label={`${info.char} - ${info.label}`}
								hint={info.description}
								bind:checked={flags[info.id]}
							/>
						{/each}
					</FormCheckboxGroup>
				</Card.Content>
			</Card.Root>

			<div class="grid gap-4 sm:grid-cols-3">
				<Card.Root>
					<Card.Header class="pb-3">
						<Card.Title class="text-sm font-medium">Validity</Card.Title>
					</Card.Header>
					<Card.Content>
						{#if compiled.ok}
							<div class="flex items-center gap-2">
								<Check class="h-4 w-4 text-success" />
								<span class="text-sm font-medium text-success">Valid</span>
							</div>
						{:else}
							<div class="flex items-center gap-2">
								<X class="h-4 w-4 text-destructive" />
								<span class="text-sm font-medium text-destructive">Invalid</span>
							</div>
							<p class="mt-2 text-xs text-destructive">{compiled.error}</p>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header class="pb-3">
						<Card.Title class="text-sm font-medium">Capture groups</Card.Title>
					</Card.Header>
					<Card.Content>
						<p class="text-2xl font-mono tabular-nums">{groupCount}</p>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header class="pb-3">
						<Card.Title class="text-sm font-medium">
							Active flags <span class="text-muted-foreground">({flagString || '—'})</span>
						</Card.Title>
					</Card.Header>
					<Card.Content class="flex flex-wrap gap-1">
						{#each activeFlags as info (info.id)}
							<Badge variant="outline" class="font-mono text-2xs">{info.char} {info.label}</Badge>
						{/each}
						{#if activeFlags.length === 0}
							<span class="text-xs text-muted-foreground">None enabled</span>
						{/if}
					</Card.Content>
				</Card.Root>
			</div>

			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Detected features</Card.Title>
					<Card.Description class="text-xs">
						Metacharacter classes and constructs found in the pattern.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if features.length > 0}
						<ul class="space-y-1.5">
							{#each features as feature (feature.token)}
								<li class="flex items-baseline gap-3 rounded-md border bg-surface-3 px-3 py-2">
									<code class="rounded bg-muted px-2 py-0.5 font-mono text-xs">{feature.token}</code
									>
									<span class="text-sm text-muted-foreground">{feature.description}</span>
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
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
