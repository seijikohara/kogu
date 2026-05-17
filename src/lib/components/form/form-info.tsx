import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface FormInfoProps {
	readonly title?: string;
	readonly showIcon?: boolean;
	readonly children?: ReactNode;
}

export function FormInfo({ title, showIcon = true, children }: FormInfoProps) {
	return (
		<div className="rounded-md border border-l-2 border-l-info/40 bg-muted/30 p-3 text-xs">
			{title ? (
				<div className="mb-1.5 flex items-center gap-1 font-medium text-foreground">
					{showIcon ? <Info className="h-3 w-3 text-info" /> : null}
					{title}
				</div>
			) : null}
			<div className="text-muted-foreground">{children}</div>
		</div>
	);
}

export type { FormInfoProps };
