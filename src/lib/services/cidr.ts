/**
 * Pure helpers for the CIDR / Subnet Calculator route.
 *
 * Supports IPv4 (32-bit) and IPv6 (128-bit) addresses. Every value is a
 * `bigint` so 128-bit math round-trips without precision loss.
 *
 * Formatting follows canonical conventions:
 * - IPv4: dotted decimal, e.g. "192.168.1.1".
 * - IPv6: compressed lowercase per RFC 5952 (longest run of zero groups
 *   becomes "::", no leading zeros in groups).
 */

export type IpFamily = 'ipv4' | 'ipv6';
export type ExportFormat = 'json' | 'csv' | 'shell';

const IPV4_MAX_PREFIX = 32;
const IPV6_MAX_PREFIX = 128;
const ZERO = 0n;
const ONE = 1n;
const IPV4_OCTET_BITS = 8n;
const IPV6_GROUP_BITS = 16n;

export const SAMPLE_V4 = '192.168.1.0/24';
export const SAMPLE_V6 = '2001:db8::/48';

export interface ParsedCidr {
	readonly family: IpFamily;
	readonly address: bigint;
	readonly prefix: number;
	readonly maxPrefix: number;
}

export interface CidrDetails {
	readonly input: string;
	readonly family: IpFamily;
	readonly prefix: number;
	readonly network: bigint;
	readonly broadcast: bigint | null;
	readonly firstHost: bigint;
	readonly lastHost: bigint;
	readonly totalAddresses: bigint;
	readonly usableHosts: bigint;
	readonly mask: bigint;
	readonly wildcardMask: bigint;
	readonly networkText: string;
	readonly broadcastText: string | null;
	readonly firstHostText: string;
	readonly lastHostText: string;
	readonly maskText: string;
	readonly wildcardText: string;
	readonly maskHex: string;
	readonly cidrText: string;
}

export type ReservedRange =
	| 'rfc1918-private'
	| 'rfc6598-cgnat'
	| 'loopback'
	| 'link-local'
	| 'multicast'
	| 'broadcast'
	| 'documentation'
	| 'unspecified'
	| 'reserved'
	| 'ula'
	| 'ipv4-mapped';

export interface ReservedMatch {
	readonly label: ReservedRange;
	readonly description: string;
}

export type ParseResult =
	| {
			readonly ok: true;
			readonly details: CidrDetails;
			readonly reserved: readonly ReservedMatch[];
			readonly parsed: ParsedCidr;
	  }
	| { readonly ok: false; readonly error: string };

export interface ChildSubnet {
	readonly cidr: string;
	readonly first: string;
	readonly last: string;
	readonly count: bigint;
}

/* -------------------------------------------------------------------------- */
/* IPv4 parsing & formatting                                                  */
/* -------------------------------------------------------------------------- */

const parseIpv4 = (text: string): bigint | null => {
	const trimmed = text.trim();
	if (trimmed.length === 0) return null;
	const parts = trimmed.split('.');
	if (parts.length !== 4) return null;
	let value = ZERO;
	for (const part of parts) {
		if (part.length === 0 || part.length > 3) return null;
		if (!/^\d+$/.test(part)) return null;
		// Reject leading zeros except for the digit 0 itself to avoid ambiguity
		// with octal interpretations seen in some parsers.
		if (part.length > 1 && part.startsWith('0')) return null;
		const octet = Number(part);
		if (octet < 0 || octet > 255) return null;
		value = (value << IPV4_OCTET_BITS) | BigInt(octet);
	}
	return value;
};

const formatIpv4 = (value: bigint): string => {
	const masked = value & ((ONE << 32n) - ONE);
	const o1 = Number((masked >> 24n) & 0xffn);
	const o2 = Number((masked >> 16n) & 0xffn);
	const o3 = Number((masked >> 8n) & 0xffn);
	const o4 = Number(masked & 0xffn);
	return `${o1}.${o2}.${o3}.${o4}`;
};

/* -------------------------------------------------------------------------- */
/* IPv6 parsing & formatting (RFC 5952)                                       */
/* -------------------------------------------------------------------------- */

const parseIpv6Group = (group: string): number | null => {
	if (group.length === 0 || group.length > 4) return null;
	if (!/^[0-9a-fA-F]+$/.test(group)) return null;
	return Number.parseInt(group, 16);
};

