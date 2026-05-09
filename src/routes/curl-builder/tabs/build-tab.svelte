<script lang="ts">
	import { Terminal } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormCheckbox, FormInput, FormSelect, FormTextarea } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import {
		buildCurl,
		DEFAULT_BUILD_OPTIONS,
		DEFAULT_REQUEST,
		formatHeaderLines,
		HTTP_METHODS,
		type HttpMethod,
		isHttpMethod,
		parseHeaderLines,
	} from '$lib/services/curl.js';

	interface Props {
		onstatschange?: (info: { command: string; valid: boolean }) => void;
	}

	let { onstatschange }: Props = $props();

	let method = $state<HttpMethod>(DEFAULT_REQUEST.method);
	let url = $state<string>(DEFAULT_REQUEST.url);
	let headersText = $state<string>(formatHeaderLines(DEFAULT_REQUEST.headers));
	let body = $state<string>(DEFAULT_REQUEST.body);
	let multiline = $state<boolean>(DEFAULT_BUILD_OPTIONS.multiline);

	const headers = $derived(parseHeaderLines(headersText));
	const command = $derived(buildCurl({ method, url, headers, body }, { multiline }));
	const isValid = $derived(url.length > 0);

	const methodOptions = HTTP_METHODS.map((m) => ({ value: m, label: m }));

	const handleMethodChange = (value: string) => {
		if (isHttpMethod(value)) method = value;
	};

	$effect(() => {
		onstatschange?.({ command, valid: isValid });
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Build cURL Command">
		{#snippet trailing()}
			<CopyButton text={command} toastLabel="Command" size="sm" class="h-7" />
		{/snippet}
	</SectionHeader>

	<div class="flex-1 overflow-auto p-4">
		<div class="space-y-4">
			<div class="rounded-lg border bg-surface-3 p-4">
				<div class="grid gap-3 sm:grid-cols-[140px_1fr]">
					<FormSelect
						label="Method"
						value={method}
						options={methodOptions}
						onchange={handleMethodChange}
					/>
					<FormInput label="URL" bind:value={url} placeholder="https://api.example.com/users" />
				</div>
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<FormTextarea
					label="Headers"
					bind:value={headersText}
					placeholder={`Authorization: Bearer xxx\nContent-Type: application/json`}
					hint="One header per line, Key: Value format"
					rows={4}
					class="font-mono text-sm"
				/>
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<FormTextarea
					label="Body"
					bind:value={body}
					placeholder={`{ "name": "alice" }`}
					hint="Sent with --data-raw; methods default to POST when a body is present"
					rows={6}
					class="font-mono text-sm"
				/>
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<FormCheckbox
					label="Multi-line output"
					hint="Wraps each argument onto its own line with backslash continuations"
					bind:checked={multiline}
				/>
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<div class="flex items-center gap-2">
					<Terminal class="h-4 w-4 text-muted-foreground" />
					<span class="text-sm font-medium">Generated command</span>
				</div>
				<pre class="mt-2 overflow-auto rounded bg-muted p-3 font-mono text-sm">{command}</pre>
			</div>
		</div>
	</div>
</div>
