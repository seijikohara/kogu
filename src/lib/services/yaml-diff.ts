import * as yaml from 'yaml';
import type { GenericDiffItem } from '$lib/constants/diff.js';
import {
	compareArrays as compareArraysBase,
	compareObjects as compareObjectsBase,
	isEmpty,
	normalizeValue,
	type BaseDiffOptions,
} from './diff/index.js';

export interface YamlDiffOptions extends BaseDiffOptions {}

export const defaultYamlDiffOptions: Required<YamlDiffOptions> = {
	ignoreWhitespace: false,
	ignoreArrayOrder: false,
	ignoreCase: false,
	ignoreEmpty: false,
	deepCompare: true,
	ignoreKeys: [],
};

/**
 * Create a diff item for YAML comparison.
 */
const createDiffItem = (
	path: string,
	type: GenericDiffItem['type'],
	oldValue?: unknown,
	newValue?: unknown
): GenericDiffItem => ({
	path,
	type,
	...(oldValue !== undefined && { oldValue: JSON.stringify(oldValue) }),
	...(newValue !== undefined && { newValue: JSON.stringify(newValue) }),
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
		const str1 = JSON.stringify(obj1);
		const str2 = JSON.stringify(obj2);
		return str1 !== str2 ? [createDiffItem(path, 'changed', obj1, obj2)] : [];
	}

	if (typeof obj1 !== typeof obj2) {
		return [createDiffItem(path, 'changed', obj1, obj2)];
	}

	if (Array.isArray(obj1) && Array.isArray(obj2)) {
		return compareArraysBase(
			obj1,
			obj2,
			path,
			options,
			(p, v) => createDiffItem(p, 'added', undefined, v),
			(p, v) => createDiffItem(p, 'removed', v, undefined),
			findDifferences
		);
	}

	if (obj1 !== null && obj2 !== null && typeof obj1 === 'object' && typeof obj2 === 'object') {
		return compareObjectsBase(
			obj1 as Record<string, unknown>,
			obj2 as Record<string, unknown>,
			path,
			options,
			(p, v) => createDiffItem(p, 'added', undefined, v),
			(p, v) => createDiffItem(p, 'removed', v, undefined),
			findDifferences
		);
	}

	const norm1 = normalizeValue(obj1, options);
	const norm2 = normalizeValue(obj2, options);
	return norm1 !== norm2 ? [createDiffItem(path, 'changed', obj1, obj2)] : [];
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
