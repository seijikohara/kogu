/**
 * Common diff types and interfaces.
 */

/**
 * Base options for object/value comparison.
 */
export interface BaseDiffOptions {
	readonly ignoreWhitespace?: boolean;
	readonly ignoreArrayOrder?: boolean;
	readonly ignoreCase?: boolean;
	readonly ignoreEmpty?: boolean;
	readonly deepCompare?: boolean;
	readonly ignoreKeys?: readonly string[];
}

/**
 * Default options for object comparison.
 */
export const defaultBaseDiffOptions: Required<BaseDiffOptions> = {
	ignoreWhitespace: false,
	ignoreArrayOrder: false,
	ignoreCase: false,
	ignoreEmpty: false,
	deepCompare: true,
	ignoreKeys: [],
};
