/**
 * Pure helpers for the IPv4 / IPv6 Address Converter route.
 *
 * Handles every well-known cross-family encoding:
 *   - IPv4-mapped IPv6 (`::ffff:a.b.c.d`)
 *   - IPv4-compatible IPv6 (`::a.b.c.d`, deprecated by RFC 4291)
 *   - 6to4 prefix (`2002::/16`, RFC 3056)
 *   - Teredo (`2001::/32`, RFC 4380)
 *   - ISATAP (`::5efe:a.b.c.d` in the low 64 bits, RFC 5214)
 *
 * Reuses the canonical parse / format helpers from `./cidr` so this module
 * does not re-implement RFC 5952 compression.
 */

import { formatIp, type IpFamily, parseIp as parseIpCidr } from './cidr';

export type { IpFamily };

const ZERO = 0n;
const ONE = 1n;
const U32_MASK = (ONE << 32n) - ONE;
const U16_MASK = 0xffffn;
const U128_MASK = (ONE << 128n) - ONE;

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

export interface ParsedAddress {
	readonly family: IpFamily;
	readonly value: bigint;
}

export type ParseError = { readonly ok: false; readonly error: string };
export type ParseResult = { readonly ok: true; readonly parsed: ParsedAddress } | ParseError;

export const parseIp = (text: string): ParseResult => {
	const trimmed = text.trim();
	if (trimmed.length === 0) {
		return { ok: false, error: 'Enter an IPv4 or IPv6 address.' };
	}
	if (trimmed.includes('/')) {
		return {
			ok: false,
			error: 'Plain address only — remove the CIDR prefix (use the CIDR Calculator for prefixes).',
		};
	}
	const ip = parseIpCidr(trimmed);
	if (ip === null) {
		return {
			ok: false,
			error: `Invalid IP address: "${trimmed}". Expected dotted-quad IPv4 or colon-separated IPv6.`,
		};
	}
	return { ok: true, parsed: { family: ip.family, value: ip.value } };
};

/* -------------------------------------------------------------------------- */
/* IPv6 notation normalizer                                                   */
/* -------------------------------------------------------------------------- */

export interface NormalizedIpv6 {
	readonly compressed: string;
	readonly expanded: string;
	readonly mixed: string;
}

const formatIpv6Expanded = (value: bigint): string => {
	const masked = value & U128_MASK;
	const groups: string[] = [];
	for (let i = 7; i >= 0; i -= 1) {
		const shift = BigInt(i) * 16n;
		const group = Number((masked >> shift) & U16_MASK);
		groups.push(group.toString(16).padStart(4, '0'));
	}
	return groups.join(':');
};

const formatIpv6Mixed = (value: bigint): string => {
	const masked = value & U128_MASK;
	// Use mixed form only when the address looks like it embeds an IPv4 tail:
	// the top 96 bits match either ::ffff:0:0/96 (mapped) or all zeros
	// (compatible / unspecified). For everything else, fall back to the canonical
	// compressed form so we never emit ambiguous mixed-notation hextets.
	const top96 = masked >> 32n;
	const v4Tail = masked & U32_MASK;
	const ipv4Text = formatIp(v4Tail, 'ipv4');
	if (top96 === 0xffffn) {
		return `::ffff:${ipv4Text}`;
	}
	if (top96 === ZERO && v4Tail !== ZERO) {
		return `::${ipv4Text}`;
	}
	return formatIp(value, 'ipv6');
};

export const normalizeIpv6 = (value: bigint): NormalizedIpv6 => ({
	compressed: formatIp(value, 'ipv6'),
	expanded: formatIpv6Expanded(value),
	mixed: formatIpv6Mixed(value),
});

/* -------------------------------------------------------------------------- */
/* Embedding detector                                                         */
/* -------------------------------------------------------------------------- */

export type EmbeddingKind =
	| 'ipv4-mapped'
	| 'ipv4-compatible'
	| '6to4'
	| 'teredo'
	| 'isatap'
	| 'none';

