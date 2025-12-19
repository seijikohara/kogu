/**
 * JSON Diff - Find Differences Between JSON
 */

import { defaultJsonDiffOptions } from '../constants.js';
import type { DiffItem, JsonDiffOptions } from '../types.js';
import { parseJsonAuto } from './parser.js';

// ============================================================================
// Helper Functions
// ============================================================================

const normalizeValue = (value: unknown, opts: JsonDiffOptions): unknown => {
	if (value === null || value === undefined) return value;

	if (typeof value === 'string') {
		let normalized = value;
		if (opts.ignoreCase) normalized = normalized.toLowerCase();
		if (opts.ignoreWhitespace) normalized = normalized.replace(/\s+/g, '');
		return normalized;
	}

	if (typeof value === 'number' && opts.ignoreNumericType) {
		return String(value);
	}

	return value;
};

const isEmpty = (value: unknown): boolean =>
	value === null ||
	value === undefined ||
	value === '' ||
	(Array.isArray(value) && value.length === 0) ||
	(typeof value === 'object' && value !== null && Object.keys(value).length === 0);

const sortArray = (arr: unknown[], opts: JsonDiffOptions): unknown[] =>
	[...arr].sort((a, b) => {
		const strA = JSON.stringify(normalizeValue(a, opts));
		const strB = JSON.stringify(normalizeValue(b, opts));
		return strA.localeCompare(strB);
	});

const createDiffItem = (
	path: string,
	type: DiffItem['type'],
	oldValue?: unknown,
	newValue?: unknown
): DiffItem => ({
	path,
	type,
	...(oldValue !== undefined && { oldValue: JSON.stringify(oldValue) }),
	...(newValue !== undefined && { newValue: JSON.stringify(newValue) }),
});

/** Check if types are equivalent considering numeric type option */
const areTypesEquivalent = (obj1: unknown, obj2: unknown, opts: JsonDiffOptions): boolean => {
	if (typeof obj1 === typeof obj2) return true;
	if (!opts.ignoreNumericType) return false;
	if (typeof obj1 === 'number' && typeof obj2 === 'string' && String(obj1) === obj2) return true;
	if (typeof obj1 === 'string' && typeof obj2 === 'number' && obj1 === String(obj2)) return true;
	return false;
};

// ============================================================================
// Comparison Functions
// ============================================================================

/** Compare two arrays and return differences */
const compareArrays = (
	arr1: unknown[],
	arr2: unknown[],
	path: string,
	opts: JsonDiffOptions,
	findDiffsFn: (a: unknown, b: unknown, p: string, o: JsonDiffOptions) => DiffItem[]
): DiffItem[] => {
	const sorted1 = opts.ignoreArrayOrder ? sortArray(arr1, opts) : arr1;
	const sorted2 = opts.ignoreArrayOrder ? sortArray(arr2, opts) : arr2;
	const maxLen = Math.max(sorted1.length, sorted2.length);

	return Array.from({ length: maxLen }).flatMap((_, i) => {
		const itemPath = `${path}[${i}]`;
		if (i >= sorted1.length) return [createDiffItem(itemPath, 'added', undefined, sorted2[i])];
		if (i >= sorted2.length) return [createDiffItem(itemPath, 'removed', sorted1[i], undefined)];
		return findDiffsFn(sorted1[i], sorted2[i], itemPath, opts);
	});
};

/** Compare two objects and return differences */
const compareObjects = (
	o1: Record<string, unknown>,
	o2: Record<string, unknown>,
	path: string,
	opts: JsonDiffOptions,
	findDiffsFn: (a: unknown, b: unknown, p: string, o: JsonDiffOptions) => DiffItem[]
): DiffItem[] => {
	const ignoreKeysSet = new Set(opts.ignoreKeys ?? []);
	const keys1 = Object.keys(o1).filter((k) => !ignoreKeysSet.has(k));
	const keys2 = Object.keys(o2).filter((k) => !ignoreKeysSet.has(k));
	const allKeys = [...new Set([...keys1, ...keys2])];

	return allKeys.flatMap((key) => {
		const keyPath = `${path}.${key}`;
		const inO1 = key in o1;
		const inO2 = key in o2;

		if (opts.ignoreEmpty && !inO1 && isEmpty(o2[key])) return [];
		if (opts.ignoreEmpty && !inO2 && isEmpty(o1[key])) return [];
		if (!inO1) return [createDiffItem(keyPath, 'added', undefined, o2[key])];
		if (!inO2) return [createDiffItem(keyPath, 'removed', o1[key], undefined)];
		return findDiffsFn(o1[key], o2[key], keyPath, opts);
	});
};

const findDifferences = (
	obj1: unknown,
	obj2: unknown,
	path: string,
	opts: JsonDiffOptions
): DiffItem[] => {
	if (opts.ignoreEmpty && isEmpty(obj1) && isEmpty(obj2)) return [];

	if (!opts.deepCompare) {
		const norm1 = JSON.stringify(obj1);
		const norm2 = JSON.stringify(obj2);
		return norm1 !== norm2 ? [createDiffItem(path, 'changed', obj1, obj2)] : [];
	}

	if (!areTypesEquivalent(obj1, obj2, opts)) {
		return [createDiffItem(path, 'changed', obj1, obj2)];
	}

	if (Array.isArray(obj1) && Array.isArray(obj2)) {
		return compareArrays(obj1, obj2, path, opts, findDifferences);
	}

	if (obj1 !== null && obj2 !== null && typeof obj1 === 'object' && typeof obj2 === 'object') {
		return compareObjects(
			obj1 as Record<string, unknown>,
			obj2 as Record<string, unknown>,
			path,
			opts,
			findDifferences
		);
	}

	const norm1 = normalizeValue(obj1, opts);
	const norm2 = normalizeValue(obj2, opts);
	return norm1 !== norm2 ? [createDiffItem(path, 'changed', obj1, obj2)] : [];
};

/** Find differences between two JSON strings */
export const findJsonDifferences = (
	json1: string,
	json2: string,
	options: JsonDiffOptions = {}
): DiffItem[] => {
	const opts = { ...defaultJsonDiffOptions, ...options };
	return findDifferences(parseJsonAuto(json1).data, parseJsonAuto(json2).data, '$', opts);
};
