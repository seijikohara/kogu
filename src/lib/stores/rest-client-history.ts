import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthConfig, BodyMode, HeaderEntry, HttpMethod } from '@/lib/services/rest-client';

/**
 * Full request configuration captured so a history entry can be restored into
 * the editor verbatim. Mirrors the rest-client route's options bag.
 */
export interface RequestSnapshot {
	readonly method: HttpMethod;
	readonly url: string;
	readonly headers: readonly HeaderEntry[];
	readonly auth: AuthConfig;
	readonly bodyMode: BodyMode;
	readonly body: string;
	readonly formFields: readonly HeaderEntry[];
	readonly followRedirects: boolean;
	readonly timeoutMs: number;
}

/** Outcome metadata stored alongside a snapshot for the history list. */
export interface RequestOutcome {
	readonly status: number;
	readonly statusText: string;
	readonly elapsedMs: number;
}

/** One recorded request: the snapshot to restore plus its outcome and time. */
export interface HistoryEntry {
	readonly id: string;
	readonly request: RequestSnapshot;
	readonly status: number;
	readonly statusText: string;
	readonly elapsedMs: number;
	/** Wall-clock timestamp (ms) of the request — used for ordering and display. */
	readonly at: number;
}

interface RestClientHistoryState {
	readonly entries: readonly HistoryEntry[];
	/** Prepend a completed request to the history, trimming to the cap. */
	record: (request: RequestSnapshot, outcome: RequestOutcome) => void;
	/** Drop a single entry by id. */
	remove: (id: string) => void;
	/** Clear the entire history. */
	clear: () => void;
}

/**
 * Cap on the request history. Twenty entries cover a working session's recent
 * calls without letting the persisted list grow unbounded; older requests drop
 * off the tail as new ones arrive.
 */
export const MAX_HISTORY_ENTRIES = 20;

const createId = (): string =>
	`req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const useRestClientHistory = create<RestClientHistoryState>()(
	persist(
		(set) => ({
			entries: [],
			record: (request, outcome) =>
				set((state) => {
					const entry: HistoryEntry = {
						id: createId(),
						request,
						status: outcome.status,
						statusText: outcome.statusText,
						elapsedMs: outcome.elapsedMs,
						at: Date.now(),
					};
					return { entries: [entry, ...state.entries].slice(0, MAX_HISTORY_ENTRIES) };
				}),
			remove: (id) => set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),
			clear: () => set({ entries: [] }),
		}),
		{ name: 'kogu:rest-client:history', storage: createJSONStorage(() => localStorage) }
	)
);