export interface TeredoFlags {
	readonly cone: boolean;
	readonly reserved: number;
	readonly individual: boolean;
}

export interface EmbeddingInfo {
	readonly kind: EmbeddingKind;
	readonly description: string;
	readonly embeddedIpv4?: string;
	readonly teredoServer?: string;
	readonly teredoMappedAddress?: string;
	readonly teredoMappedPort?: number;
	readonly teredoFlags?: TeredoFlags;
}

const slice = (value: bigint, hiBit: number, width: number): bigint => {
	// Extract `width` bits starting at the most significant bit `hiBit` from a
	// 128-bit value where bit 0 is the most significant bit.
	const lsbIndex = 128 - hiBit - width;
	const mask = (ONE << BigInt(width)) - ONE;
	return (value >> BigInt(lsbIndex)) & mask;
};

const detectIsatap = (value: bigint): EmbeddingInfo | null => {
	// ISATAP places `5efe` at hextet 5 (bits 80-95) within the EUI-64 host
	// portion, with hextet 4 (bits 64-79) being either 0000 (private) or 0200
	// (global, after the universal/local bit flip on 0000).
	const hextet4 = Number(slice(value, 64, 16));
	const hextet5 = Number(slice(value, 80, 16));
	if (hextet5 !== 0x5efe) return null;
	if (hextet4 !== 0x0000 && hextet4 !== 0x0200) return null;
	const v4 = slice(value, 96, 32);
	return {
		kind: 'isatap',
		description: 'ISATAP interface identifier (RFC 5214): low 32 bits encode an IPv4 address.',
		embeddedIpv4: formatIp(v4, 'ipv4'),
	};
};

export const detectEmbedding = (value: bigint): EmbeddingInfo => {
	const masked = value & U128_MASK;
	const top80 = masked >> 48n;
	const wordAt80 = Number(slice(masked, 80, 16));
	const top96 = masked >> 32n;
	const v4Tail = masked & U32_MASK;

	if (top80 === ZERO && wordAt80 === 0xffff) {
		return {
			kind: 'ipv4-mapped',
			description: 'IPv4-mapped IPv6 (::ffff:0:0/96, RFC 4291): low 32 bits hold an IPv4 address.',
			embeddedIpv4: formatIp(v4Tail, 'ipv4'),
		};
	}

	if (top96 === ZERO && v4Tail !== ZERO && v4Tail !== ONE) {
		return {
			kind: 'ipv4-compatible',
			description:
				'IPv4-compatible IPv6 (::/96, deprecated by RFC 4291): low 32 bits encode an IPv4 address.',
			embeddedIpv4: formatIp(v4Tail, 'ipv4'),
		};
	}

	const top16 = Number(slice(masked, 0, 16));
	if (top16 === 0x2002) {
		const v4 = slice(masked, 16, 32);
		return {
			kind: '6to4',
			description:
				'6to4 tunneling (2002::/16, RFC 3056): bits 16-47 hold the gateway IPv4 address.',
			embeddedIpv4: formatIp(v4, 'ipv4'),
		};
	}

	const top32 = masked >> 96n;
	if (top32 === 0x20010000n) {
		const serverRaw = slice(masked, 32, 32);
		const flagsRaw = Number(slice(masked, 64, 16));
		const portRaw = Number(slice(masked, 80, 16));
		const clientRaw = slice(masked, 96, 32);
		// Per RFC 4380, the mapped port and client IPv4 are XOR-obfuscated with
		// all-ones to keep them out of NAT rewrite paths.
		const port = portRaw ^ 0xffff;
		const client = clientRaw ^ U32_MASK;
		const cone = (flagsRaw & 0x8000) !== 0;
		const individual = (flagsRaw & 0x0100) === 0;
		const reserved = flagsRaw & 0x7eff;
		return {
			kind: 'teredo',
			description:
				'Teredo tunneling (2001::/32, RFC 4380): decomposed into server, flags, mapped port, and mapped client.',
			teredoServer: formatIp(serverRaw, 'ipv4'),
			teredoMappedAddress: formatIp(client, 'ipv4'),
			teredoMappedPort: port,
			teredoFlags: { cone, reserved, individual },
		};
	}

	const isatap = detectIsatap(masked);
	if (isatap !== null) return isatap;

	return {
		kind: 'none',
		description: 'No known IPv4 embedding detected; this is a plain IPv6 address.',
	};
};

