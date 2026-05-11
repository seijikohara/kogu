<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CollapsibleAside } from '$lib/components/ui/collapsible-aside';

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
		width = 'w-64',
		show = $bindable(true),
		onclose,
		onopen,
		children,
	}: Props = $props();
</script>

<CollapsibleAside bind:show {title} background="bg-surface-2" {width} {onclose} {onopen}>
	{@render children?.()}
</CollapsibleAside>
