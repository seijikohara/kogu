/**
 * X.509 certificate parsing service.
 *
 * Wraps `@peculiar/x509` (ASN.1 + X.509 v3 parsing) and the Web Crypto API
 * (SHA-256 / SHA-1 digests) plus `js-md5` (MD5 digest, not exposed via
 * `crypto.subtle`) to produce a fully structured representation of one or
 * more pasted certificates. All parsing happens client-side; the service
 * never performs network I/O.
 */

import {
	AuthorityInfoAccessExtension,
	AuthorityKeyIdentifierExtension,
	BasicConstraintsExtension,
	CRLDistributionPointsExtension,
	cryptoProvider,
	ExtendedKeyUsageExtension,
	KeyUsageFlags,
	KeyUsagesExtension,
	PemConverter,
	SubjectAlternativeNameExtension,
	SubjectKeyIdentifierExtension,
	X509Certificate,
} from '@peculiar/x509';
import type { GeneralName } from '@peculiar/x509';
import { md5 } from 'js-md5';

import { getErrorMessage } from '@/lib/utils';

// Register the platform Web Crypto so @peculiar/x509 can compute thumbprints
// and digests without an explicit `crypto` argument at every call site.
cryptoProvider.set(crypto);

// Friendly display names for the standard certificate extensions surfaced
// in the UI. Unknown extensions fall back to their OID.
const EXT_NAMES: Readonly<Record<string, string>> = {
	'2.5.29.15': 'Key Usage',
	'2.5.29.37': 'Extended Key Usage',
	'2.5.29.17': 'Subject Alternative Name',
	'2.5.29.18': 'Issuer Alternative Name',
	'2.5.29.19': 'Basic Constraints',
	'2.5.29.14': 'Subject Key Identifier',
	'2.5.29.35': 'Authority Key Identifier',
	'2.5.29.31': 'CRL Distribution Points',
	'2.5.29.32': 'Certificate Policies',
	'1.3.6.1.5.5.7.1.1': 'Authority Information Access',
};

// Human-readable names for the bit positions of the KeyUsage extension.
// Order matches RFC 5280 §4.2.1.3.
const KEY_USAGE_LABELS: readonly { readonly flag: KeyUsageFlags; readonly label: string }[] = [
	{ flag: KeyUsageFlags.digitalSignature, label: 'Digital Signature' },
	{ flag: KeyUsageFlags.nonRepudiation, label: 'Non Repudiation' },
	{ flag: KeyUsageFlags.keyEncipherment, label: 'Key Encipherment' },
	{ flag: KeyUsageFlags.dataEncipherment, label: 'Data Encipherment' },
	{ flag: KeyUsageFlags.keyAgreement, label: 'Key Agreement' },
	{ flag: KeyUsageFlags.keyCertSign, label: 'Certificate Sign' },
	{ flag: KeyUsageFlags.cRLSign, label: 'CRL Sign' },
	{ flag: KeyUsageFlags.encipherOnly, label: 'Encipher Only' },
	{ flag: KeyUsageFlags.decipherOnly, label: 'Decipher Only' },
];

// Common Extended Key Usage OIDs to human-readable purposes. Anything else
// is rendered as its raw OID.
const EXTENDED_KEY_USAGE_NAMES: Readonly<Record<string, string>> = {
	'1.3.6.1.5.5.7.3.1': 'TLS Server Authentication',
	'1.3.6.1.5.5.7.3.2': 'TLS Client Authentication',
	'1.3.6.1.5.5.7.3.3': 'Code Signing',
	'1.3.6.1.5.5.7.3.4': 'Email Protection',
	'1.3.6.1.5.5.7.3.8': 'Time Stamping',
	'1.3.6.1.5.5.7.3.9': 'OCSP Signing',
};

// Short labels for the DN component OIDs the UI surfaces directly. Anything
// else falls back to the raw OID string.
const DN_SHORT_NAMES: Readonly<Record<string, string>> = {
	'2.5.4.3': 'CN',
	'2.5.4.6': 'C',
	'2.5.4.7': 'L',
	'2.5.4.8': 'ST',
	'2.5.4.10': 'O',
	'2.5.4.11': 'OU',
	'2.5.4.5': 'serialNumber',
	'1.2.840.113549.1.9.1': 'emailAddress',
	'0.9.2342.19200300.100.1.25': 'DC',
	'2.5.4.4': 'SN',
	'2.5.4.42': 'GN',
	'2.5.4.12': 'title',
};

