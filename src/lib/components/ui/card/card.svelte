<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type CardDensity = 'default' | 'compact';

	interface CardProps extends HTMLAttributes<HTMLDivElement> {
		readonly density?: CardDensity;
	}

	let {
		ref = $bindable(null),
		class: className,
		density = 'default',
		children,
		...restProps
	}: WithElementRef<CardProps> = $props();
</script>

<div
	bind:this={ref}
	data-slot="card"
	data-density={density}
	class={cn(
		'group/card flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm',
		'gap-6 py-6',
		'data-[density=compact]:gap-3 data-[density=compact]:py-4',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
