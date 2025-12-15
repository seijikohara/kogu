<script lang="ts">
	import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
	import * as ResizablePrimitive from "paneforge";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		withHandle = false,
		...restProps
	}: WithoutChildrenOrChild<ResizablePrimitive.PaneResizerProps> & {
		withHandle?: boolean;
	} = $props();
</script>

<ResizablePrimitive.PaneResizer
	bind:ref
	data-slot="resizable-handle"
	class={cn(
		"group/handle bg-border/50 hover:bg-primary/20 focus-visible:ring-ring focus-visible:outline-hidden relative flex w-px items-center justify-center transition-colors duration-200 after:absolute after:inset-y-0 after:start-1/2 after:w-2 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 data-[direction=vertical]:h-px data-[direction=vertical]:w-full data-[direction=vertical]:after:start-0 data-[direction=vertical]:after:h-2 data-[direction=vertical]:after:w-full data-[direction=vertical]:after:-translate-y-1/2 data-[direction=vertical]:after:translate-x-0 [&[data-direction=vertical]>div]:rotate-90",
		className
	)}
	{...restProps}
>
	{#if withHandle}
		<div class="z-10 flex h-6 w-4 items-center justify-center rounded-sm border border-border/60 bg-background shadow-sm transition-all duration-200 group-hover/handle:border-primary/40 group-hover/handle:bg-accent group-hover/handle:shadow-md group-active/handle:scale-95">
			<GripVerticalIcon class="size-3 text-muted-foreground/60 transition-colors group-hover/handle:text-primary/80" />
		</div>
	{/if}
</ResizablePrimitive.PaneResizer>
