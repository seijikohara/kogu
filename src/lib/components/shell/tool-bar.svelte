<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { page } from '$app/state';
	import { getPageByUrl } from '$lib/services/pages.js';

	interface Props {
		readonly title?: string;
		readonly leading?: Snippet;
		readonly center?: Snippet;
		readonly trailing?: Snippet;
	}

	let { title: titleOverride, leading, center, trailing }: Props = $props();

	const pageDefinition = $derived(getPageByUrl(page.url.pathname));
	const title = $derived(titleOverride ?? pageDefinition?.title ?? 'Untitled');
	const PageIcon: Component | undefined = $derived(pageDefinition?.icon);
</script>

<header
	class="grid h-12 shrink-0 grid-cols-[auto_1fr_auto] items-center border-b bg-surface-1 px-4"
>
	<!-- Left: Always icon + title -->
	<div class="flex min-w-0 shrink-0 items-center gap-2">
		{#if PageIcon}
			<PageIcon class="h-4 w-4 shrink-0 opacity-80" />
		{/if}
		<h1 class="truncate text-sm font-bold tracking-tight">{title}</h1>
		{#if leading}
			{@render leading()}
		{/if}
	</div>

	<!-- Center: tabs or custom -->
	<div class="flex min-w-0 items-center justify-center">
		{#if center}
			{@render center()}
		{/if}
	</div>

	<!-- Right: trailing actions -->
	<div class="flex shrink-0 items-center justify-end gap-1">
		{#if trailing}
			{@render trailing()}
		{/if}
	</div>
</header>
