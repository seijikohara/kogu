import type { ReactNode } from 'react';

import { CollapsibleAside } from '@/lib/components/ui/collapsible-aside';

interface OptionsPanelProps {
	readonly title?: string;
	readonly width?: string;
	readonly show?: boolean;
	readonly defaultShow?: boolean;
	readonly onShowChange?: (show: boolean) => void;
	readonly onClose?: () => void;
	readonly onOpen?: () => void;
	readonly children?: ReactNode;
}

export function OptionsPanel({
	title = 'Options',
	width = 'w-[var(--rail-w)]',
	show,
	defaultShow = true,
	onShowChange,
	onClose,
	onOpen,
	children,
}: OptionsPanelProps) {
	return (
		<CollapsibleAside
			show={show}
			defaultShow={defaultShow}
			onShowChange={onShowChange}
			title={title}
			background="bg-surface-2"
			width={width}
			onClose={onClose}
			onOpen={onOpen}
		>
			{children}
		</CollapsibleAside>
	);
}

export type { OptionsPanelProps };
