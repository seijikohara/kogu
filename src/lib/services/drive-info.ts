/**
 * Drive / Disk Info service.
 *
 * Thin wrapper over the `drives_list` and `folder_size_scan` Tauri
 * commands. Adds small utilities the route needs for rendering:
 * IEC-style human-readable byte formatting, a usage-percent helper that
 * tolerates zero-capacity disks, and a color-tier classifier so the
 * usage progress bar can switch tone above 70% / 85% thresholds.
 *
 * The service intentionally keeps no React-specific logic; it can be
 * imported from a worker if a future build offloads scanning further.
 */
import { invoke } from '@tauri-apps/api/core';

export interface DriveInfo {
	readonly name: string;
	readonly mountPoint: string;
	readonly fileSystem: string;
	readonly kind: string;
	readonly totalBytes: number;
	readonly availableBytes: number;
	readonly usedBytes: number;
	readonly isRemovable: boolean;
	readonly isReadOnly: boolean;
}

export interface FolderSizeEntry {
	readonly path: string;
	readonly name: string;
	readonly isDir: boolean;
	readonly sizeBytes: number;
}

export interface FolderScanProgress {
	readonly entriesVisited: number;
	readonly bytesSeen: number;
}

/**
 * Enumerate mounted drives via the Tauri backend.
 *
 * Returns a fresh snapshot every call; the backend refreshes the
 * `sysinfo` disk list internally so the frontend never holds a stale
 * value.
 */
export const listDrives = (): Promise<readonly DriveInfo[]> =>
	invoke<readonly DriveInfo[]>('drives_list');

/**
 * Walk the immediate children of `path` and return cumulative-byte
 * entries sorted by size descending. Progress events flow over the
 * `drive-info-scan-progress` Tauri event channel; subscribe with
 * `listen` from `@tauri-apps/api/event`.
 */
export const scanFolderSizes = (path: string): Promise<readonly FolderSizeEntry[]> =>
	invoke<readonly FolderSizeEntry[]>('folder_size_scan', { path });

/** Tauri event name carrying scan progress payloads. */
export const FOLDER_SCAN_PROGRESS_EVENT = 'drive-info-scan-progress';

/**
 * IEC-style byte formatting (KiB, MiB, GiB, TiB). Returns `'—'` for
 * non-finite or negative inputs so the UI never surfaces NaN values.
 */
export const humanSize = (bytes: number): string => {
	if (!Number.isFinite(bytes) || bytes < 0) return '—';
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
	let value = bytes / 1024;
	let unit = units[0] ?? 'KB';
	for (let i = 0; i < units.length - 1 && value >= 1024; i += 1) {
		value /= 1024;
		unit = units[i + 1] ?? unit;
	}
	const formatted = value >= 100 ? value.toFixed(0) : value.toFixed(1);
	return `${formatted} ${unit}`;
};

/**
 * Compute a 0-100 usage percentage. Returns 0 for empty / zero-capacity
 * drives instead of producing `NaN` from a divide-by-zero.
 */
export const usagePercent = (drive: DriveInfo): number => {
	if (drive.totalBytes <= 0) return 0;
	return Math.min(100, Math.max(0, (drive.usedBytes / drive.totalBytes) * 100));
};

export type UsageTier = 'normal' | 'warning' | 'critical';

/**
 * Classify a usage percentage into the three color tiers the UI uses
 * for progress-bar tone and badge color.
 */
export const usageTier = (percent: number): UsageTier => {
	if (percent > 85) return 'critical';
	if (percent >= 70) return 'warning';
	return 'normal';
};

/**
 * Filesystem identifiers that the UI treats as "system" filesystems
 * (read-only OS volumes, virtual / pseudo filesystems). The route hides
 * these by default; users can toggle them back via the rail.
 */
const SYSTEM_FILESYSTEMS: ReadonlySet<string> = new Set([
	'autofs',
	'devfs',
	'devtmpfs',
	'fdescfs',
	'fuse.gvfsd-fuse',
	'lifs',
	'overlay',
	'proc',
	'procfs',
	'sysfs',
	'tmpfs',
]);

/**
 * Decide whether a drive should be considered a system / virtual one.
 * Matches by filesystem string (case-insensitive). The decision is
 * intentionally conservative — anything not in the catalog is treated
 * as a regular volume.
 */
export const isSystemFilesystem = (fileSystem: string): boolean =>
	SYSTEM_FILESYSTEMS.has(fileSystem.toLowerCase());

/**
 * Compute each entry's percent-of-total contribution to the scanned
 * folder. Returns a parallel array so callers do not need to know the
 * order in which the entries were sorted.
 */
export const entryPercents = (entries: readonly FolderSizeEntry[]): readonly number[] => {
	const total = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
	if (total <= 0) return entries.map(() => 0);
	return entries.map((entry) => (entry.sizeBytes / total) * 100);
};
