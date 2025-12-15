<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import ValidityBadge from '$lib/components/feedback/validity-badge.svelte';
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

	// Active tab tracking
	type TabType = 'format' | 'query' | 'compare' | 'convert' | 'schema' | 'generate';
	let activeTab = $state<TabType>('format');

	// Stats from each tab
	let tabStats = $state<
		Record<
			TabType,
			{ input: string; valid: boolean | null; error: string; format: JsonInputFormat | null }
		>
	>({
		format: { input: '', valid: null, error: '', format: null },
		query: { input: '', valid: null, error: '', format: null },
		compare: { input: '', valid: null, error: '', format: null },
		convert: { input: '', valid: null, error: '', format: null },
		schema: { input: '', valid: null, error: '', format: null },
		generate: { input: '', valid: null, error: '', format: null },
	});

	// Current tab stats
	const currentStats = $derived(tabStats[activeTab]);

	// Live stats calculation
	const liveStats = $derived.by((): JsonStats | null => {
		const input = currentStats.input.trim();
		if (!input) return null;
		try {
			return calculateJsonStats(input);
		} catch {
			return null;
		}
	});

	// Update stats handler
	const createStatsHandler =
		(tab: TabType) =>
		(stats: {
			input: string;
			valid: boolean | null;
			error: string;
			format: JsonInputFormat | null;
		}) => {
			tabStats[tab] = stats;
		};
</script>

<svelte:head>
	<title>JSON Formatter - Kogu</title>
</svelte:head>

<Tabs.Root
	value="format"
	onValueChange={(v) => (activeTab = v as TabType)}
	class="flex h-full flex-col overflow-hidden"
>
	<!-- Header with integrated tabs -->
	<header class="flex h-12 shrink-0 items-center justify-between border-b px-4">
		<div class="flex items-center gap-4">
			<Sidebar.Trigger class="-ml-1" />
			<Separator orientation="vertical" class="h-6" />
			<h1 class="text-sm font-semibold">JSON Formatter</h1>
			<Tabs.List class="h-8 rounded-md bg-muted p-1">
				<Tabs.Trigger
					value="format"
					class="gap-1.5 rounded-sm px-3 text-xs hover:bg-foreground/5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
				>
					<Play class="h-3.5 w-3.5" />Format
				</Tabs.Trigger>
				<Tabs.Trigger
					value="query"
					class="gap-1.5 rounded-sm px-3 text-xs hover:bg-foreground/5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
				>
					<Search class="h-3.5 w-3.5" />Query
				</Tabs.Trigger>
				<Tabs.Trigger
					value="compare"
					class="gap-1.5 rounded-sm px-3 text-xs hover:bg-foreground/5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
				>
					<GitCompare class="h-3.5 w-3.5" />Compare
				</Tabs.Trigger>
				<Tabs.Trigger
					value="convert"
					class="gap-1.5 rounded-sm px-3 text-xs hover:bg-foreground/5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
				>
					<ArrowRightLeft class="h-3.5 w-3.5" />Convert
				</Tabs.Trigger>
				<Tabs.Trigger
					value="schema"
					class="gap-1.5 rounded-sm px-3 text-xs hover:bg-foreground/5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
				>
					<FileCheck class="h-3.5 w-3.5" />Schema
				</Tabs.Trigger>
				<Tabs.Trigger
					value="generate"
					class="gap-1.5 rounded-sm px-3 text-xs hover:bg-foreground/5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
				>
					<Code2 class="h-3.5 w-3.5" />Generate
				</Tabs.Trigger>
			</Tabs.List>
		</div>
		<div class="flex items-center gap-3 text-xs">
			{#if currentStats.error}
				<span class="max-w-md truncate text-destructive" title={currentStats.error}
					>{currentStats.error}</span
				>
			{:else if liveStats}
				{#if currentStats.format && currentStats.format !== 'json'}
					<span class="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary"
						>{JSON_FORMAT_INFO[currentStats.format].label}</span
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
			{:else}
				<span class="text-muted-foreground/50">No input</span>
			{/if}
			<ValidityBadge valid={currentStats.valid} />
		</div>
	</header>

	<!-- Format Tab -->
	<Tabs.Content value="format" class="flex-1 overflow-hidden p-0 data-[state=active]:flex">
		<FormatTab onStatsChange={createStatsHandler('format')} />
	</Tabs.Content>

	<!-- Query Tab -->
	<Tabs.Content value="query" class="flex-1 overflow-hidden p-0 data-[state=active]:flex">
		<QueryTab onStatsChange={createStatsHandler('query')} />
	</Tabs.Content>

	<!-- Compare Tab -->
	<Tabs.Content value="compare" class="flex-1 overflow-hidden p-0 data-[state=active]:flex">
		<CompareTab onStatsChange={createStatsHandler('compare')} />
	</Tabs.Content>

	<!-- Convert Tab -->
	<Tabs.Content value="convert" class="flex-1 overflow-hidden p-0 data-[state=active]:flex">
		<ConvertTab onStatsChange={createStatsHandler('convert')} />
	</Tabs.Content>

	<!-- Schema Tab -->
	<Tabs.Content value="schema" class="flex-1 overflow-hidden p-0 data-[state=active]:flex">
		<SchemaTab onStatsChange={createStatsHandler('schema')} />
	</Tabs.Content>

	<!-- Generate Tab -->
	<Tabs.Content value="generate" class="flex-1 overflow-hidden p-0 data-[state=active]:flex">
		<GenerateTab onStatsChange={createStatsHandler('generate')} />
	</Tabs.Content>
</Tabs.Root>
