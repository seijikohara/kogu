/**
 * Hash generator service.
 *
 * Delegates the actual digest computation to the Rust `hash_text_batch`
 * Tauri command (see `src-tauri/src/hash_text.rs`). The renderer never
 * touches `crypto-js` in the typing-driven hot path; algorithms run on
 * a `spawn_blocking` worker on the Rust side.
 */
import { invoke } from '@tauri-apps/api/core';

export type HashAlgorithm = 'MD5' | 'SHA1' | 'SHA224' | 'SHA256' | 'SHA384' | 'SHA512';

export interface HashResult {
	readonly algorithm: HashAlgorithm;
	readonly hash: string;
	readonly bits: number;
}

/**
 * Hash algorithms with their bit lengths.
 */
export const HASH_ALGORITHMS: readonly {
	algorithm: HashAlgorithm;
	bits: number;
	secure: boolean;
}[] = [
	{ algorithm: 'MD5', bits: 128, secure: false },
	{ algorithm: 'SHA1', bits: 160, secure: false },
	{ algorithm: 'SHA224', bits: 224, secure: true },
	{ algorithm: 'SHA256', bits: 256, secure: true },
	{ algorithm: 'SHA384', bits: 384, secure: true },
	{ algorithm: 'SHA512', bits: 512, secure: true },
];

interface HashTextBatchResult {
	readonly hashes: Readonly<Record<string, string>>;
	readonly sizeBytes: number;
}

/**
 * Compute all configured hashes for `text` via the Rust backend.
 *
 * Returned ordering follows [`HASH_ALGORITHMS`]; algorithms the Rust
 * side omits (it never should, but defensively) are dropped from the
 * output.
 */
export const generateAllHashes = async (text: string): Promise<readonly HashResult[]> => {
	const algorithms = HASH_ALGORITHMS.map((entry) => entry.algorithm.toLowerCase());
	const response = await invoke<HashTextBatchResult>('hash_text_batch', { text, algorithms });
	return HASH_ALGORITHMS.flatMap(({ algorithm, bits }) => {
		const hash = response.hashes[algorithm.toLowerCase()];
		if (typeof hash !== 'string') return [];
		return [{ algorithm, hash, bits }];
	});
};

/**
 * Compare two hash values (case-insensitive).
 */
export const compareHashes = (hash1: string, hash2: string): boolean =>
	hash1.toLowerCase().trim() === hash2.toLowerCase().trim();

export const SAMPLE_TEXT_FOR_HASH = 'Hello, World!';
