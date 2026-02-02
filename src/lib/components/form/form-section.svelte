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

<Collapsible.Root {open} class="group">
	<Collapsible.Trigger
		class="flex h-8 w-full items-center justify-between px-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
	>
		{title}
		<ChevronDown
			class="h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-data-[state=closed]:-rotate-90"
		/>
	</Collapsible.Trigger>
	<Collapsible.Content class="space-y-2 px-3 pb-2">
		{@render children?.()}
	</Collapsible.Content>
</Collapsible.Root>
