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
			class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 shadow-sm"
		>
			<Icon class="h-8 w-8 opacity-50" />
		</div>
		<p class="text-base font-semibold text-foreground/80">{title}</p>
		{#if description}
			<p class="mt-2 max-w-xs text-sm text-muted-foreground/80">{description}</p>
		{/if}
		{#if children}
			<div class="mt-5">
				{@render children()}
			</div>
		{/if}
	</div>
</div>
