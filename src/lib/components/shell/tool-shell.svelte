<script lang="ts">
	import type { Snippet } from 'svelte';
	import ToolBar from './tool-bar.svelte';
	import OptionsRail from './options-rail.svelte';
	import StatusBar from './status-bar.svelte';
	import TabPanels from '$lib/components/layout/tab-panels.svelte';

	interface TabDefinition {
		readonly id: string;
		readonly label: string;
		readonly icon: import('svelte').Component;
	}

	interface Props {
		readonly layout?: 'tabbed' | 'transform' | 'master-detail';

		// Toolbar
		readonly title?: string;
		readonly toolbarLeading?: Snippet;
		readonly toolbarCenter?: Snippet;
		readonly toolbarTrailing?: Snippet;

		// Tabs (integrated toolbar tabs)
		readonly tabs?: readonly TabDefinition[];
		readonly activeTab?: string;
		readonly ontabchange?: (tab: string) => void;
		readonly preserveTabState?: boolean;
		readonly tabContent?: Snippet<[string]>;

		// Options rail
		showRail?: boolean;
		readonly railTitle?: string;
		readonly rail?: Snippet;

		// Status bar
		readonly valid?: boolean | null;
		readonly error?: string;
		readonly statusContent?: Snippet;

		// Main content
		readonly children?: Snippet;
	}

	let {
		layout = 'transform',
		title,
		toolbarLeading,
		toolbarCenter,
		toolbarTrailing,
		tabs,
		activeTab,
		ontabchange,
		preserveTabState = false,
		tabContent,
		showRail = $bindable(true),
		railTitle = 'Options',
		rail,
		valid,
		error,
		statusContent,
		children,
	}: Props = $props();

	const hasTabs = $derived(tabs && tabs.length > 0);
	const tabIds = $derived(tabs?.map((t) => t.id) ?? []);

	// Determine rail state for CSS grid
	const railState = $derived.by(() => {
		if (!rail) return 'none';
		return showRail ? 'open' : 'closed';
	});
</script>

<div class="tool-shell" data-layout={layout} data-rail={railState}>
	<!-- Toolbar -->
	<div class="tool-toolbar">
		<ToolBar {title}>
			{#snippet leading()}
				{#if toolbarLeading}
					{@render toolbarLeading()}
				{/if}
			{/snippet}

			{#snippet center()}
				{#if toolbarCenter}
					{@render toolbarCenter()}
				{:else if hasTabs && tabs}
					<div class="flex items-center gap-0.5 rounded-lg bg-surface-3/70 p-0.5" role="tablist">
						{#each tabs as tab (tab.id)}
							{@const TabIcon = tab.icon}
							<button
								role="tab"
								aria-selected={activeTab === tab.id}
								class="relative flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring/50 {activeTab ===
								tab.id
									? 'bg-background text-foreground shadow-sm ring-1 ring-border/50 after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-accent-brand'
									: 'text-muted-foreground opacity-70 hover:bg-surface-3/40 hover:text-foreground hover:opacity-100'}"
								onclick={() => ontabchange?.(tab.id)}
							>
								<TabIcon class="h-3.5 w-3.5" />
								{tab.label}
							</button>
						{/each}
					</div>
				{/if}
			{/snippet}

			{#snippet trailing()}
				{#if toolbarTrailing}
					{@render toolbarTrailing()}
				{/if}
			{/snippet}
		</ToolBar>
	</div>

	<!-- Options Rail -->
	{#if rail}
		<div class="tool-rail">
			<OptionsRail
				bind:show={showRail}
				title={railTitle}
				onclose={() => (showRail = false)}
				onopen={() => (showRail = true)}
			>
				{@render rail()}
			</OptionsRail>
		</div>
	{/if}

	<!-- Main Content -->
	<div class="tool-content animate-fade-in">
		{#if preserveTabState && tabContent && tabs && activeTab}
			<TabPanels tabs={tabIds} {activeTab}>
				{#snippet children(tab)}
					{@render tabContent(tab)}
				{/snippet}
			</TabPanels>
		{:else if children}
			{@render children()}
		{/if}
	</div>

	<!-- Status Bar -->
	<div class="tool-status">
		<StatusBar {valid} {error}>
			{#if statusContent}
				{@render statusContent()}
			{/if}
		</StatusBar>
	</div>
</div>

<style>
	.tool-shell {
		display: grid;
		height: 100%;
		overflow: hidden;
		grid-template-rows: var(--toolbar-h) 1fr var(--status-h);
	}

	/* Rail open */
	.tool-shell[data-rail='open'] {
		grid-template-columns: var(--rail-w) 1fr;
		grid-template-areas:
			'toolbar toolbar'
			'rail content'
			'status status';
	}

	/* Rail collapsed */
	.tool-shell[data-rail='closed'] {
		grid-template-columns: var(--rail-w-collapsed) 1fr;
		grid-template-areas:
			'toolbar toolbar'
			'rail content'
			'status status';
	}

	/* No rail */
	.tool-shell[data-rail='none'] {
		grid-template-columns: 1fr;
		grid-template-areas:
			'toolbar'
			'content'
			'status';
	}

	.tool-toolbar {
		grid-area: toolbar;
	}

	.tool-rail {
		grid-area: rail;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.tool-content {
		grid-area: content;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.tool-status {
		grid-area: status;
	}
</style>
