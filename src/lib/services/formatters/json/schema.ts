/**
 * JSON Schema - Schema Inference
 */

import type { JsonInputFormat } from '../types.js';
import { parseJson, parseJsonAuto } from './parser.js';

// ============================================================================
// Schema Inference
// ============================================================================

const STRING_FORMAT_PATTERNS = [
	{ pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, format: 'email' },
	{ pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'date' },
	{ pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, format: 'date-time' },
	{ pattern: /^https?:\/\//, format: 'uri' },
] as const;

const inferStringFormat = (value: string): Record<string, string> => {
	const match = STRING_FORMAT_PATTERNS.find(({ pattern }) => pattern.test(value));
	return match ? { type: 'string', format: match.format } : { type: 'string' };
};

const inferSchema = (data: unknown): Record<string, unknown> => {
	if (data === null) return { type: 'null' };

	if (Array.isArray(data)) {
		return { type: 'array', items: data.length === 0 ? {} : inferSchema(data[0]) };
	}

	if (typeof data === 'object') {
		const entries = Object.entries(data);
		return {
			type: 'object',
			properties: Object.fromEntries(entries.map(([key, value]) => [key, inferSchema(value)])),
			required: entries.map(([key]) => key),
		};
	}

	if (typeof data === 'string') return inferStringFormat(data);
	if (typeof data === 'number')
		return Number.isInteger(data) ? { type: 'integer' } : { type: 'number' };
	if (typeof data === 'boolean') return { type: 'boolean' };

	return {};
};

/** Infer JSON Schema from input */
export const inferJsonSchema = (input: string, format?: JsonInputFormat): Record<string, unknown> =>
	inferSchema(format ? parseJson(input, format) : parseJsonAuto(input).data);
