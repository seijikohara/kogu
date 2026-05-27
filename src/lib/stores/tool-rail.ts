import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ToolRailState {
	readonly showRail: boolean;
	readonly setShowRail: (next: boolean) => void;
}

type ToolRailHook = UseBoundStore<StoreApi<ToolRailState>>;

/**
 * Factory: persist a tool route's rail collapsed/expanded state under
 * `kogu:tool:<routeId>:rail`. Pair the returned hook with
 * `<ToolShell showRail={…} onShowRailChange={…} />` so the rail
 * remembers its position across navigations and reloads.
 *
 * Example:
 *   const useUuidRail = createToolRailStore('uuid-generator');
 *   const showRail = useUuidRail((s) => s.showRail);
 *   const setShowRail = useUuidRail((s) => s.setShowRail);
 */
export function createToolRailStore(routeId: string, defaultShow = true): ToolRailHook {
	return create<ToolRailState>()(
		persist(
			(set) => ({
				showRail: defaultShow,
				setShowRail: (next) => set({ showRail: next }),
			}),
			{ name: `kogu:tool:${routeId}:rail`, storage: createJSONStorage(() => localStorage) }
		)
	);
}

// Module-level cache so repeated `usePersistedRail('uuid-generator')`
// calls share a single Zustand store per route. Without this, every
// render would spawn a new store and lose persistence wiring.
const RAIL_STORES = new Map<string, ToolRailHook>();

/**
 * Drop-in replacement for `useState(true)` that persists the rail's
 * collapsed/expanded state under `kogu:tool:<routeId>:rail`. Returns a
 * `[showRail, setShowRail]` tuple so the call site reads identically
 * to the previous `useState` declaration.
 *
 * Example:
 *   const [showRail, setShowRail] = usePersistedRail('uuid-generator');
 */
export function usePersistedRail(
	routeId: string,
	defaultShow = true
): readonly [boolean, (next: boolean) => void] {
	let store = RAIL_STORES.get(routeId);
	if (!store) {
		store = createToolRailStore(routeId, defaultShow);
		RAIL_STORES.set(routeId, store);
	}
	const showRail = store((s) => s.showRail);
	const setShowRail = store((s) => s.setShowRail);
	return [showRail, setShowRail] as const;
}

export type { ToolRailHook, ToolRailState };
