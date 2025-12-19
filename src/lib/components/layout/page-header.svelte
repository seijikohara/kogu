<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { page } from '$app/state';
	import { ValidityBadge } from '$lib/components/status';
	import { getPageByUrl } from '$lib/services/pages.js';

	interface TabDefinition {
		readonly id: string;
		readonly label: string;
		readonly icon: Component;
	}

	interface Props {
		/** Override title (optional - defaults to page title from pages.ts) */
		title?: string;
		/** Tab definitions (optional) */
		tabs?: readonly TabDefinition[];
		/** Currently active tab */
		activeTab?: string;
		/** Tab change handler */
		ontabchange?: (tab: string) => void;
		/** Content to display in the status area (right side) */
		statusContent?: Snippet;
		/** Validation state for ValidityBadge */
		valid?: boolean | null;
		/** Error message to display */
		error?: string;
	}

	let {
		title: titleOverride,
		tabs,
		activeTab,
		ontabchange,
		statusContent,
		valid,
		error,
	}: Props = $props();

	// Get page definition from current URL
	const pageDefinition = $derived(getPageByUrl(page.url.pathname));

	// Use override or page title
	const title = $derived(titleOverride ?? pageDefinition?.title ?? 'Untitled');

	// Get icon from page definition
	const PageIcon = $derived(pageDefinition?.icon);

	// Has tabs
	const hasTabs = $derived(tabs && tabs.length > 0);

	// Has status content
	const hasStatus = $derived(statusContent || valid !== undefined || error);
</script>

<header class="flex h-10 shrink-0 items-center justify-between border-b px-4">
	<div class="flex items-center gap-4">
		<!-- Page title with icon -->
		<div class="flex items-center gap-2">
			{#if PageIcon}
				<PageIcon class="h-4 w-4 shrink-0 opacity-70" />
			{/if}
			<h1 class="text-sm font-semibold">{title}</h1>
		</div>

		<!-- Tabs (if provided) -->
		{#if hasTabs && tabs}
			<div class="flex items-center gap-1 rounded-md bg-muted/50 p-0.5">
				{#each tabs as tab (tab.id)}
					{@const TabIcon = tab.icon}
					<button
						class="flex items-center gap-1.5 rounded px-3 py-1 text-xs transition-colors {activeTab ===
						tab.id
							? 'bg-background shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
						onclick={() => ontabchange?.(tab.id)}
					>
						<TabIcon class="h-3.5 w-3.5" />
						{tab.label}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Status area (right side) -->
	{#if hasStatus}
		<div class="flex items-center gap-3 text-xs">
			{#if error}
				<span class="max-w-md truncate text-destructive" title={error}>{error}</span>
			{:else if statusContent}
				{@render statusContent()}
			{:else}
				<span class="text-muted-foreground/50">No input</span>
			{/if}
			{#if valid !== undefined}
				<ValidityBadge {valid} />
			{/if}
		</div>
	{/if}
</header>
