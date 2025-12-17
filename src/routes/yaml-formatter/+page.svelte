<script lang="ts">
	
	import { ArrowRightLeft, Code2, FileCheck, GitCompare, Play, Search } from '@lucide/svelte';
import { FormatterPage } from '$lib/components/tool/index.js';
	import { calculateYamlStats, type YamlStats } from '$lib/services/formatters.js';
	import {
		CompareTab,
		ConvertTab,
		FormatTab,
		GenerateTab,
		QueryTab,
		SchemaTab,
	} from './tabs/index.js';

	type TabType = 'format' | 'query' | 'compare' | 'convert' | 'schema' | 'generate';

	const tabs = [
		{ value: 'format' as const, label: 'Format', icon: Play },
		{ value: 'query' as const, label: 'Query', icon: Search },
		{ value: 'compare' as const, label: 'Compare', icon: GitCompare },
		{ value: 'convert' as const, label: 'Convert', icon: ArrowRightLeft },
		{ value: 'schema' as const, label: 'Schema', icon: FileCheck },
		{ value: 'generate' as const, label: 'Generate', icon: Code2 },
	] as const;
</script>

<svelte:head>
	<title>YAML Formatter - Kogu</title>
</svelte:head>

<FormatterPage
	title="YAML Formatter"
	{tabs}
	defaultTab="format"
	defaultInput=""
	calculateStats={(input: string) => calculateYamlStats(input) as YamlStats | null}
>
	{#snippet statsSnippet(stats: YamlStats)}
		<span class="text-muted-foreground"
			>Keys: <strong class="text-foreground">{stats.keys}</strong></span
		>
		<span class="text-muted-foreground"
			>Values: <strong class="text-foreground">{stats.values}</strong></span
		>
		<span class="text-muted-foreground"
			>Depth: <strong class="text-foreground">{stats.depth}</strong></span
		>
		<span class="text-muted-foreground"
			>Size: <strong class="text-foreground">{stats.size}</strong></span
		>
	{/snippet}

	{#snippet tabContents(tab: TabType, sharedInput: string, setSharedInput: (value: string) => void, onStatsChange: (stats: { input: string; valid: boolean | null; error: string }) => void)}
		{#if tab === 'format'}
			<FormatTab input={sharedInput} onInputChange={setSharedInput} {onStatsChange} />
		{:else if tab === 'query'}
			<QueryTab input={sharedInput} onInputChange={setSharedInput} {onStatsChange} />
		{:else if tab === 'compare'}
			<CompareTab input={sharedInput} onInputChange={setSharedInput} {onStatsChange} />
		{:else if tab === 'convert'}
			<ConvertTab input={sharedInput} onInputChange={setSharedInput} {onStatsChange} />
		{:else if tab === 'schema'}
			<SchemaTab input={sharedInput} onInputChange={setSharedInput} {onStatsChange} />
		{:else if tab === 'generate'}
			<GenerateTab input={sharedInput} onInputChange={setSharedInput} {onStatsChange} />
		{/if}
	{/snippet}
</FormatterPage>
