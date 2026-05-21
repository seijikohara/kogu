const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

// Magnitude-aware decimal precision: ≤2 digits significand for values < 10,
// ≤1 digit for values < 100, integer otherwise. Reads "1.23 GB" / "12.3 GB" /
// "123 GB" rather than fixed `.toFixed(1)` which under-precisions small values
// and over-precisions large ones.
const formatWithPrecision = (value: number): string => {
	if (value < 10) return value.toFixed(2);
	if (value < 100) return value.toFixed(1);
	return Math.round(value).toString();
};

// Format byte count to human-readable string (e.g. "1.23 GB").
//
// Single source of truth for byte-size display across the app. Replaces three
// near-identical implementations that diverged in decimal precision and max
// unit: `services/encoders.ts` (1-decimal, capped at MB),
// `services/formatters/utils.ts` (2-decimal, capped at MB), and
// `services/network-interfaces.ts` (magnitude-precision, up to PB).
//
// The canonical shape mirrors the network-interfaces version because it
// produces the most readable output across the largest range (e.g. a regex
// pattern matching 1 GB of input shouldn't read as "1024.00 MB").
export const formatBytes = (bytes: number): string => {
	if (bytes === 0) return '0 B';
	const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
	const value = bytes / 1024 ** index;
	return `${formatWithPrecision(value)} ${BYTE_UNITS[index]}`;
};
