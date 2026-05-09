/**
 * UUID generation service.
 * Wraps the `uuid` npm package with project-specific options
 * (formatting, version metadata, namespace presets).
 */

import { NIL, v1, v3, v4, v5, v7, validate, version as detectVersion } from 'uuid';

export type UuidVersion = 'v1' | 'v3' | 'v4' | 'v5' | 'v7' | 'nil';

export interface UuidVersionInfo {
	readonly version: UuidVersion;
	readonly label: string;
	readonly description: string;
}

export const UUID_VERSIONS: readonly UuidVersionInfo[] = [
	{ version: 'v1', label: 'v1', description: 'Time-based with MAC address' },
	{ version: 'v3', label: 'v3', description: 'Namespace + name (MD5)' },
	{ version: 'v4', label: 'v4', description: 'Random (most common)' },
	{ version: 'v5', label: 'v5', description: 'Namespace + name (SHA-1)' },
	{ version: 'v7', label: 'v7', description: 'Time-ordered (sortable)' },
	{ version: 'nil', label: 'NIL', description: 'All zeros (placeholder)' },
] as const;

export interface NamespacePreset {
	readonly id: string;
	readonly label: string;
	readonly value: string;
}

// RFC 4122 / RFC 9562 predefined namespace UUIDs.
export const NAMESPACE_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_OID = '6ba7b812-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_X500 = '6ba7b814-9dad-11d1-80b4-00c04fd430c8';

export const NAMESPACE_PRESETS: readonly NamespacePreset[] = [
	{ id: 'dns', label: 'DNS', value: NAMESPACE_DNS },
	{ id: 'url', label: 'URL', value: NAMESPACE_URL },
	{ id: 'oid', label: 'OID', value: NAMESPACE_OID },
	{ id: 'x500', label: 'X.500', value: NAMESPACE_X500 },
] as const;

export interface UuidFormatOptions {
	readonly uppercase: boolean;
	readonly hyphens: boolean;
	readonly braces: boolean;
}

export const DEFAULT_FORMAT_OPTIONS: UuidFormatOptions = {
	uppercase: false,
	hyphens: true,
	braces: false,
};

export interface UuidGenerateOptions {
	readonly version: UuidVersion;
	readonly count: number;
	readonly namespace?: string;
	readonly name?: string;
	readonly format: UuidFormatOptions;
}

export const MIN_COUNT = 1;
export const MAX_COUNT = 100;
export const DEFAULT_COUNT = 1;

export const isUuidVersion = (value: string): value is UuidVersion =>
	UUID_VERSIONS.some((info) => info.version === value);

export const requiresNamespace = (version: UuidVersion): boolean =>
	version === 'v3' || version === 'v5';

export const isValidUuid = (value: string): boolean => validate(value);

export const detectUuidVersion = (value: string): number | null => {
	if (!validate(value)) return null;
	return detectVersion(value);
};

export const formatUuid = (uuid: string, options: UuidFormatOptions): string => {
	const stripped = options.hyphens ? uuid : uuid.replaceAll('-', '');
	const cased = options.uppercase ? stripped.toUpperCase() : stripped.toLowerCase();
	return options.braces ? `{${cased}}` : cased;
};

const generateOneUuid = (version: UuidVersion, namespace?: string, name?: string): string => {
	if (version === 'v1') return v1();
	if (version === 'v4') return v4();
	if (version === 'v7') return v7();
	if (version === 'nil') return NIL;

	if (!namespace || !validate(namespace)) {
		throw new Error('Namespace must be a valid UUID for v3 / v5 generation');
	}
	if (name === undefined || name.length === 0) {
		throw new Error('Name is required for v3 / v5 generation');
	}
	return version === 'v3' ? v3(name, namespace) : v5(name, namespace);
};

export const generateUuids = (options: UuidGenerateOptions): readonly string[] => {
	const { version, count, namespace, name, format } = options;
	if (count < MIN_COUNT || count > MAX_COUNT) {
		throw new Error(`Count must be between ${MIN_COUNT} and ${MAX_COUNT}`);
	}
	// NIL has only one value; emit it `count` times so users see the same shape.
	const raw = Array.from({ length: count }, () => generateOneUuid(version, namespace, name));
	return raw.map((value) => formatUuid(value, format));
};
