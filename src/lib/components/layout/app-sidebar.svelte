<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import {
		Home,
		Braces,
		FileCode2,
		ChevronRight,
		Sun,
		Moon,
		Monitor,
		Wrench,
		type Icon,
	} from '@lucide/svelte';
	import { page } from '$app/state';
	import { toggleMode, mode } from 'mode-watcher';

	interface MenuItem {
		title: string;
		url: string;
		icon: typeof Icon;
		description?: string;
	}

	interface MenuGroup {
		label: string;
		icon: typeof Icon;
		items: MenuItem[];
		defaultOpen?: boolean;
	}

	const menuGroups: MenuGroup[] = [
		{
			label: 'Tools',
			icon: Wrench,
			defaultOpen: true,
			items: [
				{
					title: 'JSON Formatter',
					url: '/json-formatter',
					icon: Braces,
					description: 'Format, validate, and transform JSON',
				},
			],
		},
	];

	// Track open state for each collapsible group
	let openGroups = $state<Record<string, boolean>>(
		Object.fromEntries(menuGroups.map((g) => [g.label, g.defaultOpen ?? true]))
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
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={page.url.pathname === '/'} tooltipContent="Dashboard">
							{#snippet child({ props })}
								<a href="/" {...props}>
									<Home />
									<span>Dashboard</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<!-- Tool Groups -->
		{#each menuGroups as group}
			<Collapsible.Root bind:open={openGroups[group.label]} class="group/collapsible">
				<Sidebar.Group>
					<Sidebar.GroupLabel
						class="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground p-0"
					>
						<Collapsible.Trigger class="flex w-full items-center gap-2 px-2 py-1.5">
							<group.icon class="size-4" />
							<span class="flex-1 text-left">{group.label}</span>
							<ChevronRight
								class="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
							/>
						</Collapsible.Trigger>
					</Sidebar.GroupLabel>
					<Collapsible.Content>
						<Sidebar.GroupContent>
							<Sidebar.Menu>
								{#each group.items as item}
									<Sidebar.MenuItem>
										<Sidebar.MenuButton
											isActive={page.url.pathname === item.url}
											tooltipContent={item.title}
										>
											{#snippet child({ props })}
												<a href={item.url} {...props}>
													<item.icon />
													<span>{item.title}</span>
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
