/**
 * JSON Query - JSONPath Query Execution
 */

import type { JsonInputFormat } from '../types.js';
import { parseJson, parseJsonAuto } from './parser.js';

/** Execute JSONPath query */
export const executeJsonPath = (input: string, path: string, format?: JsonInputFormat): unknown => {
	const parsed = format ? parseJson(input, format) : parseJsonAuto(input).data;
	const parts = path
		.replace(/^\$\.?/, '')
		.split(/\.|\[|\]/)
		.filter(Boolean);

	return parts.reduce<unknown>((current, part) => {
		if (current === undefined || current === null) {
			throw new Error(`Path not found: ${path}`);
		}

		if (Array.isArray(current)) {
			const index = Number.parseInt(part, 10);
			if (Number.isNaN(index)) throw new Error(`Invalid array index: ${part}`);
			return current[index];
		}

		if (typeof current === 'object') {
			return (current as Record<string, unknown>)[part];
		}

		throw new Error(`Cannot access property of non-object: ${part}`);
	}, parsed);
};
