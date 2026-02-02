<script lang="ts">
	import { Loader2, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	interface Props {
		readonly show: boolean;
		readonly title?: string;
		readonly message?: string;
		readonly estimatedTime?: string;
		readonly elapsedTime?: string;
		readonly progress?: number | null;
		readonly cancellable?: boolean;
		readonly oncancel?: () => void;
	}

	let {
		show,
		title = 'Processing...',
		message,
		estimatedTime,
		elapsedTime,
		progress = null,
		cancellable = true,
		oncancel,
	}: Props = $props();
</script>

{#if show}
	<div
		class="absolute inset-0 z-50 flex animate-fade-in items-center justify-center bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="loading-title"
	>
		<div class="flex flex-col items-center gap-4 rounded-lg border bg-card p-8 shadow-lg">
			<Loader2 class="h-10 w-10 animate-spin text-primary" />

			<div class="text-center">
				<h3 id="loading-title" class="text-lg font-semibold">{title}</h3>
				{#if message}
					<p class="mt-1 text-sm text-muted-foreground">{message}</p>
				{/if}
			</div>

			{#if progress !== null && progress !== undefined}
				<div class="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
					<div
						class="h-full rounded-full bg-primary transition-all duration-300"
						style="width: {Math.min(100, Math.max(0, progress))}%"
					></div>
				</div>
			{/if}

			{#if estimatedTime || elapsedTime}
				<div class="flex flex-col items-center gap-1 text-xs text-muted-foreground">
					{#if elapsedTime}
						<span>Elapsed: <strong class="text-foreground">{elapsedTime}</strong></span>
					{/if}
					{#if estimatedTime}
						<span>Estimated: <strong class="text-foreground">{estimatedTime}</strong></span>
					{/if}
				</div>
			{/if}

			{#if cancellable && oncancel}
				<Button variant="outline" size="sm" onclick={oncancel}>
					<X class="mr-1.5 h-4 w-4" />
					Cancel
				</Button>
			{/if}
		</div>
	</div>
{/if}
