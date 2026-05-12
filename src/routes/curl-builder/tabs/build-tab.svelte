<script lang="ts">
	import { Globe, Lock, Settings2, Terminal } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import {
		FormCheckbox,
		FormInput,
		FormSection,
		FormSelect,
		FormTextarea,
	} from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import {
		AUTH_SCHEMES,
		BODY_MODES,
		buildCurl,
		type CurlRequest,
		DEFAULT_BUILD_OPTIONS,
		DEFAULT_REQUEST,
		formatHeaderLines,
		HTTP_METHODS,
		type HttpMethod,
		isAuthScheme,
		isBodyMode,
		isHttpMethod,
		type KeyValue,
		parseHeaderLines,
	} from '$lib/services/curl.js';

	interface Props {
		onstatschange?: (info: { command: string; valid: boolean; request: CurlRequest }) => void;
	}

	let { onstatschange }: Props = $props();

	let request = $state<CurlRequest>({ ...DEFAULT_REQUEST });
	let headersText = $state<string>(formatHeaderLines(DEFAULT_REQUEST.headers));
	let formText = $state<string>('');
	let multiline = $state<boolean>(DEFAULT_BUILD_OPTIONS.multiline);

	const headers = $derived(parseHeaderLines(headersText));
	const formFields = $derived<readonly KeyValue[]>(
		formText
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && line.includes('='))
			.map((line) => {
				const idx = line.indexOf('=');
				return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
			})
	);

	const fullRequest = $derived.by<CurlRequest>(() => {
		const base = { ...request, headers };
		if (request.body.mode === 'form') {
			return { ...base, body: { mode: 'form', fields: formFields } };
		}
		return base;
	});

	const command = $derived(buildCurl(fullRequest, { multiline }));
	const isValid = $derived(request.url.length > 0);

	const METHOD_DESCRIPTIONS: Record<HttpMethod, string> = {
		GET: 'Retrieve a resource',
		POST: 'Create a resource or submit form',
		PUT: 'Replace a resource',
		PATCH: 'Partially update a resource',
		DELETE: 'Remove a resource',
		HEAD: 'Retrieve headers only',
		OPTIONS: 'List allowed methods (CORS preflight)',
	};
	const methodOptions = HTTP_METHODS.map((m) => ({
		value: m,
		label: m,
		description: METHOD_DESCRIPTIONS[m],
	}));
	const authOptions = AUTH_SCHEMES.map((info) => ({
		value: info.id,
		label: info.label,
		description: info.description,
	}));
	const bodyOptions = BODY_MODES.map((info) => ({
		value: info.id,
		label: info.label,
		description: info.description,
	}));

	const handleMethodChange = (value: string) => {
		if (isHttpMethod(value)) request = { ...request, method: value };
	};
	const handleAuthChange = (value: string) => {
		if (!isAuthScheme(value)) return;
		if (value === 'none') request = { ...request, auth: { scheme: 'none' } };
		else if (value === 'basic')
			request = { ...request, auth: { scheme: 'basic', username: '', password: '' } };
		else if (value === 'bearer') request = { ...request, auth: { scheme: 'bearer', token: '' } };
		else request = { ...request, auth: { scheme: 'apikey', headerName: 'X-API-Key', value: '' } };
	};
	const handleBodyChange = (value: string) => {
		if (!isBodyMode(value)) return;
		if (value === 'none') request = { ...request, body: { mode: 'none' } };
		else if (value === 'raw') request = { ...request, body: { mode: 'raw', content: '' } };
		else if (value === 'json')
			request = { ...request, body: { mode: 'json', content: '{\n  "key": "value"\n}' } };
		else request = { ...request, body: { mode: 'form', fields: [] } };
	};

	$effect(() => {
		onstatschange?.({ command, valid: isValid, request: fullRequest });
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Build">
		{#snippet trailing()}
			<CopyButton text={command} toastLabel="Command" size="sm" class="h-7" />
		{/snippet}
	</SectionHeader>

	<div class="flex-1 overflow-auto p-4">
		<div class="mx-auto flex max-w-5xl flex-col gap-4">
			<!-- Request line -->
			<Card.Root density="compact">
				<Card.Header class="pb-3">
					<div class="flex items-center gap-2">
						<Globe class="h-4 w-4 text-muted-foreground" />
						<Card.Title class="text-sm font-medium">Request</Card.Title>
					</div>
				</Card.Header>
				<Card.Content class="grid gap-3 sm:grid-cols-[140px_1fr]">
					<FormSelect
						label="Method"
						value={request.method}
						options={methodOptions}
						onchange={handleMethodChange}
					/>
					<FormInput
						label="URL"
						value={request.url}
						onchange={(v) => (request = { ...request, url: v })}
						placeholder="https://api.example.com/users"
					/>
				</Card.Content>
			</Card.Root>

			<!-- Authentication -->
			<Card.Root density="compact">
				<Card.Header class="pb-3">
					<div class="flex items-center gap-2">
						<Lock class="h-4 w-4 text-muted-foreground" />
						<Card.Title class="text-sm font-medium">Authentication</Card.Title>
						<Badge variant="outline" class="ml-auto text-2xs uppercase">
							{request.auth.scheme}
						</Badge>
					</div>
				</Card.Header>
				<Card.Content class="space-y-3">
					<FormSelect
						label="Scheme"
						value={request.auth.scheme}
						options={authOptions}
						onchange={handleAuthChange}
					/>
					{#if request.auth.scheme === 'basic'}
						{@const basicAuth = request.auth}
						<FormInput
							label="Username"
							value={basicAuth.username}
							onchange={(v) =>
								(request = {
									...request,
									auth: { scheme: 'basic', username: v, password: basicAuth.password },
								})}
						/>
						<FormInput
							label="Password"
							type="password"
							showToggle
							value={basicAuth.password}
							onchange={(v) =>
								(request = {
									...request,
									auth: { scheme: 'basic', username: basicAuth.username, password: v },
								})}
						/>
					{:else if request.auth.scheme === 'bearer'}
						{@const bearerAuth = request.auth}
						<FormInput
							label="Token"
							value={bearerAuth.token}
							onchange={(v) => (request = { ...request, auth: { scheme: 'bearer', token: v } })}
							placeholder="eyJhbGc..."
							class="font-mono"
						/>
					{:else if request.auth.scheme === 'apikey'}
						{@const apiAuth = request.auth}
						<FormInput
							label="Header name"
							value={apiAuth.headerName}
							onchange={(v) =>
								(request = {
									...request,
									auth: { scheme: 'apikey', headerName: v, value: apiAuth.value },
								})}
							class="font-mono"
						/>
						<FormInput
							label="Value"
							value={apiAuth.value}
							onchange={(v) =>
								(request = {
									...request,
									auth: { scheme: 'apikey', headerName: apiAuth.headerName, value: v },
								})}
							class="font-mono"
						/>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Headers -->
			<Card.Root density="compact">
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Headers</Card.Title>
					<Card.Description class="text-xs">
						One header per line in <code class="rounded bg-muted px-1 font-mono">Key: Value</code> format.
						Auth headers are added automatically based on the scheme above.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<FormTextarea
						label=""
						bind:value={headersText}
						placeholder="Accept: application/json"
						rows={4}
						class="font-mono text-sm"
					/>
				</Card.Content>
			</Card.Root>

			<!-- Body -->
			<Card.Root density="compact">
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Body</Card.Title>
					<Card.Description class="text-xs">
						When set, the method auto-promotes to POST and the matching Content-Type header is
						appended.
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					<FormSelect
						label="Type"
						value={request.body.mode}
						options={bodyOptions}
						onchange={handleBodyChange}
					/>
					{#if request.body.mode === 'raw'}
						<FormTextarea
							label="Body"
							value={request.body.content}
							onchange={(v) => (request = { ...request, body: { mode: 'raw', content: v } })}
							rows={6}
							class="font-mono text-sm"
						/>
					{:else if request.body.mode === 'json'}
						<FormTextarea
							label="JSON body"
							value={request.body.content}
							onchange={(v) => (request = { ...request, body: { mode: 'json', content: v } })}
							rows={6}
							class="font-mono text-sm"
						/>
					{:else if request.body.mode === 'form'}
						<FormTextarea
							label="Form fields"
							bind:value={formText}
							placeholder={'name=alice\nrole=admin'}
							hint="One field per line in key=value format. Values are URL-encoded automatically."
							rows={5}
							class="font-mono text-sm"
						/>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Options -->
			<Card.Root density="compact">
				<Card.Header class="pb-3">
					<div class="flex items-center gap-2">
						<Settings2 class="h-4 w-4 text-muted-foreground" />
						<Card.Title class="text-sm font-medium">Options</Card.Title>
					</div>
				</Card.Header>
				<Card.Content class="space-y-3">
					<FormCheckbox
						label="Multi-line output"
						hint="Wrap each argument onto its own line with backslash continuations."
						bind:checked={multiline}
					/>
					<FormCheckbox
						label="Follow redirects (-L)"
						checked={request.followRedirects}
						onchange={(v) => (request = { ...request, followRedirects: v })}
					/>
					<FormCheckbox
						label="Allow insecure TLS (-k)"
						hint="Disables certificate validation. Use only against trusted hosts."
						checked={request.insecure}
						onchange={(v) => (request = { ...request, insecure: v })}
					/>
					<FormCheckbox
						label="Include response headers (-i)"
						checked={request.includeHeaders}
						onchange={(v) => (request = { ...request, includeHeaders: v })}
					/>
					<FormInput
						label="Timeout (seconds)"
						value={String(request.timeoutSeconds || '')}
						onchange={(v) => {
							const n = Number.parseFloat(v);
							request = { ...request, timeoutSeconds: Number.isFinite(n) ? n : 0 };
						}}
						placeholder="0 = no timeout"
						hint="Maps to --max-time"
						class="font-mono"
					/>
				</Card.Content>
			</Card.Root>

			<!-- Output -->
			<Card.Root density="compact">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
					<div class="flex items-center gap-2">
						<Terminal class="h-4 w-4 text-muted-foreground" />
						<Card.Title class="text-sm font-medium">Generated command</Card.Title>
					</div>
					<CopyButton text={command} toastLabel="Command" size="sm" />
				</Card.Header>
				<Card.Content>
					<pre class="overflow-auto rounded-md bg-muted p-3 font-mono text-sm">{command}</pre>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