/**
 * Convert an embedded IPv4 dotted-quad tail into two 16-bit hex groups so the
 * rest of the IPv6 parser only has to deal with hextets.
 */
const normalizeEmbeddedIpv4 = (input: string): string | null => {
	const lastColon = input.lastIndexOf(':');
	if (lastColon < 0 || !input.includes('.', lastColon)) return input;
	const tail = input.slice(lastColon + 1);
	const v4 = parseIpv4(tail);
	if (v4 === null) return null;
	const hi = Number((v4 >> 16n) & 0xffffn);
	const lo = Number(v4 & 0xffffn);
	return `${input.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`;
};

/**
 * Split the input on "::" (if present) and zero-pad to exactly 8 groups.
 */
const expandIpv6Groups = (input: string, hasDoubleColon: boolean): readonly string[] | null => {
	const [head, tail] = hasDoubleColon
		? (input.split('::') as [string, string | undefined])
		: ([input, ''] as const);
	const headGroups = head.length > 0 ? head.split(':') : [];
	const tailGroups = tail && tail.length > 0 ? tail.split(':') : [];
	if (!hasDoubleColon && headGroups.length !== 8) return null;
	if (hasDoubleColon && headGroups.length + tailGroups.length >= 8) return null;
	const fillCount = 8 - headGroups.length - tailGroups.length;
	const all = [...headGroups, ...Array.from({ length: fillCount }, () => '0'), ...tailGroups];
	return all.length === 8 ? all : null;
};

const parseIpv6 = (text: string): bigint | null => {
	const trimmed = text.trim();
	if (trimmed.length === 0) return null;
	const doubleColonCount = (trimmed.match(/::/g) ?? []).length;
	if (doubleColonCount > 1) return null;
	const normalized = normalizeEmbeddedIpv4(trimmed);
	if (normalized === null) return null;
	const groups = expandIpv6Groups(normalized, doubleColonCount === 1);
	if (groups === null) return null;
	return groups.reduce<bigint | null>((acc, group) => {
		if (acc === null) return null;
		const num = parseIpv6Group(group);
		if (num === null) return null;
		return (acc << IPV6_GROUP_BITS) | BigInt(num);
	}, ZERO);
};

/** Format an IPv6 address using RFC 5952 compression rules. */
const formatIpv6 = (value: bigint): string => {
	const masked = value & ((ONE << 128n) - ONE);
	const groups: number[] = [];
	for (let i = 7; i >= 0; i -= 1) {
		const shift = BigInt(i) * IPV6_GROUP_BITS;
		groups.push(Number((masked >> shift) & 0xffffn));
	}

	// Find the longest run of consecutive zero groups (length >= 2). RFC 5952
	// requires the leftmost such run to be replaced by "::".
	let bestStart = -1;
	let bestLen = 0;
	let curStart = -1;
	let curLen = 0;
	for (let i = 0; i < 8; i += 1) {
		if (groups[i] === 0) {
			if (curStart === -1) curStart = i;
			curLen += 1;
			if (curLen > bestLen) {
				bestLen = curLen;
				bestStart = curStart;
			}
		} else {
			curStart = -1;
			curLen = 0;
		}
	}

	if (bestLen < 2) {
		return groups.map((g) => g.toString(16)).join(':');
	}

	const headPart = groups
		.slice(0, bestStart)
		.map((g) => g.toString(16))
		.join(':');
	const tailPart = groups
		.slice(bestStart + bestLen)
		.map((g) => g.toString(16))
		.join(':');

	if (headPart.length === 0 && tailPart.length === 0) return '::';
	if (headPart.length === 0) return `::${tailPart}`;
	if (tailPart.length === 0) return `${headPart}::`;
	return `${headPart}::${tailPart}`;
};

/* -------------------------------------------------------------------------- */
/* Public format / parse helpers                                              */
/* -------------------------------------------------------------------------- */

export const formatIp = (value: bigint, family: IpFamily): string =>
	family === 'ipv4' ? formatIpv4(value) : formatIpv6(value);

