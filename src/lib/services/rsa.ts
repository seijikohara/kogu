/**
 * RSA Toolkit service.
 *
 * Pure helpers that wrap the Web Crypto API for RSA encryption, decryption,
 * signing and verification. All processing is local to the browser; nothing
 * is sent to a server. PEM input supports PKCS#1, PKCS#8 and SPKI formats —
 * legacy PKCS#1 private keys are wrapped into PKCS#8 envelopes before being
 * handed to `crypto.subtle.importKey`, which only accepts PKCS#8 / SPKI for
 * RSA keys.
 *
 * Encryption is restricted to RSA-OAEP because the Web Crypto API does not
 * expose RSA PKCS#1 v1.5 encryption (the legacy padding remains available
 * for signatures only).
 */

export type RsaPadding = 'oaep-sha1' | 'oaep-sha256' | 'oaep-sha384' | 'oaep-sha512';

export type RsaSignAlg =
	| 'pss-sha256'
	| 'pss-sha384'
	| 'pss-sha512'
	| 'pkcs1-sha256'
	| 'pkcs1-sha384'
	| 'pkcs1-sha512';

export type OutputFormat = 'base64' | 'hex' | 'data-uri';

export type PemHeader =
	| 'private-pkcs1'
	| 'private-pkcs8'
	| 'public-pkcs1'
	| 'public-spki'
	| 'unknown';

export interface ParsedKeyInfo {
	readonly algorithm: string;
	readonly type: 'public' | 'private';
	readonly bitLength: number;
	readonly format: 'pkcs1' | 'pkcs8' | 'spki';
	readonly fingerprint: string;
}

export interface ImportError {
	readonly ok: false;
	readonly error: string;
}

export interface ImportSuccess {
	readonly ok: true;
	readonly key: CryptoKey;
	readonly info: ParsedKeyInfo;
}

export type ImportResult = ImportSuccess | ImportError;

const PADDING_HASH: Readonly<Record<RsaPadding, string>> = {
	'oaep-sha1': 'SHA-1',
	'oaep-sha256': 'SHA-256',
	'oaep-sha384': 'SHA-384',
	'oaep-sha512': 'SHA-512',
};

const SIGN_HASH: Readonly<Record<RsaSignAlg, string>> = {
	'pss-sha256': 'SHA-256',
	'pss-sha384': 'SHA-384',
	'pss-sha512': 'SHA-512',
	'pkcs1-sha256': 'SHA-256',
	'pkcs1-sha384': 'SHA-384',
	'pkcs1-sha512': 'SHA-512',
};

const isPssAlg = (alg: RsaSignAlg): boolean => alg.startsWith('pss-');

const signAlgorithmName = (alg: RsaSignAlg): 'RSA-PSS' | 'RSASSA-PKCS1-v1_5' =>
	isPssAlg(alg) ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5';

// Saltlength matches the digest size for PSS — this is the de-facto default
// for interoperable signatures.
const pssSaltLength = (alg: RsaSignAlg): number => {
	switch (alg) {
		case 'pss-sha256':
			return 32;
		case 'pss-sha384':
			return 48;
		case 'pss-sha512':
			return 64;
		default:
			return 32;
	}
};

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

// Re-pack a Uint8Array onto a fresh ArrayBuffer so the resulting view
// satisfies `BufferSource` cleanly (TypeScript 7 distinguishes views over
// `ArrayBufferLike` vs `ArrayBuffer`).
const toArrayBufferView = (bytes: Uint8Array): ArrayBuffer => {
	const out = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(out).set(bytes);
	return out;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i] ?? 0);
	}
	return btoa(binary);
};

const base64ToBytes = (input: string): Uint8Array => {
	const cleaned = input.replace(/\s+/g, '');
	const normalised = cleaned.replace(/-/g, '+').replace(/_/g, '/');
	const padding = normalised.length % 4 === 0 ? '' : '='.repeat(4 - (normalised.length % 4));
	const binary = atob(normalised + padding);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
};

