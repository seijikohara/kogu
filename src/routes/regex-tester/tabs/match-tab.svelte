<script lang="ts">
	import { Search } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormCheckbox, FormCheckboxGroup, FormInput, FormTextarea } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { EmbeddedEmptyState } from '$lib/components/status';
	import { cn } from '$lib/utils';
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

	// Highlighted text — segment the test text into matched / unmatched ranges.
	interface Segment {
		readonly text: string;
		readonly matched: boolean;
		readonly index: number;
	}

	const segments = $derived.by<Segment[]>(() => {
		if (!result.ok || result.value.length === 0)
			return [{ text: testText, matched: false, index: 0 }];
		const out: Segment[] = [];
		let cursor = 0;
		for (let i = 0; i < result.value.length; i++) {
			const m = result.value[i];
			if (!m) continue;
			if (m.index > cursor) {
				out.push({ text: testText.slice(cursor, m.index), matched: false, index: -1 });
			}
			out.push({
				text: testText.slice(m.index, m.index + m.fullMatch.length),
				matched: true,
				index: i,
			});
			cursor = m.index + m.fullMatch.length;
		}
		if (cursor < testText.length) {
			out.push({ text: testText.slice(cursor), matched: false, index: -1 });
		}
		return out;
	});

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
		<div class="mx-auto flex max-w-5xl flex-col gap-4">
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Pattern & flags</Card.Title>
					<Card.Description class="text-xs">JavaScript regex syntax.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					<FormInput label="Pattern" bind:value={pattern} placeholder="\\d+" class="font-mono" />
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

			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Test text</Card.Title>
				</Card.Header>
				<Card.Content>
					<FormTextarea
						label=""
						bind:value={testText}
						placeholder="Paste text to match against..."
						rows={5}
						class="font-mono text-sm"
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">
						Matches <span class="text-muted-foreground">({matchCount})</span>
					</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if result.ok}
						{#if result.value.length > 0}
							<div class="mb-4 rounded-md bg-muted p-3 font-mono text-sm whitespace-pre-wrap">
								{#each segments as seg, idx (idx)}
									{#if seg.matched}
										<mark
											class="rounded bg-success/30 px-0.5 text-foreground"
											data-match-index={seg.index}
										>
											{seg.text}
										</mark>
									{:else}
										<span>{seg.text}</span>
									{/if}
								{/each}
							</div>
							<div class="space-y-2">
								{#each result.value as match, idx (idx)}
									<div class="rounded-md border bg-surface-3 p-3">
										<div class="flex items-center gap-2">
											<Badge variant="outline" class="font-mono text-2xs">@{match.index}</Badge>
											<code class="break-all font-mono text-sm">{match.fullMatch}</code>
										</div>
										{#if match.groups.length > 0}
											<div class="mt-2 space-y-1 pl-4">
												{#each match.groups as group, gIdx (gIdx)}
													<div class="flex items-baseline gap-2 text-xs">
														<Badge class="font-mono text-2xs bg-info/10 text-info border-info/30">
															${gIdx + 1}
														</Badge>
														<code class="break-all font-mono text-muted-foreground">{group}</code>
													</div>
												{/each}
											</div>
										{/if}
										{#if Object.keys(match.namedGroups).length > 0}
											<div class="mt-2 space-y-1 pl-4">
												{#each Object.entries(match.namedGroups) as [name, value] (name)}
													<div class="flex items-baseline gap-2 text-xs">
														<Badge
															class={cn(
																'font-mono text-2xs',
																'bg-success/10 text-success border-success/30'
															)}
														>
															{name}
														</Badge>
														<code class="break-all font-mono text-muted-foreground">{value}</code>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
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
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
