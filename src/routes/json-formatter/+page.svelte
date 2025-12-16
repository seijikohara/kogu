<script lang="ts">
	import { FormatterPage } from '$lib/components/tool/index.js';
	import {
		FormatTab,
		QueryTab,
		CompareTab,
		ConvertTab,
		SchemaTab,
		GenerateTab,
	} from './tabs/index.js';
	import {
		calculateJsonStats,
		JSON_FORMAT_INFO,
		type JsonStats,
		type JsonInputFormat,
	} from '$lib/services/formatters.js';
	import { Play, Search, GitCompare, ArrowRightLeft, FileCheck, Code2 } from '@lucide/svelte';

	// Valid tab types
	type TabType = 'format' | 'query' | 'compare' | 'convert' | 'schema' | 'generate';

	// Tab definitions
	const tabs = [
		{ value: 'format' as const, label: 'Format', icon: Play },
		{ value: 'query' as const, label: 'Query', icon: Search },
		{ value: 'compare' as const, label: 'Compare', icon: GitCompare },
		{ value: 'convert' as const, label: 'Convert', icon: ArrowRightLeft },
		{ value: 'schema' as const, label: 'Schema', icon: FileCheck },
		{ value: 'generate' as const, label: 'Generate', icon: Code2 },
	] as const;

	// Extended stats type for JSON formatter
	interface JsonTabStats {
		input: string;
		valid: boolean | null;
		error: string;
		format: JsonInputFormat | null;
	}

	// Stats handler wrapper that includes format info
	let currentFormat = $state<JsonInputFormat | null>(null);

	const handleStatsChange =
		(handler: (stats: { input: string; valid: boolean | null; error: string }) => void) =>
		(stats: JsonTabStats) => {
			currentFormat = stats.format;
			handler({ input: stats.input, valid: stats.valid, error: stats.error });
		};
</script>

<svelte:head>
	<title>JSON Formatter - Kogu</title>
</svelte:head>

<FormatterPage
	title="JSON Formatter"
	{tabs}
	defaultTab="format"
	defaultInput={'{}'}
	calculateStats={calculateJsonStats}
>
	{#snippet formatBadge()}
		{#if currentFormat && currentFormat !== 'json'}
			<span class="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary"
				>{JSON_FORMAT_INFO[currentFormat].label}</span
			>
		{/if}
	{/snippet}

	{#snippet statsSnippet(stats: JsonStats)}
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

	{#snippet tabContents(tab: TabType, sharedInput: string, setSharedInput: (value: string) => void, statsHandler: (stats: { input: string; valid: boolean | null; error: string }) => void)}
		{#if tab === 'format'}
			<FormatTab input={sharedInput} onInputChange={setSharedInput} onStatsChange={handleStatsChange(statsHandler)} />
		{:else if tab === 'query'}
			<QueryTab input={sharedInput} onInputChange={setSharedInput} onStatsChange={handleStatsChange(statsHandler)} />
		{:else if tab === 'compare'}
			<CompareTab input={sharedInput} onInputChange={setSharedInput} onStatsChange={handleStatsChange(statsHandler)} />
		{:else if tab === 'convert'}
			<ConvertTab input={sharedInput} onInputChange={setSharedInput} onStatsChange={handleStatsChange(statsHandler)} />
		{:else if tab === 'schema'}
			<SchemaTab input={sharedInput} onInputChange={setSharedInput} onStatsChange={handleStatsChange(statsHandler)} />
		{:else if tab === 'generate'}
			<GenerateTab input={sharedInput} onInputChange={setSharedInput} onStatsChange={handleStatsChange(statsHandler)} />
		{/if}
	{/snippet}
</FormatterPage>
