import { goto } from '$app/navigation';
import { page } from '$app/state';
import { persisted } from '$lib/services/persisted.svelte.js';

/**
 * Options for useTabSync hook.
 */
export interface UseTabSyncOptions<T extends string> {
	/** Valid tab identifiers */
	readonly tabs: readonly T[];
	/** Default tab to use when none specified in URL */
	readonly defaultTab: T;
	/**
	 * Optional `persisted` key. When provided, the last-active tab is mirrored
	 * to `localStorage` and used as the fallback when the URL has no `?tab=`
	 * query parameter (e.g. on a fresh app launch). URL parameters still take
	 * precedence so deep links work as before.
	 */
	readonly persistKey?: string;
}

/**
 * Return type for useTabSync hook.
 */
export interface UseTabSyncReturn<T extends string> {
	/** Current active tab (reactive getter) */
	readonly activeTab: T;
	/** Set active tab and update URL */
	readonly setActiveTab: (tab: T) => void;
	/** Check if a tab is currently active */
	readonly isActive: (tab: T) => boolean;
}

/**
 * Tab synchronization hook with URL integration.
 * Uses Svelte 5 runes for reactivity.
 *
 * Features:
 * - Syncs active tab with URL query parameter (?tab=xxx)
 * - Supports browser back/forward navigation
 * - Default tab is not included in URL (clean URLs)
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   const { activeTab, setActiveTab } = useTabSync({
 *     tabs: ['format', 'query', 'compare'] as const,
 *     defaultTab: 'format',
 *   });
 * </script>
 * ```
 */
export const useTabSync = <T extends string>(
	options: UseTabSyncOptions<T>
): UseTabSyncReturn<T> => {
	const { tabs, defaultTab, persistKey } = options;

	// Optional localStorage-backed fallback. When `persistKey` is omitted, this
	// resolves to `null` and tab state behaves exactly as before (URL only).
	const persistedTab = persistKey ? persisted<T>(`tab:${persistKey}`, defaultTab) : null;

	const isValidTab = (candidate: string | null | undefined): candidate is T =>
		candidate !== null && candidate !== undefined && tabs.includes(candidate as T);

	const resolveInitialTab = (): T => {
		if (persistedTab && isValidTab(persistedTab.current)) return persistedTab.current;
		return defaultTab;
	};

	/**
	 * Get tab from URL, falling back to the persisted value (if configured) and
	 * finally to the default.
	 */
	const getTabFromUrl = (): T => {
		const tabParam = page.url.searchParams.get('tab');
		if (isValidTab(tabParam)) return tabParam;
		return resolveInitialTab();
	};

	// Reactive state - initialize from URL
	let _activeTab = $state<T>(getTabFromUrl());

	// Sync from URL changes (browser back/forward)
	$effect(() => {
		const tabParam = page.url.searchParams.get('tab');
		if (isValidTab(tabParam)) {
			_activeTab = tabParam;
		} else if (!tabParam) {
			_activeTab = resolveInitialTab();
		}
	});

	/**
	 * Set active tab and update URL.
	 */
	const setActiveTab = (tab: T): void => {
		_activeTab = tab;
		if (persistedTab) persistedTab.current = tab;
		const url = new URL(page.url);
		if (tab === defaultTab) {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', tab);
		}
		goto(url.toString(), { replaceState: true, noScroll: true });
	};

	/**
	 * Check if a tab is currently active.
	 */
	const isActive = (tab: T): boolean => _activeTab === tab;

	return {
		get activeTab() {
			return _activeTab;
		},
		setActiveTab,
		isActive,
	};
};