export type CertInputFormat = 'pem' | 'base64' | 'der';

export interface DnComponent {
	readonly oid: string;
	readonly shortName: string;
	readonly value: string;
}

export interface DistinguishedName {
	readonly raw: string;
	readonly components: readonly DnComponent[];
}

export type SanType = 'dns' | 'ip' | 'uri' | 'email' | 'dirName' | 'other';

export interface SanEntry {
	readonly type: SanType;
	readonly value: string;
}

export interface PublicKeyInfo {
	readonly algorithm: string;
	readonly bitLength?: number;
	readonly curve?: string;
	readonly modulusPreview?: string;
	readonly exponent?: string;
	readonly raw: string;
}

export interface KeyUsageExt {
	readonly kind: 'keyUsage';
	readonly usages: readonly string[];
}

export interface ExtendedKeyUsageExt {
	readonly kind: 'extendedKeyUsage';
	readonly purposes: readonly { readonly oid: string; readonly name: string }[];
}

export interface BasicConstraintsExt {
	readonly kind: 'basicConstraints';
	readonly ca: boolean;
	readonly pathLenConstraint?: number;
}

export interface SubjectAltNameExt {
	readonly kind: 'subjectAltName';
	readonly entries: readonly SanEntry[];
}

export interface CrlDistributionExt {
	readonly kind: 'crlDistributionPoints';
	readonly urls: readonly string[];
}

export interface AuthorityInfoAccessExt {
	readonly kind: 'authorityInfoAccess';
	readonly ocspUrls: readonly string[];
	readonly caIssuerUrls: readonly string[];
}

export interface SubjectKeyIdExt {
	readonly kind: 'subjectKeyId';
	readonly keyId: string;
}

export interface AuthorityKeyIdExt {
	readonly kind: 'authorityKeyId';
	readonly keyId?: string;
	readonly issuerSerial?: string;
}

export interface RawExt {
	readonly kind: 'raw';
	readonly value: string;
}

export type ParsedExtensionData =
	| KeyUsageExt
	| ExtendedKeyUsageExt
	| BasicConstraintsExt
	| SubjectAltNameExt
	| CrlDistributionExt
	| AuthorityInfoAccessExt
	| SubjectKeyIdExt
	| AuthorityKeyIdExt
	| RawExt;

export interface ParsedExtension {
	readonly oid: string;
	readonly name: string;
	readonly critical: boolean;
	readonly parsed: ParsedExtensionData;
}

export interface Fingerprints {
	readonly sha256: string;
	readonly sha1: string;
	readonly md5: string;
}

export interface ParsedCertificate {
	readonly version: number;
	readonly serialNumber: string;
	readonly signatureAlgorithm: string;
	readonly subject: DistinguishedName;
	readonly issuer: DistinguishedName;
	readonly notBefore: Date;
	readonly notAfter: Date;
	readonly publicKey: PublicKeyInfo;
	readonly subjectAlternativeNames: readonly SanEntry[];
	readonly extensions: readonly ParsedExtension[];
	readonly fingerprints: Fingerprints;
	readonly pem: string;
	readonly derBase64: string;
	readonly selfSigned: boolean;
}

export interface ParseError {
	readonly index: number;
	readonly message: string;
}

export interface ParseResult {
	readonly certificates: readonly ParsedCertificate[];
	readonly errors: readonly ParseError[];
}

// Format DER bytes as colon-separated uppercase hex (e.g. `AB:CD:EF`).
const bytesToColonHex = (bytes: Uint8Array): string =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');

// Format bytes as space-separated lowercase hex with no separators in the
// preview; used for the modulus snippet.
const bytesToSpacedHex = (bytes: Uint8Array): string =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');

const hexStringToBytes = (hex: string): Uint8Array => {
	const clean = hex.replace(/[^0-9a-fA-F]/g, '');
	const out = new Uint8Array(Math.floor(clean.length / 2));
	for (let i = 0; i < out.length; i += 1) {
		out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
};

const arrayBufferToUint8 = (buffer: ArrayBuffer): Uint8Array => new Uint8Array(buffer);

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
	const bytes = arrayBufferToUint8(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i] ?? 0);
	}
	return btoa(binary);
};

