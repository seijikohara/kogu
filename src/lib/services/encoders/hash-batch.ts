/**
 * File hash batch service.
 *
 * Wraps the `hash_file_batch` Tauri command which reads N files from
 * disk and computes the selected hashes (MD5 / SHA-1 / SHA-256 /
 * SHA-512) in parallel. Provides pure helpers to build and parse
 * `.sha256sum`-style verification blocks so the same module can drive
 * generate + verify modes from a single result set.
 */
import { invoke } from '@tauri-apps/api/core';

/**
 * Batch-hash algorithm identifiers exchanged with the Rust backend.
 * Lower-case strings are used to match the convention in
 * `file-inspect.ts`.
 */
export type BatchHashAlgo = 'md5' | 'sha1' | 'sha256' | 'sha512';

export const BATCH_HASH_ALGOS: readonly BatchHashAlgo[] = ['md5', 'sha1', 'sha256', 'sha512'];

export const BATCH_HASH_ALGO_LABELS: Readonly<Record<BatchHashAlgo, string>> = {
	md5: 'MD5',
	sha1: 'SHA-1',
	sha256: 'SHA-256',
	sha512: 'SHA-512',
};

export const BATCH_HASH_ALGO_SECURE: Readonly<Record<BatchHashAlgo, boolean>> = {
	md5: false,
	sha1: false,
	sha256: true,
	sha512: true,
};

/**
 * Result returned by the Rust command for each input path. Hashes are
 * lower-case hex strings keyed by the algorithm id. `error` is set
 * when the file could not be read; in that case `hashes` is empty.
 */
export interface FileHashResult {
	readonly path: string;
	readonly sizeBytes: number;
	readonly hashes: Partial<Record<BatchHashAlgo, string>>;
	readonly error: string | null;
}

/**
 * Invoke the Rust batch hasher. Results are returned in the same order
 * as `paths`. Throws when the input is structurally invalid (empty
 * paths list or unrecognized algorithms); per-file IO errors come back
 * inside the result list.
 */
export const hashFileBatch = (
	paths: readonly string[],
	algorithms: readonly BatchHashAlgo[]
): Promise<readonly FileHashResult[]> =>
	invoke<readonly FileHashResult[]>('hash_file_batch', {
		paths: [...paths],
		algorithms: [...algorithms],
	});

/**
 * Extract the trailing path component from an absolute or relative
 * path. Mirrors the POSIX `basename` behaviour for the common case
 * (forward and backward slashes) without pulling in a `path` polyfill.
 */
export const basename = (path: string): string => {
	if (!path) return '';
	const trimmed = path.replace(/[\\/]+$/, '');
	const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
	return idx < 0 ? trimmed : trimmed.slice(idx + 1);
};

/**
 * Build a `.sha256sum`-style block from a list of results. Each line
 * follows the GNU coreutils format: `<hash>  <filename>` (two spaces).
 * Files that errored or lack the requested algorithm are skipped.
 */
export const buildShasumBlock = (
	results: readonly FileHashResult[],
	algorithm: BatchHashAlgo
): string =>
	results
		.filter((r) => !r.error && r.hashes[algorithm])
		.map((r) => `${r.hashes[algorithm]}  ${basename(r.path)}`)
		.join('\n');

/**
 * Single line parsed from a `.sha256sum`-style block.
 */
export interface ShasumEntry {
	readonly hash: string;
	readonly filename: string;
}

/**
 * Parse a `.sha256sum`-style block into per-line entries. Lines that
 * do not match the `<hex>  <filename>` shape are silently skipped so
 * comments and stray whitespace do not break verification.
 */
export const parseShasumBlock = (text: string): readonly ShasumEntry[] =>
	text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('#'))
		.flatMap((line) => {
			// GNU coreutils prints "<hash>  <filename>" or "<hash> *<filename>"
			// (binary mode). Either way the first token is the digest.
			const match = /^([0-9a-fA-F]+)\s+\*?(.+)$/.exec(line);
			if (!match) return [];
			const [, hash, filename] = match;
			if (!hash || !filename) return [];
			return [{ hash: hash.toLowerCase(), filename }];
		});

/**
 * Outcome of comparing an expected hash against the actual hash
 * computed for the matching file.
 */
export interface VerifyOutcome {
	readonly filename: string;
	readonly expected: string;
	readonly actual: string | null;
	readonly match: boolean;
}

/**
 * Verify expected hashes against computed results. Matching is done by
 * filename basename, so the expected list and the result list can live
 * in different directory contexts. Files present in `expected` but
 * absent from `results` are returned with `actual: null` and `match:
 * false` so the UI can surface them as missing.
 */
export const verifyShasum = (
	results: readonly FileHashResult[],
	expected: readonly ShasumEntry[],
	algorithm: BatchHashAlgo
): readonly VerifyOutcome[] => {
	const byName = new Map<string, FileHashResult>();
	for (const r of results) {
		byName.set(basename(r.path), r);
	}
	return expected.map((entry) => {
		const result = byName.get(entry.filename);
		const actual = result?.hashes[algorithm] ?? null;
		const match = actual !== null && actual.toLowerCase() === entry.hash.toLowerCase();
		return { filename: entry.filename, expected: entry.hash, actual, match };
	});
};

/**
 * Human-readable size formatter shared with the inspector tools.
 * Mirrors the helper in `file-inspect.ts` so status-bar values stay
 * visually consistent across the file tools.
 */
export const humanSize = (bytes: number): string => {
	if (!Number.isFinite(bytes) || bytes < 0) return '—';
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unit = units[0] ?? 'KB';
	for (let i = 0; i < units.length - 1 && value >= 1024; i += 1) {
		value /= 1024;
		unit = units[i + 1] ?? unit;
	}
	const formatted = value >= 100 ? value.toFixed(0) : value.toFixed(1);
	return `${formatted} ${unit}`;
};