/* -------------------------------------------------------------------------- */
/* IPv4 -> derived representations                                            */
/* -------------------------------------------------------------------------- */

export interface ConvertedFromIpv4 {
	readonly ipv4: string;
	readonly mapped: string;
	readonly compatible: string;
	readonly sixToFour: string;
	readonly sixToFourFull: string;
	readonly decimalInteger: bigint;
	readonly hexInteger: string;
	readonly binary: string;
}

const formatBinaryV4 = (value: bigint): string => {
	const bits = (value & U32_MASK).toString(2).padStart(32, '0');
	return [bits.slice(0, 8), bits.slice(8, 16), bits.slice(16, 24), bits.slice(24, 32)].join('.');
};

export const convertFromIpv4 = (value: bigint): ConvertedFromIpv4 => {
	const masked = value & U32_MASK;
	const ipv4 = formatIp(masked, 'ipv4');
	// Build the 6to4 prefix by placing the 32-bit IPv4 at hextets 1-2 of a
	// 2002::/16 base, then re-format through the canonical IPv6 formatter so
	// we always emit RFC 5952 compression.
	const sixToFourBase = (0x2002n << 112n) | (masked << 80n);
	const sixToFourPrefix = formatIp(sixToFourBase & U128_MASK, 'ipv6');
	const sixToFourHost = formatIp((sixToFourBase | ONE) & U128_MASK, 'ipv6');
	return {
		ipv4,
		mapped: `::ffff:${ipv4}`,
		compatible: `::${ipv4}`,
		sixToFour: `${sixToFourPrefix}/48`,
		sixToFourFull: `${sixToFourHost}/64`,
		decimalInteger: masked,
		hexInteger: `0x${masked.toString(16).padStart(8, '0').toUpperCase()}`,
		binary: formatBinaryV4(masked),
	};
};

/* -------------------------------------------------------------------------- */
/* IPv6 -> derived representations                                            */
/* -------------------------------------------------------------------------- */

export interface ConvertedFromIpv6 {
	readonly ipv6: NormalizedIpv6;
	readonly embedding: EmbeddingInfo;
	readonly decimalInteger: bigint;
	readonly hexInteger: string;
}

export const convertFromIpv6 = (value: bigint): ConvertedFromIpv6 => {
	const masked = value & U128_MASK;
	return {
		ipv6: normalizeIpv6(masked),
		embedding: detectEmbedding(masked),
		decimalInteger: masked,
		hexInteger: `0x${masked.toString(16).padStart(32, '0').toUpperCase()}`,
	};
};

/* -------------------------------------------------------------------------- */
/* Bit visualization                                                          */
/* -------------------------------------------------------------------------- */

export interface BitCell {
	readonly value: 0 | 1;
	readonly field?: string;
	readonly fieldColor?: string;
}

// Field color tokens — each maps to a semantic palette in app.css. Bound here
// so callers can render a legend that stays in sync with the bitmap.
export const BIT_FIELD_COLORS = {
	prefix: 'bg-info/60',
	server: 'bg-warning/60',
	flags: 'bg-muted-foreground/50',
	port: 'bg-success/60',
	client: 'bg-primary/60',
	ipv4: 'bg-primary/60',
	host: 'bg-muted-foreground/30',
	zero: 'bg-muted-foreground/20',
} as const;

type FieldKey = keyof typeof BIT_FIELD_COLORS;

