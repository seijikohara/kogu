import { onMount } from 'svelte';
import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
import { page } from '$app/state';

interface NavigationEntry {
	readonly url: string;
	readonly title: string;
}

// Navigation history state using Svelte 5 runes
let history = $state<NavigationEntry[]>([]);
let currentIndex = $state(-1);
let isNavigatingProgrammatically = $state(false);

// Export functions instead of derived values (Svelte 5 module limitation)
export const getCanGoBack = (): boolean => currentIndex > 0;
export const getCanGoForward = (): boolean => currentIndex < history.length - 1;

export const initNavigationHistory = (): void => {
	onMount(() => {
		// Initialize with current page
		const initialEntry: NavigationEntry = {
			url: page.url.pathname,
			title: document.title,
		};
		history = [initialEntry];
		currentIndex = 0;
	});

	beforeNavigate(() => {
		// Skip if programmatic navigation (back/forward)
		if (isNavigatingProgrammatically) return;
	});

	afterNavigate(({ to }) => {
		// Skip if programmatic navigation
		if (isNavigatingProgrammatically) {
			isNavigatingProgrammatically = false;
			return;
		}

		if (!to?.url) return;

		const newEntry: NavigationEntry = {
			url: to.url.pathname,
			title: document.title,
		};

		// If not at the end, truncate forward history
		if (currentIndex < history.length - 1) {
			history = history.slice(0, currentIndex + 1);
		}

		// Avoid duplicate entries
		const lastEntry = history[history.length - 1];
		if (lastEntry?.url !== newEntry.url) {
			history = [...history, newEntry];
			currentIndex = history.length - 1;
		}
	});
};

export const goBack = async (): Promise<void> => {
	if (!getCanGoBack()) return;

	isNavigatingProgrammatically = true;
	currentIndex -= 1;
	const entry = history[currentIndex];
	if (!entry) return;
	await goto(entry.url, { replaceState: false });
};

export const goForward = async (): Promise<void> => {
	if (!getCanGoForward()) return;

	isNavigatingProgrammatically = true;
	currentIndex += 1;
	const entry = history[currentIndex];
	if (!entry) return;
	await goto(entry.url, { replaceState: false });
};

// For debugging/testing
export const getHistoryState = (): {
	readonly history: readonly NavigationEntry[];
	readonly currentIndex: number;
} => ({
	history: [...history],
	currentIndex,
});
