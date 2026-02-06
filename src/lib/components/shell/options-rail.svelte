<script lang="ts">
	import { ChevronLeft, Settings2 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as ScrollArea from '$lib/components/ui/scroll-area/index.js';

	interface Props {
		show?: boolean;
		readonly title?: string;
		readonly children?: Snippet;
		readonly onclose?: () => void;
		readonly onopen?: () => void;
	}

	let { show = $bindable(true), title = 'Options', children, onclose, onopen }: Props = $props();
</script>

{#if show}
	<aside
		class="flex h-full w-[var(--rail-w)] flex-col overflow-hidden border-r border-border/50 bg-sidebar"
	>
		<ScrollArea.Root class="min-h-0 flex-1">
			<div class="py-3">
				{@render children?.()}
			</div>
		</ScrollArea.Root>
		{#if onclose}
			<div class="flex h-8 shrink-0 items-center justify-end border-t border-border/30 px-2">
				<Button
					variant="ghost"
					size="icon"
					class="h-6 w-6"
					onclick={() => {
						show = false;
						onclose?.();
					}}
					aria-label="Collapse {title}"
					title="Collapse {title}"
				>
					<ChevronLeft class="h-3.5 w-3.5" />
				</Button>
			</div>
		{/if}
	</aside>
{:else}
	<aside class="flex flex-1 w-11 shrink-0 flex-col border-r border-border/50 bg-sidebar">
		<Button
			variant="ghost"
			size="icon"
			class="m-1.5 h-8 w-8"
			onclick={() => {
				show = true;
				onopen?.();
			}}
			aria-label="Show options"
			title="Show options"
		>
			<Settings2 class="h-4 w-4" />
		</Button>
	</aside>
{/if}
