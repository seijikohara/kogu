<script lang="ts">
	import { Code2, Pencil, Search } from '@lucide/svelte';
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