const bytesToHex = (bytes: Uint8Array): string =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const hexToBytes = (hex: string): Uint8Array => {
	const cleaned = hex.replace(/\s+/g, '').replace(/^0x/i, '');
	if (cleaned.length % 2 !== 0)
		throw new Error('Hex input must have an even number of characters.');
	if (!/^[0-9a-fA-F]*$/.test(cleaned))
		throw new Error('Hex input contains non-hexadecimal characters.');
	const out = new Uint8Array(cleaned.length / 2);
	for (let i = 0; i < out.length; i += 1) {
		out[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
};

/**
 * Detect the PEM block type from the BEGIN header.
 */
export const detectPemType = (pem: string): PemHeader => {
	const match = pem.match(/-----BEGIN ([A-Z0-9 ]+)-----/);
	if (!match) return 'unknown';
	switch (match[1]?.trim()) {
		case 'RSA PRIVATE KEY':
			return 'private-pkcs1';
		case 'PRIVATE KEY':
			return 'private-pkcs8';
		case 'RSA PUBLIC KEY':
			return 'public-pkcs1';
		case 'PUBLIC KEY':
			return 'public-spki';
		default:
			return 'unknown';
	}
};

/**
 * Strip PEM armor and decode the base64 body into DER bytes.
 */
export const pemToDer = (pem: string): Uint8Array => {
	const stripped = pem
		.replace(/-----BEGIN [A-Z0-9 ]+-----/g, '')
		.replace(/-----END [A-Z0-9 ]+-----/g, '')
		.replace(/\s+/g, '');
	if (stripped.length === 0) throw new Error('PEM body is empty.');
	return base64ToBytes(stripped);
};

const wrapBase64Pem = (label: string, body: string): string => {
	const lines = body.match(/.{1,64}/g) ?? [body];
	return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
};

export type PemLabel = 'PRIVATE KEY' | 'PUBLIC KEY' | 'RSA PRIVATE KEY' | 'RSA PUBLIC KEY';

/**
 * Encode DER bytes as a PEM block with the given label.
 */
export const derToPem = (der: Uint8Array, type: PemLabel): string =>
	wrapBase64Pem(type, bytesToBase64(der));

/**
 * Wrap a PKCS#1-encoded RSA private key in a PKCS#8 envelope so it can be
 * passed to `crypto.subtle.importKey` with format `'pkcs8'`.
 *
 * Layout:
 *   30 82 LL LL                              SEQUENCE, length = full content
 *   02 01 00                                 Version INTEGER 0
 *   30 0D                                    AlgorithmIdentifier SEQUENCE
 *     06 09 2A 86 48 86 F7 0D 01 01 01       OID 1.2.840.113549.1.1.1 (rsaEncryption)
 *     05 00                                  parameters NULL
 *   04 82 LL LL                              OCTET STRING wrapper
 *     <PKCS#1 DER bytes>
 */
export const wrapPkcs1AsPkcs8 = (pkcs1: Uint8Array): Uint8Array => {
	const headerBeforeOctet = [
		0x02, 0x01, 0x00, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
		0x05, 0x00,
	] as const;
	const octetHeader = [0x04, 0x82, (pkcs1.length >> 8) & 0xff, pkcs1.length & 0xff] as const;
	const innerLength = headerBeforeOctet.length + octetHeader.length + pkcs1.length;
	const out = new Uint8Array(4 + innerLength);
	out[0] = 0x30;
	out[1] = 0x82;
	out[2] = (innerLength >> 8) & 0xff;
	out[3] = innerLength & 0xff;
	let offset = 4;
	out.set(headerBeforeOctet, offset);
	offset += headerBeforeOctet.length;
	out.set(octetHeader, offset);
	offset += octetHeader.length;
	out.set(pkcs1, offset);
	return out;
};

const sha256Fingerprint = async (der: Uint8Array): Promise<string> => {
	const digest = await crypto.subtle.digest('SHA-256', toArrayBufferView(der));
	const hex = bytesToHex(new Uint8Array(digest));
	return hex.match(/.{2}/g)?.join(':') ?? hex;
};

const importKeyForUsage = async (
	der: Uint8Array,
	format: 'pkcs8' | 'spki',
	algorithm: RsaHashedImportParams,
	usages: readonly KeyUsage[]
): Promise<CryptoKey> =>
	crypto.subtle.importKey(format, toArrayBufferView(der), algorithm, true, [...usages]);

const bitLengthFromAlgorithm = (key: CryptoKey): number => {
	const algorithm = key.algorithm as RsaHashedKeyAlgorithm;
	return algorithm.modulusLength ?? 0;
};

interface NormalisedPem {
	readonly format: 'pkcs1' | 'pkcs8' | 'spki';
	readonly type: 'public' | 'private';
	readonly importFormat: 'pkcs8' | 'spki';
	readonly importDer: Uint8Array;
	readonly originalDer: Uint8Array;
}

const normalisePem = (pem: string, expected: 'public' | 'private'): NormalisedPem => {
	const header = detectPemType(pem);
	if (header === 'unknown') throw new Error('Unrecognised PEM header.');
	if (expected === 'private' && header !== 'private-pkcs1' && header !== 'private-pkcs8') {
		throw new Error('Expected a private key PEM.');
	}
	if (expected === 'public' && header !== 'public-spki' && header !== 'public-pkcs1') {
		throw new Error('Expected a public key PEM.');
	}
	if (header === 'public-pkcs1') {
		throw new Error(
			'RSA PUBLIC KEY (PKCS#1) is not supported by Web Crypto. Convert to SPKI PEM first.'
		);
	}
	const der = pemToDer(pem);
	if (header === 'private-pkcs1') {
		return {
			format: 'pkcs1',
			type: 'private',
			importFormat: 'pkcs8',
			importDer: wrapPkcs1AsPkcs8(der),
			originalDer: der,
		};
	}
	if (header === 'private-pkcs8') {
		return {
			format: 'pkcs8',
			type: 'private',
			importFormat: 'pkcs8',
			importDer: der,
			originalDer: der,
		};
	}
	return {
		format: 'spki',
		type: 'public',
		importFormat: 'spki',
		importDer: der,
		originalDer: der,
	};
};

const buildInfo = async (key: CryptoKey, normalised: NormalisedPem): Promise<ParsedKeyInfo> => ({
	algorithm: 'RSA',
	type: normalised.type,
	bitLength: bitLengthFromAlgorithm(key),
	format: normalised.format,
	fingerprint: await sha256Fingerprint(normalised.originalDer),
});

const wrapImport = async (
	pem: string,
	expected: 'public' | 'private',
	algorithm: RsaHashedImportParams,
	usages: readonly KeyUsage[]
): Promise<ImportResult> => {
	try {
		const normalised = normalisePem(pem, expected);
		const key = await importKeyForUsage(
			normalised.importDer,
			normalised.importFormat,
			algorithm,
			usages
		);
		const info = await buildInfo(key, normalised);
		return { ok: true, key, info };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
};

/**
 * Import a public key for RSA-OAEP encryption.
 */
export const importPublicKey = (pem: string, padding: RsaPadding): Promise<ImportResult> =>
	wrapImport(pem, 'public', { name: 'RSA-OAEP', hash: PADDING_HASH[padding] }, ['encrypt']);

/**
 * Import a private key for RSA-OAEP decryption.
 */
export const importPrivateKey = (pem: string, padding: RsaPadding): Promise<ImportResult> =>
	wrapImport(pem, 'private', { name: 'RSA-OAEP', hash: PADDING_HASH[padding] }, ['decrypt']);

/**
 * Import a public key for signature verification.
 */
export const importVerifyKey = (pem: string, alg: RsaSignAlg): Promise<ImportResult> =>
	wrapImport(pem, 'public', { name: signAlgorithmName(alg), hash: SIGN_HASH[alg] }, ['verify']);

/**
 * Import a private key for signing.
 */
export const importSignKey = (pem: string, alg: RsaSignAlg): Promise<ImportResult> =>
	wrapImport(pem, 'private', { name: signAlgorithmName(alg), hash: SIGN_HASH[alg] }, ['sign']);

/**
 * Encrypt plaintext with the given RSA-OAEP public key.
 */
export const encrypt = async (key: CryptoKey, plaintext: string): Promise<Uint8Array> => {
	const data = TEXT_ENCODER.encode(plaintext);
	const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, toArrayBufferView(data));
	return new Uint8Array(cipher);
};

/**
 * Decrypt ciphertext with the given RSA-OAEP private key.
 */
export const decrypt = async (key: CryptoKey, ciphertext: Uint8Array): Promise<string> => {
	const plain = await crypto.subtle.decrypt(
		{ name: 'RSA-OAEP' },
		key,
		toArrayBufferView(ciphertext)
	);
	return TEXT_DECODER.decode(plain);
};

/**
 * Sign the message with the given RSA private key.
 */
export const sign = async (
	key: CryptoKey,
	message: string,
	alg: RsaSignAlg
): Promise<Uint8Array> => {
	const data = TEXT_ENCODER.encode(message);
	const params: AlgorithmIdentifier | RsaPssParams = isPssAlg(alg)
		? { name: 'RSA-PSS', saltLength: pssSaltLength(alg) }
		: { name: 'RSASSA-PKCS1-v1_5' };
	const sig = await crypto.subtle.sign(params, key, toArrayBufferView(data));
	return new Uint8Array(sig);
};

/**
 * Verify a signature against the message with the given RSA public key.
 */
export const verify = (
	key: CryptoKey,
	message: string,
	signature: Uint8Array,
	alg: RsaSignAlg
): Promise<boolean> => {
	const data = TEXT_ENCODER.encode(message);
	const params: AlgorithmIdentifier | RsaPssParams = isPssAlg(alg)
		? { name: 'RSA-PSS', saltLength: pssSaltLength(alg) }
		: { name: 'RSASSA-PKCS1-v1_5' };
	return crypto.subtle.verify(params, key, toArrayBufferView(signature), toArrayBufferView(data));
};

/**
 * Format raw bytes for display in the chosen output format.
 */
export const formatOutput = (bytes: Uint8Array, fmt: OutputFormat): string => {
	if (fmt === 'base64') return bytesToBase64(bytes);
	if (fmt === 'hex') return bytesToHex(bytes);
	return `data:application/octet-stream;base64,${bytesToBase64(bytes)}`;
};

/**
 * Parse user-supplied text into bytes. `auto` infers base64 vs hex from the
 * character set.
 */
export const parseInputBytes = (text: string, fmt: 'base64' | 'hex' | 'auto'): Uint8Array => {
	const trimmed = text.trim();
	if (trimmed.length === 0) throw new Error('Input is empty.');
	if (trimmed.startsWith('data:')) {
		const comma = trimmed.indexOf(',');
		if (comma < 0) throw new Error('Invalid data URI.');
		return base64ToBytes(trimmed.slice(comma + 1));
	}
	if (fmt === 'hex') return hexToBytes(trimmed);
	if (fmt === 'base64') return base64ToBytes(trimmed);
	const stripped = trimmed.replace(/\s+/g, '').replace(/^0x/i, '');
	if (/^[0-9a-fA-F]+$/.test(stripped) && stripped.length % 2 === 0) {
		return hexToBytes(stripped);
	}
	return base64ToBytes(trimmed);
};

/**
 * Generate a fresh 2048-bit RSA keypair and export as PKCS#8 (private) and
 * SPKI (public) PEMs. Used by the in-product "Generate sample keypair"
 * button so no key material is committed to source.
 */
export const generateSampleKeypair = async (): Promise<{
	readonly publicPem: string;
	readonly privatePem: string;
}> => {
	const pair = await crypto.subtle.generateKey(
		{
			name: 'RSA-OAEP',
			modulusLength: 2048,
			publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
			hash: 'SHA-256',
		},
		true,
		['encrypt', 'decrypt']
	);
	const [spki, pkcs8] = await Promise.all([
		crypto.subtle.exportKey('spki', pair.publicKey),
		crypto.subtle.exportKey('pkcs8', pair.privateKey),
	]);
	return {
		publicPem: derToPem(new Uint8Array(spki), 'PUBLIC KEY'),
		privatePem: derToPem(new Uint8Array(pkcs8), 'PRIVATE KEY'),
	};
};
