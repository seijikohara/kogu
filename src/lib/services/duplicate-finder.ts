/**
 * Duplicate File Finder service.
 *
 * Wraps the `duplicate_scan` / `duplicate_delete` /
 * `duplicate_replace_with_link` Tauri commands and exposes helpers
 * for the duplicate-finder tool. The Rust backend handles a 3-stage
 * pipeline (size bucket -> partial hash of the first 8 KiB -> full
 * hash). Progress events stream into the UI via the
 * `duplicate-scan-progress` Tauri event channel.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type HashAlgorithm = 'sha256' | 'blake3';

export interface ScanRequest {
	readonly root: string;
	readonly includeGlobs: readonly string[];
	readonly excludeGlobs: readonly string[];
	readonly minSize: number;
	readonly maxSize: number;
	readonly algorithm: HashAlgorithm;
}

export interface DuplicateEntry {
	readonly path: string;
	readonly modifiedMs: number | null;
}

export interface DuplicateGroup {
	readonly hash: string;
	readonly sizeBytes: number;
	readonly paths: readonly DuplicateEntry[];
}

export interface ScanResult {
	readonly groups: readonly DuplicateGroup[];
	readonly totalFiles: number;
	readonly totalWastedBytes: number;
	readonly elapsedMs: number;
}

export type ScanPhase = 'scanning' | 'hashing-partial' | 'hashing-full' | 'done';

export interface ScanProgress {
	readonly phase: ScanPhase;
	readonly current: string;
	readonly done: number;
	readonly total: number;
}

/**
 * Wire-format conversion: the Rust serde rename_all = "camelCase"
 * already lines up with our TypeScript interfaces, so we hand the
 * payload straight through.
 */
export const scanForDuplicates = (opId: string, req: ScanRequest): Promise<ScanResult> =>
	invoke<ScanResult>('duplicate_scan', { opId, req });

/**
 * Request cancellation of an in-flight scan by its operation id. Returns true
 * when a matching operation was found and signalled. Cancellation is
 * cooperative: the scan stops at its next check point rather than instantly.
 */
export const cancelScan = (opId: string): Promise<boolean> =>
	invoke<boolean>('cancel_op', { opId });

/**
 * Delete the given files. Returns the total number of bytes freed.
 */
export const deleteFiles = (paths: readonly string[]): Promise<number> =>
	invoke<number>('duplicate_delete', { paths });

/**
 * Replace `source` with a link to `target`. The link kind is
 * platform-dependent: symbolic link on Unix, hard link on Windows.
 * Hard links require source and target to live on the same volume.
 */
export const replaceWithLink = (source: string, target: string): Promise<void> =>
	invoke<void>('duplicate_replace_with_link', { source, target });

/**
 * Subscribe to scan progress events. Returns an unlisten function the
 * caller must invoke when it no longer needs updates (typically in a
 * `useEffect` cleanup).
 */
export const onScanProgress = (handler: (progress: ScanProgress) => void): Promise<UnlistenFn> =>
	listen<ScanProgress>('duplicate-scan-progress', (event) => handler(event.payload));

/**
 * Human-readable byte size, mirroring the helpers in file-inspect /
 * hex-editor so all file tools render sizes consistently.
 */
export const humanSize = (bytes: number): string => {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const exponent = Math.min(units.length - 1, Math.floor(Math.log10(Math.max(bytes, 1)) / 3));
	const value = bytes / 10 ** (exponent * 3);
	return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
};

/**
 * Selection helpers - the UI keeps a set of paths checked for deletion;
 * these helpers compute the bulk-selection variants ("keep oldest",
 * "keep newest", "keep shortest path"). Returns the paths that should
 * be CHECKED (i.e. marked for deletion) within the group, leaving one
 * file kept.
 */
export type KeepStrategy = 'oldest' | 'newest' | 'shortest-path';

/**
 * Determine which entry to keep within a group based on the chosen
 * strategy. Falls back to the first entry when timestamps are missing.
 */
export const pickKeeper = (
	group: DuplicateGroup,
	strategy: KeepStrategy
): DuplicateEntry | null => {
	if (group.paths.length === 0) return null;
	switch (strategy) {
		case 'oldest': {
			return group.paths.reduce((acc, cur) => {
				const a = acc.modifiedMs ?? Number.POSITIVE_INFINITY;
				const b = cur.modifiedMs ?? Number.POSITIVE_INFINITY;
				return b < a ? cur : acc;
			});
		}
		case 'newest': {
			return group.paths.reduce((acc, cur) => {
				const a = acc.modifiedMs ?? Number.NEGATIVE_INFINITY;
				const b = cur.modifiedMs ?? Number.NEGATIVE_INFINITY;
				return b > a ? cur : acc;
			});
		}
		case 'shortest-path': {
			return group.paths.reduce((acc, cur) => (cur.path.length < acc.path.length ? cur : acc));
		}
		default:
			return group.paths[0] ?? null;
	}
};

/**
 * Build the set of paths to mark for deletion across every group using
 * a keeper strategy. The keeper for each group is left untouched.
 */
export const selectDeletablePaths = (
	groups: readonly DuplicateGroup[],
	strategy: KeepStrategy
): ReadonlySet<string> => {
	const set = new Set<string>();
	for (const group of groups) {
		const keeper = pickKeeper(group, strategy);
		if (!keeper) continue;
		for (const entry of group.paths) {
			if (entry.path !== keeper.path) {
				set.add(entry.path);
			}
		}
	}
	return set;
};

/**
 * Format a Unix-millisecond timestamp as a locale string. Returns `'—'`
 * for missing or non-finite inputs so the UI never shows `Invalid Date`.
 */
export const formatTimestamp = (ms: number | null | undefined): string => {
	if (ms == null || !Number.isFinite(ms)) return '—';
	return new Date(ms).toLocaleString();
};
