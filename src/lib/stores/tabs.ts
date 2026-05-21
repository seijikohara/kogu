import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface TabState {
	readonly active: Readonly<Record<string, string>>;
	setActive: (key: string, value: string) => void;
	clearActive: (key: string) => void;
}

export const useTabStore = create<TabState>()(
	persist(
		(set) => ({
			active: {},
			setActive: (key, value) => set((s) => ({ active: { ...s.active, [key]: value } })),
			clearActive: (key) =>
				set((s) => {
					const { [key]: _, ...rest } = s.active;
					return { active: rest };
				}),
		}),
		{ name: 'kogu:tabs', storage: createJSONStorage(() => localStorage) }
	)
);

export const useActiveTab = (key: string): string | undefined => useTabStore((s) => s.active[key]);
