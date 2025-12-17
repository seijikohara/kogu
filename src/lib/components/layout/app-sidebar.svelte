<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import {
		FileCode2,
		ChevronRight,
		Sun,
		Moon,
		Monitor,
		FileText,
		Lock,
		Sparkles,
	} from '@lucide/svelte';
	import { page } from '$app/state';
	import { toggleMode, mode } from 'mode-watcher';
	import { PAGES, CATEGORIES, getPagesByCategory } from '$lib/services/pages.js';

	// Get dashboard page
	const dashboardPage = $derived(PAGES.find((p) => p.id === 'dashboard'));

	// Category icons
	const categoryIcons = {
		formatters: FileText,
		encoders: Lock,
		generators: Sparkles,
	} as const;

	// Track open state for each collapsible group
	let openGroups = $state<Record<string, boolean>>(
		Object.fromEntries(CATEGORIES.map((c) => [c.id, c.defaultOpen]))
	);
</script>

<Sidebar.Root collapsible="icon">
	<!-- Header with Logo -->
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					size="lg"
					class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
				>
					{#snippet child({ props })}
						<a href="/" {...props}>
							<div
								class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
							>
								<FileCode2 class="size-4" />
							</div>
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-semibold">Kogu</span>
								<span class="truncate text-xs text-muted-foreground">Developer Tools</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<!-- Main Navigation -->
	<Sidebar.Content>
		<!-- Quick Access -->
		<Sidebar.Group>
			<Sidebar.GroupLabel>Quick Access</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#if dashboardPage}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={page.url.pathname === dashboardPage.url}
								tooltipContent={dashboardPage.title}
							>
								{#snippet child({ props })}
									<a href={dashboardPage.url} {...props}>
										<dashboardPage.icon />
										<span>{dashboardPage.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/if}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<!-- Category Groups -->
		{#each CATEGORIES as category}
			{@const CategoryIcon = categoryIcons[category.id]}
			{@const categoryPages = getPagesByCategory(category.id)}
			<Collapsible.Root bind:open={openGroups[category.id]} class="group/collapsible">
				<Sidebar.Group>
					<Sidebar.GroupLabel
						class="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground p-0"
					>
						<Collapsible.Trigger class="flex w-full items-center gap-2 px-2 py-1.5">
							<CategoryIcon class="size-4" />
							<span class="flex-1 text-left">{category.label}</span>
							<ChevronRight
								class="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
							/>
						</Collapsible.Trigger>
					</Sidebar.GroupLabel>
					<Collapsible.Content>
						<Sidebar.GroupContent>
							<Sidebar.Menu>
								{#each categoryPages as tool}
									<Sidebar.MenuItem>
										<Sidebar.MenuButton
											isActive={page.url.pathname === tool.url}
											tooltipContent={tool.title}
										>
											{#snippet child({ props })}
												<a href={tool.url} {...props}>
													<tool.icon />
													<span>{tool.title}</span>
												</a>
											{/snippet}
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								{/each}
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Collapsible.Content>
				</Sidebar.Group>
			</Collapsible.Root>
		{/each}
	</Sidebar.Content>

	<!-- Footer with Theme Toggle -->
	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton onclick={toggleMode} tooltipContent="Toggle theme">
					{#if mode.current === 'dark'}
						<Moon class="size-4" />
						<span>Dark Mode</span>
					{:else if mode.current === 'light'}
						<Sun class="size-4" />
						<span>Light Mode</span>
					{:else}
						<Monitor class="size-4" />
						<span>System</span>
					{/if}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>

	<!-- Rail for collapse/expand -->
	<Sidebar.Rail />
</Sidebar.Root>
