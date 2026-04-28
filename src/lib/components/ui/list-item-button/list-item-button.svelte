<script lang="ts" module>
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { tv, type VariantProps } from 'tailwind-variants';
	import { cn, type WithElementRef } from '$lib/utils.js';

	export const listItemButtonVariants = tv({
		base: "focus-visible:border-ring focus-visible:ring-ring/50 inline-flex w-full shrink-0 items-center gap-2 text-left outline-none transition-colors focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		variants: {
			variant: {
				default:
					'border-l-2 border-l-transparent px-3 py-2 hover:bg-interactive-hover data-[selected=true]:border-l-primary data-[selected=true]:bg-primary/10',
				option:
					'border-b border-border border-l-2 border-l-transparent px-3 py-2.5 last:border-b-0 hover:bg-interactive-hover data-[selected=true]:border-l-primary data-[selected=true]:bg-primary/10',
				'tree-node':
					'rounded-md px-1 py-0.5 hover:bg-muted/60 data-[selected=true]:bg-primary/10 data-[selected=true]:ring-1 data-[selected=true]:ring-primary/30',
				toc: 'rounded-sm px-1 hover:text-primary hover:underline',
			},
			size: {
				default: 'text-sm',
				sm: 'text-xs',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	});

	export type ListItemButtonVariant = VariantProps<typeof listItemButtonVariants>['variant'];
	export type ListItemButtonSize = VariantProps<typeof listItemButtonVariants>['size'];

	export type ListItemButtonProps = WithElementRef<HTMLButtonAttributes> & {
		variant?: ListItemButtonVariant;
		size?: ListItemButtonSize;
		selected?: boolean;
		depth?: number;
		leading?: Snippet;
		children?: Snippet;
		trailing?: Snippet;
	};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		selected = false,
		depth = 0,
		disabled,
		ref = $bindable(null),
		type = 'button',
		leading,
		children,
		trailing,
		...restProps
	}: ListItemButtonProps = $props();

	const indentStyle = $derived(
		variant === 'tree-node' && depth > 0 ? `padding-left: ${depth * 12}px` : ''
	);

	const dynamicAttrs = $derived.by(() => {
		const role = restProps.role;
		// aria-selected only applies to roles that support it (option, treeitem, etc.).
		// We hide it inside a spread so static a11y analysis does not flag the implicit
		// 'button' role on the underlying <button> element.
		if (role === 'option' || role === 'treeitem') {
			return { 'aria-selected': selected, ...restProps };
		}
		return restProps;
	});
</script>

<button
	bind:this={ref}
	data-slot="list-item-button"
	data-selected={selected}
	class={cn(listItemButtonVariants({ variant, size }), className)}
	style={indentStyle}
	{type}
	{disabled}
	{...dynamicAttrs}
>
	{#if leading}
		<span class="flex shrink-0 items-center">
			{@render leading()}
		</span>
	{/if}
	<span class="min-w-0 flex-1 truncate">
		{@render children?.()}
	</span>
	{#if trailing}
		<span class="ml-auto flex shrink-0 items-center">
			{@render trailing()}
		</span>
	{/if}
</button>