interface FieldSpan {
	readonly start: number;
	readonly width: number;
	readonly field: FieldKey;
	readonly label: string;
}

const fieldSpansFor = (family: IpFamily, embedding: EmbeddingInfo | undefined): FieldSpan[] => {
	if (family === 'ipv4') {
		return [{ start: 0, width: 32, field: 'ipv4', label: 'IPv4 address' }];
	}
	if (!embedding || embedding.kind === 'none') {
		return [{ start: 0, width: 128, field: 'host', label: 'IPv6 address' }];
	}
	if (embedding.kind === 'ipv4-mapped') {
		return [
			{ start: 0, width: 80, field: 'zero', label: 'Zeros (80 bits)' },
			{ start: 80, width: 16, field: 'prefix', label: 'IPv4-mapped marker (0xffff)' },
			{ start: 96, width: 32, field: 'ipv4', label: 'Embedded IPv4' },
		];
	}
	if (embedding.kind === 'ipv4-compatible') {
		return [
			{ start: 0, width: 96, field: 'zero', label: 'Zeros (96 bits)' },
			{ start: 96, width: 32, field: 'ipv4', label: 'Embedded IPv4 (deprecated)' },
		];
	}
	if (embedding.kind === '6to4') {
		return [
			{ start: 0, width: 16, field: 'prefix', label: '6to4 prefix (0x2002)' },
			{ start: 16, width: 32, field: 'ipv4', label: 'Gateway IPv4' },
			{ start: 48, width: 16, field: 'flags', label: 'Subnet ID' },
			{ start: 64, width: 64, field: 'host', label: 'Interface identifier' },
		];
	}
	if (embedding.kind === 'teredo') {
		return [
			{ start: 0, width: 32, field: 'prefix', label: 'Teredo prefix (2001::/32)' },
			{ start: 32, width: 32, field: 'server', label: 'Server IPv4' },
			{ start: 64, width: 16, field: 'flags', label: 'Flags' },
			{ start: 80, width: 16, field: 'port', label: 'Obfuscated mapped port' },
			{ start: 96, width: 32, field: 'client', label: 'Obfuscated mapped client IPv4' },
		];
	}
	// isatap
	return [
		{ start: 0, width: 64, field: 'host', label: 'IPv6 routing prefix + subnet' },
		{ start: 64, width: 16, field: 'flags', label: 'Universal/local + group bits' },
		{ start: 80, width: 16, field: 'prefix', label: 'ISATAP marker (0x5efe)' },
		{ start: 96, width: 32, field: 'ipv4', label: 'Embedded IPv4' },
	];
};

export const bitsFor = (
	value: bigint,
	family: IpFamily,
	embedding?: EmbeddingInfo
): readonly BitCell[] => {
	const width = family === 'ipv4' ? 32 : 128;
	const masked = family === 'ipv4' ? value & U32_MASK : value & U128_MASK;
	const spans = fieldSpansFor(family, embedding);
	return Array.from({ length: width }, (_, idx) => {
		const span = spans.find((s) => idx >= s.start && idx < s.start + s.width);
		const shift = BigInt(width - 1 - idx);
		const bit = Number((masked >> shift) & ONE) as 0 | 1;
		const key = (span?.field ?? 'host') as FieldKey;
		return {
			value: bit,
			field: span?.label,
			fieldColor: BIT_FIELD_COLORS[key],
		};
	});
};

/* -------------------------------------------------------------------------- */
/* Samples                                                                    */
/* -------------------------------------------------------------------------- */

export const SAMPLE_V4 = '192.0.2.1';
export const SAMPLE_V6 = '2001:db8::1';
export const SAMPLE_MAPPED = '::ffff:192.0.2.1';
export const SAMPLE_6TO4 = '2002:c000:0201::1';
export const SAMPLE_TEREDO = '2001:0:4136:e378:8000:63bf:3fff:fdd2';
