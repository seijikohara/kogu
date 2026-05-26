/**
 * MAC address parsing, formatting, vendor lookup, and derived encodings.
 *
 * Vendor lookup is delegated to the Rust backend via the
 * `lookup_oui_vendor` Tauri command so the bundled IEEE OUI table never
 * ships in the JS bundle.
 */
import { invoke } from '@tauri-apps/api/core';

export type MacFormat = 'colon' | 'dash' | 'dot' | 'bare';

export interface ParsedMac {
	readonly bytes: readonly number[];
	readonly canonical: string;
}

export type ParseResult =
	| { readonly ok: true; readonly mac: ParsedMac }
	| { readonly ok: false; readonly error: string };

const HEX_CHARS = /^[0-9a-fA-F]+$/;
const BARE_RE = /^[0-9a-fA-F]{12}$/;
const COLON_RE = /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/;
const DASH_RE = /^([0-9a-fA-F]{2}-){5}[0-9a-fA-F]{2}$/;
const DOT_RE = /^([0-9a-fA-F]{4}\.){2}[0-9a-fA-F]{4}$/;

const toHex = (n: number, upper: boolean): string => {
	const s = n.toString(16).padStart(2, '0');
	return upper ? s.toUpperCase() : s;
};

const parseHexBytes = (hex: string): number[] => {
	const bytes: number[] = [];
	for (let i = 0; i < 12; i += 2) {
		bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
	}
	return bytes;
};

const bytesToCanonical = (bytes: readonly number[]): string =>
	bytes.map((b) => toHex(b, false)).join(':');

/**
 * Parse a MAC address from one of the canonical notations.
 *
 * Accepts colon (`aa:bb:cc:dd:ee:ff`), dash (`AA-BB-CC-DD-EE-FF`),
 * dot/Cisco (`aabb.ccdd.eeff`), and bare-hex (`aabbccddeeff`).
 * The check is case-insensitive.
 */
export const parseMac = (input: string): ParseResult => {
	const trimmed = input.trim();
	if (trimmed.length === 0) return { ok: false, error: 'Input is empty' };

	const compact = trimmed.replace(/[:\-.]/g, '');
	if (!HEX_CHARS.test(compact)) {
		return { ok: false, error: 'MAC address must contain only hex digits and separators' };
	}
	if (compact.length !== 12) {
		return { ok: false, error: 'MAC address must contain exactly 12 hex digits (6 bytes)' };
	}

	const matchesKnown =
		COLON_RE.test(trimmed) ||
		DASH_RE.test(trimmed) ||
		DOT_RE.test(trimmed) ||
		BARE_RE.test(trimmed);
	if (!matchesKnown) {
		return {
			ok: false,
			error: 'Unrecognized format. Use colon, dash, dot, or bare-hex notation.',
		};
	}

	const bytes = parseHexBytes(compact);
	return { ok: true, mac: { bytes, canonical: bytesToCanonical(bytes) } };
};

/**
 * Render a parsed MAC in the requested notation.
 */
export const formatMac = (mac: ParsedMac, format: MacFormat, upper = false): string => {
	const hex = mac.bytes.map((b) => toHex(b, upper));
	const [b0 = '00', b1 = '00', b2 = '00', b3 = '00', b4 = '00', b5 = '00'] = hex;
	switch (format) {
		case 'colon':
			return hex.join(':');
		case 'dash':
			return hex.join('-');
		case 'dot':
			return `${b0}${b1}.${b2}${b3}.${b4}${b5}`;
		case 'bare':
			return hex.join('');
	}
};

/**
 * Render the OUI (first 3 bytes) in colon-uppercase form.
 */
export const formatPrefix = (bytes: readonly number[]): string =>
	bytes
		.slice(0, 3)
		.map((b) => toHex(b, true))
		.join(':');

export interface MacFlags {
	readonly local: boolean;
	readonly multicast: boolean;
	readonly broadcast: boolean;
	readonly nullAddress: boolean;
}

/**
 * Inspect the first-byte transmission bits and special-case the broadcast
 * and null addresses.
 *
 * - Bit 0 (LSB) of byte 0 — I/G: 0 = unicast, 1 = multicast.
 * - Bit 1 of byte 0 — U/L: 0 = universally administered, 1 = locally
 *   administered.
 */
export const macFlags = (mac: ParsedMac): MacFlags => {
	const first = mac.bytes[0] ?? 0;
	const multicast = (first & 0x01) === 0x01;
	const local = (first & 0x02) === 0x02;
	const broadcast = mac.bytes.every((b) => b === 0xff);
	const nullAddress = mac.bytes.every((b) => b === 0x00);
	return { local, multicast, broadcast, nullAddress };
};

/**
 * Modified EUI-64 derived interface identifier.
 *
 * Inserts `FF:FE` between the OUI and NIC halves and flips the
 * universal/local bit in byte 0 (RFC 4291 § 2.5.1).
 */
export const toEui64Bytes = (mac: ParsedMac): readonly number[] => {
	const [b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0] = mac.bytes;
	const flipped = b0 ^ 0x02;
	return [flipped, b1, b2, 0xff, 0xfe, b3, b4, b5];
};

