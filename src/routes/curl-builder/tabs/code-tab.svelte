<script lang="ts">
	import { Code2, FileCode } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { SectionHeader } from '$lib/components/layout';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import {
		type CurlRequest,
		DEFAULT_REQUEST,
		generateFetchCode,
		generateGoCode,
		generatePythonCode,
	} from '$lib/services/curl.js';

	interface Props {
		request: CurlRequest;
		onstatschange?: (info: { command: string; valid: boolean }) => void;
	}

	let { request = DEFAULT_REQUEST, onstatschange }: Props = $props();

	type Language = 'fetch' | 'python' | 'go';

	const LANGUAGES: { readonly id: Language; readonly label: string; readonly hint: string }[] = [
		{ id: 'fetch', label: 'JavaScript (fetch)', hint: 'Modern browser / Node 18+ fetch API' },
		{ id: 'python', label: 'Python (requests)', hint: 'Synchronous HTTP via requests' },
		{ id: 'go', label: 'Go (net/http)', hint: 'Standard library http.Client' },
	];

	let selected = $state<Language>('fetch');

	const code = $derived.by(() => {
		if (selected === 'fetch') return generateFetchCode(request);
		if (selected === 'python') return generatePythonCode(request);
		return generateGoCode(request);
	});

	$effect(() => {
		onstatschange?.({ command: code, valid: request.url.length > 0 });
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Code">
		{#snippet trailing()}
			<CopyButton
				text={code}
				toastLabel={LANGUAGES.find((l) => l.id === selected)?.label ?? ''}
				size="sm"
				class="h-7"
			/>
		{/snippet}
	</SectionHeader>

	<div class="flex-1 overflow-auto p-4">
		<div class="mx-auto flex max-w-5xl flex-col gap-4">
			<Card.Root density="compact">
				<Card.Header class="pb-3">
					<div class="flex items-center gap-2">
						<Code2 class="h-4 w-4 text-muted-foreground" />
						<Card.Title class="text-sm font-medium">Language</Card.Title>
					</div>
					<Card.Description class="text-xs">
						Generated from the Build tab's request — switch tabs to see other clients.
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-wrap gap-2">
					{#each LANGUAGES as lang (lang.id)}
						<Button
							variant="outline"
							size="sm"
							class={cn(
								'h-auto justify-start gap-2 px-3 py-1.5 text-xs',
								selected === lang.id && 'border-primary bg-primary/5'
							)}
							onclick={() => (selected = lang.id)}
						>
							<span class="font-medium">{lang.label}</span>
							<span class="text-2xs text-muted-foreground">{lang.hint}</span>
						</Button>
					{/each}
				</Card.Content>
			</Card.Root>

			<Card.Root density="compact">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
					<div class="flex items-center gap-2">
						<FileCode class="h-4 w-4 text-muted-foreground" />
						<Card.Title class="text-sm font-medium">
							{LANGUAGES.find((l) => l.id === selected)?.label ?? ''}
						</Card.Title>
						<Badge variant="outline" class="font-mono text-2xs">{selected}</Badge>
					</div>
					<CopyButton text={code} toastLabel="Snippet" size="sm" />
				</Card.Header>
				<Card.Content>
					<pre class="overflow-auto rounded-md bg-muted p-3 font-mono text-sm">{code}</pre>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
