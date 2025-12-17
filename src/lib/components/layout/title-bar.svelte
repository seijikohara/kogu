<script lang="ts">
	import { Search } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { Input } from '$lib/components/ui/input/index.js';
	import { initNavigationHistory } from '$lib/services/navigation-history.svelte.js';
	import { type SearchResult, searchPages } from '$lib/services/pages.js';
	import NavButtons from './nav-buttons.svelte';

	let searchQuery = $state('');
	let isSearchOpen = $state(false);
	let selectedIndex = $state(0);
	let inputElement = $state<HTMLInputElement | null>(null);

	// Initialize navigation history tracking
	initNavigationHistory();

	const searchResults = $derived<readonly SearchResult[]>(searchPages(searchQuery));

	const handleKeydown = (e: KeyboardEvent): void => {
		if (!isSearchOpen) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
		} else if (e.key === 'Enter') {
			const selectedResult = searchResults[selectedIndex];
			if (selectedResult) {
				e.preventDefault();
				navigateToResult(selectedResult);
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			closeSearch();
		}
	};

	const navigateToResult = (result: SearchResult): void => {
		goto(result.url);
		closeSearch();
	};

	const closeSearch = (): void => {
		isSearchOpen = false;
		searchQuery = '';
		selectedIndex = 0;
		inputElement?.blur();
	};

	const openSearch = (): void => {
		isSearchOpen = true;
		selectedIndex = 0;
	};

	// Reset selection when filtered results change
	$effect(() => {
		if (searchResults.length > 0 && selectedIndex >= searchResults.length) {
			selectedIndex = 0;
		}
	});
</script>

<header
	data-tauri-drag-region
	class="flex h-8 shrink-0 items-center justify-center gap-2 border-b bg-background px-4"
>
	<!-- Navigation buttons and Search box - centered together -->
	<NavButtons />
	<div class="relative w-full max-w-md">
		<div class="relative">
			<Search
				class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				bind:ref={inputElement}
				type="text"
				placeholder="Search pages and tabs..."
				class="h-6 pl-8 pr-3 text-xs"
				bind:value={searchQuery}
				onfocus={openSearch}
				onblur={() => setTimeout(closeSearch, 150)}
				onkeydown={handleKeydown}
			/>
		</div>

		<!-- Search results dropdown -->
		{#if isSearchOpen}
			<div
				role="listbox"
				aria-label="Search results"
				class="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
			>
				{#if searchResults.length === 0}
					<div class="px-3 py-2 text-sm text-muted-foreground">No results found</div>
				{:else}
					{#each searchResults as result, index}
						<button
							type="button"
							role="option"
							aria-selected={index === selectedIndex}
							class="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent {index ===
							selectedIndex
								? 'bg-accent'
								: ''}"
							onmousedown={() => navigateToResult(result)}
							onmouseenter={() => (selectedIndex = index)}
						>
							<result.icon class="h-4 w-4 shrink-0 text-muted-foreground" />
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="truncate font-medium">{result.title}</span>
									{#if result.type === 'tab'}
										<span
											class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
											>Tab</span
										>
									{/if}
								</div>
								<div class="truncate text-xs text-muted-foreground">{result.description}</div>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</header>