export const parseIp = (
	text: string,
	family?: IpFamily
): { readonly value: bigint; readonly family: IpFamily } | null => {
	const trimmed = text.trim();
	if (family === 'ipv4') {
		const value = parseIpv4(trimmed);
		return value === null ? null : { value, family: 'ipv4' };
	}
	if (family === 'ipv6') {
		const value = parseIpv6(trimmed);
		return value === null ? null : { value, family: 'ipv6' };
	}
	// Auto-detect: presence of ":" indicates IPv6.
	if (trimmed.includes(':')) {
		const value = parseIpv6(trimmed);
		return value === null ? null : { value, family: 'ipv6' };
	}
	const value = parseIpv4(trimmed);
	return value === null ? null : { value, family: 'ipv4' };
};

/* -------------------------------------------------------------------------- */
/* Mask, network, broadcast derivation                                        */
/* -------------------------------------------------------------------------- */

const prefixMask = (prefix: number, maxPrefix: number): bigint => {
	if (prefix <= 0) return ZERO;
	if (prefix >= maxPrefix) return (ONE << BigInt(maxPrefix)) - ONE;
	const hostBits = BigInt(maxPrefix - prefix);
	const totalMask = (ONE << BigInt(maxPrefix)) - ONE;
	return totalMask ^ ((ONE << hostBits) - ONE);
};

const formatMaskV4 = (mask: bigint): string => formatIpv4(mask);
const formatMaskV6 = (mask: bigint): string => formatIpv6(mask);

const formatMaskHex = (mask: bigint, family: IpFamily): string => {
	const chars = family === 'ipv4' ? 8 : 32;
	return `0x${mask.toString(16).padStart(chars, '0')}`;
};

/* -------------------------------------------------------------------------- */
/* Reserved-range tables                                                      */
/* -------------------------------------------------------------------------- */

interface ReservedEntry {
	readonly family: IpFamily;
	readonly base: bigint;
	readonly prefix: number;
	readonly label: ReservedRange;
	readonly description: string;
}

const v4 = (text: string): bigint => {
	const parsed = parseIpv4(text);
	if (parsed === null) throw new Error(`Internal reserved-table parse error: ${text}`);
	return parsed;
};

const v6 = (text: string): bigint => {
	const parsed = parseIpv6(text);
	if (parsed === null) throw new Error(`Internal reserved-table parse error: ${text}`);
	return parsed;
};

const RESERVED_RANGES: readonly ReservedEntry[] = [
	{
		family: 'ipv4',
		base: v4('10.0.0.0'),
		prefix: 8,
		label: 'rfc1918-private',
		description: 'RFC 1918 private use (10.0.0.0/8)',
	},
	{
		family: 'ipv4',
		base: v4('172.16.0.0'),
		prefix: 12,
		label: 'rfc1918-private',
		description: 'RFC 1918 private use (172.16.0.0/12)',
	},
	{
		family: 'ipv4',
		base: v4('192.168.0.0'),
		prefix: 16,
		label: 'rfc1918-private',
		description: 'RFC 1918 private use (192.168.0.0/16)',
	},
	{
		family: 'ipv4',
		base: v4('100.64.0.0'),
		prefix: 10,
		label: 'rfc6598-cgnat',
		description: 'RFC 6598 Carrier-Grade NAT (100.64.0.0/10)',
	},
	{
		family: 'ipv4',
		base: v4('127.0.0.0'),
		prefix: 8,
		label: 'loopback',
		description: 'Loopback (127.0.0.0/8)',
	},
	{
		family: 'ipv4',
		base: v4('169.254.0.0'),
		prefix: 16,
		label: 'link-local',
		description: 'Link-local (169.254.0.0/16)',
	},
	{
		family: 'ipv4',
		base: v4('224.0.0.0'),
		prefix: 4,
		label: 'multicast',
		description: 'Multicast (224.0.0.0/4)',
	},
	{
		family: 'ipv4',
		base: v4('240.0.0.0'),
		prefix: 4,
		label: 'reserved',
		description: 'Reserved for future use (240.0.0.0/4)',
	},
	{
		family: 'ipv4',
		base: v4('192.0.2.0'),
		prefix: 24,
		label: 'documentation',
		description: 'Documentation (TEST-NET-1, 192.0.2.0/24)',
	},
	{
		family: 'ipv4',
		base: v4('198.51.100.0'),
		prefix: 24,
		label: 'documentation',
		description: 'Documentation (TEST-NET-2, 198.51.100.0/24)',
	},
	{
		family: 'ipv4',
		base: v4('203.0.113.0'),
		prefix: 24,
		label: 'documentation',
		description: 'Documentation (TEST-NET-3, 203.0.113.0/24)',
	},
	{
		family: 'ipv4',
		base: v4('0.0.0.0'),
		prefix: 8,
		label: 'unspecified',
		description: 'Unspecified / "this network" (0.0.0.0/8)',
	},
	{
		family: 'ipv6',
		base: v6('::1'),
		prefix: 128,
		label: 'loopback',
		description: 'Loopback (::1/128)',
	},
	{
		family: 'ipv6',
		base: v6('::'),
		prefix: 128,
		label: 'unspecified',
		description: 'Unspecified (::/128)',
	},
	{
		family: 'ipv6',
		base: v6('fe80::'),
		prefix: 10,
		label: 'link-local',
		description: 'Link-local (fe80::/10)',
	},
	{
		family: 'ipv6',
		base: v6('ff00::'),
		prefix: 8,
		label: 'multicast',
		description: 'Multicast (ff00::/8)',
	},
	{
		family: 'ipv6',
		base: v6('fc00::'),
		prefix: 7,
		label: 'ula',
		description: 'Unique local addresses (fc00::/7)',
	},
	{
		family: 'ipv6',
		base: v6('2001:db8::'),
		prefix: 32,
		label: 'documentation',
		description: 'Documentation (2001:db8::/32)',
	},
	{
		family: 'ipv6',
		base: v6('::ffff:0:0'),
		prefix: 96,
		label: 'ipv4-mapped',
		description: 'IPv4-mapped IPv6 (::ffff:0:0/96)',
	},
];

