<script lang="ts">
	import { ArrowRightLeft, Code2, FileCheck, GitCompare, Play, Search } from '@lucide/svelte';
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
	import { calculateYamlStats, type YamlStats } from '$lib/services/formatters';
	import { useTabSync } from '$lib/utils';
	import {
		CompareTab,
		ConvertTab,
		FormatTab,
		GenerateTab,
		QueryTab,
		SchemaTab,
	} from './tabs/index.js';

	// Valid tab types
	type TabType = 'format' | 'query' | 'compare' | 'convert' | 'schema' | 'generate';

	// Tab definitions
	const tabs = [
		{ id: 'format' as const, label: 'Format', icon: Play },
		{ id: 'query' as const, label: 'Query', icon: Search },
		{ id: 'compare' as const, label: 'Compare', icon: GitCompare },
		{ id: 'convert' as const, label: 'Convert', icon: ArrowRightLeft },
		{ id: 'schema' as const, label: 'Schema', icon: FileCheck },
		{ id: 'generate' as const, label: 'Generate', icon: Code2 },
	] as const;

	const tabIds = tabs.map((t) => t.id);

	// Tab sync with URL (keep as object reference to preserve reactivity)
	const tabSync = useTabSync({
		tabs: tabIds,
		defaultTab: 'format',
	});

	// Type-safe tab change handler for ToolShell
	const handleTabChange = (tab: string) => tabSync.setActiveTab(tab as TabType);

	// Shared input across all tabs
	let sharedInput = $state('');
	const setSharedInput = (value: string) => {
		sharedInput = value;
	};

	// Tab-specific stats tracking
	interface TabStats {
		input: string;
		valid: boolean | null;
		error: string;
	}

	let tabStats = $state<Record<TabType, TabStats>>({
		format: { input: '', valid: null, error: '' },
		query: { input: '', valid: null, error: '' },
		compare: { input: '', valid: null, error: '' },
		convert: { input: '', valid: null, error: '' },
		schema: { input: '', valid: null, error: '' },
		generate: { input: '', valid: null, error: '' },
	});

	// Current tab stats
	const currentStats = $derived(tabStats[tabSync.activeTab as TabType]);

	// Stats handler
	const handleStatsChange =
		(tab: TabType) =>
		(stats: TabStats): void => {
			tabStats[tab] = stats;
		};

	// Live stats calculation
	const liveStats = $derived.by((): YamlStats | null => {
		const input = sharedInput.trim();
		if (!input) return null;
		try {
			return calculateYamlStats(input);
		} catch {
			return null;
		}
	});
</script>

<svelte:head>
	<title>YAML Formatter - Kogu</title>
</svelte:head>

<ToolShell
	layout="tabbed"
	{tabs}
	activeTab={tabSync.activeTab}
	ontabchange={handleTabChange}
	valid={currentStats.valid}
	error={currentStats.error}
	preserveTabState
>
	{#snippet statusContent()}
		{#if liveStats}
			<StatItem label="Keys" value={liveStats.keys} />
			<StatItem label="Values" value={liveStats.values} />
			<StatItem label="Depth" value={liveStats.depth} />
			<StatItem label="Size" value={liveStats.size} />
		{/if}
	{/snippet}

	{#snippet tabContent(tab)}
		{#if tab === 'format'}
			<FormatTab
				input={sharedInput}
				onInputChange={setSharedInput}
				onStatsChange={handleStatsChange('format')}
			/>
		{:else if tab === 'query'}
			<QueryTab
				input={sharedInput}
				onInputChange={setSharedInput}
				onStatsChange={handleStatsChange('query')}
			/>
		{:else if tab === 'compare'}
			<CompareTab
				input={sharedInput}
				onInputChange={setSharedInput}
				onStatsChange={handleStatsChange('compare')}
			/>
		{:else if tab === 'convert'}
			<ConvertTab
				input={sharedInput}
				onInputChange={setSharedInput}
				onStatsChange={handleStatsChange('convert')}
			/>
		{:else if tab === 'schema'}
			<SchemaTab
				input={sharedInput}
				onInputChange={setSharedInput}
				onStatsChange={handleStatsChange('schema')}
			/>
		{:else if tab === 'generate'}
			<GenerateTab
				input={sharedInput}
				onInputChange={setSharedInput}
				onStatsChange={handleStatsChange('generate')}
			/>
		{/if}
	{/snippet}
</ToolShell>
