/**
 * Common object diff utilities.
 *
 * Shared logic for JSON and YAML diff implementations.
 */

import type { BaseDiffOptions } from './types.js';

/**
 * Normalize a value for comparison.
 * Applies case and whitespace normalization based on options.
 */
export const normalizeValue = <T extends BaseDiffOptions>(value: unknown, options: T): unknown => {
	if (value === null || value === undefined) return value;

	if (typeof value === 'string') {
		let normalized = value;
		if (options.ignoreCase) normalized = normalized.toLowerCase();
		if (options.ignoreWhitespace) normalized = normalized.replace(/\s+/g, '');
		return normalized;
	}

	return value;
};

/**
 * Check if a value is considered empty.
 */
export const isEmpty = (value: unknown): boolean =>
	value === null ||
	value === undefined ||
	value === '' ||
	(Array.isArray(value) && value.length === 0) ||
	(typeof value === 'object' && value !== null && Object.keys(value).length === 0);

/**
 * Sort an array for comparison, using normalized JSON stringification.
 */
export const sortArray = <T extends BaseDiffOptions>(
	arr: readonly unknown[],
	options: T
): unknown[] =>
	[...arr].sort((a, b) => {
		const strA = JSON.stringify(normalizeValue(a, options));
		const strB = JSON.stringify(normalizeValue(b, options));
		return strA.localeCompare(strB);
	});

/**
 * Generic array comparison function.
 *
 * @param arr1 First array
 * @param arr2 Second array
 * @param path Current path in the object tree
 * @param options Diff options
 * @param onAdded Callback for added items
 * @param onRemoved Callback for removed items
 * @param compareFn Recursive comparison function
 * @returns Array of diff items
 */
export const compareArrays = <TOptions extends BaseDiffOptions, TItem>(
	arr1: readonly unknown[],
	arr2: readonly unknown[],
	path: string,
	options: TOptions,
	onAdded: (path: string, value: unknown) => TItem,
	onRemoved: (path: string, value: unknown) => TItem,
	compareFn: (a: unknown, b: unknown, p: string, o: TOptions) => readonly TItem[]
): TItem[] => {
	const sorted1 = options.ignoreArrayOrder ? sortArray(arr1, options) : arr1;
	const sorted2 = options.ignoreArrayOrder ? sortArray(arr2, options) : arr2;
	const maxLen = Math.max(sorted1.length, sorted2.length);

	return Array.from({ length: maxLen }).flatMap((_, i) => {
		const itemPath = `${path}[${i}]`;
		if (i >= sorted1.length) return [onAdded(itemPath, sorted2[i])];
		if (i >= sorted2.length) return [onRemoved(itemPath, sorted1[i])];
		return compareFn(sorted1[i], sorted2[i], itemPath, options) as TItem[];
	});
};

/**
 * Generic object comparison function.
 *
 * @param o1 First object
 * @param o2 Second object
 * @param path Current path in the object tree
 * @param options Diff options
 * @param onAdded Callback for added keys
 * @param onRemoved Callback for removed keys
 * @param compareFn Recursive comparison function
 * @returns Array of diff items
 */
export const compareObjects = <TOptions extends BaseDiffOptions, TItem>(
	o1: Record<string, unknown>,
	o2: Record<string, unknown>,
	path: string,
	options: TOptions,
	onAdded: (path: string, value: unknown) => TItem,
	onRemoved: (path: string, value: unknown) => TItem,
	compareFn: (a: unknown, b: unknown, p: string, o: TOptions) => readonly TItem[]
): TItem[] => {
	const ignoreKeysSet = new Set(options.ignoreKeys ?? []);
	const keys1 = Object.keys(o1).filter((k) => !ignoreKeysSet.has(k));
	const keys2 = Object.keys(o2).filter((k) => !ignoreKeysSet.has(k));
	const allKeys = [...new Set([...keys1, ...keys2])];

	return allKeys.flatMap((key) => {
		const keyPath = path ? `${path}.${key}` : key;
		const inO1 = key in o1;
		const inO2 = key in o2;

		if (options.ignoreEmpty && !inO1 && isEmpty(o2[key])) return [];
		if (options.ignoreEmpty && !inO2 && isEmpty(o1[key])) return [];
		if (!inO1) return [onAdded(keyPath, o2[key])];
		if (!inO2) return [onRemoved(keyPath, o1[key])];
		return compareFn(o1[key], o2[key], keyPath, options) as TItem[];
	});
};
