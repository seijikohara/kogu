/**
 * Off-thread decoding and hashing worker for the File Inspector tool.
 *
 * Decoding an 8 MB base64 payload (`atob` + a per-byte copy loop) and the
 * `js-md5` digest are both synchronous and CPU-bound. Run on the main thread
 * they freeze the webview for hundreds of milliseconds; this worker moves them
 * off the event loop. The Web Crypto digests already run off-thread, but they
 * live here too so the route never touches raw bytes on the main thread.
 *
 * Message protocol:
 *
 * ```
 * main -> worker: FileInspectWorkerRequest (union discriminated by `kind`)
 * worker -> main: FileInspectWorkerResponse
 * ```
 *
 * `'decode'` decodes the base64 string and transfers the decoded `ArrayBuffer`
 * back (zero-copy) so the main thread can build the image / audio preview and
 * drive hashing without decoding anything itself.
 *
 * `'hash'` receives a buffer (a transferred copy from the main thread) and
 * computes the requested digests, leaving the main thread's own copy untouched.
 *
 * Decode responses carry `buffer`; hash responses carry `hashes`. `id` is the
 * monotonic request id supplied by the caller — the hook keeps the latest id
 * and discards responses carrying a smaller one so a superseded file cannot
 * tear the UI.
 */
import { md5 } from 'js-md5';

import type { HashAlgo } from '@/lib/services/file-inspect';

export interface DecodeRequest {
	readonly kind: 'decode';
	readonly id: number;
	readonly base64: string;
}

export interface HashRequest {
	readonly kind: 'hash';
	readonly id: number;
	readonly buffer: ArrayBuffer;
	readonly algorithms: readonly HashAlgo[];
}

export type FileInspectWorkerRequest = DecodeRequest | HashRequest;

export interface FileInspectWorkerResponse {
	readonly id: number;
	/** Computed digests. Present only on `'hash'` responses. */
	readonly hashes: Partial<Record<HashAlgo, string>> | undefined;
	/** Decoded byte buffer, transferred back only on `'decode'` responses. */
	readonly buffer: ArrayBuffer | undefined;
	readonly error: string | null;
}

/** Decode a standard base64 string into an `ArrayBuffer` off the main thread. */
const decodeBase64 = (b64: string): ArrayBuffer => {
	if (b64.length === 0) return new ArrayBuffer(0);
	const binary = atob(b64);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		out[i] = binary.charCodeAt(i);
	}
	return out.buffer;
};

const bytesToHex = (bytes: Uint8Array): string =>
	Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

const SUBTLE_NAME: Readonly<Record<Exclude<HashAlgo, 'md5'>, string>> = {
	sha1: 'SHA-1',
	sha256: 'SHA-256',
	sha512: 'SHA-512',
};

/** Compute every requested digest for a buffer, all inside the worker. */
const computeHashes = async (
	buffer: ArrayBuffer,
	algorithms: readonly HashAlgo[]
): Promise<Partial<Record<HashAlgo, string>>> => {
	const entries = await Promise.all(
		algorithms.map(async (algo): Promise<readonly [HashAlgo, string]> => {
			if (algo === 'md5') return [algo, md5(new Uint8Array(buffer))];
			const digest = await crypto.subtle.digest(SUBTLE_NAME[algo], buffer);
			return [algo, bytesToHex(new Uint8Array(digest))];
		})
	);
	return Object.fromEntries(entries) as Partial<Record<HashAlgo, string>>;
};

self.addEventListener('message', async (event: MessageEvent<FileInspectWorkerRequest>) => {
	const request = event.data;
	try {
		if (request.kind === 'decode') {
			const buffer = decodeBase64(request.base64);
			self.postMessage(
				{
					id: request.id,
					hashes: undefined,
					buffer,
					error: null,
				} satisfies FileInspectWorkerResponse,
				[buffer]
			);
			return;
		}
		const hashes = await computeHashes(request.buffer, request.algorithms);
		self.postMessage({
			id: request.id,
			hashes,
			buffer: undefined,
			error: null,
		} satisfies FileInspectWorkerResponse);
	} catch (err) {
		const error = err instanceof Error ? err.message : 'file-inspect worker failed';
		self.postMessage({
			id: request.id,
			hashes: undefined,
			buffer: undefined,
			error,
		} satisfies FileInspectWorkerResponse);
	}
});
