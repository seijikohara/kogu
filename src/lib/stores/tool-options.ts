import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ToolOptionsState<T> {
	readonly value: T;
	set: (next: T) => void;
	patch: (delta: Partial<T>) => void;
	reset: () => void;
}

type ToolOptionsHook<T> = UseBoundStore<StoreApi<ToolOptionsState<T>>>;

/**
 * Factory: create a Zustand store that persists a typed options bag under
 * `kogu:tool:<routeId>:options`. Each tool route owns its own hook.
 *
 * Example consumer (lands in Phase 5):
 *   const useUuidOptions = createToolOptionsStore('uuid-generator', { version: 'v4' as const, count: 1 });
 *   const { value, patch } = useUuidOptions();
 */
export function createToolOptionsStore<T>(routeId: string, defaults: T): ToolOptionsHook<T> {
	return create<ToolOptionsState<T>>()(
		persist(
			(set) => ({
				value: defaults,
				set: (next) => set({ value: next }),
				patch: (delta) => set((s) => ({ value: { ...s.value, ...delta } })),
				reset: () => set({ value: defaults }),
			}),
			{ name: `kogu:tool:${routeId}:options`, storage: createJSONStorage(() => localStorage) }
		)
	);
}
