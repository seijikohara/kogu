import { useState, type ReactNode } from 'react';
import { Settings2 } from 'lucide-react';

import { Button } from '@/lib/components/ui/button';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CollapsibleAsideProps {
	readonly show?: boolean;
	readonly defaultShow?: boolean;
	readonly onShowChange?: (show: boolean) => void;
	readonly title?: string;
	readonly background?: string;
	readonly width?: string;
	readonly children?: ReactNode;
	readonly onClose?: () => void;
	readonly onOpen?: () => void;
}

export function CollapsibleAside({
	show: controlledShow,
	defaultShow = true,
	onShowChange,
	title = 'Options',
	background = 'bg-surface-2',
	width = 'w-[var(--rail-w)]',
	children,
	onClose,
	onOpen,
}: CollapsibleAsideProps) {
	const [internalShow, setInternalShow] = useState(defaultShow);
	const show = controlledShow ?? internalShow;

	const setShow = (next: boolean) => {
		if (controlledShow === undefined) setInternalShow(next);
		onShowChange?.(next);
	};

	const handleToggle = () => {
		if (show) {
			setShow(false);
			onClose?.();
			return;
		}
		setShow(true);
		onOpen?.();
	};

	const toggleLabel = show ? `Collapse ${title}` : `Expand ${title}`;

	return (
		<aside
			className={cn(
				'relative flex h-full shrink-0 flex-col border-r border-border/50',
				show ? cn(width, 'overflow-hidden') : 'w-[var(--rail-w-collapsed)]',
				background
			)}
			data-slot="collapsible-aside"
			data-state={show ? 'open' : 'closed'}
		>
			{show ? (
				<ScrollArea className="min-h-0 flex-1">
					<div className="py-3">{children}</div>
				</ScrollArea>
			) : (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="ghost" size="icon" className="m-1.5 h-8 w-8" onClick={handleToggle}>
							<Settings2 className="h-4 w-4" />
							<span className="sr-only">Show {title}</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Show {title}</TooltipContent>
				</Tooltip>
			)}
			<button
				type="button"
				data-slot="collapsible-aside-rail"
				aria-label={toggleLabel}
				title={toggleLabel}
				tabIndex={-1}
				onClick={handleToggle}
				className={cn(
					'absolute inset-y-0 end-0 z-20 hidden w-4 transition-all ease-linear sm:flex',
					'after:absolute after:inset-y-0 after:end-0 after:w-[2px]',
					'hover:after:bg-border',
					show ? 'cursor-w-resize' : 'cursor-e-resize'
				)}
			/>
		</aside>
	);
}
