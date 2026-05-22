import { forwardRef } from 'react';

import { NavButtons } from './nav-buttons';
import { TitleBarCommand, type TitleBarCommandHandle } from './title-bar-command';

export const TitleBar = forwardRef<TitleBarCommandHandle, TitleBarProps>(
	function TitleBar(_props, ref) {
		return (
			<header
				data-tauri-drag-region
				className="flex h-8 shrink-0 items-center justify-center gap-2 border-b bg-surface-1 px-4"
			>
				<NavButtons />
				<TitleBarCommand ref={ref} />
			</header>
		);
	}
);

export type TitleBarProps = {
	readonly className?: string;
};
