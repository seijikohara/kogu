/**
 * File watcher service.
 *
 * Thin TypeScript wrapper around the `file_watch_start` and
 * `file_watch_stop` Tauri commands plus a React hook that subscribes
 * to the `file-watch-event` event stream emitted from Rust. Events are
 * kept in an in-memory ring buffer so the UI can render the most
 * recent entries without growing without bound.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Maximum number of events kept in the per-hook ring buffer. */
export const EVENT_RING_CAPACITY = 500;

/** Tauri event channel that the Rust watcher emits on. */
const EVENT_NAME = 'file-watch-event';

export type FileWatchEventKind = 'create' | 'modify' | 'delete' | 'rename';

/**
 * Raw payload as emitted from the Rust watcher. Lacks a per-session
 * sequence number; the hook injects one before exposing the value to
 * consumers.
 */
interface FileWatchEventPayload {
	readonly watchId: string;
	readonly kind: FileWatchEventKind;
	readonly path: string;
	readonly timestamp: number;
}

export interface FileWatchEvent extends FileWatchEventPayload {
	/** Monotonically increasing index assigned by the hook. */
	readonly seq: number;
}

/**
 * Start a recursive watcher on `path`. Returns the watch ID that must
 * be passed back to [`stopWatch`] when the caller is done.
 */
export const startWatch = (path: string): Promise<string> =>
	invoke<string>('file_watch_start', { path });

/**
 * Stop a previously started watcher. Safe to call with an unknown ID;
 * the backend treats unknown IDs as a no-op.
 */
export const stopWatch = (watchId: string): Promise<void> =>
	invoke<void>('file_watch_stop', { watchId });

interface UseFileWatchReturn {
	readonly events: readonly FileWatchEvent[];
	readonly watching: boolean;
	readonly watchId: string | null;
	readonly start: (path: string) => Promise<void>;
	readonly stop: () => Promise<void>;
	readonly clear: () => void;
}

/**
 * React hook that owns the lifecycle of a single watcher: it manages
 * the Tauri event subscription, drops events from other watch IDs,
 * and trims the buffer to [`EVENT_RING_CAPACITY`] so memory stays
 * bounded. The hook stops the active watcher on unmount.
 */
export function useFileWatch(): UseFileWatchReturn {
	const [events, setEvents] = useState<readonly FileWatchEvent[]>([]);
	const [watchId, setWatchId] = useState<string | null>(null);
	const watchIdRef = useRef<string | null>(null);
	const unlistenRef = useRef<UnlistenFn | null>(null);
	// Session-scoped monotonically increasing counter used as a stable
	// React key for the rendered event log.
	const seqRef = useRef(0);

	useEffect(() => {
		watchIdRef.current = watchId;
	}, [watchId]);

	useEffect(() => {
		let cancelled = false;
		listen<FileWatchEventPayload>(EVENT_NAME, (event) => {
			const current = watchIdRef.current;
			if (!current) return;
			if (event.payload.watchId !== current) return;
			seqRef.current += 1;
			const enriched: FileWatchEvent = { ...event.payload, seq: seqRef.current };
			setEvents((prev) => {
				const next = [enriched, ...prev];
				return next.length > EVENT_RING_CAPACITY ? next.slice(0, EVENT_RING_CAPACITY) : next;
			});
		})
			.then((unlisten) => {
				if (cancelled) {
					unlisten();
					return;
				}
				unlistenRef.current = unlisten;
			})
			.catch(() => undefined);

		return () => {
			cancelled = true;
			const unlisten = unlistenRef.current;
			unlistenRef.current = null;
			if (unlisten) unlisten();
		};
	}, []);

	const stop = useCallback(async () => {
		const current = watchIdRef.current;
		if (!current) return;
		watchIdRef.current = null;
		setWatchId(null);
		try {
			await stopWatch(current);
		} catch {
			// Backend may have already released the watcher; ignore.
		}
	}, []);

	const start = useCallback(
		async (path: string) => {
			const current = watchIdRef.current;
			if (current) await stop();
			const id = await startWatch(path);
			watchIdRef.current = id;
			setWatchId(id);
		},
		[stop]
	);

	// Ensure the watcher is released when the consuming component
	// unmounts. The dependency-free effect above clears the listener;
	// the watcher itself must be stopped explicitly.
	useEffect(
		() => () => {
			const current = watchIdRef.current;
			if (!current) return;
			watchIdRef.current = null;
			stopWatch(current).catch(() => undefined);
		},
		[]
	);

	const clear = useCallback(() => setEvents([]), []);

	return useMemo(
		() => ({
			events,
			watching: watchId !== null,
			watchId,
			start,
			stop,
			clear,
		}),
		[events, watchId, start, stop, clear]
	);
}
