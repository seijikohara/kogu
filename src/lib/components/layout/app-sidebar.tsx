import { useEffect } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Clock, Pin, PinOff, Settings } from 'lucide-react';

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/lib/components/ui/collapsible';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from '@/lib/components/ui/context-menu';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from '@/lib/components/ui/sidebar';
import {
	CATEGORIES,
	getPageById,
	getPageByUrl,
	getPagesByCategory,
	type PageDefinition,
} from '@/lib/services/pages';
import { useRecentToolsStore, useSidebarStore, useToolPinsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface ToolMenuItemProps {
	readonly tool: PageDefinition;
	readonly active: boolean;
	readonly pinned: boolean;
	readonly onTogglePin: (toolId: string) => void;
	/** Optional key prefix when the same tool may appear in multiple groups (e.g. Recent vs Categorized). */
	readonly keyPrefix?: string;
}

function ToolMenuItem({ tool, active, pinned, onTogglePin, keyPrefix }: ToolMenuItemProps) {
	const ToolIcon = tool.icon;
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<SidebarMenuItem key={keyPrefix ? `${keyPrefix}-${tool.id}` : tool.id}>
					<SidebarMenuButton isActive={active} tooltip={tool.title} asChild>
						<Link to={tool.url as never}>
							<ToolIcon />
							<span>{tool.title}</span>
						</Link>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-44">
				<ContextMenuItem onSelect={() => onTogglePin(tool.id)}>
					{pinned ? (
						<>
							<PinOff className="size-4" />
							<span>Unpin</span>
						</>
					) : (
						<>
							<Pin className="size-4" />
							<span>Pin to top</span>
						</>
					)}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

export function AppSidebar(_: AppSidebarProps = {}) {
	const openGroups = useSidebarStore((s) => s.openGroups);
	const setGroupOpen = useSidebarStore((s) => s.setGroupOpen);
	const recent = useRecentToolsStore((s) => s.recent);
	const recordVisit = useRecentToolsStore((s) => s.recordVisit);
	const pinned = useToolPinsStore((s) => s.pinned);
	const togglePin = useToolPinsStore((s) => s.togglePin);

	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const sidebar = useSidebar();

	// Record visits to tool pages (excludes `/` and `/settings`, which are
	// filtered out of `getToolPages`'s definition).
	useEffect(() => {
		const page = getPageByUrl(pathname);
		if (!page || page.id === 'dashboard' || page.id === 'settings') return;
		recordVisit(page.id);
	}, [pathname, recordVisit]);

	const pinnedSet = new Set(pinned);

	const pinnedPages = pinned
		.map((id) => getPageById(id))
		.filter((page): page is NonNullable<typeof page> => page !== undefined);

	// Hide pinned tools from Recent — they're already prominent at the top.
	const recentPages = recent
		.map((entry) => getPageById(entry.toolId))
		.filter((page): page is NonNullable<typeof page> => page !== undefined)
		.filter((page) => !pinnedSet.has(page.id));

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="border-b border-sidebar-border/50 pb-2">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
							asChild
						>
							<Link to="/">
								<img src="/logo.svg" alt="Kogu" className="size-8 rounded-lg" />
								<span className="flex-1 truncate text-sm font-semibold">Kogu</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				{pinnedPages.length > 0 ? (
					<SidebarGroup>
						<SidebarGroupLabel className="text-sidebar-foreground">
							<div className="flex items-center gap-2 px-2 py-1.5">
								<Pin className="size-4 opacity-70" />
								<span className="flex-1 text-left text-xs font-semibold">Pinned</span>
							</div>
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{pinnedPages.map((tool) => (
									<ToolMenuItem
										key={`pinned-${tool.id}`}
										tool={tool}
										active={pathname === tool.url}
										pinned
										onTogglePin={togglePin}
										keyPrefix="pinned"
									/>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				) : null}
				{recentPages.length > 0 ? (
					<SidebarGroup>
						<SidebarGroupLabel className="text-sidebar-foreground">
							<div className="flex items-center gap-2 px-2 py-1.5">
								<Clock className="size-4 opacity-70" />
								<span className="flex-1 text-left text-xs font-semibold">Recent</span>
							</div>
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{recentPages.map((tool) => (
									<ToolMenuItem
										key={`recent-${tool.id}`}
										tool={tool}
										active={pathname === tool.url}
										pinned={false}
										onTogglePin={togglePin}
										keyPrefix="recent"
									/>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				) : null}
				{CATEGORIES.map((category) => {
					const CategoryIcon = category.icon;
					const categoryPages = getPagesByCategory(category.id);
					const isOpen = openGroups[category.id] ?? category.defaultOpen;
					return (
						<Collapsible
							key={category.id}
							open={isOpen}
							onOpenChange={(open) => setGroupOpen(category.id, open)}
							className="group/collapsible"
						>
							<SidebarGroup>
								<SidebarGroupLabel className="group/label p-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
									<CollapsibleTrigger
										className={cn(
											'flex w-full items-center gap-2 border-l-2 px-2 py-1.5',
											category.borderClass
										)}
									>
										<CategoryIcon className="size-4 opacity-70" />
										<span className="flex-1 text-left text-xs font-semibold">{category.label}</span>
										<ChevronRight className="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
									</CollapsibleTrigger>
								</SidebarGroupLabel>
								<CollapsibleContent>
									<SidebarGroupContent>
										<SidebarMenu>
											{categoryPages.map((tool) => (
												<ToolMenuItem
													key={tool.id}
													tool={tool}
													active={pathname === tool.url}
													pinned={pinnedSet.has(tool.id)}
													onTogglePin={togglePin}
												/>
											))}
										</SidebarMenu>
									</SidebarGroupContent>
								</CollapsibleContent>
							</SidebarGroup>
						</Collapsible>
					);
				})}
			</SidebarContent>

			<SidebarFooter className="border-t border-sidebar-border py-1.5">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton isActive={pathname === '/settings'} tooltip="Settings" asChild>
							<Link to="/settings">
								<Settings className="size-4" />
								<span>Settings</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							onClick={sidebar.toggleSidebar}
							tooltip="Toggle sidebar"
							className="text-muted-foreground"
						>
							<ChevronLeft className="size-4 transition-transform duration-200 group-data-[state=collapsed]:rotate-180" />
							<span>Collapse</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}

export type AppSidebarProps = {
	readonly className?: string;
};
