<script lang="ts">
	import { CopyButton } from '$lib/components/action';
	import { FormCheckbox, FormCheckboxGroup, FormInput, FormTextarea } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
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
		<div class="space-y-4">
			<div class="rounded-lg border bg-surface-3 p-4 space-y-3">
				<FormInput label="Pattern" bind:value={pattern} placeholder="\\d+" class="font-mono" />
				<FormInput
					label="Replacement"
					bind:value={replacement}
					placeholder="$1 → $2"
					hint="Use $1, $2... for capture groups; $& for full match"
					class="font-mono"
				/>
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
				<FormTextarea
					label="Source text"
					bind:value={testText}
					placeholder="Paste text to apply the replacement on..."
					rows={6}
					class="font-mono text-sm"
				/>
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<span class="mb-2 block text-sm font-medium">Result</span>
				{#if result.ok}
					<pre
						class="whitespace-pre-wrap rounded bg-muted p-3 font-mono text-sm">{result.value}</pre>
				{:else}
					<p class="text-sm text-destructive">{result.error}</p>
				{/if}
			</div>
		</div>
	</div>
</div>
