<script lang="ts">
	import { Search } from '@lucide/svelte';
	import { initNavigationHistory } from '$lib/services/navigation-history.svelte.js';
	import { formatShortcut } from '$lib/utils/keyboard.js';
	import NavButtons from './nav-buttons.svelte';

	interface Props {
		readonly onOpenCommandPalette?: () => void;
	}

	let { onOpenCommandPalette }: Props = $props();

	// Initialize navigation history tracking
	initNavigationHistory();
</script>

<header
	data-tauri-drag-region
	class="flex h-8 shrink-0 items-center justify-center gap-2 border-b bg-background px-4"
>
	<!-- Navigation buttons and Search trigger - centered together -->
	<NavButtons />
	<button
		type="button"
		class="flex h-6 w-full max-w-md items-center gap-2 rounded-lg bg-surface-2 px-3 text-xs text-muted-foreground transition-colors hover:bg-surface-3"
		onclick={() => onOpenCommandPalette?.()}
	>
		<Search class="h-3.5 w-3.5 shrink-0" />
		<span class="flex-1 text-left">Search pages...</span>
		<kbd
			class="pointer-events-none hidden shrink-0 rounded border border-border/40 bg-surface-3 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline"
		>
			{formatShortcut('K', true)}
		</kbd>
	</button>
</header>
