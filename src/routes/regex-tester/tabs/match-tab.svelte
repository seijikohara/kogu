<script lang="ts">
	import { Search } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormCheckbox, FormCheckboxGroup, FormInput, FormTextarea } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { EmbeddedEmptyState } from '$lib/components/status';
	import {
		DEFAULT_FLAGS,
		findMatches,
		FLAG_INFO,
		flagsToString,
		type RegexFlags,
	} from '$lib/services/regex.js';

	interface Props {
		onstatschange?: (info: { matches: number; valid: boolean }) => void;
	}

	let { onstatschange }: Props = $props();

	let pattern = $state<string>('\\b\\w+@\\w+\\.\\w+\\b');
	let flags = $state<RegexFlags>({ ...DEFAULT_FLAGS });
	let testText = $state<string>(
		`Contact alice@example.com or bob@example.org for details.\nAlso reach out via charlie@kogu.io anytime.`
	);

	const result = $derived(findMatches(pattern, flags, testText));
	const matchCount = $derived(result.ok ? result.value.length : 0);
	const flagString = $derived(flagsToString(flags));

	$effect(() => {
		onstatschange?.({ matches: matchCount, valid: result.ok });
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Match" count={matchCount || undefined}>
		{#snippet trailing()}
			<CopyButton text={`/${pattern}/${flagString}`} toastLabel="Pattern" size="sm" class="h-7" />
		{/snippet}
	</SectionHeader>

	<div class="flex-1 overflow-auto p-4">
		<div class="space-y-4">
			<div class="rounded-lg border bg-surface-3 p-4">
				<FormInput
					label="Pattern"
					bind:value={pattern}
					placeholder="\\d+"
					hint="JavaScript regex syntax"
					class="font-mono"
				/>
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<span class="mb-2 block text-sm font-medium">Flags</span>
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
				<FormTextarea
					label="Test text"
					bind:value={testText}
					placeholder="Paste text to match against..."
					rows={6}
					class="font-mono text-sm"
				/>
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<span class="mb-2 block text-sm font-medium">Matches</span>
				{#if result.ok}
					{#if result.value.length > 0}
						<ul class="space-y-2">
							{#each result.value as match, idx (idx)}
								<li class="rounded border bg-muted px-3 py-2 font-mono text-sm">
									<div class="flex items-baseline gap-2">
										<span class="text-xs text-muted-foreground tabular-nums">
											@{match.index}
										</span>
										<span class="break-all">{match.fullMatch}</span>
									</div>
									{#if match.groups.length > 0}
										<div class="mt-1 grid gap-1 pl-12">
											{#each match.groups as group, gIdx (gIdx)}
												<div class="text-xs text-muted-foreground">
													<span class="font-semibold">${gIdx + 1}:</span>
													<span class="break-all">{group}</span>
												</div>
											{/each}
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{:else}
						<EmbeddedEmptyState
							icon={Search}
							title="No matches"
							description="The pattern compiled but found no matches in the test text."
						/>
					{/if}
				{:else}
					<p class="text-sm text-destructive">{result.error}</p>
				{/if}
			</div>
		</div>
	</div>
</div>
