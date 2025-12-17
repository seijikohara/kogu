<script lang="ts">
	import '../app.css';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { AppSidebar, TitleBar } from '$lib/components/layout/index.js';
	import { Sonner } from '$lib/components/ui/sonner/index.js';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';

	let { children } = $props();

	// Use capture phase to intercept context menu events before they reach any element
	onMount(() => {
		const handleContextMenu = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			// Only allow context menu on code editor
			if (target.closest('.code-editor-wrapper')) return;
			// Prevent context menu everywhere else
			e.preventDefault();
			e.stopPropagation();
		};

		// Capture phase ensures this runs before bubbling handlers
		document.addEventListener('contextmenu', handleContextMenu, { capture: true });

		return () => {
			document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
		};
	});
</script>

<ModeWatcher />
<Sonner richColors />

<div class="flex h-screen flex-col">
	<TitleBar />
	<Sidebar.Provider
		class="flex-1 !min-h-0 [&_[data-slot=sidebar-container]]:top-8 [&_[data-slot=sidebar-container]]:h-[calc(100svh-2rem)]"
	>
		<div class="flex h-full w-full overflow-hidden">
			<AppSidebar />
			<Sidebar.Inset class="flex h-full flex-col overflow-hidden">
				{@render children()}
			</Sidebar.Inset>
		</div>
	</Sidebar.Provider>
</div>
