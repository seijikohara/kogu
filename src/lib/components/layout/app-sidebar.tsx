import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Clock, Pin, PinOff, Search, Settings, X } from 'lucide-react';

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
	SidebarInput,
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
	getToolPages,
	type CategoryInfo,
	type PageDefinition,
} from '@/lib/services/pages';
import { useRecentToolsStore, useSidebarStore, useToolPinsStore } from '@/lib/stores';

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

interface PinnedGroupProps {
	readonly pages: readonly PageDefinition[];
	readonly pathname: string;
	readonly onTogglePin: (toolId: string) => void;
}

function PinnedGroup({ pages, pathname, onTogglePin }: PinnedGroupProps) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel className="text-sidebar-foreground">
				<div className="flex items-center gap-2 px-2 py-1.5">
					<Pin className="size-4 opacity-70" />
					<span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">
						Pinned
					</span>
				</div>
			</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{pages.map((tool) => (
						<ToolMenuItem
							key={`pinned-${tool.id}`}
							tool={tool}
							active={pathname === tool.url}
							pinned
							onTogglePin={onTogglePin}
							keyPrefix="pinned"
						/>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

interface RecentGroupProps {
	readonly pages: readonly PageDefinition[];
	readonly pathname: string;
	readonly onTogglePin: (toolId: string) => void;
}

function RecentGroup({ pages, pathname, onTogglePin }: RecentGroupProps) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel className="text-sidebar-foreground">
				<div className="flex items-center gap-2 px-2 py-1.5">
					<Clock className="size-4 opacity-70" />
					<span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">
						Recent
					</span>
				</div>
			</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{pages.map((tool) => (
						<ToolMenuItem
							key={`recent-${tool.id}`}
							tool={tool}
							active={pathname === tool.url}
							pinned={false}
							onTogglePin={onTogglePin}
							keyPrefix="recent"
						/>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

interface CategoryGroupProps {
	readonly category: CategoryInfo;
	readonly pages: readonly PageDefinition[];
	readonly pathname: string;
	readonly isOpen: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly pinnedSet: ReadonlySet<string>;
	readonly onTogglePin: (toolId: string) => void;
}

function CategoryGroup({
	category,
	pages,
	pathname,
	isOpen,
	onOpenChange,
	pinnedSet,
	onTogglePin,
}: CategoryGroupProps) {
	const CategoryIcon = category.icon;
	return (
		<Collapsible open={isOpen} onOpenChange={onOpenChange} className="group/collapsible">
			<SidebarGroup>
				<SidebarGroupLabel className="group/label p-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
					<CollapsibleTrigger className="flex w-full items-center gap-2 px-2 py-1.5">
						<CategoryIcon className="size-4 opacity-70" />
						<span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">
							{category.label}
						</span>
						<ChevronRight className="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
					</CollapsibleTrigger>
				</SidebarGroupLabel>
				<CollapsibleContent>
					<SidebarGroupContent>
						<SidebarMenu>
							{pages.map((tool) => (
								<ToolMenuItem
									key={tool.id}
									tool={tool}
									active={pathname === tool.url}
									pinned={pinnedSet.has(tool.id)}
									onTogglePin={onTogglePin}
								/>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</CollapsibleContent>
			</SidebarGroup>
		</Collapsible>
	);
}

interface SidebarSearchInputProps {
	readonly inputRef: React.RefObject<HTMLInputElement | null>;
	readonly query: string;
	readonly onQueryChange: (value: string) => void;
}

function SidebarSearchInput({ inputRef, query, onQueryChange }: SidebarSearchInputProps) {
	return (
		<div className="relative px-2">
			<Search
				aria-hidden="true"
				className="pointer-events-none absolute left-4 top-2 size-3.5 text-muted-foreground"
			/>
			<SidebarInput
				ref={inputRef}
				value={query}
				onChange={(e) => onQueryChange(e.target.value)}
				placeholder="Search tools..."
				className="h-7 px-7 text-sm"
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						onQueryChange('');
					}
				}}
				aria-label="Search tools"
			/>
			{query ? (
				<button
					type="button"
					onClick={() => onQueryChange('')}
					aria-label="Clear search"
					className="absolute right-3 top-2 text-muted-foreground hover:text-foreground"
				>
					<X className="size-3.5" />
				</button>
			) : null}
		</div>
	);
}

interface SidebarSearchResultsProps {
	readonly filtered: readonly PageDefinition[];
	readonly query: string;
	readonly pathname: string;
	readonly pinnedSet: ReadonlySet<string>;
	readonly onTogglePin: (toolId: string) => void;
}

function SidebarSearchResults({
	filtered,
	query,
	pathname,
	pinnedSet,
	onTogglePin,
}: SidebarSearchResultsProps) {
	if (filtered.length === 0) {
		return (
			<div className="px-3 py-6 text-center text-xs text-muted-foreground">
				No tools match <span className="font-medium text-foreground">&quot;{query}&quot;</span>
			</div>
		);
	}
	return (
		<SidebarGroup>
			<SidebarGroupLabel className="text-sidebar-foreground">
				<div className="flex items-center gap-2 px-2 py-1.5">
					<Search className="size-4 opacity-70" />
					<span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">
						Search results ({filtered.length})
					</span>
				</div>
			</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{filtered.map((tool) => (
						<ToolMenuItem
							key={`search-${tool.id}`}
							tool={tool}
							active={pathname === tool.url}
							pinned={pinnedSet.has(tool.id)}
							onTogglePin={onTogglePin}
							keyPrefix="search"
						/>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
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
	const expanded = sidebar.state === 'expanded';
	// Recent section shows only in collapsed (icon-only) mode. In expanded
	// mode every tool is already reachable via Categories, so Recent would
	// just add vertical noise and shift the tree when items change.
	const showRecent = !expanded;

	const [query, setQuery] = useState('');
	const inputRef = useRef<HTMLInputElement | null>(null);

	const handleQueryChange = useCallback((value: string) => setQuery(value), []);

	// Search filter — case-insensitive substring match on title + description.
	// Uses the existing getToolPages() helper so Dashboard / Settings are
	// excluded automatically. Tab-level matches are intentionally not surfaced
	// in the sidebar (those belong to the Cmd+K palette).
	const filteredTools = useMemo<readonly PageDefinition[]>(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return getToolPages().filter(
			(tool) => tool.title.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q)
		);
	}, [query]);
	const searchActive = query.trim().length > 0;

	// Click handler for the collapsed-mode Search icon. Expands the sidebar
	// first, then focuses the input on the next frame so the element is
	// guaranteed mounted.
	const expandAndFocusSearch = useCallback(() => {
		sidebar.setOpen(true);
		requestAnimationFrame(() => inputRef.current?.focus());
	}, [sidebar]);

	// Record visits to tool pages (excludes `/` and `/settings`).
	useEffect(() => {
		const page = getPageByUrl(pathname);
		if (!page || page.id === 'dashboard' || page.id === 'settings') return;
		recordVisit(page.id);
	}, [pathname, recordVisit]);

	const pinnedSet = useMemo(() => new Set(pinned), [pinned]);

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
			<SidebarHeader className="gap-2 border-b border-sidebar-border/50 pb-2">
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
				{expanded ? (
					<SidebarSearchInput inputRef={inputRef} query={query} onQueryChange={handleQueryChange} />
				) : (
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton tooltip="Search tools" onClick={expandAndFocusSearch}>
								<Search />
								<span>Search tools</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				)}
			</SidebarHeader>

			<SidebarContent>
				{searchActive ? (
					<SidebarSearchResults
						filtered={filteredTools}
						query={query.trim()}
						pathname={pathname}
						pinnedSet={pinnedSet}
						onTogglePin={togglePin}
					/>
				) : (
					<>
						{pinnedPages.length > 0 ? (
							<PinnedGroup pages={pinnedPages} pathname={pathname} onTogglePin={togglePin} />
						) : null}
						{showRecent && recentPages.length > 0 ? (
							<RecentGroup pages={recentPages} pathname={pathname} onTogglePin={togglePin} />
						) : null}
						{CATEGORIES.map((category) => (
							<CategoryGroup
								key={category.id}
								category={category}
								pages={getPagesByCategory(category.id)}
								pathname={pathname}
								isOpen={openGroups[category.id] ?? category.defaultOpen}
								onOpenChange={(open) => setGroupOpen(category.id, open)}
								pinnedSet={pinnedSet}
								onTogglePin={togglePin}
							/>
						))}
					</>
				)}
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
