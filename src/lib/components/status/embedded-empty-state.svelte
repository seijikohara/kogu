<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		readonly icon: Component;
		readonly title: string;
		readonly description: string;
		/** When true, fill the parent's height; otherwise just pad vertically. */
		readonly fillHeight?: boolean;
	}

	let { icon: Icon, title, description, fillHeight = false }: Props = $props();
</script>

<div class={cn('flex items-center justify-center', fillHeight ? 'h-full' : 'py-8')}>
	<div class="max-w-xs text-center">
		<div class="mx-auto mb-3 inline-flex rounded-2xl bg-muted p-3">
			<Icon class="h-8 w-8 text-muted-foreground" />
		</div>
		<h3 class="mb-1 text-sm font-semibold">{title}</h3>
		<p class="text-xs leading-relaxed text-muted-foreground">{description}</p>
	</div>
</div>
