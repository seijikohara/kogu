<script lang="ts">
	import { Globe, Terminal } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormTextarea } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { EmbeddedEmptyState } from '$lib/components/status';
	import { parseCurl } from '$lib/services/curl.js';

	interface Props {
		onstatschange?: (info: { command: string; valid: boolean }) => void;
	}

	let { onstatschange }: Props = $props();

	let command = $state<string>(
		`curl -X POST 'https://api.example.com/login' \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{"username":"alice","password":"secret"}'`
	);

	const parsed = $derived(parseCurl(command));

	$effect(() => {
		onstatschange?.({ command, valid: parsed.ok });
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Parse cURL Command">
		{#snippet trailing()}
			<CopyButton text={command} toastLabel="Command" size="sm" class="h-7" />
		{/snippet}
	</SectionHeader>

	<div class="flex-1 overflow-auto p-4">
		<div class="space-y-4">
			<div class="rounded-lg border bg-surface-3 p-4">
				<FormTextarea
					label="cURL command"
					bind:value={command}
					placeholder="curl -X GET 'https://example.com'"
					hint="Supports -X, -H, -d / --data / --data-raw / --data-binary, -G; backslash continuations are joined."
					rows={6}
					class="font-mono text-sm"
				/>
			</div>

			{#if parsed.ok}
				<div class="rounded-lg border bg-surface-3 p-4">
					<div class="flex items-center gap-2">
						<Globe class="h-4 w-4 text-muted-foreground" />
						<span class="text-sm font-medium">Request</span>
					</div>
					<div class="mt-2 grid gap-3 sm:grid-cols-[140px_1fr]">
						<div class="rounded border bg-muted px-3 py-2 text-center font-mono text-sm">
							{parsed.value.method}
						</div>
						<div class="rounded border bg-muted px-3 py-2 font-mono text-sm break-all">
							{parsed.value.url}
						</div>
					</div>
				</div>

				<div class="rounded-lg border bg-surface-3 p-4">
					<span class="mb-2 block text-sm font-medium">
						Headers ({parsed.value.headers.length})
					</span>
					{#if parsed.value.headers.length > 0}
						<div class="space-y-1 font-mono text-sm">
							{#each parsed.value.headers as header, idx (idx)}
								<div class="flex items-baseline gap-2 rounded border bg-muted px-3 py-2">
									<span class="shrink-0 font-medium">{header.key}:</span>
									<span class="break-all text-muted-foreground">{header.value}</span>
								</div>
							{/each}
						</div>
					{:else}
						<EmbeddedEmptyState
							icon={Globe}
							title="No headers"
							description="No -H flags were present in the command."
						/>
					{/if}
				</div>

				<div class="rounded-lg border bg-surface-3 p-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm font-medium">Body</span>
						{#if parsed.value.body.length > 0}
							<CopyButton text={parsed.value.body} toastLabel="Body" size="sm" />
						{/if}
					</div>
					{#if parsed.value.body.length > 0}
						<pre class="overflow-auto rounded bg-muted p-3 font-mono text-sm">{parsed.value
								.body}</pre>
					{:else}
						<p class="text-sm text-muted-foreground">No body.</p>
					{/if}
				</div>
			{:else}
				<div class="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
					<div class="flex items-center gap-2">
						<Terminal class="h-4 w-4 text-destructive" />
						<span class="text-sm font-medium text-destructive">Parse error</span>
					</div>
					<p class="mt-2 text-sm">{parsed.error}</p>
				</div>
			{/if}
		</div>
	</div>
</div>