const matchReservedRanges = (
	address: bigint,
	family: IpFamily,
	maxPrefix: number
): readonly ReservedMatch[] => {
	const matches: ReservedMatch[] = [];
	for (const entry of RESERVED_RANGES) {
		if (entry.family !== family) continue;
		const mask = prefixMask(entry.prefix, maxPrefix);
		if ((address & mask) === (entry.base & mask)) {
			matches.push({ label: entry.label, description: entry.description });
		}
	}
	return matches;
};

/* -------------------------------------------------------------------------- */
/* Top-level parse                                                            */
/* -------------------------------------------------------------------------- */

const computeUsableHosts = (
	family: IpFamily,
	prefix: number,
	maxPrefix: number,
	total: bigint
): bigint => {
	if (family === 'ipv4') {
		// /32 hosts a single address (point-to-point peer); /31 hosts two
		// (RFC 3021); otherwise subtract network + broadcast.
		if (prefix === maxPrefix) return ONE;
		if (prefix === maxPrefix - 1) return 2n;
		return total - 2n;
	}
	// IPv6 has no broadcast; /127 is point-to-point (RFC 6164); /128 is a host
	// address. Standard practice subtracts the subnet-router anycast + the
	// reserved high-end addresses for typical /64 subnets, but the conventional
	// "usable" count for an IPv6 subnet is simply total - 2 except for the
	// edge prefixes that hold one or two addresses.
	if (prefix === maxPrefix) return ONE;
	if (prefix === maxPrefix - 1) return 2n;
	return total - 2n;
};

const splitCidrText = (
	input: string
): { readonly address: string; readonly prefix: string } | null => {
	const idx = input.lastIndexOf('/');
	if (idx < 0) return null;
	const address = input.slice(0, idx);
	const prefix = input.slice(idx + 1);
	if (address.length === 0 || prefix.length === 0) return null;
	return { address, prefix };
};

interface HostRange {
	readonly firstHost: bigint;
	readonly lastHost: bigint;
}

const computeHostRange = (
	network: bigint,
	lastInRange: bigint,
	prefix: number,
	maxPrefix: number
): HostRange => {
	if (prefix >= maxPrefix - 1) return { firstHost: network, lastHost: lastInRange };
	return { firstHost: network + ONE, lastHost: lastInRange - ONE };
};

