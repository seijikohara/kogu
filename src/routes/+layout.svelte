<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { listen } from '@tauri-apps/api/event';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import {
		AppSidebar,
		CommandPalette,
		KeyboardShortcutsDialog,
		TitleBar,
	} from '$lib/components/layout/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Sonner } from '$lib/components/ui/sonner/index.js';
	import { goBack, goForward } from '$lib/services/navigation-history.svelte.js';
	import {
		applyAllSettings,
		getSettings,
		resetSettings,
		DEFAULT_SETTINGS,
	} from '$lib/services/settings.js';
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

	// Shared reset flow: confirm → reset → apply → toast
	const handleResetAllSettings = async () => {
		const confirmed = await confirm(
			'This will reset all settings including fonts and window position.',
			{
				title: 'Reset All Settings',
				kind: 'warning',
				okLabel: 'Reset',
				cancelLabel: 'Cancel',
			}
		);
		if (!confirmed) return;

		await resetSettings();
		applyAllSettings(DEFAULT_SETTINGS);
		toast.success('All settings have been reset');
	};

	onMount(() => {
		// Load and apply settings at startup
		getSettings()
			.then((settings) => applyAllSettings(settings))
			.catch(() => {
				// Silently use defaults if settings fail to load
			});

		const handleOpenShortcutsHelp = () => {
			shortcutsHelpOpen = true;
		};
		window.addEventListener('open-shortcuts-help', handleOpenShortcutsHelp);

		// Listen for "Reset All Settings" from command palette
		const handleResetFromPalette = () => {
			handleResetAllSettings();
		};
		window.addEventListener('reset-all-settings', handleResetFromPalette);

		// Listen for "Reset All Settings" from macOS native menu
		const unlistenMenuReset = listen('menu-reset-settings', () => {
			handleResetAllSettings();
		});

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
			window.removeEventListener('reset-all-settings', handleResetFromPalette);
			unlistenMenuReset.then((unlisten) => unlisten());
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
