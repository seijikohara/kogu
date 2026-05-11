<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CollapsibleAside } from '$lib/components/ui/collapsible-aside';

	interface Props {
		show?: boolean;
		readonly title?: string;
		readonly children?: Snippet;
		readonly onclose?: () => void;
		readonly onopen?: () => void;
	}

	let { show = $bindable(true), title = 'Options', children, onclose, onopen }: Props = $props();
</script>

<CollapsibleAside
	bind:show
	{title}
	background="bg-sidebar"
	width="w-[var(--rail-w)]"
	{onclose}
	{onopen}
>
	{@render children?.()}
</CollapsibleAside>
