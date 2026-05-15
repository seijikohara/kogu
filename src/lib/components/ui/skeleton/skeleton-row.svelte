<script lang="ts">
	import { Skeleton } from '.';

	interface Props {
		/** Animation delay in ms for staggered list reveals. */
		readonly delay?: number;
		/** Show a leading icon skeleton (square). */
		readonly leading?: boolean;
		/** Show a trailing badge skeleton (small pill). */
		readonly trailing?: boolean;
		/** Width of the main label skeleton, as a Tailwind class. */
		readonly labelWidth?: string;
	}

	let { delay = 0, leading = true, trailing = false, labelWidth = 'w-32' }: Props = $props();
</script>

<div
	class="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
	style:animation-delay="{delay}ms"
>
	{#if leading}
		<Skeleton class="h-4 w-4 shrink-0 rounded" />
	{/if}
	<div class="flex flex-1 flex-col gap-1.5">
		<Skeleton class="h-3 {labelWidth}" />
		<Skeleton class="h-2.5 w-20" />
	</div>
	{#if trailing}
		<Skeleton class="h-4 w-10 rounded-full" />
	{/if}
</div>
