<script lang="ts" generics="T extends string, TStats">
	import type { Snippet, Component } from 'svelte';
	import { PageHeader } from '$lib/components/layout/index.js';
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

	// Shared input across all tabs - initialize from props
	let sharedInput = $state('');

	// Initialize sharedInput on mount
	$effect(() => {
		if (sharedInput === '' && defaultInput) {
			sharedInput = defaultInput;
		}
	});

	const setSharedInput = (value: string) => {
		sharedInput = value;
	};

	// Active tab tracking
	let activeTab = $state<T | null>(null);

	// Get effective active tab (use defaultTab if not set)
	const effectiveActiveTab = $derived(activeTab ?? defaultTab);

	// Sync tab with URL
	$effect(() => {
		const tabParam = page.url.searchParams.get('tab');
		if (tabParam && tabs.some((t) => t.value === tabParam)) {
			activeTab = tabParam as T;
		} else if (!tabParam && activeTab !== null) {
			activeTab = null; // Reset to use defaultTab
		}
	});

	// Convert tabs to PageHeader format (value -> id)
	const pageHeaderTabs = $derived(tabs.map((t) => ({ id: t.value, label: t.label, icon: t.icon })));

	// Sync activeTab with URL when it changes
	const handleTabChange = (value: string): void => {
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

	// Stats from each tab - use derived to initialize based on tabs prop
	const initialTabStats = $derived(
		Object.fromEntries(tabs.map((t) => [t.value, { input: '', valid: null, error: '' }])) as Record<
			T,
			TabStats
		>
	);
	let tabStats = $state<Record<T, TabStats>>({} as Record<T, TabStats>);

	// Initialize tabStats when tabs change
	$effect(() => {
		const currentKeys = Object.keys(tabStats);
		const newKeys = tabs.map((t) => t.value);
		if (currentKeys.length === 0 || !newKeys.every((k) => currentKeys.includes(k))) {
			tabStats = { ...initialTabStats };
		}
	});

	// Current tab stats
	const currentStats = $derived(
		tabStats[effectiveActiveTab] ?? { input: '', valid: null, error: '' }
	);

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

<div class="flex h-full flex-col overflow-hidden">
	<!-- Page header with tabs and stats -->
	<PageHeader
		{title}
		tabs={pageHeaderTabs}
		activeTab={effectiveActiveTab}
		ontabchange={handleTabChange}
		valid={currentStats.valid}
		error={currentStats.error}
	>
		{#snippet statusContent()}
			{#if liveStats && statsSnippet}
				{#if formatBadge}
					{@render formatBadge()}
				{/if}
				{@render statsSnippet(liveStats)}
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Tab contents - using CSS visibility to preserve state across tab switches -->
	{#each tabs as tab (tab.value)}
		<div
			class="flex-1 overflow-hidden {effectiveActiveTab === tab.value ? 'flex' : 'hidden'}"
			role="tabpanel"
			aria-labelledby="tab-{tab.value}"
		>
			{@render tabContents(tab.value, sharedInput, setSharedInput, createStatsHandler(tab.value))}
		</div>
	{/each}
</div>
