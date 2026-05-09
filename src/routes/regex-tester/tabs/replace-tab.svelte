<script lang="ts">
	import { ArrowRightLeft } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormCheckbox, FormCheckboxGroup, FormInput, FormTextarea } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import {
		DEFAULT_FLAGS,
		FLAG_INFO,
		flagsToString,
		type RegexFlags,
		replaceText,
	} from '$lib/services/regex.js';

	interface Props {
		onstatschange?: (info: { length: number; valid: boolean }) => void;
	}

	let { onstatschange }: Props = $props();

	let pattern = $state<string>('(\\w+)@(\\w+\\.\\w+)');
	let replacement = $state<string>('$1 [at] $2');
	let flags = $state<RegexFlags>({ ...DEFAULT_FLAGS });
	let testText = $state<string>(`Contact alice@example.com or bob@example.org for details.`);

	const result = $derived(replaceText(pattern, flags, testText, replacement));
	const flagString = $derived(flagsToString(flags));

	$effect(() => {
		onstatschange?.({
			length: result.ok ? result.value.length : 0,
			valid: result.ok,
		});
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Replace">
		{#snippet trailing()}
			{#if result.ok}
				<CopyButton text={result.value} toastLabel="Result" size="sm" class="h-7" />
			{/if}
		{/snippet}
	</SectionHeader>

	<div class="flex-1 overflow-auto p-4">
		<div class="mx-auto flex max-w-5xl flex-col gap-4">
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Pattern & replacement</Card.Title>
					<Card.Description class="text-xs">
						Use <code class="rounded bg-muted px-1 font-mono">$1</code>,
						<code class="rounded bg-muted px-1 font-mono">$2</code> ... for capture groups,
						<code class="rounded bg-muted px-1 font-mono">$&amp;</code> for the full match,
						<code class="rounded bg-muted px-1 font-mono">$&lt;name&gt;</code> for named groups.
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					<FormInput label="Pattern" bind:value={pattern} placeholder="\\d+" class="font-mono" />
					<FormInput
						label="Replacement"
						bind:value={replacement}
						placeholder="$1 → $2"
						class="font-mono"
					/>
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
					<Card.Title class="text-sm font-medium">Source text</Card.Title>
				</Card.Header>
				<Card.Content>
					<FormTextarea
						label=""
						bind:value={testText}
						placeholder="Paste text to apply the replacement on..."
						rows={5}
						class="font-mono text-sm"
					/>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
					<div class="flex items-center gap-2">
						<ArrowRightLeft class="h-4 w-4 text-muted-foreground" />
						<Card.Title class="text-sm font-medium">Result</Card.Title>
						{#if result.ok}
							<Badge variant="outline" class="font-mono text-2xs">
								{result.value.length} chars
							</Badge>
						{/if}
					</div>
					{#if result.ok}
						<CopyButton text={result.value} toastLabel="Result" size="sm" />
					{/if}
				</Card.Header>
				<Card.Content>
					{#if result.ok}
						<pre
							class="overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-sm">{result.value}</pre>
					{:else}
						<p class="text-sm text-destructive">{result.error}</p>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
