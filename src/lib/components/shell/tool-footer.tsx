/**
 * Canonical rail footer pair: Related → About.
 *
 * Every tool route is expected to end its rail with these two sections
 * in this order. `ToolFooter` encodes that contract so individual
 * routes cannot accidentally reorder them, drop one, or skip both.
 * The component renders nothing when both `aboutText` and
 * `relatedItems` are absent, so it is safe to drop in unconditionally.
 *
 * For tool routes with no peer tools, omit `relatedItems` and only the
 * About section renders. For routes whose About copy contains rich
 * inline structure (links, code spans), pass it as `aboutText` —
 * `FormInfo` renders plain text or React nodes.
 */
import type { ReactNode } from 'react';

import { FormInfo, FormSection } from '@/lib/components/form';
import { RelatedTools, type RelatedToolItem } from '@/lib/components/layout';

interface ToolFooterProps {
	readonly aboutText?: ReactNode;
	readonly relatedItems?: readonly RelatedToolItem[];
}

export function ToolFooter({ aboutText, relatedItems }: ToolFooterProps) {
	const hasAbout = aboutText !== undefined;
	const hasRelated = relatedItems !== undefined && relatedItems.length > 0;
	if (!hasAbout && !hasRelated) return null;
	return (
		<>
			{hasRelated ? (
				<FormSection title="Related">
					<RelatedTools items={relatedItems} />
				</FormSection>
			) : null}
			{hasAbout ? (
				<FormSection title="About">
					<FormInfo>{aboutText}</FormInfo>
				</FormSection>
			) : null}
		</>
	);
}

export type { ToolFooterProps };
