import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';

import { useActiveTab, useTabStore } from '@/lib/stores';

import { useDebouncedValue } from './use-debounced-value';

export interface TabStats {
	readonly input: string;
	readonly valid: boolean | null;
	readonly error: string;
}

export const FORMATTER_TABS = [
	'format',
	'query',
	'compare',
	'convert',
	'schema',
	'generate',
] as const;

export type FormatterTabType = (typeof FORMATTER_TABS)[number];

export interface UseFormatterPageConfig<TStats> {
	readonly calculateStats: (input: string) => TStats | null;
	readonly persistKey?: string;
}

export interface UseFormatterPageReturn<TStats> {
	readonly tabSync: {
		readonly activeTab: FormatterTabType;
		readonly setActiveTab: (tab: FormatterTabType) => void;
		readonly isActive: (tab: FormatterTabType) => boolean;
	};
	readonly sharedInput: string;
	readonly setSharedInput: (value: string) => void;
	readonly currentStats: TabStats;
	readonly handleStatsChange: (tab: FormatterTabType) => (stats: TabStats) => void;
	readonly liveStats: TStats | null;
}

const DEFAULT_TAB: FormatterTabType = 'format';
const LEGACY_PERSIST_PREFIX = 'kogu:tab:';

const isValidTab = (candidate: string | null | undefined): candidate is FormatterTabType =>
	candidate !== null &&
	candidate !== undefined &&
	(FORMATTER_TABS as readonly string[]).includes(candidate);

/**
 * Read the legacy `kogu:tab:<persistKey>` localStorage entry so users who
 * previously chose a non-default tab keep that choice on first load after
 * the Zustand migration. Returns null when no usable legacy value exists.
 */
const readLegacyPersistedTab = (persistKey: string | undefined): FormatterTabType | null => {
	if (!persistKey || typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(`${LEGACY_PERSIST_PREFIX}${persistKey}`);
		if (raw === null) return null;
		const parsed = JSON.parse(raw) as unknown;
		return typeof parsed === 'string' && isValidTab(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

const createInitialTabStats = (): Record<FormatterTabType, TabStats> => ({
	format: { input: '', valid: null, error: '' },
	query: { input: '', valid: null, error: '' },
	compare: { input: '', valid: null, error: '' },
	convert: { input: '', valid: null, error: '' },
	schema: { input: '', valid: null, error: '' },
	generate: { input: '', valid: null, error: '' },
});

export const useFormatterPage = <TStats>(
	config: UseFormatterPageConfig<TStats>
): UseFormatterPageReturn<TStats> => {
	const { calculateStats, persistKey } = config;

	const pathname = useLocation({ select: (loc) => loc.pathname });
	const searchStr = useLocation({ select: (loc) => loc.searchStr });
	const navigate = useNavigate();

	const storedTab = useActiveTab(persistKey ?? '');
	const setStoredTab = useTabStore((s) => s.setActive);

	const activeTab = useMemo<FormatterTabType>(() => {
		const params = new URLSearchParams(searchStr);
		const candidate = params.get('tab');
		if (isValidTab(candidate)) return candidate;
		if (isValidTab(storedTab)) return storedTab;
		const legacy = readLegacyPersistedTab(persistKey);
		return legacy ?? DEFAULT_TAB;
	}, [searchStr, storedTab, persistKey]);

	const setActiveTab = useCallback(
		(tab: FormatterTabType): void => {
			if (persistKey) setStoredTab(persistKey, tab);
			navigate({
				to: pathname,
				search: (prev: Record<string, unknown>) => {
					const next = { ...prev };
					if (tab === DEFAULT_TAB) {
						delete next['tab'];
					} else {
						next['tab'] = tab;
					}
					return next;
				},
				replace: true,
				resetScroll: false,
			});
		},
		[pathname, navigate, persistKey, setStoredTab]
	);

	const isActive = useCallback((tab: FormatterTabType): boolean => activeTab === tab, [activeTab]);

	const [sharedInput, setSharedInput] = useState<string>('');
	const [tabStats, setTabStats] =
		useState<Record<FormatterTabType, TabStats>>(createInitialTabStats);

	const currentStats = tabStats[activeTab];

	// Per-tab handlers must be referentially stable across renders. Returning a fresh
	// inner arrow on every call would re-trigger child useEffect(deps: [..., onStatsChange])
	// loops on every parent render, exceeding React's update-depth guard.
	const tabStatsHandlers = useMemo<Record<FormatterTabType, (stats: TabStats) => void>>(
		() =>
			Object.fromEntries(
				FORMATTER_TABS.map((tab) => [
					tab,
					(stats: TabStats) => setTabStats((prev) => ({ ...prev, [tab]: stats })),
				])
			) as Record<FormatterTabType, (stats: TabStats) => void>,
		[]
	);

	const handleStatsChange = useCallback(
		(tab: FormatterTabType) => tabStatsHandlers[tab],
		[tabStatsHandlers]
	);

	// Debounce stats recomputation so parsing large JSON / XML / YAML
	// payloads only fires after the user pauses typing. Parse cost on
	// medium documents is ~10-30ms; 150ms is invisible to typing but
	// collapses bursts into a single call.
	const debouncedSharedInput = useDebouncedValue(sharedInput, 150);
	const liveStats = useMemo<TStats | null>(() => {
		const input = debouncedSharedInput.trim();
		if (!input) return null;
		try {
			return calculateStats(input);
		} catch {
			return null;
		}
	}, [debouncedSharedInput, calculateStats]);

	useEffect(() => {
		if (persistKey) setStoredTab(persistKey, activeTab);
	}, [persistKey, activeTab, setStoredTab]);

	const tabSync = useMemo(
		() => ({
			activeTab,
			setActiveTab,
			isActive,
		}),
		[activeTab, setActiveTab, isActive]
	);

	return {
		tabSync,
		sharedInput,
		setSharedInput,
		currentStats,
		handleStatsChange,
		liveStats,
	};
};
