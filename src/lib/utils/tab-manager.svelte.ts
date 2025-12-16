import { goto } from '$app/navigation';

/**
 * Tab stats interface for tracking input state.
 */
export interface TabStats {
	input: string;
	valid: boolean | null;
	error: string;
}

/**
 * Extended tab stats with format information.
 */
export interface TabStatsWithFormat extends TabStats {
	format: string | null;
}

/**
 * Creates a tab manager for URL-synced tab navigation.
 *
 * @param validTabs - Array of valid tab identifiers
 * @param defaultTab - Default tab to use when none specified
 * @param getPageUrl - Function to get current page URL
 * @returns Tab management utilities
 */
export const createTabManager = <T extends string>(
	validTabs: readonly T[],
	defaultTab: T,
	getPageUrl: () => URL
) => {
	/**
	 * Get initial tab from URL or default.
	 */
	const getInitialTab = (): T => {
		const tabParam = getPageUrl().searchParams.get('tab');
		if (tabParam && validTabs.includes(tabParam as T)) {
			return tabParam as T;
		}
		return defaultTab;
	};

	/**
	 * Handle tab change with URL update.
	 */
	const handleTabChange = (value: string | undefined, setActiveTab: (tab: T) => void): void => {
		if (!value) return;
		const newTab = value as T;
		setActiveTab(newTab);

		const url = new URL(getPageUrl());
		if (newTab === defaultTab) {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', newTab);
		}
		goto(url.toString(), { replaceState: true, noScroll: true });
	};

	/**
	 * Sync tab from URL (for use in $effect).
	 */
	const syncFromUrl = (setActiveTab: (tab: T) => void): void => {
		const tabParam = getPageUrl().searchParams.get('tab');
		if (tabParam && validTabs.includes(tabParam as T)) {
			setActiveTab(tabParam as T);
		} else if (!tabParam) {
			setActiveTab(defaultTab);
		}
	};

	/**
	 * Create initial tab stats record.
	 */
	const createInitialStats = (): Record<T, TabStats> => {
		return Object.fromEntries(
			validTabs.map((tab) => [tab, { input: '', valid: null, error: '' }])
		) as Record<T, TabStats>;
	};

	/**
	 * Create stats change handler for a specific tab.
	 */
	const createStatsHandler = (tab: T, setStats: (tab: T, stats: TabStats) => void) => {
		return (stats: TabStats) => setStats(tab, stats);
	};

	return {
		getInitialTab,
		handleTabChange,
		syncFromUrl,
		createInitialStats,
		createStatsHandler,
		validTabs,
		defaultTab,
	};
};
