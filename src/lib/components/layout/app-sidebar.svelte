<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import {
		Home,
		Braces,
		FileCode,
		Link,
		Hash,
		KeyRound,
		Code,
		FileText,
		FileType,
	} from '@lucide/svelte';
	import { page } from '$app/state';

	const menuItems = [
		{ title: 'Dashboard', url: '/', icon: Home },
		{ title: 'JSON Formatter', url: '/json-formatter', icon: Braces },
		{ title: 'XML Formatter', url: '/xml-formatter', icon: FileCode },
		{ title: 'URL Encoding', url: '/url-encoding', icon: Link },
		{ title: 'Hash', url: '/hash', icon: Hash },
		{ title: 'BCrypt Hash', url: '/bcrypt-hash', icon: KeyRound },
		{ title: 'HTML Entities', url: '/html-entities', icon: Code },
		{ title: 'JSON to TypeScript', url: '/json-to-typescript', icon: FileType },
		{ title: 'Markdown', url: '/markdown', icon: FileText },
	];
</script>

<Sidebar.Root>
	<Sidebar.Header>
		<div class="flex items-center gap-2 px-2 py-2">
			<span class="text-lg font-semibold">Kogu</span>
			<span class="text-xs text-muted-foreground">Dev Tools</span>
		</div>
	</Sidebar.Header>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Tools</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each menuItems as item}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={page.url.pathname === item.url}>
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
		</Sidebar.Group>
	</Sidebar.Content>
</Sidebar.Root>
