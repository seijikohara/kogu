import { useTabSync } from '$lib/utils';

/**
 * Standard tab stats interface for formatter pages.
 */
export interface TabStats {
	readonly input: string;
	readonly valid: boolean | null;
	readonly error: string;
}

/**
 * Standard formatter tabs.
 */
export const FORMATTER_TABS = [
	'format',
	'query',
	'compare',
	'convert',
	'schema',
	'generate',
] as const;

export type FormatterTabType = (typeof FORMATTER_TABS)[number];

/**
 * Configuration for useFormatterPage hook.
 */
export interface UseFormatterPageConfig<TStats> {
	/** Function to calculate live stats from input */
	readonly calculateStats: (input: string) => TStats | null;
}

/**
 * Return type for useFormatterPage hook.
 */
export interface UseFormatterPageReturn<TStats> {
	/** Tab sync state and methods */
	readonly tabSync: {
		readonly activeTab: FormatterTabType;
		readonly setActiveTab: (tab: FormatterTabType) => void;
		readonly isActive: (tab: FormatterTabType) => boolean;
	};
	/** Shared input across all tabs (reactive getter) */
	readonly sharedInput: string;
	/** Set shared input value */
	readonly setSharedInput: (value: string) => void;
	/** Current tab's stats (reactive getter) */
	readonly currentStats: TabStats;
	/** Create stats change handler for a specific tab */
	readonly handleStatsChange: (tab: FormatterTabType) => (stats: TabStats) => void;
	/** Live stats calculated from current input (reactive getter) */
	readonly liveStats: TStats | null;
}

/**
 * Formatter page state management hook.
 *
 * Consolidates common state patterns across JSON, XML, YAML formatter pages:
 * - Tab sync with URL
 * - Shared input state
 * - Per-tab stats tracking
 * - Live stats calculation
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useFormatterPage } from '$lib/hooks';
 *   import { calculateJsonStats } from '$lib/services/formatters';
 *
 *   const { tabSync, sharedInput, setSharedInput, currentStats, handleStatsChange, liveStats } =
 *     useFormatterPage({ calculateStats: (input) => calculateJsonStats(input, 'json') });
 * </script>
 * ```
 */
export const useFormatterPage = <TStats>(
	config: UseFormatterPageConfig<TStats>
): UseFormatterPageReturn<TStats> => {
	const { calculateStats } = config;

	// Tab sync with URL
	const tabSync = useTabSync({
		tabs: FORMATTER_TABS,
		defaultTab: 'format',
	});

	// Type-safe tab change handler
	const handleTabChange = (tab: string) => tabSync.setActiveTab(tab as FormatterTabType);

	// Shared input across all tabs
	let _sharedInput = $state('');
	const setSharedInput = (value: string) => {
		_sharedInput = value;
	};

	// Initial stats for all tabs
	const createInitialTabStats = (): Record<FormatterTabType, TabStats> => ({
		format: { input: '', valid: null, error: '' },
		query: { input: '', valid: null, error: '' },
		compare: { input: '', valid: null, error: '' },
		convert: { input: '', valid: null, error: '' },
		schema: { input: '', valid: null, error: '' },
		generate: { input: '', valid: null, error: '' },
	});

	const _tabStats = $state<Record<FormatterTabType, TabStats>>(createInitialTabStats());

	// Current tab stats (derived)
	const _currentStats = $derived(_tabStats[tabSync.activeTab]);

	// Stats change handler factory
	const handleStatsChange =
		(tab: FormatterTabType) =>
		(stats: TabStats): void => {
			_tabStats[tab] = stats;
		};

	// Live stats calculation (derived)
	const _liveStats = $derived.by((): TStats | null => {
		const input = _sharedInput.trim();
		if (!input) return null;
		try {
			return calculateStats(input);
		} catch {
			return null;
		}
	});

	return {
		tabSync: {
			get activeTab() {
				return tabSync.activeTab;
			},
			setActiveTab: handleTabChange,
			isActive: tabSync.isActive,
		},
		get sharedInput() {
			return _sharedInput;
		},
		setSharedInput,
		get currentStats() {
			return _currentStats;
		},
		handleStatsChange,
		get liveStats() {
			return _liveStats;
		},
	};
};
