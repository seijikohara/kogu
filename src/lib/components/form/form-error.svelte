<script lang="ts">
	import { AlertCircle } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		readonly message?: string | null;
		readonly icon?: boolean;
		readonly class?: string;
		readonly children?: Snippet;
	}

	let { message, icon = true, class: className, children }: Props = $props();
</script>

{#if message || children}
	<p
		role="alert"
		class={cn('flex items-start gap-1.5 text-xs leading-snug text-destructive', className)}
	>
		{#if icon}
			<AlertCircle class="mt-px h-3.5 w-3.5 shrink-0" />
		{/if}
		<span>
			{#if children}
				{@render children()}
			{:else}
				{message}
			{/if}
		</span>
	</p>
{/if}
