<script lang="ts">
	import { initNavigationHistory } from '$lib/services/navigation-history.svelte.js';
	import NavButtons from './nav-buttons.svelte';
	import TitleBarCommand from './title-bar-command.svelte';

	interface Props {
		readonly commandRef?: { focusInput: () => void } | null;
	}

	let { commandRef = $bindable(null) }: Props = $props();

	// Initialize navigation history tracking
	initNavigationHistory();
</script>

<header
	data-tauri-drag-region
	class="flex h-8 shrink-0 items-center justify-center gap-2 border-b bg-background px-4"
>
	<NavButtons />
	<TitleBarCommand bind:this={commandRef} />
</header>
