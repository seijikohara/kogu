<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import ToolBar from './tool-bar.svelte';
	import OptionsRail from './options-rail.svelte';
	import StatusBar from './status-bar.svelte';
	import { isModKey } from '$lib/utils/keyboard.js';

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

		// Tabs (integrated toolbar tabs). All tab panels remain mounted thanks to
		// the bits-ui Tabs.Content default behavior (inactive panels are hidden via
		// the `hidden` attribute, not unmounted), so component state is preserved
		// across tab switches without an explicit opt-in.
		readonly tabs?: readonly TabDefinition[];
		readonly activeTab?: string;
		readonly ontabchange?: (tab: string) => void;
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
		tabContent,
		showRail = $bindable(true),
		railTitle = 'Options',
		rail,
		valid,
		error,
		statusContent,
		children,
	}: Props = $props();

	const hasTabs = $derived(!!tabs && tabs.length > 0);

	const railState = $derived.by(() => {
		if (!rail) return 'none';
		return showRail ? 'open' : 'closed';
	});

	const handleShellKeydown = (e: KeyboardEvent) => {
		if (!isModKey(e)) return;

		// Cmd+, → toggle options rail
		if (e.key === ',' && rail) {
			e.preventDefault();
			showRail = !showRail;
			return;
		}

		// Cmd+1-9 → switch tabs
		if (e.key >= '1' && e.key <= '9' && tabs && tabs.length > 0) {
			const idx = Number.parseInt(e.key, 10) - 1;
			const tab = tabs[idx];
			if (tab) {
				e.preventDefault();
				ontabchange?.(tab.id);
			}
		}
	};

	const handleValueChange = (value: string) => {
		ontabchange?.(value);
	};
</script>

<svelte:window onkeydown={handleShellKeydown} />

{#snippet shell()}
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
						<Tabs.List
							class="bg-surface-2 inline-flex h-auto items-center gap-0.5 rounded-lg p-1 shadow-inner"
						>
							{#each tabs as tab (tab.id)}
								{@const TabIcon = tab.icon}
								<Tabs.Trigger
									value={tab.id}
									class="data-[state=active]:bg-surface-0 data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:bg-interactive-hover hover:text-foreground inline-flex flex-none items-center gap-1.5 rounded-md border-0 px-3.5 py-2 text-sm font-medium transition-all duration-150"
								>
									<TabIcon class="h-4 w-4" />
									{tab.label}
								</Tabs.Trigger>
							{/each}
						</Tabs.List>
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
			{#if hasTabs && tabContent && tabs && activeTab}
				{#each tabs as tab (tab.id)}
					<Tabs.Content
						value={tab.id}
						class="flex h-full min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
					>
						{@render tabContent(tab.id)}
					</Tabs.Content>
				{/each}
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
{/snippet}

{#if hasTabs && tabs && activeTab}
	<Tabs.Root value={activeTab} onValueChange={handleValueChange} class="contents">
		{@render shell()}
	</Tabs.Root>
{:else}
	{@render shell()}
{/if}

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
