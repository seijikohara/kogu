import { Link, useRouterState } from '@tanstack/react-router';
import { useTheme } from 'next-themes';
import { ChevronLeft, ChevronRight, Monitor, Moon, Settings, Sun } from 'lucide-react';

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/lib/components/ui/collapsible';
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
import { CATEGORIES, getPagesByCategory } from '@/lib/services/pages';
import { useSidebarStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

type ThemeName = 'light' | 'dark' | 'system';

const cycleTheme = (current: ThemeName): ThemeName => {
	if (current === 'light') return 'dark';
	if (current === 'dark') return 'system';
	return 'light';
};

const isThemeName = (value: string | undefined): value is ThemeName =>
	value === 'light' || value === 'dark' || value === 'system';

export function AppSidebar(_: AppSidebarProps = {}) {
	const openGroups = useSidebarStore((s) => s.openGroups);
	const setGroupOpen = useSidebarStore((s) => s.setGroupOpen);

	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const sidebar = useSidebar();
	const { theme, setTheme } = useTheme();
	const activeTheme: ThemeName = isThemeName(theme) ? theme : 'system';

	const handleToggleTheme = () => {
		setTheme(cycleTheme(activeTheme));
	};

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
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">Kogu</span>
									<span className="truncate text-xs text-muted-foreground">Developer Tools</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
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
											{categoryPages.map((tool) => {
												const ToolIcon = tool.icon;
												return (
													<SidebarMenuItem key={tool.id}>
														<SidebarMenuButton
															isActive={pathname === tool.url}
															tooltip={tool.title}
															asChild
														>
															<Link to={tool.url as never}>
																<ToolIcon />
																<span>{tool.title}</span>
															</Link>
														</SidebarMenuButton>
													</SidebarMenuItem>
												);
											})}
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
						<SidebarMenuButton onClick={handleToggleTheme} tooltip="Toggle theme">
							{activeTheme === 'dark' ? (
								<>
									<Moon className="size-4" />
									<span>Dark Mode</span>
								</>
							) : activeTheme === 'light' ? (
								<>
									<Sun className="size-4" />
									<span>Light Mode</span>
								</>
							) : (
								<>
									<Monitor className="size-4" />
									<span>System</span>
								</>
							)}
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton onClick={sidebar.toggleSidebar} tooltip="Toggle sidebar">
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
