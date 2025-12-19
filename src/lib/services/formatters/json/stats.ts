/**
 * JSON Stats - Calculate Statistics
 */

import type { JsonStats } from '../types.js';
import { calculateStats, formatBytes } from '../utils.js';
import { parseJsonAuto } from './parser.js';

/** Calculate JSON statistics */
export const calculateJsonStats = (input: string): JsonStats => {
	const { data } = parseJsonAuto(input);
	const stats = calculateStats(data);
	return {
		keys: stats.keys,
		values: stats.values,
		depth: stats.maxDepth,
		size: formatBytes(new Blob([input]).size),
	};
};
