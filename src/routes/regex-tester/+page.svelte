<script lang="ts">
	import { ArrowRightLeft, GitBranch, Info, Search } from '@lucide/svelte';
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
	import { ExplainTab, MatchTab, ReplaceTab, VisualizeTab } from './tabs/index.js';

	type RegexTab = 'match' | 'replace' | 'visualize' | 'explain';

	const TABS = [
		{ id: 'match' as const, label: 'Match', icon: Search },
		{ id: 'replace' as const, label: 'Replace', icon: ArrowRightLeft },
		{ id: 'visualize' as const, label: 'Visualize', icon: GitBranch },
		{ id: 'explain' as const, label: 'Explain', icon: Info },
	] as const;

	let activeTab = $state<RegexTab>('match');
	let matchStats = $state<{ matches: number; valid: boolean }>({ matches: 0, valid: true });
	let replaceStats = $state<{ length: number; valid: boolean }>({ length: 0, valid: true });
	let visualizeStats = $state<{ valid: boolean }>({ valid: true });
	let explainStats = $state<{ valid: boolean }>({ valid: true });

	const isValid = $derived.by(() => {
		if (activeTab === 'match') return matchStats.valid;
		if (activeTab === 'replace') return replaceStats.valid;
		if (activeTab === 'visualize') return visualizeStats.valid;
		return explainStats.valid;
	});

	const handleTabChange = (tab: string) => {
		if (tab === 'match' || tab === 'replace' || tab === 'visualize' || tab === 'explain')
			activeTab = tab;
	};
</script>

<svelte:head>
	<title>Regex Tester - Kogu</title>
</svelte:head>

<ToolShell layout="tabbed" tabs={TABS} {activeTab} ontabchange={handleTabChange} valid={isValid}>
	{#snippet statusContent()}
		{#if activeTab === 'match'}
			<StatItem label="Matches" value={matchStats.matches} />
		{:else if activeTab === 'replace'}
			<StatItem label="Output" value={`${replaceStats.length} chars`} />
		{/if}
	{/snippet}

	{#snippet tabContent(tab)}
		{#if tab === 'match'}
			<MatchTab onstatschange={(info) => (matchStats = info)} />
		{:else if tab === 'replace'}
			<ReplaceTab onstatschange={(info) => (replaceStats = info)} />
		{:else if tab === 'visualize'}
			<VisualizeTab onstatschange={(info) => (visualizeStats = info)} />
		{:else if tab === 'explain'}
			<ExplainTab onstatschange={(info) => (explainStats = info)} />
		{/if}
	{/snippet}
</ToolShell>
