<script lang="ts">
	import { Settings2 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as ScrollArea from '$lib/components/ui/scroll-area/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		/** Whether the aside is expanded. Bindable. */
		show?: boolean;
		/** Accessible label, used for toggle-button aria-label/title. */
		readonly title?: string;
		/** Background tone utility class (e.g., 'bg-sidebar', 'bg-surface-2'). */
		readonly background?: string;
		/** Width utility class for the expanded state (e.g., 'w-[var(--rail-w)]'). */
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
		width = 'w-[var(--rail-w)]',
		children,
		onclose,
		onopen,
	}: Props = $props();

	const handleToggle = () => {
		if (show) {
			show = false;
			onclose?.();
			return;
		}
		show = true;
		onopen?.();
	};

	const toggleLabel = $derived(show ? `Collapse ${title}` : `Expand ${title}`);
</script>

<!--
	Edge-strip toggle mirrors `ui/sidebar/sidebar-rail.svelte`:
	a thin absolute hit zone hugging the aside's right border. Hover
	reveals a 2px vertical accent line via `::after`. `tabIndex={-1}`
	matches SidebarRail (mouse-only affordance; keyboard users rely on
	the explicit shortcut wired up at the page level).

	The Settings2 button is retained as the primary expand affordance in
	the collapsed state — the w-11 strip is too narrow to reliably target
	the edge-strip with a pointer. In the open state the edge-strip is the
	only toggle, matching how SidebarRail is the sidebar's only toggle.

	The strip is positioned with `end-0` (inside the aside's right border)
	rather than `-end-4` (overlapping outside, as SidebarRail does) because
	`tool-shell .tool-rail { overflow: hidden }` would clip any outside
	overflow in our grid layout.
-->
<aside
	class={cn(
		'relative flex h-full shrink-0 flex-col border-r border-border/50',
		show ? cn(width, 'overflow-hidden') : 'w-[var(--rail-w-collapsed)]',
		background
	)}
	data-slot="collapsible-aside"
	data-state={show ? 'open' : 'closed'}
>
	{#if show}
		<ScrollArea.Root class="min-h-0 flex-1">
			<div class="py-3">
				{@render children?.()}
			</div>
		</ScrollArea.Root>
	{:else}
		<Button
			variant="ghost"
			size="icon"
			class="m-1.5 h-8 w-8"
			onclick={handleToggle}
			aria-label="Show {title}"
			title="Show {title}"
		>
			<Settings2 class="h-4 w-4" />
		</Button>
	{/if}

	<button
		type="button"
		data-slot="collapsible-aside-rail"
		aria-label={toggleLabel}
		title={toggleLabel}
		tabIndex={-1}
		onclick={handleToggle}
		class={cn(
			'absolute inset-y-0 end-0 z-20 hidden w-4 transition-all ease-linear sm:flex',
			'after:absolute after:inset-y-0 after:end-0 after:w-[2px]',
			'hover:after:bg-border',
			show ? 'cursor-w-resize' : 'cursor-e-resize'
		)}
	></button>
</aside>
