<script lang="ts">
	import { ArrowRightLeft, Code2, FileCheck, GitCompare, Play, Search } from '@lucide/svelte';
	import { FormSection, FormSelect } from '$lib/components/form';
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
	import { useFormatterPage, type FormatterTabType } from '$lib/hooks/use-formatter-page.svelte.js';
	import {
		calculateJsonStats,
		JSON_FORMAT_INFO,
		JSON_FORMAT_OPTIONS,
		type JsonInputFormat,
		type JsonOutputFormat,
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

	// Tab definitions with icons
	const TABS = [
		{ id: 'format' as const, label: 'Format', icon: Play },
		{ id: 'query' as const, label: 'Query', icon: Search },
		{ id: 'compare' as const, label: 'Compare', icon: GitCompare },
		{ id: 'convert' as const, label: 'Convert', icon: ArrowRightLeft },
		{ id: 'schema' as const, label: 'Schema', icon: FileCheck },
		{ id: 'generate' as const, label: 'Generate', icon: Code2 },
	] as const;

	// JSON-specific format state
	let inputFormat = $state<JsonInputFormat>('json');
	let outputFormat = $state<JsonOutputFormat>('json');

	// Use formatter page hook with JSON-specific stats calculation
	const page = useFormatterPage<JsonStats>({
		calculateStats: (input) => calculateJsonStats(input, inputFormat),
	});

	// Type-safe tab change handler
	const handleTabChange = (tab: string) => {
		page.tabSync.setActiveTab(tab as FormatterTabType);
	};
</script>

<svelte:head>
	<title>JSON Formatter - Kogu</title>
</svelte:head>

{#snippet formatSection(showOutput?: boolean)}
	<FormSection title="Format">
		<FormSelect label="Input" bind:value={inputFormat} options={JSON_FORMAT_OPTIONS} />
		{#if showOutput}
			<FormSelect label="Output" bind:value={outputFormat} options={JSON_FORMAT_OPTIONS} />
		{/if}
	</FormSection>
{/snippet}

<ToolShell
	layout="tabbed"
	tabs={TABS}
	activeTab={page.tabSync.activeTab}
	ontabchange={handleTabChange}
	valid={page.currentStats.valid}
	error={page.currentStats.error}
	preserveTabState
>
	{#snippet statusContent()}
		{#if page.liveStats}
			<span class="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
				{JSON_FORMAT_INFO[inputFormat].label} → {JSON_FORMAT_INFO[outputFormat].label}
			</span>
			<StatItem label="Keys" value={page.liveStats.keys} />
			<StatItem label="Values" value={page.liveStats.values} />
			<StatItem label="Depth" value={page.liveStats.depth} />
			<StatItem label="Size" value={page.liveStats.size} />
		{/if}
	{/snippet}

	{#snippet tabContent(tab)}
		{#if tab === 'format'}
			<FormatTab
				{formatSection}
				{inputFormat}
				{outputFormat}
				input={page.sharedInput}
				onInputChange={page.setSharedInput}
				onStatsChange={page.handleStatsChange('format')}
			/>
		{:else if tab === 'query'}
			<QueryTab
				{formatSection}
				{inputFormat}
				input={page.sharedInput}
				onInputChange={page.setSharedInput}
				onStatsChange={page.handleStatsChange('query')}
			/>
		{:else if tab === 'compare'}
			<CompareTab
				{formatSection}
				{inputFormat}
				input={page.sharedInput}
				onInputChange={page.setSharedInput}
				onStatsChange={page.handleStatsChange('compare')}
			/>
		{:else if tab === 'convert'}
			<ConvertTab
				{formatSection}
				{inputFormat}
				input={page.sharedInput}
				onInputChange={page.setSharedInput}
				onStatsChange={page.handleStatsChange('convert')}
			/>
		{:else if tab === 'schema'}
			<SchemaTab
				{formatSection}
				{inputFormat}
				input={page.sharedInput}
				onInputChange={page.setSharedInput}
				onStatsChange={page.handleStatsChange('schema')}
			/>
		{:else if tab === 'generate'}
			<GenerateTab
				{formatSection}
				{inputFormat}
				input={page.sharedInput}
				onInputChange={page.setSharedInput}
				onStatsChange={page.handleStatsChange('generate')}
			/>
		{/if}
	{/snippet}
</ToolShell>
