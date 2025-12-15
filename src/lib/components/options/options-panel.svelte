<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronLeft, ChevronRight, Settings2 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		width?: string;
		show?: boolean;
		onclose?: () => void;
		onopen?: () => void;
		children?: Snippet;
	}

	let {
		title = 'Options',
		width = 'w-60',
		show = true,
		onclose,
		onopen,
		children,
	}: Props = $props();
</script>

{#if show}
	<aside class="flex {width} flex-col border-r bg-muted/20">
		<div class="flex h-10 items-center justify-between border-b bg-background px-3">
			<span class="text-xs font-medium">{title}</span>
			{#if onclose}
				<Button variant="ghost" size="icon" class="h-6 w-6" onclick={onclose} title="Close options">
					<ChevronLeft class="h-3.5 w-3.5" />
				</Button>
			{/if}
		</div>
		<div class="flex-1 space-y-0.5 overflow-y-auto py-1">
			{@render children?.()}
		</div>
	</aside>
{:else if onopen}
	<aside class="flex w-8 shrink-0 flex-col border-r bg-muted/20">
		<Button
			variant="ghost"
			size="icon"
			class="m-1 h-8 w-6"
			onclick={onopen}
			title="Show options"
		>
			<Settings2 class="h-4 w-4" />
		</Button>
	</aside>
{/if}
