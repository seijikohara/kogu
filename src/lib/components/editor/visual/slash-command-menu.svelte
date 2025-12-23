<script lang="ts">
	import {
		AlignLeft,
		Box,
		CheckSquare,
		Circle,
		Heading1,
		Heading2,
		Heading3,
		Heading4,
		Heading5,
		Heading6,
		Image,
		Link,
		List,
		ListOrdered,
		Minus,
		Quote,
		SquareCode,
		Table,
		Workflow,
	} from '@lucide/svelte';

	import type { Component } from 'svelte';
	import type { SlashCommandItem } from './slash-command-extension.js';
	import { getSlashCommandState } from './slash-command-state.svelte.js';

	// Get reactive state (renamed to avoid conflict with $state rune)
	const slashCommandState = getSlashCommandState();

	// Map icon names to Lucide components
	const ICON_MAP: Record<string, Component> = {
		text: AlignLeft,
		heading1: Heading1,
		heading2: Heading2,
		heading3: Heading3,
		heading4: Heading4,
		heading5: Heading5,
		heading6: Heading6,
		bulletList: List,
		numberedList: ListOrdered,
		taskList: CheckSquare,
		quote: Quote,
		codeBlock: SquareCode,
		divider: Minus,
		table: Table,
		image: Image,
		link: Link,
		mermaid: Circle,
		workflow: Workflow,
		plantuml: Box,
		graphviz: Workflow,
	};

	// Get icon component for an item
	const getIconComponent = (iconName: string): Component => {
		return ICON_MAP[iconName] ?? AlignLeft;
	};

	// Handle item click
	const handleItemClick = (item: SlashCommandItem, event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		slashCommandState.onSelect?.(item);
	};

	// Scroll selected item into view
	let menuElement: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (menuElement && slashCommandState.selectedIndex >= 0) {
			const selectedElement = menuElement.querySelector(
				`[data-index="${slashCommandState.selectedIndex}"]`
			);
			selectedElement?.scrollIntoView({ block: 'nearest' });
		}
	});
</script>

<div
	bind:this={menuElement}
	class="slash-command-menu z-50 h-auto max-h-[330px] w-[280px] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
>
	{#if slashCommandState.items.length === 0}
		<div class="px-2 py-3 text-center text-sm text-muted-foreground">
			No results for "{slashCommandState.query}"
		</div>
	{:else}
		{#each slashCommandState.items as item, index (item.title)}
			{@const IconComponent = getIconComponent(item.icon)}
			<button
				type="button"
				class="slash-command-item flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent {index ===
				slashCommandState.selectedIndex
					? 'bg-accent'
					: ''}"
				data-index={index}
				onclick={(e) => handleItemClick(item, e)}
			>
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-background"
				>
					<IconComponent class="h-4 w-4" />
				</div>
				<div class="flex flex-col">
					<span class="font-medium">{item.title}</span>
					<span class="text-xs text-muted-foreground">{item.description}</span>
				</div>
			</button>
		{/each}
	{/if}
</div>
