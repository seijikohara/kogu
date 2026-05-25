/**
 * Hash generator service.
 */
import CryptoJS from 'crypto-js';

export type HashAlgorithm = 'MD5' | 'SHA1' | 'SHA224' | 'SHA256' | 'SHA384' | 'SHA512';

export interface HashResult {
	algorithm: HashAlgorithm;
	hash: string;
	bits: number;
}

/**
 * Hash algorithms with their bit lengths.
 */
export const HASH_ALGORITHMS: { algorithm: HashAlgorithm; bits: number; secure: boolean }[] = [
	{ algorithm: 'MD5', bits: 128, secure: false },
	{ algorithm: 'SHA1', bits: 160, secure: false },
	{ algorithm: 'SHA224', bits: 224, secure: true },
	{ algorithm: 'SHA256', bits: 256, secure: true },
	{ algorithm: 'SHA384', bits: 384, secure: true },
	{ algorithm: 'SHA512', bits: 512, secure: true },
];

/**
 * Generate hash for text using specified algorithm.
 */
export const generateHash = (text: string, algorithm: HashAlgorithm): string => {
	switch (algorithm) {
		case 'MD5':
			return CryptoJS.MD5(text).toString();
		case 'SHA1':
			return CryptoJS.SHA1(text).toString();
		case 'SHA224':
			return CryptoJS.SHA224(text).toString();
		case 'SHA256':
			return CryptoJS.SHA256(text).toString();
		case 'SHA384':
			return CryptoJS.SHA384(text).toString();
		case 'SHA512':
			return CryptoJS.SHA512(text).toString();
		default:
			throw new Error(`Unknown algorithm: ${algorithm}`);
	}
};

/**
 * Generate all hashes for text.
 */
export const generateAllHashes = (text: string): HashResult[] => {
	return HASH_ALGORITHMS.map(({ algorithm, bits }) => ({
		algorithm,
		hash: generateHash(text, algorithm),
		bits,
	}));
};

/**
 * Generate hash for file using specified algorithm.
 */
export const generateFileHash = (file: File, algorithm: HashAlgorithm): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const wordArray = CryptoJS.lib.WordArray.create(reader.result as ArrayBuffer);

			// Dispatch the algorithm via a map of factories. Unknown algorithms
			// are surfaced via `null`, which triggers the reject path below.
			const hashFactories: Record<HashAlgorithm, (wa: CryptoJS.lib.WordArray) => string> = {
				MD5: (wa) => CryptoJS.MD5(wa).toString(),
				SHA1: (wa) => CryptoJS.SHA1(wa).toString(),
				SHA224: (wa) => CryptoJS.SHA224(wa).toString(),
				SHA256: (wa) => CryptoJS.SHA256(wa).toString(),
				SHA384: (wa) => CryptoJS.SHA384(wa).toString(),
				SHA512: (wa) => CryptoJS.SHA512(wa).toString(),
			};
			const factory = hashFactories[algorithm];
			if (!factory) {
				reject(new Error(`Unknown algorithm: ${algorithm}`));
				return;
			}
			resolve(factory(wordArray));
		};
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsArrayBuffer(file);
	});
};

/**
 * Generate all hashes for file.
 */
export const generateAllFileHashes = async (file: File): Promise<HashResult[]> =>
	Promise.all(
		HASH_ALGORITHMS.map(async ({ algorithm, bits }) => ({
			algorithm,
			hash: await generateFileHash(file, algorithm),
			bits,
		}))
	);

/**
 * Compare two hash values (case-insensitive).
 */
export const compareHashes = (hash1: string, hash2: string): boolean => {
	return hash1.toLowerCase().trim() === hash2.toLowerCase().trim();
};

export const SAMPLE_TEXT_FOR_HASH = 'Hello, World!';
