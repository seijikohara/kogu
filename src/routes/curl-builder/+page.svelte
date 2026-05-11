<script lang="ts">
	import { Code2, Pencil, Search } from '@lucide/svelte';
	import { FormInfo, FormSection } from '$lib/components/form';
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
	import { type CurlRequest, DEFAULT_REQUEST } from '$lib/services/curl.js';
	import { BuildTab, CodeTab, ParseTab } from './tabs/index.js';

	type CurlTab = 'build' | 'parse' | 'code';

	const TABS = [
		{ id: 'build' as const, label: 'Build', icon: Pencil },
		{ id: 'parse' as const, label: 'Parse', icon: Search },
		{ id: 'code' as const, label: 'Code', icon: Code2 },
	] as const;

	let activeTab = $state<CurlTab>('build');
	let buildRequest = $state<CurlRequest>({ ...DEFAULT_REQUEST });
	let buildStats = $state<{ command: string; valid: boolean }>({ command: '', valid: true });
	let parseStats = $state<{ command: string; valid: boolean }>({ command: '', valid: true });
	let codeStats = $state<{ command: string; valid: boolean }>({ command: '', valid: true });

	const currentStats = $derived.by(() => {
		if (activeTab === 'build') return buildStats;
		if (activeTab === 'parse') return parseStats;
		return codeStats;
	});

	const handleTabChange = (tab: string) => {
		if (tab === 'build' || tab === 'parse' || tab === 'code') activeTab = tab;
	};
</script>

<svelte:head>
	<title>cURL Builder - Kogu</title>
</svelte:head>

<ToolShell
	layout="tabbed"
	tabs={TABS}
	{activeTab}
	ontabchange={handleTabChange}
	valid={currentStats.valid}
>
	{#snippet statusContent()}
		{#if currentStats.command}
			<StatItem label="Length" value={currentStats.command.length} />
		{/if}
	{/snippet}

	{#snippet rail()}
		<FormSection title="Tabs">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li><strong>Build</strong> — compose a request with form controls</li>
					<li><strong>Parse</strong> — paste an existing command to inspect it</li>
					<li><strong>Code</strong> — convert the request to other languages</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Authentication">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li><strong>None</strong> — no auth header</li>
					<li><strong>Basic</strong> — <code class="font-mono">user:password</code> via -u</li>
					<li><strong>Bearer</strong> — <code class="font-mono">Authorization: Bearer …</code></li>
					<li><strong>API key</strong> — custom header name + value</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Body types">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li><strong>JSON</strong> — application/json, raw payload via -d</li>
					<li><strong>Form</strong> — urlencoded, --data-urlencode per field</li>
					<li><strong>Multipart</strong> — -F for files and form parts</li>
					<li><strong>Raw</strong> — arbitrary text body</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Common flags">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li><code class="font-mono">-i</code> — include response headers</li>
					<li><code class="font-mono">-L</code> — follow redirects</li>
					<li><code class="font-mono">-k</code> — skip TLS verification</li>
					<li><code class="font-mono">--max-time</code> — total timeout in seconds</li>
				</ul>
			</FormInfo>
		</FormSection>
	{/snippet}

	{#snippet tabContent(tab)}
		{#if tab === 'build'}
			<BuildTab
				onstatschange={(info) => {
					buildStats = { command: info.command, valid: info.valid };
					buildRequest = info.request;
				}}
			/>
		{:else if tab === 'parse'}
			<ParseTab onstatschange={(info) => (parseStats = info)} />
		{:else if tab === 'code'}
			<CodeTab request={buildRequest} onstatschange={(info) => (codeStats = info)} />
		{/if}
	{/snippet}
</ToolShell>