const base64ToBytes = (input: string): Uint8Array => {
	const cleaned = input.replace(/\s+/g, '');
	const binary = atob(cleaned);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
};

// Detect a PEM blob without committing to a specific tag (CERTIFICATE,
// TRUSTED CERTIFICATE, etc.).
const looksLikePem = (text: string): boolean => /-----BEGIN [^-]+-----/.test(text);

// Extract individual PEM blocks from a multi-cert bundle. Falls back to a
// single-entry array when only one BEGIN marker is present.
const splitPemBlocks = (pem: string): readonly string[] => {
	const matches = pem.match(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g);
	return matches ?? [];
};

// Re-pack a Uint8Array onto a fresh ArrayBuffer so the resulting view
// satisfies `BufferSource` even when the source is `Uint8Array<ArrayBufferLike>`
// (TypeScript 7's stricter generic on TypedArray surfaces this distinction).
const toArrayBufferView = (bytes: Uint8Array): ArrayBuffer => {
	const out = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(out).set(bytes);
	return out;
};

const computeDigest = async (
	algorithm: 'SHA-256' | 'SHA-1',
	bytes: Uint8Array
): Promise<string> => {
	const buf = await crypto.subtle.digest(algorithm, toArrayBufferView(bytes));
	return bytesToColonHex(arrayBufferToUint8(buf));
};

const computeMd5 = (bytes: Uint8Array): string => {
	const hex = md5(bytes);
	const upper = hex.toUpperCase();
	return upper.match(/.{2}/g)?.join(':') ?? upper;
};

const computeFingerprints = async (derBytes: Uint8Array): Promise<Fingerprints> => {
	const [sha256, sha1] = await Promise.all([
		computeDigest('SHA-256', derBytes),
		computeDigest('SHA-1', derBytes),
	]);
	return { sha256, sha1, md5: computeMd5(derBytes) };
};

