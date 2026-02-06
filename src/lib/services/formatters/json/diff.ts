/**
 * JSON Diff - Find Differences Between JSON
 */

import {
	compareArrays as compareArraysBase,
	compareObjects as compareObjectsBase,
	isEmpty,
	normalizeValue as normalizeValueBase,
} from '../../diff/index.js';
import { defaultJsonDiffOptions } from '../constants.js';
import type { DiffItem, JsonDiffOptions, JsonInputFormat } from '../types.js';
import { parseJson, parseJsonAuto } from './parser.js';

// ============================================================================
// Helper Functions
// ============================================================================

const normalizeValue = (value: unknown, opts: JsonDiffOptions): unknown => {
	const baseNormalized = normalizeValueBase(value, opts);
	if (typeof value === 'number' && opts.ignoreNumericType) {
		return String(value);
	}
	return baseNormalized;
};

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
		return compareArraysBase(
			obj1,
			obj2,
			path,
			opts,
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
			opts,
			(p, v) => createDiffItem(p, 'added', undefined, v),
			(p, v) => createDiffItem(p, 'removed', v, undefined),
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
	options: JsonDiffOptions = {},
	format?: JsonInputFormat
): DiffItem[] => {
	const parse = (s: string) => (format ? parseJson(s, format) : parseJsonAuto(s).data);
	const opts = { ...defaultJsonDiffOptions, ...options };
	return findDifferences(parse(json1), parse(json2), '$', opts);
};
