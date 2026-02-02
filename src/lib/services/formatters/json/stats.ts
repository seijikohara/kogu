/**
 * JSON Stats - Calculate Statistics
 */

import type { JsonInputFormat, JsonStats } from '../types.js';
import { calculateStats, formatBytes } from '../utils.js';
import { parseJson, parseJsonAuto } from './parser.js';

/** Calculate JSON statistics */
export const calculateJsonStats = (input: string, format?: JsonInputFormat): JsonStats => {
	const data = format ? parseJson(input, format) : parseJsonAuto(input).data;
	const stats = calculateStats(data);
	return {
		keys: stats.keys,
		values: stats.values,
		depth: stats.maxDepth,
		size: formatBytes(new Blob([input]).size),
	};
};
