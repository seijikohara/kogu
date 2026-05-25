/**
 * Tailwind class helpers used by the diff viewer for line / segment tinting.
 *
 * These are colocated with the diff types so the viewer route does not
 * need to know the cn / token vocabulary itself — it just hands the
 * line / segment kind to the matching helper.
 */

import type { DiffLineType, DiffSide, DiffType } from './types';

/** Get CSS class for character-level segment highlighting. */
export const getDiffSegmentClass = (type: DiffType, side: DiffSide): string => {
	if (type === 'equal') return '';
	if (side === 'left' && type === 'delete') {
		return 'bg-destructive/40 text-destructive-foreground rounded-sm';
	}
	if (side === 'right' && type === 'insert') {
		return 'bg-success/40 text-success-foreground rounded-sm';
	}
	return '';
};

/** Get background CSS class for left side line in split view. */
export const getDiffLeftLineBgClass = (type: DiffLineType): string => {
	switch (type) {
		case 'delete':
			return 'bg-destructive/15';
		case 'modified':
			return 'bg-warning/10';
		case 'insert':
			return 'bg-muted/30';
		default:
			return '';
	}
};

/** Get background CSS class for right side line in split view. */
export const getDiffRightLineBgClass = (type: DiffLineType): string => {
	switch (type) {
		case 'insert':
			return 'bg-success/15';
		case 'modified':
			return 'bg-warning/10';
		case 'delete':
			return 'bg-muted/30';
		default:
			return '';
	}
};

/** Get background CSS class for unified view line. */
export const getDiffUnifiedLineClass = (type: DiffType): string => {
	switch (type) {
		case 'insert':
			return 'bg-success/15';
		case 'delete':
			return 'bg-destructive/15';
		default:
			return '';
	}
};

/** Get CSS class for unified view line prefix (+ / - / space). */
export const getDiffPrefixClass = (type: DiffType): string => {
	switch (type) {
		case 'insert':
			return 'text-success font-bold';
		case 'delete':
			return 'text-destructive font-bold';
		default:
			return 'text-muted-foreground';
	}
};

/** Get CSS class for unified view segment highlighting. */
export const getDiffUnifiedSegmentClass = (
	segType: DiffType,
	lineType: 'insert' | 'delete'
): string => {
	if (segType === 'equal') return '';
	if (lineType === 'delete' && segType === 'delete') {
		return 'bg-destructive/50 rounded-sm px-0.5';
	}
	if (lineType === 'insert' && segType === 'insert') {
		return 'bg-success/50 rounded-sm px-0.5';
	}
	return '';
};
