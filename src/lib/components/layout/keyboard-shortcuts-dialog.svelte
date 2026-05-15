<script lang="ts">
	import { Search } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { modLabel } from '$lib/utils/keyboard.js';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	interface ShortcutEntry {
		readonly keys: string;
		readonly description: string;
	}

	interface ShortcutGroup {
		readonly title: string;
		readonly shortcuts: readonly ShortcutEntry[];
	}

	const groups: readonly ShortcutGroup[] = [
		{
			title: 'Global',
			shortcuts: [
				{ keys: `${modLabel}+K`, description: 'Open command palette' },
				{ keys: `${modLabel}+B`, description: 'Toggle sidebar' },
				{ keys: '?', description: 'Show keyboard shortcuts' },
			],
		},
		{
			title: 'Navigation',
			shortcuts: [
				{ keys: `${modLabel}+[`, description: 'Navigate back' },
				{ keys: `${modLabel}+]`, description: 'Navigate forward' },
			],
		},
		{
			title: 'Page',
			shortcuts: [
				{ keys: `${modLabel}+,`, description: 'Toggle options panel' },
				{ keys: `${modLabel}+1-9`, description: 'Switch to tab N' },
				{ keys: `${modLabel}+Enter`, description: 'Execute primary action' },
			],
		},
		{
			title: 'Lists',
			shortcuts: [
				{ keys: '↑ / ↓', description: 'Move selection up / down' },
				{ keys: 'Home / End', description: 'Jump to first / last item' },
			],
		},
		{
			title: 'Tree View',
			shortcuts: [
				{ keys: '↑ / ↓', description: 'Move to previous / next node' },
				{ keys: '→', description: 'Expand node' },
				{ keys: '←', description: 'Collapse node' },
				{ keys: 'Enter', description: 'Select node' },
				{ keys: 'Home / End', description: 'Jump to first / last node' },
			],
		},
	];

	let query = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);

	const filteredGroups = $derived.by(() => {
		const trimmed = query.trim().toLowerCase();
		if (!trimmed) return groups;
		return groups
			.map((group) => ({
				...group,
				shortcuts: group.shortcuts.filter(
					(shortcut) =>
						shortcut.description.toLowerCase().includes(trimmed) ||
						shortcut.keys.toLowerCase().includes(trimmed)
				),
			}))
			.filter((group) => group.shortcuts.length > 0);
	});

	// Reset the query and focus the input each time the dialog opens so the
	// next keystroke filters from a clean state.
	$effect(() => {
		if (open) {
			query = '';
			// Defer focus until after bits-ui has mounted the dialog content.
			queueMicrotask(() => {
				searchInput?.focus();
			});
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Keyboard Shortcuts</Dialog.Title>
			<Dialog.Description>Available keyboard shortcuts in Kogu.</Dialog.Description>
		</Dialog.Header>
		<div class="relative">
			<Search
				class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				bind:ref={searchInput}
				bind:value={query}
				placeholder="Search shortcuts..."
				class="pl-8"
			/>
		</div>
		<div class="max-h-[60vh] space-y-4 overflow-y-auto py-2">
			{#each filteredGroups as group (group.title)}
				<div>
					<h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{group.title}
					</h3>
					<div class="space-y-1">
						{#each group.shortcuts as shortcut (shortcut.description)}
							<div class="flex items-center justify-between py-1">
								<span class="text-sm">{shortcut.description}</span>
								<div class="flex items-center gap-1">
									{#each shortcut.keys.split('+') as part (part)}
										<kbd
											class="rounded border border-border/40 bg-card px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
										>
											{part.trim()}
										</kbd>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
			{#if filteredGroups.length === 0}
				<p class="py-6 text-center text-sm text-muted-foreground">
					No shortcuts match "{query}"
				</p>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
