/**
 * JSON Query - JSONPath Query Execution
 */

import { parseJsonAuto } from './parser.js';

/** Execute JSONPath query */
export const executeJsonPath = (input: string, path: string): unknown => {
	const { data: parsed } = parseJsonAuto(input);
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
