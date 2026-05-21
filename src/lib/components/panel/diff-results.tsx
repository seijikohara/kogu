import { useMemo } from 'react';
import { Minus, Plus, RefreshCw } from 'lucide-react';

import { Button } from '@/lib/components/ui/button';
import {
	calculateDiffSummary,
	getDiffTypeClass,
	type DiffSummary,
	type DiffType,
} from '@/lib/constants/diff';
import { cn } from '@/lib/utils';

interface DiffItem {
	readonly path: string;
	readonly type: DiffType;
	readonly oldValue?: string;
	readonly newValue?: string;
}

interface DiffResultsProps {
	readonly diffs: readonly DiffItem[];
	readonly selectedDiff?: DiffItem | null;
	readonly onDiffClick?: (diff: DiffItem) => void;
	readonly checkIdentical?: boolean;
	readonly hasContent?: boolean;
}

export function DiffResults({
	diffs,
	selectedDiff = null,
	onDiffClick,
	checkIdentical = false,
	hasContent = true,
}: DiffResultsProps) {
	const summary = useMemo<DiffSummary>(() => calculateDiffSummary(diffs), [diffs]);

	if (diffs.length === 0) {
		if (checkIdentical && hasContent) {
			return (
				<div className="flex h-8 items-center justify-center border-t bg-success/20 text-xs font-medium text-success">
					✓ Identical
				</div>
			);
		}
		return null;
	}

	return (
		<>
			<div className="flex items-center gap-4 border-t bg-surface-3 px-3 py-1.5 text-xs">
				<span className="font-medium">
					{summary.total} difference{summary.total !== 1 ? 's' : ''}
				</span>
				{summary.added > 0 ? (
					<span className="flex items-center gap-1 text-success">
						<Plus className="h-3 w-3" />
						{summary.added}
					</span>
				) : null}
				{summary.removed > 0 ? (
					<span className="flex items-center gap-1 text-destructive">
						<Minus className="h-3 w-3" />
						{summary.removed}
					</span>
				) : null}
				{summary.changed > 0 ? (
					<span className="flex items-center gap-1 text-warning">
						<RefreshCw className="h-3 w-3" />
						{summary.changed}
					</span>
				) : null}
			</div>
			<div className="max-h-64 overflow-auto border-t bg-surface-2 p-2">
				<div className="space-y-1">
					{diffs.map((diff) => (
						<Button
							key={diff.path}
							variant="ghost"
							size="sm"
							className={cn(
								'h-auto w-full justify-start gap-2 rounded border px-2 py-1.5 text-left hover:ring-2 hover:ring-ring/50',
								getDiffTypeClass(diff.type),
								selectedDiff?.path === diff.path && 'ring-2 ring-ring'
							)}
							onClick={() => onDiffClick?.(diff)}
						>
							<DiffIcon type={diff.type} />
							<span className="shrink-0 font-mono text-xs font-medium">{diff.path}</span>
							<span className="truncate text-xs opacity-80">
								<DiffValue diff={diff} />
							</span>
						</Button>
					))}
				</div>
			</div>
		</>
	);
}

function DiffIcon({ type }: { readonly type: DiffType }) {
	if (type === 'added') return <Plus className="h-4 w-4 shrink-0 text-success" />;
	if (type === 'removed') return <Minus className="h-4 w-4 shrink-0 text-destructive" />;
	return <RefreshCw className="h-4 w-4 shrink-0 text-warning" />;
}

function DiffValue({ diff }: { readonly diff: DiffItem }) {
	if (diff.type === 'added') return <>{diff.newValue}</>;
	if (diff.type === 'removed') return <>{diff.oldValue}</>;
	return (
		<>
			{diff.oldValue} → {diff.newValue}
		</>
	);
}

export type { DiffItem, DiffResultsProps };
