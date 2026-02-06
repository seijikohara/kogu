<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';

	interface Props {
		title: string;
		open?: boolean;
		children?: Snippet;
	}

	let { title, open = true, children }: Props = $props();
</script>

<Collapsible.Root {open} class="group border-b border-border/30 last:border-b-0">
	<Collapsible.Trigger
		class="flex h-9 w-full items-center justify-between px-4 text-sm font-semibold uppercase tracking-wide text-foreground/70 transition-colors hover:bg-interactive-hover"
	>
		{title}
		<ChevronDown
			class="h-4 w-4 text-muted-foreground/50 transition-transform group-data-[state=closed]:-rotate-90"
		/>
	</Collapsible.Trigger>
	<Collapsible.Content class="space-y-3 px-4 pb-4">
		{@render children?.()}
	</Collapsible.Content>
</Collapsible.Root>
