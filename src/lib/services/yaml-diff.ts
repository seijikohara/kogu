import * as yaml from 'yaml';
import type { GenericDiffItem } from '$lib/constants/diff.js';

export interface YamlDiffOptions {
	ignoreWhitespace?: boolean;
	ignoreArrayOrder?: boolean;
	ignoreCase?: boolean;
	ignoreEmpty?: boolean;
	deepCompare?: boolean;
	ignoreKeys?: string[];
}

export const defaultYamlDiffOptions: YamlDiffOptions = {
	ignoreWhitespace: false,
	ignoreArrayOrder: false,
	ignoreCase: false,
	ignoreEmpty: false,
	deepCompare: true,
	ignoreKeys: [],
};

/**
 * Normalize value for comparison.
 */
const normalizeValue = (value: unknown, options: YamlDiffOptions): unknown => {
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
 * Check if value is empty.
 */
const isEmpty = (value: unknown): boolean =>
	value === null ||
	value === undefined ||
	value === '' ||
	(Array.isArray(value) && value.length === 0) ||
	(typeof value === 'object' && value !== null && Object.keys(value).length === 0);

/**
 * Sort array for comparison.
 */
const sortArray = (arr: unknown[], options: YamlDiffOptions): unknown[] =>
	[...arr].sort((a, b) => {
		const strA = JSON.stringify(normalizeValue(a, options));
		const strB = JSON.stringify(normalizeValue(b, options));
		return strA.localeCompare(strB);
	});

/**
 * Find differences between two objects.
 */
const findDifferences = (
	obj1: unknown,
	obj2: unknown,
	path: string,
	options: YamlDiffOptions
): GenericDiffItem[] => {
	if (options.ignoreEmpty && isEmpty(obj1) && isEmpty(obj2)) return [];

	if (!options.deepCompare) {
		const normalized1 = JSON.stringify(obj1);
		const normalized2 = JSON.stringify(obj2);
		return normalized1 !== normalized2
			? [
					{
						path,
						type: 'changed',
						oldValue: JSON.stringify(obj1),
						newValue: JSON.stringify(obj2),
					},
				]
			: [];
	}

	if (typeof obj1 !== typeof obj2) {
		return [
			{ path, type: 'changed', oldValue: JSON.stringify(obj1), newValue: JSON.stringify(obj2) },
		];
	}

	if (Array.isArray(obj1) && Array.isArray(obj2)) {
		const arr1 = options.ignoreArrayOrder ? sortArray(obj1, options) : obj1;
		const arr2 = options.ignoreArrayOrder ? sortArray(obj2, options) : obj2;
		const maxLen = Math.max(arr1.length, arr2.length);

		return Array.from({ length: maxLen }).flatMap((_, i) => {
			const itemPath = `${path}[${i}]`;
			if (i >= arr1.length)
				return [{ path: itemPath, type: 'added' as const, newValue: JSON.stringify(arr2[i]) }];
			if (i >= arr2.length)
				return [{ path: itemPath, type: 'removed' as const, oldValue: JSON.stringify(arr1[i]) }];
			return findDifferences(arr1[i], arr2[i], itemPath, options);
		});
	}

	if (obj1 !== null && obj2 !== null && typeof obj1 === 'object' && typeof obj2 === 'object') {
		const o1 = obj1 as Record<string, unknown>;
		const o2 = obj2 as Record<string, unknown>;
		const ignoreKeysSet = new Set(options.ignoreKeys || []);

		const keys1 = Object.keys(o1).filter((k) => !ignoreKeysSet.has(k));
		const keys2 = Object.keys(o2).filter((k) => !ignoreKeysSet.has(k));
		const allKeys = [...new Set([...keys1, ...keys2])];

		return allKeys.flatMap((key) => {
			const keyPath = path ? `${path}.${key}` : key;
			const inO1 = key in o1;
			const inO2 = key in o2;

			if (options.ignoreEmpty) {
				if (!inO1 && isEmpty(o2[key])) return [];
				if (!inO2 && isEmpty(o1[key])) return [];
			}

			if (!inO1)
				return [{ path: keyPath, type: 'added' as const, newValue: JSON.stringify(o2[key]) }];
			if (!inO2)
				return [{ path: keyPath, type: 'removed' as const, oldValue: JSON.stringify(o1[key]) }];
			return findDifferences(o1[key], o2[key], keyPath, options);
		});
	}

	const norm1 = normalizeValue(obj1, options);
	const norm2 = normalizeValue(obj2, options);

	return norm1 !== norm2
		? [{ path, type: 'changed', oldValue: JSON.stringify(obj1), newValue: JSON.stringify(obj2) }]
		: [];
};

/**
 * Find differences between two YAML strings.
 */
export const findYamlDifferences = (
	yaml1: string,
	yaml2: string,
	options: YamlDiffOptions = defaultYamlDiffOptions
): GenericDiffItem[] => {
	const obj1 = yaml.parse(yaml1);
	const obj2 = yaml.parse(yaml2);
	return findDifferences(obj1, obj2, '$', options);
};
