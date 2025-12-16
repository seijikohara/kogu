<script lang="ts" generics="T extends string, TStats">
	import type { Snippet, Component } from 'svelte';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import ValidityBadge from '$lib/components/feedback/validity-badge.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	interface TabDefinition {
		readonly value: T;
		readonly label: string;
		readonly icon: Component;
	}

	interface TabStats {
		input: string;
		valid: boolean | null;
		error: string;
	}

	interface Props {
		/** Page title */
		title: string;
		/** Tab definitions */
		tabs: readonly TabDefinition[];
		/** Default tab value */
		defaultTab: T;
		/** Default input value */
		defaultInput?: string;
		/** Function to calculate stats from input */
		calculateStats?: (input: string) => TStats | null;
		/** Snippet to render stats */
		statsSnippet?: Snippet<[TStats]>;
		/** Snippet to render format badge */
		formatBadge?: Snippet;
		/** Tab contents snippet - receives tab value, shared input, input setter, and stats handler */
		tabContents: Snippet<[T, string, (value: string) => void, (stats: TabStats) => void]>;
	}

	let {
		title,
		tabs,
		defaultTab,
		defaultInput = '',
		calculateStats,
		statsSnippet,
		formatBadge,
		tabContents,
	}: Props = $props();

	// Shared input across all tabs
	let sharedInput = $state(defaultInput);
	const setSharedInput = (value: string) => {
		sharedInput = value;
	};

	// Get initial tab from URL or default
	const getInitialTab = (): T => {
		const tabParam = page.url.searchParams.get('tab');
		if (tabParam && tabs.some((t) => t.value === tabParam)) {
			return tabParam as T;
		}
		return defaultTab;
	};

	// Active tab tracking
	let activeTab = $state<T>(getInitialTab());

	// Sync activeTab with URL when it changes
	const handleTabChange = (value: string | undefined): void => {
		if (!value) return;
		const newTab = value as T;
		activeTab = newTab;
		const url = new URL(page.url);
		if (newTab === defaultTab) {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', newTab);
		}
		goto(url.toString(), { replaceState: true, noScroll: true });
	};

	// React to URL changes (e.g., from search navigation)
	$effect(() => {
		const tabParam = page.url.searchParams.get('tab');
		if (tabParam && tabs.some((t) => t.value === tabParam)) {
			activeTab = tabParam as T;
		} else if (!tabParam) {
			activeTab = defaultTab;
		}
	});

	// Stats from each tab
	let tabStats = $state<Record<T, TabStats>>(
		Object.fromEntries(tabs.map((t) => [t.value, { input: '', valid: null, error: '' }])) as Record<
			T,
			TabStats
		>
	);

	// Current tab stats
	const currentStats = $derived(tabStats[activeTab]);

	// Live stats calculation (using shared input)
	const liveStats = $derived.by((): TStats | null => {
		const input = sharedInput.trim();
		if (!input || !calculateStats) return null;
		try {
			return calculateStats(input);
		} catch {
			return null;
		}
	});

	// Update stats handler factory
	const createStatsHandler = (tab: T) => (stats: TabStats) => {
		tabStats[tab] = stats;
	};
</script>

<Tabs.Root
	value={activeTab}
	onValueChange={handleTabChange}
	class="flex h-full flex-col overflow-hidden"
>
	<!-- Page header with tabs and stats -->
	<header class="flex h-10 shrink-0 items-center justify-between border-b px-4">
		<div class="flex items-center gap-4">
			<h1 class="text-sm font-semibold">{title}</h1>
			<Tabs.List class="h-8 rounded-md bg-muted p-1">
				{#each tabs as tab (tab.value)}
					<Tabs.Trigger
						value={tab.value}
						class="gap-1.5 rounded-sm px-3 text-xs hover:bg-foreground/5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
					>
						<tab.icon class="h-3.5 w-3.5" />{tab.label}
					</Tabs.Trigger>
				{/each}
			</Tabs.List>
		</div>

		<div class="flex items-center gap-3 text-xs">
			{#if currentStats.error}
				<span class="max-w-md truncate text-destructive" title={currentStats.error}
					>{currentStats.error}</span
				>
			{:else if liveStats && statsSnippet}
				{#if formatBadge}
					{@render formatBadge()}
				{/if}
				{@render statsSnippet(liveStats)}
			{:else}
				<span class="text-muted-foreground/50">No input</span>
			{/if}
			<ValidityBadge valid={currentStats.valid} />
		</div>
	</header>

	<!-- Tab contents - using CSS visibility to preserve state across tab switches -->
	{#each tabs as tab (tab.value)}
		<div
			class="flex-1 overflow-hidden {activeTab === tab.value ? 'flex' : 'hidden'}"
			role="tabpanel"
			aria-labelledby="tab-{tab.value}"
		>
			{@render tabContents(tab.value, sharedInput, setSharedInput, createStatsHandler(tab.value))}
		</div>
	{/each}
</Tabs.Root>
