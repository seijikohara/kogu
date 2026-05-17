import type { ReactNode } from 'react';

import { CollapsibleAside } from '@/lib/components/ui/collapsible-aside';

interface OptionsRailProps {
	readonly show?: boolean;
	readonly defaultShow?: boolean;
	readonly onShowChange?: (show: boolean) => void;
	readonly title?: string;
	readonly children?: ReactNode;
	readonly onClose?: () => void;
	readonly onOpen?: () => void;
}

export function OptionsRail({
	show,
	defaultShow = true,
	onShowChange,
	title = 'Options',
	children,
	onClose,
	onOpen,
}: OptionsRailProps) {
	return (
		<CollapsibleAside
			show={show}
			defaultShow={defaultShow}
			onShowChange={onShowChange}
			title={title}
			background="bg-sidebar"
			width="w-[var(--rail-w)]"
			onClose={onClose}
			onOpen={onOpen}
		>
			{children}
		</CollapsibleAside>
	);
}

export type { OptionsRailProps };
