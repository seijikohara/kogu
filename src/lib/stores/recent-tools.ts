import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface RecentToolEntry {
	readonly toolId: string;
	/** Wall-clock timestamp (ms) of last visit — used for ordering. */
	readonly lastUsedAt: number;
}

interface RecentToolsState {
	readonly recent: readonly RecentToolEntry[];
	/**
	 * Record a visit to `toolId`. Bumps it to the head of the list (most
	 * recent first) and trims to `MAX_RECENT_TOOLS` entries.
	 */
	recordVisit: (toolId: string) => void;
	/** Clear the entire recent list (e.g. from a Settings → Reset). */
	clear: () => void;
}

/**
 * Cap on the recent list. Five items fit naturally above the categorized
 * tool groups without dominating the sidebar; older visits drop off the
 * tail as new ones come in.
 */
export const MAX_RECENT_TOOLS = 5;

export const useRecentToolsStore = create<RecentToolsState>()(
	persist(
		(set) => ({
			recent: [],
			recordVisit: (toolId) =>
				set((state) => {
					const now = Date.now();
					const filtered = state.recent.filter((entry) => entry.toolId !== toolId);
					const next = [{ toolId, lastUsedAt: now }, ...filtered].slice(0, MAX_RECENT_TOOLS);
					return { recent: next };
				}),
			clear: () => set({ recent: [] }),
		}),
		{ name: 'kogu:recent-tools', storage: createJSONStorage(() => localStorage) }
	)
);
