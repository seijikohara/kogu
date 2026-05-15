<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import {
		getCanGoBack,
		getCanGoForward,
		goBack,
		goForward,
	} from '$lib/services/navigation-history.svelte.js';

	// Use derived to reactively track navigation state
	const canGoBack = $derived(getCanGoBack());
	const canGoForward = $derived(getCanGoForward());

	const handleBack = async (): Promise<void> => {
		await goBack();
	};

	const handleForward = async (): Promise<void> => {
		await goForward();
	};
</script>

<div class="flex items-center gap-0.5">
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon-sm"
					disabled={!canGoBack}
					onclick={handleBack}
					class="h-7 w-7"
				>
					<ChevronLeft class="h-4 w-4" />
					<span class="sr-only">Go back</span>
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>Go back</Tooltip.Content>
	</Tooltip.Root>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon-sm"
					disabled={!canGoForward}
					onclick={handleForward}
					class="h-7 w-7"
				>
					<ChevronRight class="h-4 w-4" />
					<span class="sr-only">Go forward</span>
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>Go forward</Tooltip.Content>
	</Tooltip.Root>
</div>
