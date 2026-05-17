import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SidebarState {
	readonly collapsed: boolean;
	readonly openGroups: Readonly<Record<string, boolean>>;
	setCollapsed: (collapsed: boolean) => void;
	toggleCollapsed: () => void;
	toggleGroup: (groupId: string) => void;
	setGroupOpen: (groupId: string, open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
	persist(
		(set) => ({
			collapsed: false,
			openGroups: {},
			setCollapsed: (collapsed) => set({ collapsed }),
			toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
			toggleGroup: (groupId) =>
				set((s) => ({ openGroups: { ...s.openGroups, [groupId]: !s.openGroups[groupId] } })),
			setGroupOpen: (groupId, open) =>
				set((s) => ({ openGroups: { ...s.openGroups, [groupId]: open } })),
		}),
		{ name: 'kogu:sidebar', storage: createJSONStorage(() => localStorage) }
	)
);
