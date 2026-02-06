<script lang="ts">
	import { ArrowRightLeft, Code2, FileCheck, GitCompare, Play, Search } from '@lucide/svelte';
	import { ToolShell } from '$lib/components/shell';
	import {
		useFormatterPage,
		type FormatterTabType,
		type TabStats,
	} from '$lib/hooks/use-formatter-page.svelte.js';
	import type { Snippet } from 'svelte';

	/**
	 * Tab definition for formatter pages.
	 */
	interface TabDefinition {
		readonly id: FormatterTabType;
		readonly label: string;
		readonly icon: typeof Play;
	}

	/**
	 * Standard tab definitions for all formatter pages.
	 */
	const TABS: readonly TabDefinition[] = [
		{ id: 'format', label: 'Format', icon: Play },
		{ id: 'query', label: 'Query', icon: Search },
		{ id: 'compare', label: 'Compare', icon: GitCompare },
		{ id: 'convert', label: 'Convert', icon: ArrowRightLeft },
		{ id: 'schema', label: 'Schema', icon: FileCheck },
		{ id: 'generate', label: 'Generate', icon: Code2 },
	] as const;

	/**
	 * Tab content props passed to the renderTabContent snippet.
	 */
	export interface TabContentProps {
		readonly tab: FormatterTabType;
		readonly input: string;
		readonly onInputChange: (value: string) => void;
		readonly onStatsChange: (stats: TabStats) => void;
	}

	interface Props<TStats> {
		/** Page title */
		readonly title: string;
		/** Function to calculate stats from input */
		readonly calculateStats: (input: string) => TStats | null;
		/** Status bar content snippet - receives liveStats */
		readonly renderStatusContent?: Snippet<[TStats | null]>;
		/** Tab content snippet - receives tab props */
		readonly renderTabContent: Snippet<[TabContentProps]>;
	}

	let { title, calculateStats, renderStatusContent, renderTabContent }: Props<unknown> = $props();

	// Wrap calculateStats to avoid state_referenced_locally warning
	const statsCalculator = (input: string) => calculateStats(input);
	const page = useFormatterPage({ calculateStats: statsCalculator });

	// Type-safe tab change handler for ToolShell
	const handleTabChange = (tab: string) => {
		page.tabSync.setActiveTab(tab as FormatterTabType);
	};
</script>

<svelte:head>
	<title>{title} - Kogu</title>
</svelte:head>

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
		{#if renderStatusContent}
			{@render renderStatusContent(page.liveStats)}
		{/if}
	{/snippet}

	{#snippet tabContent(tab)}
		{@render renderTabContent({
			tab: tab as FormatterTabType,
			input: page.sharedInput,
			onInputChange: page.setSharedInput,
			onStatsChange: page.handleStatsChange(tab as FormatterTabType),
		})}
	{/snippet}
</ToolShell>