const buildDetails = (
	trimmed: string,
	ip: { readonly value: bigint; readonly family: IpFamily },
	prefix: number,
	maxPrefix: number
): { readonly details: CidrDetails; readonly parsed: ParsedCidr; readonly network: bigint } => {
	const mask = prefixMask(prefix, maxPrefix);
	const totalMask = (ONE << BigInt(maxPrefix)) - ONE;
	const wildcardMask = mask ^ totalMask;
	const network = ip.value & mask;
	const total = ONE << BigInt(maxPrefix - prefix);
	const lastInRange = network | wildcardMask;
	const broadcast = ip.family === 'ipv4' ? lastInRange : null;
	const { firstHost, lastHost } = computeHostRange(network, lastInRange, prefix, maxPrefix);
	const networkText = formatIp(network, ip.family);
	const details: CidrDetails = {
		input: trimmed,
		family: ip.family,
		prefix,
		network,
		broadcast,
		firstHost,
		lastHost,
		totalAddresses: total,
		usableHosts: computeUsableHosts(ip.family, prefix, maxPrefix, total),
		mask,
		wildcardMask,
		networkText,
		broadcastText: broadcast === null ? null : formatIp(broadcast, ip.family),
		firstHostText: formatIp(firstHost, ip.family),
		lastHostText: formatIp(lastHost, ip.family),
		maskText: ip.family === 'ipv4' ? formatMaskV4(mask) : formatMaskV6(mask),
		wildcardText: formatIp(wildcardMask, ip.family),
		maskHex: formatMaskHex(mask, ip.family),
		cidrText: `${networkText}/${prefix}`,
	};
	const parsed: ParsedCidr = { family: ip.family, address: ip.value, prefix, maxPrefix };
	return { details, parsed, network };
};

const validatePrefix = (
	prefixText: string,
	family: IpFamily
): { readonly prefix: number; readonly maxPrefix: number } | { readonly error: string } => {
	if (!/^\d+$/.test(prefixText)) {
		return { error: `Prefix length must be a non-negative integer, got "${prefixText}".` };
	}
	const prefix = Number(prefixText);
	const maxPrefix = family === 'ipv4' ? IPV4_MAX_PREFIX : IPV6_MAX_PREFIX;
	if (prefix < 0 || prefix > maxPrefix) {
		return {
			error: `Prefix length out of range for ${family.toUpperCase()}: expected 0–${maxPrefix}, got ${prefix}.`,
		};
	}
	return { prefix, maxPrefix };
};

export const parseCidr = (input: string, familyOverride?: IpFamily): ParseResult => {
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		return { ok: false, error: 'Enter a CIDR notation such as 192.168.1.0/24 or 2001:db8::/48.' };
	}
	const split = splitCidrText(trimmed);
	if (!split) {
		return {
			ok: false,
			error: 'Missing prefix length. Append "/N" (e.g. /24 for IPv4, /48 for IPv6).',
		};
	}
	const ip = parseIp(split.address, familyOverride);
	if (!ip) {
		return { ok: false, error: `Invalid ${familyOverride ?? 'IP'} address: "${split.address}".` };
	}
	const prefixCheck = validatePrefix(split.prefix, ip.family);
	if ('error' in prefixCheck) return { ok: false, error: prefixCheck.error };
	const { details, parsed, network } = buildDetails(
		trimmed,
		ip,
		prefixCheck.prefix,
		prefixCheck.maxPrefix
	);
	return {
		ok: true,
		details,
		parsed,
		reserved: matchReservedRanges(network, ip.family, prefixCheck.maxPrefix),
	};
};

/* -------------------------------------------------------------------------- */
/* Subnetting helpers                                                         */
/* -------------------------------------------------------------------------- */

const MAX_CHILDREN = 1024;

