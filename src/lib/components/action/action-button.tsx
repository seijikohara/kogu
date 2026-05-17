import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';

import { Button } from '@/lib/components/ui/button';
import { cn } from '@/lib/utils';
import { formatShortcut, isModKey } from '@/lib/utils/keyboard';

interface ActionButtonProps {
	readonly label: string;
	readonly icon?: LucideIcon;
	readonly loading?: boolean;
	readonly loadingLabel?: string;
	readonly disabled?: boolean;
	readonly variant?: 'default' | 'outline' | 'destructive' | 'ghost' | 'secondary';
	readonly size?: 'default' | 'sm';
	readonly className?: string;
	readonly shortcut?: boolean;
	readonly onClick: () => void;
}

export function ActionButton({
	label,
	icon: Icon,
	loading = false,
	loadingLabel,
	disabled = false,
	variant = 'default',
	size = 'default',
	className,
	shortcut = false,
	onClick,
}: ActionButtonProps) {
	const displayLabel = loading ? (loadingLabel ?? `${label}...`) : label;
	const iconClass = size === 'sm' ? 'mr-1.5 h-3.5 w-3.5' : 'mr-2 h-4 w-4';
	const spinnerClass = size === 'sm' ? 'mr-1.5 h-3.5 w-3.5' : 'mr-2 h-4 w-4';
	const sizeClass = size === 'sm' ? 'h-8 text-xs' : 'h-9';
	const shortcutLabel = useMemo(() => formatShortcut('⏎', true), []);

	useEffect(() => {
		if (!shortcut) return;
		const handler = (e: KeyboardEvent) => {
			if (isModKey(e) && e.key === 'Enter' && !disabled && !loading) {
				e.preventDefault();
				onClick();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [shortcut, disabled, loading, onClick]);

	return (
		<Button
			variant={variant}
			className={cn('w-full', sizeClass, className)}
			disabled={disabled}
			onClick={() => onClick()}
		>
			{loading ? (
				<div
					className={cn(
						spinnerClass,
						'animate-spin rounded-full border-2 border-current border-t-transparent'
					)}
				/>
			) : Icon ? (
				<Icon className={iconClass} />
			) : null}
			{displayLabel}
			{shortcut && !loading ? (
				<kbd className="ml-1.5 rounded border border-current/20 px-1 py-0.5 font-mono text-2xs opacity-60">
					{shortcutLabel}
				</kbd>
			) : null}
		</Button>
	);
}

export type { ActionButtonProps };
