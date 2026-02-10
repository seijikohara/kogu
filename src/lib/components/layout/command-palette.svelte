<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Command from '$lib/components/ui/command/index.js';
	import { CATEGORIES, getPagesByCategory, type PageDefinition } from '$lib/services/pages.js';
	import { formatShortcut } from '$lib/utils/keyboard.js';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	const handleSelect = (page: PageDefinition) => {
		open = false;
		goto(page.url);
	};
</script>

<Command.Dialog bind:open title="Command Palette" description="Search for a page to navigate to">
	<Command.Input placeholder="Search pages..." />
	<Command.List>
		<Command.Empty>No results found.</Command.Empty>
		{#each CATEGORIES as category}
			{@const pages = getPagesByCategory(category.id)}
			{#if pages.length > 0}
				<Command.Group heading={category.label}>
					{#each pages as page (page.id)}
						{@const PageIcon = page.icon}
						<Command.Item value={page.title} onSelect={() => handleSelect(page)}>
							<PageIcon />
							<span>{page.title}</span>
							<span class="ml-auto text-xs text-muted-foreground">{page.description}</span>
						</Command.Item>
					{/each}
				</Command.Group>
			{/if}
		{/each}
		<Command.Separator />
		<Command.Group heading="Actions">
			<Command.Item
				value="Settings"
				onSelect={() => {
					open = false;
					goto('/settings');
				}}
			>
				<span>Settings</span>
			</Command.Item>
			<Command.Item
				value="Reset All Settings"
				onSelect={() => {
					open = false;
					window.dispatchEvent(new CustomEvent('reset-all-settings'));
				}}
			>
				<span>Reset All Settings</span>
			</Command.Item>
			<Command.Item
				value="Keyboard shortcuts"
				onSelect={() => {
					open = false;
					window.dispatchEvent(new CustomEvent('open-shortcuts-help'));
				}}
			>
				<span>Keyboard Shortcuts</span>
				<Command.Shortcut>{formatShortcut('?')}</Command.Shortcut>
			</Command.Item>
		</Command.Group>
	</Command.List>
</Command.Dialog>
