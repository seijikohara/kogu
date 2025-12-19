/**
 * Formatters - Shared Utility Functions
 */

import type { JsonFormatOptions, StatsAccumulator } from './types.js';

/** Format bytes to human readable string */
export const formatBytes = (bytes: number): string =>
	bytes < 1024
		? `${bytes} B`
		: bytes < 1024 * 1024
			? `${(bytes / 1024).toFixed(2)} KB`
			: `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

/** Get indent string from options */
export const getIndentString = (options: JsonFormatOptions): string =>
	options.indentType === 'tabs' && options.indentSize > 0 ? '\t' : ' '.repeat(options.indentSize);

/** Deep sort object keys recursively */
export const sortKeysDeep = (obj: unknown): unknown => {
	if (Array.isArray(obj)) return obj.map(sortKeysDeep);
	if (obj === null || typeof obj !== 'object') return obj;

	return Object.fromEntries(
		Object.keys(obj)
			.sort()
			.map((key) => [key, sortKeysDeep((obj as Record<string, unknown>)[key])])
	);
};

/** Calculate stats accumulator for nested data */
export const calculateStats = (obj: unknown): StatsAccumulator => {
	if (Array.isArray(obj)) {
		return obj.reduce<StatsAccumulator>(
			(acc, item) => {
				const childStats = calculateStats(item);
				return {
					keys: acc.keys + childStats.keys,
					values: acc.values + 1 + childStats.values,
					maxDepth: Math.max(acc.maxDepth, 1 + childStats.maxDepth),
				};
			},
			{ keys: 0, values: 0, maxDepth: 0 }
		);
	}

	if (obj !== null && typeof obj === 'object') {
		return Object.entries(obj).reduce<StatsAccumulator>(
			(acc, [, value]) => {
				const childStats = calculateStats(value);
				return {
					keys: acc.keys + 1 + childStats.keys,
					values: acc.values + childStats.values,
					maxDepth: Math.max(acc.maxDepth, 1 + childStats.maxDepth),
				};
			},
			{ keys: 0, values: 0, maxDepth: 0 }
		);
	}

	return { keys: 0, values: 1, maxDepth: 0 };
};
