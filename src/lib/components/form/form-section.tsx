import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/lib/components/ui/collapsible';

interface FormSectionProps {
	readonly title: string;
	readonly defaultOpen?: boolean;
	readonly open?: boolean;
	readonly onOpenChange?: (open: boolean) => void;
	readonly children?: ReactNode;
}

export function FormSection({
	title,
	defaultOpen = true,
	open: controlledOpen,
	onOpenChange,
	children,
}: FormSectionProps) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const open = controlledOpen ?? internalOpen;

	const handleOpenChange = (next: boolean) => {
		if (controlledOpen === undefined) setInternalOpen(next);
		onOpenChange?.(next);
	};

	return (
		<Collapsible
			open={open}
			onOpenChange={handleOpenChange}
			className="group border-b border-border/30 last:border-b-0"
		>
			<CollapsibleTrigger className="flex h-9 w-full items-center justify-between px-4 text-sm font-semibold text-foreground/70 transition-colors hover:bg-interactive-hover">
				{title}
				<ChevronDown className="h-4 w-4 text-muted-foreground/50 transition-transform group-data-[state=closed]:-rotate-90" />
			</CollapsibleTrigger>
			<CollapsibleContent className="space-y-3 px-4 pb-4">{children}</CollapsibleContent>
		</Collapsible>
	);
}

export type { FormSectionProps };
