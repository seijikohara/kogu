<script lang="ts">
	import { Search } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { Command as CommandPrimitive } from 'bits-ui';
	import * as Command from '$lib/components/ui/command/index.js';
	import { CATEGORIES, getPagesByCategory } from '$lib/services/pages.js';
	import { cn } from '$lib/utils.js';
	import { formatShortcut } from '$lib/utils/keyboard.js';

	let open = $state(false);
	let query = $state('');
	let containerRef = $state<HTMLDivElement | null>(null);
	let inputRef = $state<HTMLInputElement | null>(null);

	export function focusInput() {
		inputRef?.focus();
		open = true;
	}

	const close = () => {
		open = false;
		query = '';
		inputRef?.blur();
	};

	const handleNavigate = (url: string) => {
		close();
		goto(url);
	};

	const handleAction = (fn: () => void) => {
		close();
		fn();
	};

	const handleInputKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	};

	const handleDocPointer = (e: MouseEvent) => {
		if (!containerRef) return;
		if (!containerRef.contains(e.target as Node)) {
			close();
		}
	};

	$effect(() => {
		if (!open) return;
		document.addEventListener('mousedown', handleDocPointer);
		return () => document.removeEventListener('mousedown', handleDocPointer);
	});
</script>

<div bind:this={containerRef} class="relative w-full max-w-md">
	<CommandPrimitive.Root
		loop
		shouldFilter
		label="Search pages and actions"
		class="overflow-visible bg-transparent"
	>
		<div
			class={cn(
				'flex h-6 items-center gap-2 rounded-lg border px-3 transition-colors',
				open
					? 'border-ring bg-background ring-2 ring-ring/30'
					: 'border-transparent bg-surface-2 hover:bg-surface-3'
			)}
		>
			<Search class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
			<CommandPrimitive.Input
				bind:ref={inputRef}
				bind:value={query}
				placeholder="Search pages..."
				onfocus={() => (open = true)}
				onkeydown={handleInputKeydown}
				class="h-full flex-1 bg-transparent text-xs font-normal text-foreground outline-none placeholder:text-muted-foreground"
			/>
			<kbd
				class="pointer-events-none hidden shrink-0 rounded border border-border/40 bg-card px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline"
			>
				{formatShortcut('K', true)}
			</kbd>
		</div>

		{#if open}
			<div
				class="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-xl"
			>
				<Command.List class="max-h-96 overflow-auto">
					<Command.Empty>No results found.</Command.Empty>
					{#each CATEGORIES as category (category.id)}
						{@const pages = getPagesByCategory(category.id)}
						{#if pages.length > 0}
							<Command.Group heading={category.label}>
								{#each pages as page (page.id)}
									{@const PageIcon = page.icon}
									<Command.Item
										value={`${page.title} ${page.description}`}
										onSelect={() => handleNavigate(page.url)}
									>
										<PageIcon />
										<span class="whitespace-nowrap font-medium">{page.title}</span>
										<span class="ml-auto min-w-0 truncate text-xs text-muted-foreground">
											{page.description}
										</span>
									</Command.Item>
								{/each}
							</Command.Group>
						{/if}
					{/each}
					<Command.Separator />
					<Command.Group heading="Actions">
						<Command.Item value="Settings" onSelect={() => handleNavigate('/settings')}>
							<span>Settings</span>
						</Command.Item>
						<Command.Item
							value="Reset All Settings"
							onSelect={() =>
								handleAction(() => window.dispatchEvent(new CustomEvent('reset-all-settings')))}
						>
							<span>Reset All Settings</span>
						</Command.Item>
						<Command.Item
							value="Keyboard Shortcuts"
							onSelect={() =>
								handleAction(() => window.dispatchEvent(new CustomEvent('open-shortcuts-help')))}
						>
							<span>Keyboard Shortcuts</span>
							<Command.Shortcut>{formatShortcut('?')}</Command.Shortcut>
						</Command.Item>
					</Command.Group>
				</Command.List>
			</div>
		{/if}
	</CommandPrimitive.Root>
</div>
