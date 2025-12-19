import { goto } from '$app/navigation';
import { page } from '$app/state';

/**
 * Options for useTabSync hook.
 */
export interface UseTabSyncOptions<T extends string> {
	/** Valid tab identifiers */
	readonly tabs: readonly T[];
	/** Default tab to use when none specified in URL */
	readonly defaultTab: T;
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
	const { tabs, defaultTab } = options;

	/**
	 * Get tab from URL or return default.
	 */
	const getTabFromUrl = (): T => {
		const tabParam = page.url.searchParams.get('tab');
		if (tabParam && tabs.includes(tabParam as T)) {
			return tabParam as T;
		}
		return defaultTab;
	};

	// Reactive state - initialize from URL
	let _activeTab = $state<T>(getTabFromUrl());

	// Sync from URL changes (browser back/forward)
	$effect(() => {
		const tabParam = page.url.searchParams.get('tab');
		if (tabParam && tabs.includes(tabParam as T)) {
			_activeTab = tabParam as T;
		} else if (!tabParam) {
			_activeTab = defaultTab;
		}
	});

	/**
	 * Set active tab and update URL.
	 */
	const setActiveTab = (tab: T): void => {
		_activeTab = tab;
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
