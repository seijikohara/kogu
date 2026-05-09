<script lang="ts">
	import { Pencil, Search } from '@lucide/svelte';
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
	import { BuildTab, ParseTab } from './tabs/index.js';

	type CurlTab = 'build' | 'parse';

	const TABS = [
		{ id: 'build' as const, label: 'Build', icon: Pencil },
		{ id: 'parse' as const, label: 'Parse', icon: Search },
	] as const;

	let activeTab = $state<CurlTab>('build');
	let buildStats = $state<{ command: string; valid: boolean }>({ command: '', valid: true });
	let parseStats = $state<{ command: string; valid: boolean }>({ command: '', valid: true });

	const currentStats = $derived(activeTab === 'build' ? buildStats : parseStats);

	const handleTabChange = (tab: string) => {
		if (tab === 'build' || tab === 'parse') activeTab = tab;
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
			<BuildTab onstatschange={(info) => (buildStats = info)} />
		{:else if tab === 'parse'}
			<ParseTab onstatschange={(info) => (parseStats = info)} />
		{/if}
	{/snippet}
</ToolShell>
