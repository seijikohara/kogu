import { useState, type ReactNode } from 'react';
import { Settings2 } from 'lucide-react';

import { Button } from '@/lib/components/ui/button';
import { IconTooltip } from '@/lib/components/ui/icon-tooltip';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type RailSize = 'default' | 'wide';
type RailSide = 'left' | 'right';

interface RailProps {
	readonly show?: boolean;
	readonly defaultShow?: boolean;
	readonly onShowChange?: (show: boolean) => void;
	readonly title?: string;
	readonly size?: RailSize;
	readonly side?: RailSide;
	readonly children?: ReactNode;
	readonly onClose?: () => void;
	readonly onOpen?: () => void;
}

const SIZE_CLASS: Record<RailSize, string> = {
	default: 'w-[var(--rail-w)]',
	wide: 'w-[var(--rail-w-wide)]',
};

export function Rail({
	show: controlledShow,
	defaultShow = true,
	onShowChange,
	title = 'Options',
	size = 'default',
	side = 'left',
	children,
	onClose,
	onOpen,
}: RailProps) {
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
				'relative flex h-full shrink-0 flex-col border-border bg-sidebar',
				'data-[side=left]:border-r data-[side=right]:border-l',
				show ? cn(SIZE_CLASS[size], 'overflow-hidden') : 'w-[var(--rail-w-collapsed)]'
			)}
			data-slot="rail"
			data-state={show ? 'open' : 'closed'}
			data-size={size}
			data-side={side}
		>
			{show ? (
				<ScrollArea className="min-h-0 flex-1">
					<div className="py-3">{children}</div>
				</ScrollArea>
			) : (
				<IconTooltip label={`Show ${title}`}>
					<Button
						variant="ghost"
						size="icon"
						className="m-1.5 h-8 w-8 hover:bg-interactive-hover"
						onClick={handleToggle}
					>
						<Settings2 className="h-4 w-4" />
						<span className="sr-only">Show {title}</span>
					</Button>
				</IconTooltip>
			)}
			<button
				type="button"
				data-slot="rail-resizer"
				aria-label={toggleLabel}
				title={toggleLabel}
				tabIndex={-1}
				onClick={handleToggle}
				className={cn(
					'absolute inset-y-0 z-20 hidden w-4 transition-all ease-linear sm:flex',
					'after:absolute after:inset-y-0 after:w-[2px] hover:after:bg-border',
					side === 'left' ? 'end-0 after:end-0' : 'start-0 after:start-0',
					show
						? side === 'left'
							? 'cursor-w-resize'
							: 'cursor-e-resize'
						: side === 'left'
							? 'cursor-e-resize'
							: 'cursor-w-resize'
				)}
			/>
		</aside>
	);
}

export type { RailProps, RailSize, RailSide };
