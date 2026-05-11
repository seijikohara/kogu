<script lang="ts">
	import { ChevronLeft, Settings2 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as ScrollArea from '$lib/components/ui/scroll-area/index.js';

	interface Props {
		/** Whether the aside is expanded. Bindable. */
		show?: boolean;
		/** Accessible label, used for collapse-button aria-label/title. */
		readonly title?: string;
		/** Background tone utility class (e.g., 'bg-sidebar', 'bg-surface-2'). */
		readonly background?: string;
		/** Width utility class for the expanded state (e.g., 'w-64'). */
		readonly width?: string;
		/** Content rendered inside the scrollable expanded body. */
		readonly children?: Snippet;
		/** Optional side-effect callback fired after the user collapses the aside. */
		readonly onclose?: () => void;
		/** Optional side-effect callback fired after the user re-expands the aside. */
		readonly onopen?: () => void;
	}

	let {
		show = $bindable(true),
		title = 'Options',
		background = 'bg-surface-2',
		width = 'w-64',
		children,
		onclose,
		onopen,
	}: Props = $props();

	const handleClose = () => {
		show = false;
		onclose?.();
	};

	const handleOpen = () => {
		show = true;
		onopen?.();
	};
</script>

{#if show}
	<aside
		class="flex h-full {width} flex-col overflow-hidden border-r border-border/50 {background}"
		data-slot="collapsible-aside"
		data-state="open"
	>
		<ScrollArea.Root class="min-h-0 flex-1">
			<div class="py-3">
				{@render children?.()}
			</div>
		</ScrollArea.Root>
		<div class="flex h-8 shrink-0 items-center justify-end border-t border-border/30 px-2">
			<Button
				variant="ghost"
				size="icon"
				class="h-6 w-6"
				onclick={handleClose}
				aria-label="Collapse {title}"
				title="Collapse {title}"
			>
				<ChevronLeft class="h-3.5 w-3.5" />
			</Button>
		</div>
	</aside>
{:else}
	<aside
		class="flex w-11 shrink-0 flex-col border-r border-border/50 {background}"
		data-slot="collapsible-aside"
		data-state="closed"
	>
		<Button
			variant="ghost"
			size="icon"
			class="m-1.5 h-8 w-8"
			onclick={handleOpen}
			aria-label="Show {title}"
			title="Show {title}"
		>
			<Settings2 class="h-4 w-4" />
		</Button>
	</aside>
{/if}
