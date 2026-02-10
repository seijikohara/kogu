<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
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
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Keyboard Shortcuts</Dialog.Title>
			<Dialog.Description>Available keyboard shortcuts in Kogu.</Dialog.Description>
		</Dialog.Header>
		<div class="max-h-[60vh] space-y-4 overflow-y-auto py-2">
			{#each groups as group}
				<div>
					<h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{group.title}
					</h3>
					<div class="space-y-1">
						{#each group.shortcuts as shortcut}
							<div class="flex items-center justify-between py-1">
								<span class="text-sm">{shortcut.description}</span>
								<div class="flex items-center gap-1">
									{#each shortcut.keys.split('+') as part}
										<kbd
											class="rounded border border-border/40 bg-surface-3 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
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
		</div>
	</Dialog.Content>
</Dialog.Root>
