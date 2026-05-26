/**
 * TLS handshake inspector service.
 *
 * Bridges the `tls_inspect` Tauri command and decodes the returned
 * certificate chain via the in-browser X.509 parser. The handshake itself
 * runs in the Rust backend with a permissive verifier so expired,
 * self-signed, and otherwise broken chains can still be inspected.
 */
import { invoke } from '@tauri-apps/api/core';

import { parseCertificates, type ParseResult } from '@/lib/services/x509';

export interface TlsInspectRequest {
	readonly host: string;
	readonly port: number;
	readonly sni?: string;
	readonly timeoutMs: number;
}

export interface TlsInspectResult {
	readonly host: string;
	readonly port: number;
	readonly sni: string;
	readonly negotiatedVersion: string;
	readonly cipherSuite: string;
	readonly alpn: string | null;
	readonly peerChainBase64: readonly string[];
	readonly elapsedMs: number;
}

export const SAMPLE_HOST = 'example.com';
export const SAMPLE_PORT = 443;
export const EXPIRED_SAMPLE_HOST = 'expired.badssl.com';
export const SELF_SIGNED_SAMPLE_HOST = 'self-signed.badssl.com';

export const PORT_PRESETS: readonly number[] = [443, 8443, 465, 993];

export const TIMEOUT_MIN_MS = 1000;
export const TIMEOUT_MAX_MS = 30000;
export const TIMEOUT_STEP_MS = 500;
export const TIMEOUT_DEFAULT_MS = 5000;

/**
 * Invoke the Rust backend to perform a TLS handshake against `host:port`.
 */
export const inspectTls = (req: TlsInspectRequest): Promise<TlsInspectResult> =>
	invoke<TlsInspectResult>('tls_inspect', { req });

/**
 * Wrap a single base64 DER blob in a PEM `CERTIFICATE` envelope with 64-column
 * line wrapping per RFC 7468.
 */
const wrapAsPem = (base64Der: string): string => {
	const wrapped = base64Der.match(/.{1,64}/g)?.join('\n') ?? base64Der;
	return `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----`;
};

/**
 * Wrap each base64 DER blob in a PEM envelope and concatenate the results
 * into a single chain bundle (leaf first).
 */
export const buildPemBundle = (base64Chain: readonly string[]): string =>
	base64Chain.map(wrapAsPem).join('\n');

/**
 * Build the PEM representation of a single certificate from its base64 DER blob.
 */
export const buildPemFromBase64 = (base64Der: string): string => wrapAsPem(base64Der);

/**
 * Decode every entry of `base64Chain` via the X.509 parser used elsewhere in
 * the app. The returned `ParseResult` keeps any per-entry parse errors so the
 * UI can flag them without aborting the whole chain.
 */
export const decodeChain = (base64Chain: readonly string[]): Promise<ParseResult> =>
	parseCertificates(buildPemBundle(base64Chain));
