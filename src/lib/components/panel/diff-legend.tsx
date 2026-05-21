import { FormSection } from '@/lib/components/form';
import { Card, CardContent } from '@/lib/components/ui/card';

interface DiffLegendProps {
	readonly title?: string;
}

export function DiffLegend({ title = 'Legend' }: DiffLegendProps) {
	return (
		<FormSection title={title}>
			<Card density="compact">
				<CardContent className="space-y-1.5 p-2">
					<div className="flex items-center gap-2 text-xs">
						<span className="h-2.5 w-2.5 rounded-sm bg-success/40" />
						<span className="text-muted-foreground">Added</span>
					</div>
					<div className="flex items-center gap-2 text-xs">
						<span className="h-2.5 w-2.5 rounded-sm bg-destructive/40" />
						<span className="text-muted-foreground">Removed</span>
					</div>
					<div className="flex items-center gap-2 text-xs">
						<span className="h-2.5 w-2.5 rounded-sm bg-warning/40" />
						<span className="text-muted-foreground">Changed</span>
					</div>
				</CardContent>
			</Card>
		</FormSection>
	);
}

export type { DiffLegendProps };
