<script lang="ts">
	import { Skeleton } from '.';

	interface Props {
		readonly lines?: number;
		readonly delay?: number;
	}

	let { lines = 3, delay = 0 }: Props = $props();
</script>

<div class="rounded-xl border bg-card p-4 space-y-3" style:animation-delay="{delay}ms">
	<Skeleton class="h-4 w-2/3" />
	{#each Array(lines) as _, i (i)}
		<Skeleton class="h-3 w-full" />
	{/each}
</div>
