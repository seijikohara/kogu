<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { OptionsPanel } from '$lib/components/panel';
	import PageHeader from './page-header.svelte';
	import TabPanels from './tab-panels.svelte';

	interface TabDefinition {
		readonly id: string;
		readonly label: string;
		readonly icon: Component;
	}

	interface Props {
		// PageHeader props
		readonly title?: string;
		readonly tabs?: readonly TabDefinition[];
		readonly activeTab?: string;
		readonly ontabchange?: (tab: string) => void;
		readonly valid?: boolean | null;
		readonly error?: string;
		readonly statusContent?: Snippet;

		// Tab state preservation
		/** When true, all tabs are rendered but hidden (preserves state across tab switches) */
		readonly preserveTabState?: boolean;
		/** Tab content renderer - used with preserveTabState. Receives tab id. */
		readonly tabContent?: Snippet<[string]>;

		// OptionsPanel props
		showOptions?: boolean;
		readonly optionsTitle?: string;
		readonly optionsWidth?: string;
		readonly options?: Snippet;

		// Main content (used when preserveTabState is false)
		readonly children?: Snippet;
	}

	let {
		// PageHeader props
		title,
		tabs,
		activeTab,
		ontabchange,
		valid,
		error,
		statusContent,

		// Tab state preservation
		preserveTabState = false,
		tabContent,

		// OptionsPanel props
		showOptions = $bindable(true),
		optionsTitle = 'Options',
		optionsWidth = 'w-60',
		options,

		// Main content
		children,
	}: Props = $props();

	// Extract tab IDs for TabPanels
	const tabIds = $derived(tabs?.map((t) => t.id) ?? []);
</script>

<div class="flex h-full flex-col overflow-hidden">
	<PageHeader {title} {tabs} {activeTab} {ontabchange} {valid} {error}>
		{#snippet statusContent()}
			{#if statusContent}
				{@render statusContent()}
			{/if}
		{/snippet}
	</PageHeader>

	<div class="flex flex-1 overflow-hidden">
		{#if options}
			<OptionsPanel
				title={optionsTitle}
				width={optionsWidth}
				show={showOptions}
				onclose={() => (showOptions = false)}
				onopen={() => (showOptions = true)}
			>
				{@render options()}
			</OptionsPanel>
		{/if}

		<div class="flex flex-1 flex-col overflow-hidden">
			{#if preserveTabState && tabContent && tabs && activeTab}
				<!-- CSS hidden/visible for state preservation -->
				<TabPanels tabs={tabIds} {activeTab}>
					{#snippet children(tab)}
						{@render tabContent(tab)}
					{/snippet}
				</TabPanels>
			{:else if children}
				<!-- Standard rendering -->
				{@render children()}
			{/if}
		</div>
	</div>
</div>
