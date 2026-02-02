<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	interface Props {
		readonly icon: Component;
		readonly title: string;
		readonly description?: string;
		readonly children?: Snippet;
	}

	let { icon: Icon, title, description, children }: Props = $props();
</script>

<div class="flex h-full animate-fade-in items-center justify-center text-muted-foreground">
	<div class="text-center">
		<div
			class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border/40"
		>
			<Icon class="h-7 w-7 opacity-40" />
		</div>
		<p class="text-sm font-medium text-foreground/60">{title}</p>
		{#if description}
			<p class="mt-1.5 text-xs text-muted-foreground/60">{description}</p>
		{/if}
		{#if children}
			<div class="mt-4">
				{@render children()}
			</div>
		{/if}
	</div>
</div>
