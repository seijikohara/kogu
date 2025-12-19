<script lang="ts">
	import { ArrowRightLeft, CodeXml, FileCheck, GitCompare, Play, Search } from '@lucide/svelte';
	import { PageLayout } from '$lib/components/layout';
	import { useTabSync } from '$lib/utils';
	import {
		calculateJsonStats,
		JSON_FORMAT_INFO,
		type JsonInputFormat,
		type JsonStats,
	} from '$lib/services/formatters';
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
		{ id: 'generate' as const, label: 'Generate', icon: CodeXml },
	] as const;

	const tabIds = tabs.map((t) => t.id);

	// Tab sync with URL
	const { activeTab, setActiveTab } = useTabSync({
		tabs: tabIds,
		defaultTab: 'format',
	});

	// Type-safe tab change handler for PageLayout
	const handleTabChange = (tab: string) => setActiveTab(tab as TabType);

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
	const currentStats = $derived(tabStats[activeTab as TabType]);

	// Extended stats type for JSON formatter
	interface JsonTabStats extends TabStats {
		format: JsonInputFormat | null;
	}

	// Format info for display
	let currentFormat = $state<JsonInputFormat | null>(null);

	// Stats handler wrapper that includes format info
	const handleStatsChange =
		(tab: TabType) =>
		(stats: JsonTabStats): void => {
			currentFormat = stats.format;
			tabStats[tab] = { input: stats.input, valid: stats.valid, error: stats.error };
		};

	// Live stats calculation
	const liveStats = $derived.by((): JsonStats | null => {
		const input = sharedInput.trim();
		if (!input) return null;
		try {
			return calculateJsonStats(input);
		} catch {
			return null;
		}
	});
</script>

<svelte:head>
	<title>JSON Formatter - Kogu</title>
</svelte:head>

<PageLayout
	title="JSON Formatter"
	{tabs}
	{activeTab}
	ontabchange={handleTabChange}
	valid={currentStats.valid}
	error={currentStats.error}
	preserveTabState
>
	{#snippet statusContent()}
		{#if liveStats}
			{#if currentFormat && currentFormat !== 'json'}
				<span class="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary"
					>{JSON_FORMAT_INFO[currentFormat].label}</span
				>
			{/if}
			<span class="text-muted-foreground"
				>Keys: <strong class="text-foreground">{liveStats.keys}</strong></span
			>
			<span class="text-muted-foreground"
				>Values: <strong class="text-foreground">{liveStats.values}</strong></span
			>
			<span class="text-muted-foreground"
				>Depth: <strong class="text-foreground">{liveStats.depth}</strong></span
			>
			<span class="text-muted-foreground"
				>Size: <strong class="text-foreground">{liveStats.size}</strong></span
			>
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
</PageLayout>
