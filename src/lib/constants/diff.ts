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
	added: 'bg-success/20 border-success/50 text-success',
	removed: 'bg-destructive/20 border-destructive/50 text-destructive',
	changed: 'bg-warning/20 border-warning/50 text-warning',
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
