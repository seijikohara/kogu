<script lang="ts">
	import { Pencil, Search } from '@lucide/svelte';
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
	import { BuildTab, ParseTab } from './tabs/index.js';

	type CronTab = 'build' | 'parse';

	const TABS = [
		{ id: 'build' as const, label: 'Build', icon: Pencil },
		{ id: 'parse' as const, label: 'Parse', icon: Search },
	] as const;

	let activeTab = $state<CronTab>('build');
	let buildStats = $state<{ expression: string; valid: boolean }>({
		expression: '* * * * *',
		valid: true,
	});
	let parseStats = $state<{ expression: string; valid: boolean }>({
		expression: '*/5 * * * *',
		valid: true,
	});

	const currentStats = $derived(activeTab === 'build' ? buildStats : parseStats);

	const handleTabChange = (tab: string) => {
		if (tab === 'build' || tab === 'parse') activeTab = tab;
	};
</script>

<svelte:head>
	<title>Cron Expression Builder - Kogu</title>
</svelte:head>

<ToolShell
	layout="tabbed"
	tabs={TABS}
	{activeTab}
	ontabchange={handleTabChange}
	valid={currentStats.valid}
>
	{#snippet statusContent()}
		<StatItem label="Expression" value={currentStats.expression} />
	{/snippet}

	{#snippet tabContent(tab)}
		{#if tab === 'build'}
			<BuildTab onstatschange={(info) => (buildStats = info)} />
		{:else if tab === 'parse'}
			<ParseTab onstatschange={(info) => (parseStats = info)} />
		{/if}
	{/snippet}
</ToolShell>
