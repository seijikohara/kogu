/**
 * Diff type definition for comparison results.
 */
export type DiffType = 'added' | 'removed' | 'changed';

/**
 * Generic diff item interface.
 */
export interface GenericDiffItem {
	path: string;
	type: DiffType;
	oldValue?: string;
	newValue?: string;
}

/**
 * Diff summary counts.
 */
export interface DiffSummary {
	total: number;
	added: number;
	removed: number;
	changed: number;
}

/**
 * CSS classes for diff type styling.
 */
export const DIFF_TYPE_CLASSES = {
	added: 'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300',
	removed: 'bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300',
	changed: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-700 dark:text-yellow-300',
} as const satisfies Record<DiffType, string>;

/**
 * Get CSS class for a diff type.
 */
export const getDiffTypeClass = (type: DiffType): string => DIFF_TYPE_CLASSES[type];

/**
 * Calculate diff summary from diff items.
 */
export const calculateDiffSummary = <T extends { type: DiffType }>(
	diffs: readonly T[]
): DiffSummary => ({
	total: diffs.length,
	added: diffs.filter((d) => d.type === 'added').length,
	removed: diffs.filter((d) => d.type === 'removed').length,
	changed: diffs.filter((d) => d.type === 'changed').length,
});