const formatEui64Colon = (bytes: readonly number[], upper: boolean): string =>
	bytes.map((b) => toHex(b, upper)).join(':');

/**
 * Modified EUI-64 in colon-hex notation.
 */
export const toEui64 = (mac: ParsedMac, upper = false): string =>
	formatEui64Colon(toEui64Bytes(mac), upper);

const compressIpv6 = (groups: readonly string[]): string => {
	// Find the longest run of "0" groups (>= 2) to collapse to `::`.
	let bestStart = -1;
	let bestLen = 0;
	let curStart = -1;
	let curLen = 0;
	groups.forEach((g, idx) => {
		if (g === '0') {
			if (curStart === -1) curStart = idx;
			curLen += 1;
			if (curLen > bestLen) {
				bestStart = curStart;
				bestLen = curLen;
			}
		} else {
			curStart = -1;
			curLen = 0;
		}
	});
	if (bestLen < 2) return groups.join(':');
	const left = groups.slice(0, bestStart).join(':');
	const right = groups.slice(bestStart + bestLen).join(':');
	return `${left}::${right}`;
};

/**
 * IPv6 link-local address derived from the MAC via modified EUI-64.
 *
 * Format: `fe80::` followed by the EUI-64 interface identifier rendered as
 * four 16-bit groups with leading zeros stripped and consecutive zero groups
 * collapsed per RFC 5952.
 */
export const toIpv6LinkLocal = (mac: ParsedMac): string => {
	const eui = toEui64Bytes(mac);
	const groups: string[] = [];
	for (let i = 0; i < eui.length; i += 2) {
		const high = eui[i] ?? 0;
		const low = eui[i + 1] ?? 0;
		const value = (high << 8) | low;
		groups.push(value.toString(16));
	}
	const linkLocalGroups: string[] = ['fe80', '0', '0', '0', ...groups];
	return compressIpv6(linkLocalGroups);
};

export interface VendorResult {
	readonly vendor: string | null;
	readonly matchedPrefix: string | null;
}

interface RawVendorResult {
	readonly vendor: string | null;
	readonly prefix: string | null;
}

/**
 * Resolve the OUI vendor via the Rust backend.
 *
 * Falls back to `null` on transport failure so the UI keeps rendering the
 * rest of the result cards.
 */
export const lookupVendor = async (mac: ParsedMac): Promise<VendorResult> => {
	try {
		const raw = await invoke<RawVendorResult>('lookup_oui_vendor', { mac: mac.canonical });
		return { vendor: raw.vendor, matchedPrefix: raw.prefix };
	} catch {
		return { vendor: null, matchedPrefix: null };
	}
};

export interface OuiDatabaseInfo {
	readonly entries: number;
	readonly updated: string;
	readonly source: string;
}

/**
 * Fetch metadata about the bundled OUI database for the freshness badge.
 */
export const getOuiDatabaseInfo = async (): Promise<OuiDatabaseInfo | null> => {
	try {
		return await invoke<OuiDatabaseInfo>('get_oui_database_info');
	} catch {
		return null;
	}
};

export interface RandomMacOptions {
	readonly locallyAdministered: boolean;
	readonly vendorPrefix?: string;
}

const randomByte = (): number => Math.floor(Math.random() * 256);

const parsePrefixBytes = (prefix: string): readonly number[] | null => {
	const clean = prefix.replace(/[:\-.\s]/g, '');
	if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
	const slice = (start: number) => Number.parseInt(clean.slice(start, start + 2), 16);
	return [slice(0), slice(2), slice(4)];
};

/**
 * Generate a random MAC address suitable for testing.
 *
 * - When `vendorPrefix` is provided, the first three bytes are taken from it
 *   verbatim. The locally-administered bit is only set when no vendor prefix
 *   is supplied; vendor OUIs are by definition universally administered.
 * - The multicast (I/G) bit is always cleared so the result is a valid
 *   unicast address.
 */
export const generateRandomMac = (opts: RandomMacOptions): ParsedMac => {
	const tail = [randomByte(), randomByte(), randomByte()];
	const prefixBytes = opts.vendorPrefix ? parsePrefixBytes(opts.vendorPrefix) : null;

	const head: readonly number[] = prefixBytes
		? prefixBytes
		: (() => {
				const initial = randomByte();
				// Always clear multicast bit so the random MAC stays unicast;
				// honour locallyAdministered for U/L.
				const cleared = initial & 0xfe;
				const flagged = opts.locallyAdministered ? cleared | 0x02 : cleared & 0xfd;
				return [flagged, randomByte(), randomByte()];
			})();

	const bytes = [...head, ...tail];
	return { bytes, canonical: bytesToCanonical(bytes) };
};

/**
 * Sample MACs used by the "Load sample" affordance.
 */
export const SAMPLE_MAC = '00:1B:63:84:45:E6';
export const SAMPLE_LOCAL_MAC = '02:42:AC:11:00:02';
export const SAMPLE_BROADCAST = 'FF:FF:FF:FF:FF:FF';
