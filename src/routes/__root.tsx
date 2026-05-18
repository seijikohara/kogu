import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, createRootRoute, useRouter } from '@tanstack/react-router';
import { listen } from '@tauri-apps/api/event';
import { confirm } from '@tauri-apps/plugin-dialog';
import { ThemeProvider } from 'next-themes';
import { toast } from 'sonner';

import {
	AppSidebar,
	KeyboardShortcutsDialog,
	TitleBar,
	type TitleBarCommandHandle,
} from '@/lib/components/layout';
import { SidebarInset, SidebarProvider } from '@/lib/components/ui/sidebar';
import { Toaster } from '@/lib/components/ui/sonner';
import { TooltipProvider } from '@/lib/components/ui/tooltip';
import {
	DEFAULT_SETTINGS,
	applyAllSettings,
	getSettings,
	resetSettings,
} from '@/lib/services/settings';
import { useSidebarStore } from '@/lib/stores';
import { isEditableTarget, isModKey } from '@/lib/utils/keyboard';

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	const router = useRouter();
	const titleBarRef = useRef<TitleBarCommandHandle | null>(null);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);

	// Sidebar collapse state survives app restarts via the persisted Zustand store.
	// The existing store models the inverse (`collapsed`); expose `open` to the
	// SidebarProvider by flipping the boolean.
	const collapsed = useSidebarStore((s) => s.collapsed);
	const setCollapsed = useSidebarStore((s) => s.setCollapsed);
	const open = !collapsed;
	const setOpen = useCallback(
		(next: boolean) => {
			setCollapsed(!next);
		},
		[setCollapsed]
	);

	// Shared reset flow: confirm -> reset -> apply -> toast.
	const handleResetAllSettings = useCallback(async () => {
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
	}, []);

	// Global keyboard shortcuts.
	useEffect(() => {
		const handleKeydown = (e: KeyboardEvent) => {
			// Cmd+K -> focus inline command palette in the title bar.
			if (isModKey(e) && e.key === 'k') {
				e.preventDefault();
				titleBarRef.current?.focusInput();
				return;
			}
			// Cmd+[ -> navigate back through the router history.
			if (isModKey(e) && e.key === '[') {
				e.preventDefault();
				router.history.back();
				return;
			}
			// Cmd+] -> navigate forward through the router history.
			if (isModKey(e) && e.key === ']') {
				e.preventDefault();
				router.history.forward();
				return;
			}
			// ? -> open keyboard shortcuts help (skip when typing).
			if (e.key === '?' && !isEditableTarget(e)) {
				e.preventDefault();
				setShortcutsOpen(true);
				return;
			}
		};
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	}, [router]);

	// Settings bootstrap, window/Tauri event listeners, and capture-phase
	// contextmenu suppression. Runs once on mount.
	useEffect(() => {
		// Load and apply settings at startup. Silently use defaults on failure.
		getSettings()
			.then(applyAllSettings)
			.catch(() => {});

		const handleOpenShortcutsHelp = () => {
			setShortcutsOpen(true);
		};
		window.addEventListener('open-shortcuts-help', handleOpenShortcutsHelp);

		// "Reset All Settings" from the in-app command palette.
		const handleResetFromPalette = () => {
			handleResetAllSettings().catch(() => {});
		};
		window.addEventListener('reset-all-settings', handleResetFromPalette);

		// "Reset All Settings" from the macOS native menu.
		const unlistenMenuResetPromise = listen('menu-reset-settings', () => {
			handleResetAllSettings().catch(() => {});
		});

		// Capture-phase suppression of the native context menu, except inside the
		// code editor wrapper where the system menu (copy / paste) is desirable.
		const handleContextMenu = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest('.code-editor-wrapper')) return;
			e.preventDefault();
			e.stopPropagation();
		};
		document.addEventListener('contextmenu', handleContextMenu, { capture: true });

		return () => {
			window.removeEventListener('open-shortcuts-help', handleOpenShortcutsHelp);
			window.removeEventListener('reset-all-settings', handleResetFromPalette);
			unlistenMenuResetPromise.then((unlisten) => unlisten()).catch(() => {});
			document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
		};
	}, [handleResetAllSettings]);

	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			<Toaster richColors />
			<KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
			<TooltipProvider delayDuration={150}>
				<div className="flex h-screen flex-col">
					<TitleBar ref={titleBarRef} />
					<SidebarProvider
						open={open}
						onOpenChange={setOpen}
						className="flex-1 !min-h-0 [&_[data-slot=sidebar-container]]:top-8 [&_[data-slot=sidebar-container]]:h-[calc(100svh-2rem)]"
					>
						<div className="flex h-full w-full overflow-hidden">
							<AppSidebar />
							<SidebarInset className="flex h-full flex-col overflow-hidden">
								<Outlet />
							</SidebarInset>
						</div>
					</SidebarProvider>
				</div>
			</TooltipProvider>
		</ThemeProvider>
	);
}
