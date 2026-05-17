import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';

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
const PERSIST_PREFIX = 'kogu:tab:';

const isValidTab = (candidate: string | null | undefined): candidate is FormatterTabType =>
	candidate !== null &&
	candidate !== undefined &&
	(FORMATTER_TABS as readonly string[]).includes(candidate);

const readPersistedTab = (persistKey: string | undefined): FormatterTabType | null => {
	if (!persistKey || typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(`${PERSIST_PREFIX}${persistKey}`);
		if (raw === null) return null;
		const parsed = JSON.parse(raw) as unknown;
		return typeof parsed === 'string' && isValidTab(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

const writePersistedTab = (persistKey: string | undefined, tab: FormatterTabType): void => {
	if (!persistKey || typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(`${PERSIST_PREFIX}${persistKey}`, JSON.stringify(tab));
	} catch {
		// Quota exceeded or storage disabled; ignore so navigation still works.
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

	const activeTab = useMemo<FormatterTabType>(() => {
		const params = new URLSearchParams(searchStr);
		const candidate = params.get('tab');
		if (isValidTab(candidate)) return candidate;
		const stored = readPersistedTab(persistKey);
		return stored ?? DEFAULT_TAB;
	}, [searchStr, persistKey]);

	const setActiveTab = useCallback(
		(tab: FormatterTabType): void => {
			writePersistedTab(persistKey, tab);
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
		[pathname, navigate, persistKey]
	);

	const isActive = useCallback((tab: FormatterTabType): boolean => activeTab === tab, [activeTab]);

	const [sharedInput, setSharedInput] = useState<string>('');
	const [tabStats, setTabStats] =
		useState<Record<FormatterTabType, TabStats>>(createInitialTabStats);

	const currentStats = tabStats[activeTab];

	const handleStatsChange = useCallback(
		(tab: FormatterTabType) =>
			(stats: TabStats): void => {
				setTabStats((prev) => ({ ...prev, [tab]: stats }));
			},
		[]
	);

	const liveStats = useMemo<TStats | null>(() => {
		const input = sharedInput.trim();
		if (!input) return null;
		try {
			return calculateStats(input);
		} catch {
			return null;
		}
	}, [sharedInput, calculateStats]);

	useEffect(() => {
		writePersistedTab(persistKey, activeTab);
	}, [persistKey, activeTab]);

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
