import type { DiffOptions } from './types';

export const defaultDiffOptions: DiffOptions = {
	ignoreWhitespace: false,
	ignoreCase: false,
	trimLines: false,
};

/**
 * Normalize text for line-level comparison according to the active options.
 */
export const normalizeForComparison = (text: string, options: DiffOptions): string => {
	const trimmed = options.trimLines ? text.trim() : text;
	const collapsed = options.ignoreWhitespace ? trimmed.replace(/\s+/g, ' ').trim() : trimmed;
	return options.ignoreCase ? collapsed.toLowerCase() : collapsed;
};