const parseDistinguishedName = (raw: string): DistinguishedName => {
	// `@peculiar/x509` returns the DN as a string `CN=foo, O=bar, C=US`. Split
	// on commas that are not preceded by an escape, then on `=` keeping the
	// first occurrence so values with `=` survive.
	const parts = raw.split(/,(?![^"]*"(?:(?:[^"]*"){2})*[^"]*$)/).map((p) => p.trim());
	const components = parts
		.map((part): DnComponent | null => {
			const eq = part.indexOf('=');
			if (eq <= 0) return null;
			const rawKey = part.slice(0, eq).trim();
			const value = part.slice(eq + 1).trim();
			// Keys can arrive as either OIDs (`2.5.4.3`) or shortnames (`CN`).
			const oid = /^[0-9.]+$/.test(rawKey)
				? rawKey
				: (Object.entries(DN_SHORT_NAMES).find(([, short]) => short === rawKey)?.[0] ?? rawKey);
			const shortName = DN_SHORT_NAMES[oid] ?? rawKey;
			return { oid, shortName, value };
		})
		.filter((c): c is DnComponent => c !== null);
	return { raw, components };
};

const mapGeneralNameType = (name: GeneralName): SanType => {
	switch (name.type) {
		case 'dns':
			return 'dns';
		case 'ip':
			return 'ip';
		case 'url':
			return 'uri';
		case 'email':
			return 'email';
		case 'dn':
			return 'dirName';
		default:
			return 'other';
	}
};

const extractSubjectAltNames = (cert: X509Certificate): readonly SanEntry[] => {
	const ext = cert.getExtension(SubjectAlternativeNameExtension);
	if (!ext) return [];
	return ext.names.items.map((n) => ({ type: mapGeneralNameType(n), value: n.value }));
};

const decodePublicKey = async (cert: X509Certificate): Promise<PublicKeyInfo> => {
	const pk = cert.publicKey;
	const raw = pk.rawData;
	const rawB64 = arrayBufferToBase64(raw);
	const algorithm = pk.algorithm.name;
	const rsa = pk.algorithm as RsaHashedKeyGenParams & { modulusLength?: number };
	const ec = pk.algorithm as EcKeyAlgorithm & { namedCurve?: string };

	// Try Web Crypto import to extract modulus / exponent details. We only
	// care about the algorithm metadata, so importKey failure falls back to
	// the algorithm name from the SPKI.
	const bitLength = typeof rsa.modulusLength === 'number' ? rsa.modulusLength : undefined;
	const curve = typeof ec.namedCurve === 'string' ? ec.namedCurve : undefined;

	if (algorithm.toLowerCase().includes('rsa')) {
		try {
			const cryptoKey = await pk.export(
				{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
				['verify'],
				crypto
			);
			const jwk = await crypto.subtle.exportKey('jwk', cryptoKey);
			const modulusB64 = jwk.n ?? '';
			const exponentB64 = jwk.e ?? '';
			const modulusBytes = base64UrlToBytes(modulusB64);
			const exponentBytes = base64UrlToBytes(exponentB64);
			const previewBytes = modulusBytes.slice(0, 16);
			const exponent =
				exponentBytes.length > 0
					? `0x${Array.from(exponentBytes, (b) => b.toString(16)).join('')}`
					: undefined;
			return {
				algorithm: 'RSA',
				bitLength: bitLength ?? modulusBytes.length * 8,
				modulusPreview: `${bytesToSpacedHex(previewBytes)} ...`,
				exponent,
				raw: rawB64,
			};
		} catch {
			return { algorithm: 'RSA', bitLength, raw: rawB64 };
		}
	}

	if (algorithm.toLowerCase().includes('ec')) {
		return { algorithm: 'EC', curve, raw: rawB64 };
	}

	return { algorithm, bitLength, curve, raw: rawB64 };
};

const base64UrlToBytes = (input: string): Uint8Array => {
	const padded = input.replace(/-/g, '+').replace(/_/g, '/');
	const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
	return base64ToBytes(padded + padding);
};

const parseKeyUsage = (cert: X509Certificate): ParsedExtensionData => {
	const ext = cert.getExtension(KeyUsagesExtension);
	const usages = ext
		? KEY_USAGE_LABELS.filter((info) => (ext.usages & info.flag) === info.flag).map(
				(info) => info.label
			)
		: [];
	return { kind: 'keyUsage', usages };
};

const parseExtendedKeyUsage = (cert: X509Certificate): ParsedExtensionData => {
	const ext = cert.getExtension(ExtendedKeyUsageExtension);
	const purposes = ext
		? ext.usages.map((u) => {
				const oidString = String(u);
				return { oid: oidString, name: EXTENDED_KEY_USAGE_NAMES[oidString] ?? oidString };
			})
		: [];
	return { kind: 'extendedKeyUsage', purposes };
};

const parseBasicConstraints = (cert: X509Certificate): ParsedExtensionData => {
	const ext = cert.getExtension(BasicConstraintsExtension);
	return {
		kind: 'basicConstraints',
		ca: ext?.ca ?? false,
		pathLenConstraint: ext?.pathLength,
	};
};

const parseSubjectAltName = (cert: X509Certificate): ParsedExtensionData => {
	const ext = cert.getExtension(SubjectAlternativeNameExtension);
	const entries = ext
		? ext.names.items.map((n) => ({ type: mapGeneralNameType(n), value: n.value }))
		: [];
	return { kind: 'subjectAltName', entries };
};

const parseSubjectKeyId = (cert: X509Certificate): ParsedExtensionData => {
	const ext = cert.getExtension(SubjectKeyIdentifierExtension);
	return { kind: 'subjectKeyId', keyId: ext?.keyId ?? '' };
};

const parseAuthorityKeyId = (cert: X509Certificate): ParsedExtensionData => {
	const ext = cert.getExtension(AuthorityKeyIdentifierExtension);
	return {
		kind: 'authorityKeyId',
		keyId: ext?.keyId,
		issuerSerial: ext?.certId?.serialNumber,
	};
};

const parseCrlDistribution = (cert: X509Certificate): ParsedExtensionData => {
	const ext = cert.getExtension(CRLDistributionPointsExtension);
	const urls = ext
		? ext.distributionPoints
				.flatMap((dp) => dp.distributionPoint?.fullName ?? [])
				.flatMap((gn) => {
					const url = gn.uniformResourceIdentifier;
					return typeof url === 'string' ? [url] : [];
				})
		: [];
	return { kind: 'crlDistributionPoints', urls };
};

const parseAuthorityInfo = (cert: X509Certificate): ParsedExtensionData => {
	const ext = cert.getExtension(AuthorityInfoAccessExtension);
	const ocspUrls = ext ? ext.ocsp.map((g) => g.value) : [];
	const caIssuerUrls = ext ? ext.caIssuers.map((g) => g.value) : [];
	return { kind: 'authorityInfoAccess', ocspUrls, caIssuerUrls };
};

// Dispatch table mapping standard extension OIDs to dedicated decoders.
// Unknown OIDs fall through to the raw-bytes preview.
const EXTENSION_DECODERS: Readonly<Record<string, (cert: X509Certificate) => ParsedExtensionData>> =
	{
		'2.5.29.15': parseKeyUsage,
		'2.5.29.37': parseExtendedKeyUsage,
		'2.5.29.19': parseBasicConstraints,
		'2.5.29.17': parseSubjectAltName,
		'2.5.29.14': parseSubjectKeyId,
		'2.5.29.35': parseAuthorityKeyId,
		'2.5.29.31': parseCrlDistribution,
		'1.3.6.1.5.5.7.1.1': parseAuthorityInfo,
	};

const parseExtension = (cert: X509Certificate, oid: string): ParsedExtension => {
	const name = EXT_NAMES[oid] ?? oid;
	const rawExt = cert.extensions.find((e) => e.type === oid);
	const critical = rawExt?.critical ?? false;
	const decoder = EXTENSION_DECODERS[oid];
	if (decoder) {
		return { oid, name, critical, parsed: decoder(cert) };
	}
	return {
		oid,
		name,
		critical,
		parsed: {
			kind: 'raw',
			value: rawExt
				? bytesToColonHex(arrayBufferToUint8(rawExt.value)).slice(0, 96)
				: '(no payload)',
		},
	};
};

const buildParsedCertificate = async (derBytes: Uint8Array): Promise<ParsedCertificate> => {
	const cert = new X509Certificate(toArrayBufferView(derBytes));
	const subject = parseDistinguishedName(cert.subject);
	const issuer = parseDistinguishedName(cert.issuer);
	const publicKey = await decodePublicKey(cert);
	const fingerprints = await computeFingerprints(derBytes);
	const subjectAlternativeNames = extractSubjectAltNames(cert);
	const extensions = cert.extensions.map((e) => parseExtension(cert, e.type));
	const serialNumber = cert.serialNumber.replace(/(.{2})(?=.)/g, '$1:').toUpperCase();
	let selfSigned = false;
	try {
		selfSigned = await cert.isSelfSigned();
	} catch {
		selfSigned = subject.raw === issuer.raw;
	}

	return {
		// `@peculiar/x509` exposes the certificate version implicitly through
		// the underlying ASN. For X.509 v3 (the only version this tool targets)
		// the version field is always 3 when extensions are present, so we
		// derive it from extension presence.
		version: extensions.length > 0 ? 3 : 1,
		serialNumber,
		signatureAlgorithm: cert.signatureAlgorithm.name,
		subject,
		issuer,
		notBefore: cert.notBefore,
		notAfter: cert.notAfter,
		publicKey,
		subjectAlternativeNames,
		extensions,
		fingerprints,
		pem: cert.toString('pem'),
		derBase64: arrayBufferToBase64(cert.rawData),
		selfSigned,
	};
};

// Determine input format and decode to a list of DER byte arrays. PEM input
// may contain several blocks; binary / base64 input is always a single
// certificate.
const decodeInput = (input: string | Uint8Array): readonly Uint8Array[] => {
	if (input instanceof Uint8Array) return [input];

	const trimmed = input.trim();
	if (trimmed.length === 0) return [];

	if (looksLikePem(trimmed)) {
		const blocks = splitPemBlocks(trimmed);
		const buffers = blocks.flatMap((block) => {
			try {
				return [arrayBufferToUint8(PemConverter.decodeFirst(block))];
			} catch {
				return [];
			}
		});
		if (buffers.length > 0) return buffers;
	}

	// Treat as raw base64 (no headers) — strip whitespace and decode.
	if (/^[A-Za-z0-9+/=\s-]+$/.test(trimmed)) {
		try {
			const noWhitespace = trimmed.replace(/\s+/g, '');
			// Some sources paste base64url; normalise.
			const normalised = noWhitespace.replace(/-/g, '+').replace(/_/g, '/');
			return [base64ToBytes(normalised)];
		} catch {
			// fall through
		}
	}

	// Treat as space- or colon-delimited hex (rare but cheap to support).
	if (/^[0-9a-fA-F:\s]+$/.test(trimmed)) {
		try {
			return [hexStringToBytes(trimmed)];
		} catch {
			// fall through
		}
	}

	throw new Error('Input is not PEM, base64, or hex DER.');
};

/**
 * Parse one or more certificates from a string (PEM / base64 / hex) or a
 * raw DER byte array. Per-certificate parse errors are returned alongside
 * any successfully-parsed certificates rather than thrown.
 */
export const parseCertificates = async (input: string | Uint8Array): Promise<ParseResult> => {
	const certificates: ParsedCertificate[] = [];
	const errors: ParseError[] = [];

	let buffers: readonly Uint8Array[];
	try {
		buffers = decodeInput(input);
	} catch (e) {
		return { certificates: [], errors: [{ index: 0, message: getErrorMessage(e) }] };
	}

	for (let i = 0; i < buffers.length; i += 1) {
		const der = buffers[i];
		if (!der) continue;
		try {
			const parsed = await buildParsedCertificate(der);
			certificates.push(parsed);
		} catch (e) {
			errors.push({ index: i, message: getErrorMessage(e) });
		}
	}

	return { certificates, errors };
};

/**
 * Order a flat list of certificates as `[root, intermediates..., leaf]` by
 * walking issuer/subject links. Certificates that cannot be linked into any
 * chain are returned as orphans so the UI can still display them.
 */
export const buildChain = (
	certs: readonly ParsedCertificate[]
): {
	readonly chain: readonly ParsedCertificate[];
	readonly orphans: readonly ParsedCertificate[];
} => {
	if (certs.length === 0) return { chain: [], orphans: [] };
	if (certs.length === 1) {
		const only = certs[0];
		if (!only) return { chain: [], orphans: [] };
		return { chain: [only], orphans: [] };
	}

	// Leaf: a cert whose subject is not the issuer of any other cert.
	const subjects = new Set(certs.map((c) => c.subject.raw));
	const issuers = new Set(certs.map((c) => c.issuer.raw));
	const leaf = certs.find((c) => !issuers.has(c.subject.raw));

	if (!leaf) {
		// Cannot determine a leaf — treat the whole list as orphans so the UI
		// still renders each certificate card.
		return { chain: [], orphans: certs };
	}

	const chain: ParsedCertificate[] = [leaf];
	const used = new Set<ParsedCertificate>([leaf]);
	let current = leaf;
	while (current.issuer.raw !== current.subject.raw) {
		const next = certs.find((c) => c.subject.raw === current.issuer.raw && !used.has(c));
		if (!next) break;
		chain.unshift(next);
		used.add(next);
		current = next;
	}

	const orphans = certs.filter((c) => !used.has(c) && subjects.has(c.subject.raw));
	return { chain, orphans };
};

export const isExpired = (cert: ParsedCertificate, now: Date = new Date()): boolean =>
	now.getTime() > cert.notAfter.getTime();

export const isNotYetValid = (cert: ParsedCertificate, now: Date = new Date()): boolean =>
	now.getTime() < cert.notBefore.getTime();

export const daysUntilExpiry = (cert: ParsedCertificate, now: Date = new Date()): number => {
	const msPerDay = 1000 * 60 * 60 * 24;
	const diff = cert.notAfter.getTime() - now.getTime();
	return Math.floor(diff / msPerDay);
};

export const daysSinceStart = (cert: ParsedCertificate, now: Date = new Date()): number => {
	const msPerDay = 1000 * 60 * 60 * 24;
	const diff = now.getTime() - cert.notBefore.getTime();
	return Math.floor(diff / msPerDay);
};

// Extract a friendly subject label for cards/timelines: prefer CN, then O,
// then the full raw DN.
export const getSubjectLabel = (cert: ParsedCertificate): string => {
	const cn = cert.subject.components.find((c) => c.shortName === 'CN')?.value;
	if (cn) return cn;
	const o = cert.subject.components.find((c) => c.shortName === 'O')?.value;
	if (o) return o;
	return cert.subject.raw;
};
