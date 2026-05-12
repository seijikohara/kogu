<script lang="ts">
	import { FlaskConical, Globe, Settings2, Terminal } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormTextarea } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { EmbeddedEmptyState } from '$lib/components/status';
	import { parseCurl, SAMPLE_CURL_COMMAND } from '$lib/services/curl.js';

	interface Props {
		onstatschange?: (info: { command: string; valid: boolean }) => void;
	}

	let { onstatschange }: Props = $props();

	let command = $state<string>('');

	const parsed = $derived(parseCurl(command));

	const loadSample = () => {
		command = SAMPLE_CURL_COMMAND;
	};

	$effect(() => {
		onstatschange?.({ command, valid: parsed.ok });
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Parse">
		{#snippet trailing()}
			<CopyButton text={command} toastLabel="Command" size="sm" class="h-7" />
		{/snippet}
	</SectionHeader>

	<div class="flex-1 overflow-auto p-4">
		<div class="mx-auto flex max-w-5xl flex-col gap-4">
			<Card.Root density="compact">
				<Card.Header class="flex flex-row items-start justify-between space-y-0 pb-3">
					<div class="space-y-1.5">
						<Card.Title class="text-sm font-medium">cURL command</Card.Title>
						<Card.Description class="text-xs">
							Supports <code class="rounded bg-muted px-1 font-mono">-X</code>,
							<code class="rounded bg-muted px-1 font-mono">-H</code>,
							<code class="rounded bg-muted px-1 font-mono"
								>-d / --data / --data-raw / --data-binary</code
							>,
							<code class="rounded bg-muted px-1 font-mono">-G</code>,
							<code class="rounded bg-muted px-1 font-mono">-L</code>,
							<code class="rounded bg-muted px-1 font-mono">-k</code>,
							<code class="rounded bg-muted px-1 font-mono">-i</code>,
							<code class="rounded bg-muted px-1 font-mono">--max-time</code>; backslash
							continuations are joined.
						</Card.Description>
					</div>
					<Button variant="outline" size="sm" class="h-7 shrink-0" onclick={loadSample}>
						<FlaskConical class="mr-1.5 h-3.5 w-3.5" />
						Sample
					</Button>
				</Card.Header>
				<Card.Content>
					<FormTextarea
						label=""
						bind:value={command}
						placeholder="curl -X GET 'https://example.com'"
						rows={6}
						class="font-mono text-sm"
					/>
				</Card.Content>
			</Card.Root>

			{#if command.trim().length === 0}
				<Card.Root density="compact">
					<Card.Content class="py-10">
						<EmbeddedEmptyState
							icon={Terminal}
							title="Paste a cURL command"
							description="Click Sample to load a representative request, or paste your own command."
						/>
					</Card.Content>
				</Card.Root>
			{:else if parsed.ok}
				<div class="grid gap-4 lg:grid-cols-3">
					<Card.Root density="compact">
						<Card.Header class="pb-3">
							<div class="flex items-center gap-2">
								<Globe class="h-4 w-4 text-muted-foreground" />
								<Card.Title class="text-sm font-medium">Method</Card.Title>
							</div>
						</Card.Header>
						<Card.Content>
							<Badge class="font-mono text-base">{parsed.value.method}</Badge>
						</Card.Content>
					</Card.Root>

					<Card.Root density="compact" class="lg:col-span-2">
						<Card.Header class="pb-3">
							<div class="flex items-center gap-2">
								<Globe class="h-4 w-4 text-muted-foreground" />
								<Card.Title class="text-sm font-medium">URL</Card.Title>
							</div>
						</Card.Header>
						<Card.Content>
							<code class="block break-all font-mono text-sm">{parsed.value.url}</code>
						</Card.Content>
					</Card.Root>
				</div>

				<Card.Root density="compact">
					<Card.Header class="pb-3">
						<Card.Title class="text-sm font-medium">
							Headers <span class="text-muted-foreground">({parsed.value.headers.length})</span>
						</Card.Title>
					</Card.Header>
					<Card.Content>
						{#if parsed.value.headers.length > 0}
							<div class="space-y-1.5">
								{#each parsed.value.headers as header, idx (idx)}
									<div class="flex items-baseline gap-2 rounded-md border bg-card px-3 py-2">
										<Badge variant="outline" class="font-mono text-2xs">{header.key}</Badge>
										<span class="break-all font-mono text-xs text-muted-foreground">
											{header.value}
										</span>
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
					</Card.Content>
				</Card.Root>

				<Card.Root density="compact">
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
						<Card.Title class="text-sm font-medium">Body</Card.Title>
						{#if parsed.value.body.length > 0}
							<CopyButton text={parsed.value.body} toastLabel="Body" size="sm" />
						{/if}
					</Card.Header>
					<Card.Content>
						{#if parsed.value.body.length > 0}
							<pre class="overflow-auto rounded-md bg-muted p-3 font-mono text-sm">{parsed.value
									.body}</pre>
						{:else}
							<p class="text-sm text-muted-foreground">No body.</p>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root density="compact">
					<Card.Header class="pb-3">
						<div class="flex items-center gap-2">
							<Settings2 class="h-4 w-4 text-muted-foreground" />
							<Card.Title class="text-sm font-medium">Options</Card.Title>
						</div>
					</Card.Header>
					<Card.Content class="flex flex-wrap gap-2 text-xs">
						<Badge variant={parsed.value.followRedirects ? 'default' : 'outline'}>
							{parsed.value.followRedirects ? '✓' : '×'} Follow redirects
						</Badge>
						<Badge variant={parsed.value.insecure ? 'default' : 'outline'}>
							{parsed.value.insecure ? '✓' : '×'} Insecure TLS
						</Badge>
						<Badge variant={parsed.value.includeHeaders ? 'default' : 'outline'}>
							{parsed.value.includeHeaders ? '✓' : '×'} Include headers
						</Badge>
						{#if parsed.value.timeoutSeconds > 0}
							<Badge variant="outline">timeout: {parsed.value.timeoutSeconds}s</Badge>
						{/if}
					</Card.Content>
				</Card.Root>
			{:else}
				<Card.Root density="compact" class="border-destructive/40 bg-destructive/5">
					<Card.Header class="pb-3">
						<div class="flex items-center gap-2">
							<Terminal class="h-4 w-4 text-destructive" />
							<Card.Title class="text-sm font-medium text-destructive">Parse error</Card.Title>
						</div>
					</Card.Header>
					<Card.Content>
						<p class="text-sm">{parsed.error}</p>
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
	</div>
</div>
