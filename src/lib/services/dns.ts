import { invoke } from '@tauri-apps/api/core';

/**
 * Record types supported by the DNS Lookup MVP.
 * DNSSEC-only types (DNSKEY / RRSIG / DS) and operationally adjacent
 * types (CAA / SRV) are deferred to a follow-up.
 */
export type RecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME' | 'SOA' | 'PTR';

export const RECORD_TYPES: readonly RecordType[] = [
	'A',
	'AAAA',
	'MX',
	'TXT',
	'NS',
	'CNAME',
	'SOA',
	'PTR',
];

/**
 * Resolver preset keyed by short label. `"custom"` is a UI sentinel that
 * routes to a free-form IP input; the backend receives the literal IP
 * string rather than the word "custom".
 */
export type ResolverPreset = 'system' | 'cloudflare' | 'google' | 'quad9' | 'custom';

export interface ResolverPresetInfo {
	readonly id: ResolverPreset;
	readonly label: string;
	readonly description: string;
	readonly ip?: string;
}

export const RESOLVER_PRESETS: readonly ResolverPresetInfo[] = [
	{ id: 'system', label: 'System', description: 'Use the resolver configured on this device' },
	{ id: 'cloudflare', label: 'Cloudflare', description: '1.1.1.1', ip: '1.1.1.1' },
	{ id: 'google', label: 'Google', description: '8.8.8.8', ip: '8.8.8.8' },
	{ id: 'quad9', label: 'Quad9', description: '9.9.9.9', ip: '9.9.9.9' },
	{ id: 'custom', label: 'Custom', description: 'Provide a custom resolver IP' },
];

export interface DnsLookupRequest {
	readonly name: string;
	readonly recordTypes: readonly RecordType[];
	readonly resolver: string;
	readonly timeoutMs: number;
}

export interface DnsRecord {
	readonly recordType: string;
	readonly value: string;
	readonly ttl: number;
}

export interface DnsTypeResult {
	readonly recordType: string;
	readonly records: readonly DnsRecord[];
	readonly ttlExpiresAtMs: number;
	readonly authenticData: boolean | null;
	readonly error: string | null;
}

export interface DnsLookupResult {
	readonly name: string;
	readonly resolver: string;
	readonly results: readonly DnsTypeResult[];
	readonly elapsedMs: number;
}

/** Invoke the Tauri `dns_lookup` command. */
export const runDnsLookup = (req: DnsLookupRequest): Promise<DnsLookupResult> =>
	invoke<DnsLookupResult>('dns_lookup', { req });

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
// Permissive IPv6: accepts compressed (::) and fully expanded forms.
// We rely on the Rust resolver for authoritative parsing; this guard
// only needs to disambiguate "looks like an IP" from "looks like a name"
// so the UI can auto-switch to PTR.
const IPV6_RE = /^[0-9a-fA-F:]+$/;

/**
 * Return `true` when the trimmed input is a literal IPv4 or IPv6 address
 * (used to auto-switch the query type to PTR for reverse lookups).
 */
export const isIpLiteral = (text: string): boolean => {
	const trimmed = text.trim();
	if (trimmed.length === 0) return false;
	if (IPV4_RE.test(trimmed)) return true;
	if (!IPV6_RE.test(trimmed)) return false;
	// An IPv6 literal must contain a colon and be ≥ 2 characters.
	return trimmed.includes(':') && trimmed.length >= 2;
};

/**
 * Convert an IPv4 / IPv6 literal to its PTR-format reverse-DNS name.
 * Returns the original input when it is not a recognized literal so the
 * caller can pass it through unchanged.
 */
export const toReverseDnsName = (ip: string): string => {
	const trimmed = ip.trim();
	if (IPV4_RE.test(trimmed)) {
		return `${trimmed.split('.').reverse().join('.')}.in-addr.arpa`;
	}
	if (!IPV6_RE.test(trimmed) || !trimmed.includes(':')) return trimmed;
	const expanded = expandIpv6(trimmed);
	if (expanded === null) return trimmed;
	const nibbles = expanded
		.split(':')
		.map((group) => group.padStart(4, '0'))
		.join('')
		.split('')
		.reverse()
		.join('.');
	return `${nibbles}.ip6.arpa`;
};

/**
 * Expand a compressed IPv6 literal (`::` notation) to its full 8-group
 * form. Returns `null` when the input cannot be parsed as IPv6.
 */
const expandIpv6 = (ip: string): string | null => {
	const halves = ip.split('::');
	if (halves.length > 2) return null;
	const [leftRaw = '', rightRaw = ''] = halves;
	const left = leftRaw.length > 0 ? leftRaw.split(':') : [];
	const right = rightRaw.length > 0 ? rightRaw.split(':') : [];
	const missing = 8 - left.length - right.length;
	if (halves.length === 1) {
		// No `::` — must already be 8 groups.
		if (left.length !== 8) return null;
		return left.join(':');
	}
	if (missing < 0) return null;
	const filler = Array.from({ length: missing }, () => '0');
	return [...left, ...filler, ...right].join(':');
};

/**
 * Render the request as the equivalent `dig` invocation. Used for the
 * "Copy as dig" export so the user can reproduce the lookup offline.
 */
export const exportAsDig = (req: DnsLookupRequest): string => {
	const server = req.resolver === 'system' ? '' : ` @${resolverIpFor(req.resolver)}`;
	const types = req.recordTypes.join(' ');
	const name = req.name.trim().length > 0 ? req.name.trim() : 'example.com';
	return `dig${server} ${name} ${types}`.trim();
};

/**
 * Resolve a preset id (or a passthrough IP literal) to its display IP.
 * Used by the `dig` export and the resolver chip subtitle.
 */
export const resolverIpFor = (spec: string): string => {
	const preset = RESOLVER_PRESETS.find((p) => p.id === spec);
	if (preset?.ip !== undefined) return preset.ip;
	return spec;
};

/** Recommended bootstrap input shown on first load. */
export const SAMPLE_DOMAIN = 'example.com';

/** Default reverse-DNS sample for the "Load reverse sample" button. */
export const SAMPLE_REVERSE_IP = '8.8.8.8';