export const splitIntoSubnets = (
	parent: ParsedCidr,
	childPrefix: number
): readonly ChildSubnet[] | { readonly error: string } => {
	if (!Number.isInteger(childPrefix)) {
		return { error: 'Child prefix must be an integer.' };
	}
	if (childPrefix <= parent.prefix) {
		return {
			error: `Child prefix must be greater than parent prefix (${parent.prefix}). Got ${childPrefix}.`,
		};
	}
	if (childPrefix > parent.maxPrefix) {
		return {
			error: `Child prefix exceeds max prefix for ${parent.family.toUpperCase()} (${parent.maxPrefix}).`,
		};
	}
	const countBig = ONE << BigInt(childPrefix - parent.prefix);
	if (countBig > BigInt(MAX_CHILDREN)) {
		return {
			error: `Too many child subnets (${countBig.toString()}). Limit is ${MAX_CHILDREN}; widen the child prefix.`,
		};
	}
	const count = Number(countBig);
	const childSize = ONE << BigInt(parent.maxPrefix - childPrefix);
	const parentMask = prefixMask(parent.prefix, parent.maxPrefix);
	const network = parent.address & parentMask;
	const childMask = prefixMask(childPrefix, parent.maxPrefix);
	const wildcard = childMask ^ ((ONE << BigInt(parent.maxPrefix)) - ONE);

	return Array.from({ length: count }, (_, i) => {
		const childNet = network + BigInt(i) * childSize;
		const childLast = childNet | wildcard;
		return {
			cidr: `${formatIp(childNet, parent.family)}/${childPrefix}`,
			first: formatIp(childNet, parent.family),
			last: formatIp(childLast, parent.family),
			count: childSize,
		};
	});
};

export const tryAggregate = (a: ParsedCidr, b: ParsedCidr): { readonly cidr: string } | null => {
	if (a.family !== b.family) return null;
	if (a.prefix !== b.prefix) return null;
	if (a.prefix === 0) return null;
	const supernetPrefix = a.prefix - 1;
	const supernetMask = prefixMask(supernetPrefix, a.maxPrefix);
	const childMask = prefixMask(a.prefix, a.maxPrefix);
	const aNet = a.address & childMask;
	const bNet = b.address & childMask;
	if (aNet === bNet) return null;
	if ((aNet & supernetMask) !== (bNet & supernetMask)) return null;
	const supernetBase = aNet & supernetMask;
	return { cidr: `${formatIp(supernetBase, a.family)}/${supernetPrefix}` };
};

/* -------------------------------------------------------------------------- */
/* Bit visualization                                                          */
/* -------------------------------------------------------------------------- */

export const bitMap = (cidr: ParsedCidr): readonly boolean[] =>
	Array.from({ length: cidr.maxPrefix }, (_, i) => i < cidr.prefix);

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

const exportRows = (
	details: CidrDetails
): readonly { readonly key: string; readonly value: string }[] => [
	{ key: 'cidr', value: details.cidrText },
	{ key: 'family', value: details.family },
	{ key: 'prefix', value: String(details.prefix) },
	{ key: 'network', value: details.networkText },
	{ key: 'broadcast', value: details.broadcastText ?? '' },
	{ key: 'first_host', value: details.firstHostText },
	{ key: 'last_host', value: details.lastHostText },
	{ key: 'total_addresses', value: details.totalAddresses.toString() },
	{ key: 'usable_hosts', value: details.usableHosts.toString() },
	{ key: 'mask', value: details.maskText },
	{ key: 'wildcard', value: details.wildcardText },
	{ key: 'mask_hex', value: details.maskHex },
];

const escapeShellValue = (value: string): string => `'${value.replaceAll(`'`, `'\\''`)}'`;

export const exportDetails = (details: CidrDetails, fmt: ExportFormat): string => {
	if (fmt === 'json') {
		const payload = {
			cidr: details.cidrText,
			family: details.family,
			prefix: details.prefix,
			network: details.networkText,
			broadcast: details.broadcastText,
			firstHost: details.firstHostText,
			lastHost: details.lastHostText,
			totalAddresses: details.totalAddresses.toString(),
			usableHosts: details.usableHosts.toString(),
			mask: details.maskText,
			wildcard: details.wildcardText,
			maskHex: details.maskHex,
		};
		return JSON.stringify(payload, null, 2);
	}
	if (fmt === 'csv') {
		const rows = exportRows(details);
		const header = rows.map((r) => r.key).join(',');
		const values = rows
			.map((r) => (r.value.includes(',') ? `"${r.value.replaceAll('"', '""')}"` : r.value))
			.join(',');
		return `${header}\n${values}`;
	}
	// shell vars
	return exportRows(details)
		.map((r) => `${r.key.toUpperCase()}=${escapeShellValue(r.value)}`)
		.join('\n');
};

export { prefixMask };
