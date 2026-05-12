<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="card-footer"
	class={cn(
		'flex items-center [.border-t]:pt-6',
		'px-6',
		'group-data-[density=compact]/card:px-4 group-data-[density=compact]/card:[.border-t]:pt-4',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
