/**
 * Diff utilities for comparing structured data.
 */

// Common types and options
export { type BaseDiffOptions, defaultBaseDiffOptions } from './types.js';

// Common utilities
export {
	normalizeValue,
	isEmpty,
	sortArray,
	compareArrays,
	compareObjects,
} from './object-diff.js';
