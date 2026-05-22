import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ToolPinsState {
	readonly pinned: readonly string[];
	/** Add `toolId` to the pinned list. No-op if already pinned. */
	pin: (toolId: string) => void;
	/** Remove `toolId` from the pinned list. No-op if not pinned. */
	unpin: (toolId: string) => void;
	/** Toggle pin state. Returns the new state. */
	togglePin: (toolId: string) => void;
	/** True iff `toolId` is currently pinned. Pure derive helper for selectors. */
	isPinned: (toolId: string) => boolean;
}

export const useToolPinsStore = create<ToolPinsState>()(
	persist(
		(set, get) => ({
			pinned: [],
			pin: (toolId) =>
				set((state) =>
					state.pinned.includes(toolId) ? state : { pinned: [...state.pinned, toolId] }
				),
			unpin: (toolId) => set((state) => ({ pinned: state.pinned.filter((id) => id !== toolId) })),
			togglePin: (toolId) =>
				set((state) =>
					state.pinned.includes(toolId)
						? { pinned: state.pinned.filter((id) => id !== toolId) }
						: { pinned: [...state.pinned, toolId] }
				),
			isPinned: (toolId) => get().pinned.includes(toolId),
		}),
		{ name: 'kogu:tool-pins', storage: createJSONStorage(() => localStorage) }
	)
);
