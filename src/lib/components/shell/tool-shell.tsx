import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Rail, type RailSize } from '@/lib/components/ui/rail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import { isModKey } from '@/lib/utils/keyboard';

import { StatusBar } from './status-bar';
import { ToolBar } from './tool-bar';

interface TabDefinition {
	readonly id: string;
	readonly label: string;
	readonly icon: LucideIcon;
}

type ShellLayout = 'tabbed' | 'transform' | 'master-detail';

interface PrimaryAction {
	readonly run: () => void;
	readonly canRun?: boolean;
}

interface ToolShellProps {
	readonly layout?: ShellLayout;

	readonly title?: string;
	readonly toolbarLeading?: ReactNode;
	readonly toolbarCenter?: ReactNode;
	readonly toolbarTrailing?: ReactNode;

	readonly tabs?: readonly TabDefinition[];
	readonly activeTab?: string;
	readonly onTabChange?: (tab: string) => void;
	readonly renderTabContent?: (tabId: string) => ReactNode;

	readonly showRail?: boolean;
	readonly defaultShowRail?: boolean;
	readonly onShowRailChange?: (show: boolean) => void;
	readonly railTitle?: string;
	readonly railSize?: RailSize;
	readonly rail?: ReactNode;

	readonly valid?: boolean | null;
	readonly error?: string;
	readonly statusContent?: ReactNode;

	/**
	 * Page-level primary action. When provided, Cmd/Ctrl+Enter invokes
	 * `run` (unless `canRun === false` or the user is composing in an
	 * IME). Pair with `<ActionButton shortcutHint />` on the visible
	 * button to surface the `⏎` badge without registering a duplicate
	 * window listener.
	 */
	readonly primaryAction?: PrimaryAction;

	readonly children?: ReactNode;
}

export function ToolShell({
	layout = 'transform',
	title,
	toolbarLeading,
	toolbarCenter,
	toolbarTrailing,
	tabs,
	activeTab,
	onTabChange,
	renderTabContent,
	showRail: controlledShowRail,
	defaultShowRail = true,
	onShowRailChange,
	railTitle = 'Options',
	railSize = 'default',
	rail,
	valid,
	error,
	statusContent,
	primaryAction,
	children,
}: ToolShellProps) {
	const [internalShowRail, setInternalShowRail] = useState(defaultShowRail);
	const showRail = controlledShowRail ?? internalShowRail;

	const setShowRail = useCallback(
		(next: boolean) => {
			if (controlledShowRail === undefined) setInternalShowRail(next);
			onShowRailChange?.(next);
		},
		[controlledShowRail, onShowRailChange]
	);

	const shellRef = useRef<HTMLDivElement | null>(null);
	const hasTabs = Boolean(tabs && tabs.length > 0);

	const railState = useMemo<'open' | 'closed' | 'none'>(() => {
		if (!rail) return 'none';
		return showRail ? 'open' : 'closed';
	}, [rail, showRail]);

	useEffect(() => {
		const el = shellRef.current;
		if (!el) return;
		const handler = (e: KeyboardEvent) => {
			if (!isModKey(e)) return;
			// Skip while the user is composing in an IME so Cmd+1..9 cannot hijack
			// candidate selection.
			if (e.isComposing) return;

			if (e.key === ',' && rail) {
				e.preventDefault();
				setShowRail(!showRail);
				return;
			}

			if (e.key === 'Enter' && primaryAction && primaryAction.canRun !== false) {
				e.preventDefault();
				primaryAction.run();
				return;
			}

			if (e.key >= '1' && e.key <= '9' && tabs && tabs.length > 0) {
				const idx = Number.parseInt(e.key, 10) - 1;
				const tab = tabs[idx];
				if (tab) {
					e.preventDefault();
					onTabChange?.(tab.id);
				}
			}
		};
		el.addEventListener('keydown', handler);
		return () => el.removeEventListener('keydown', handler);
	}, [rail, showRail, setShowRail, tabs, onTabChange, primaryAction]);

	const shell = (
		<div
			ref={shellRef}
			className="tool-shell"
			data-layout={layout}
			data-rail={railState}
			data-rail-size={railSize}
		>
			<div className="tool-toolbar">
				<ToolBar
					title={title}
					leading={toolbarLeading}
					trailing={toolbarTrailing}
					center={
						toolbarCenter ??
						(hasTabs && tabs ? (
							<TabsList className="inline-flex h-auto items-center gap-0.5 rounded-lg bg-surface-2 p-1 shadow-inner">
								{tabs.map((tab) => {
									const TabIcon = tab.icon;
									return (
										<TabsTrigger
											key={tab.id}
											value={tab.id}
											className="inline-flex flex-none items-center gap-1.5 rounded-md border-0 px-3.5 py-2 text-sm font-medium text-muted-foreground transition-all duration-base hover:bg-interactive-hover hover:text-foreground data-active:bg-surface-0 data-active:text-foreground data-active:shadow-sm"
										>
											<TabIcon className="h-4 w-4" />
											{tab.label}
										</TabsTrigger>
									);
								})}
							</TabsList>
						) : null)
					}
				/>
			</div>

			{rail ? (
				<div className="tool-rail">
					<Rail
						show={showRail}
						title={railTitle}
						size={railSize}
						onShowChange={setShowRail}
						onClose={() => setShowRail(false)}
						onOpen={() => setShowRail(true)}
					>
						{rail}
					</Rail>
				</div>
			) : null}

			<div className="tool-content animate-fade-in">
				{hasTabs && renderTabContent && tabs && activeTab
					? tabs.map((tab) => (
							<TabsContent
								key={tab.id}
								value={tab.id}
								className="flex h-full min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
							>
								{renderTabContent(tab.id)}
							</TabsContent>
						))
					: children}
			</div>

			<div className="tool-status">
				<StatusBar valid={valid} error={error}>
					{statusContent}
				</StatusBar>
			</div>

			<style>{`
				.tool-shell {
					display: grid;
					height: 100%;
					overflow: hidden;
					grid-template-rows: var(--toolbar-h) 1fr var(--status-h);
				}
				.tool-shell[data-rail='open'][data-rail-size='default'] {
					grid-template-columns: var(--rail-w) 1fr;
					grid-template-areas:
						'toolbar toolbar'
						'rail content'
						'status status';
				}
				.tool-shell[data-rail='open'][data-rail-size='wide'] {
					grid-template-columns: var(--rail-w-wide) 1fr;
					grid-template-areas:
						'toolbar toolbar'
						'rail content'
						'status status';
				}
				.tool-shell[data-rail='closed'] {
					grid-template-columns: var(--rail-w-collapsed) 1fr;
					grid-template-areas:
						'toolbar toolbar'
						'rail content'
						'status status';
				}
				.tool-shell[data-rail='none'] {
					grid-template-columns: 1fr;
					grid-template-areas:
						'toolbar'
						'content'
						'status';
				}
				.tool-toolbar { grid-area: toolbar; }
				.tool-rail { grid-area: rail; overflow: hidden; display: flex; flex-direction: column; }
				.tool-content { grid-area: content; overflow: hidden; display: flex; flex-direction: column; }
				.tool-status { grid-area: status; }
			`}</style>
		</div>
	);

	if (hasTabs && tabs && activeTab) {
		return (
			<Tabs value={activeTab} onValueChange={onTabChange} className="contents">
				{shell}
			</Tabs>
		);
	}

	return shell;
}

export type { ToolShellProps, TabDefinition, ShellLayout, PrimaryAction };
