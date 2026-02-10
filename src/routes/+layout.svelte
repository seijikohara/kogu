<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';
	import {
		AppSidebar,
		CommandPalette,
		KeyboardShortcutsDialog,
		TitleBar,
	} from '$lib/components/layout/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Sonner } from '$lib/components/ui/sonner/index.js';
	import { goBack, goForward } from '$lib/services/navigation-history.svelte.js';
	import { isEditableTarget, isModKey } from '$lib/utils/keyboard.js';

	let { children } = $props();

	let commandPaletteOpen = $state(false);
	let shortcutsHelpOpen = $state(false);

	const handleGlobalKeydown = (e: KeyboardEvent) => {
		// Cmd+K → command palette
		if (isModKey(e) && e.key === 'k') {
			e.preventDefault();
			commandPaletteOpen = true;
			return;
		}
		// Cmd+[ → navigate back
		if (isModKey(e) && e.key === '[') {
			e.preventDefault();
			goBack();
			return;
		}
		// Cmd+] → navigate forward
		if (isModKey(e) && e.key === ']') {
			e.preventDefault();
			goForward();
			return;
		}
		// ? → keyboard shortcuts help (only when not in editable)
		if (e.key === '?' && !isEditableTarget(e)) {
			e.preventDefault();
			shortcutsHelpOpen = true;
			return;
		}
	};

	// Listen for custom event from command palette to open shortcuts help
	onMount(() => {
		const handleOpenShortcutsHelp = () => {
			shortcutsHelpOpen = true;
		};
		window.addEventListener('open-shortcuts-help', handleOpenShortcutsHelp);

		// Use capture phase to intercept context menu events before they reach any element
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
			window.removeEventListener('open-shortcuts-help', handleOpenShortcutsHelp);
			document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
		};
	});
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<ModeWatcher />
<Sonner richColors />
<CommandPalette bind:open={commandPaletteOpen} />
<KeyboardShortcutsDialog bind:open={shortcutsHelpOpen} />

<div class="flex h-screen flex-col">
	<TitleBar onOpenCommandPalette={() => (commandPaletteOpen = true)} />
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
