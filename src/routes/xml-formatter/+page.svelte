<script lang="ts">
	import { TabbedFormatterPage } from '$lib/components/template';
	import { StatItem } from '$lib/components/status';
	import { calculateXmlStats, type XmlStats } from '$lib/services/formatters';
	import type { TabStats } from '$lib/hooks';
	import {
		CompareTab,
		ConvertTab,
		FormatTab,
		GenerateTab,
		QueryTab,
		SchemaTab,
	} from './tabs/index.js';
</script>

<TabbedFormatterPage title="XML Formatter" calculateStats={calculateXmlStats}>
	{#snippet renderStatusContent(stats: unknown)}
		{@const liveStats = stats as XmlStats | null}
		{#if liveStats}
			<StatItem label="Elements" value={liveStats.elements} />
			<StatItem label="Attributes" value={liveStats.attributes} />
			<StatItem label="Depth" value={liveStats.depth} />
			<StatItem label="Size" value={liveStats.size} />
		{/if}
	{/snippet}

	{#snippet renderTabContent({
		tab,
		input,
		onInputChange,
		onStatsChange,
	}: {
		tab: string;
		input: string;
		onInputChange: (v: string) => void;
		onStatsChange: (s: TabStats) => void;
	})}
		{#if tab === 'format'}
			<FormatTab {input} {onInputChange} {onStatsChange} />
		{:else if tab === 'query'}
			<QueryTab {input} {onInputChange} {onStatsChange} />
		{:else if tab === 'compare'}
			<CompareTab {input} {onInputChange} {onStatsChange} />
		{:else if tab === 'convert'}
			<ConvertTab {input} {onInputChange} {onStatsChange} />
		{:else if tab === 'schema'}
			<SchemaTab {input} {onInputChange} {onStatsChange} />
		{:else if tab === 'generate'}
			<GenerateTab {input} {onInputChange} {onStatsChange} />
		{/if}
	{/snippet}
</TabbedFormatterPage>
