<script lang="ts">
	
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
import { Button } from '$lib/components/ui/button/index.js';
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
	<Button
		variant="ghost"
		size="icon-sm"
		disabled={!canGoBack}
		onclick={handleBack}
		aria-label="Go back"
		class="h-7 w-7"
	>
		<ChevronLeft class="h-4 w-4" />
	</Button>
	<Button
		variant="ghost"
		size="icon-sm"
		disabled={!canGoForward}
		onclick={handleForward}
		aria-label="Go forward"
		class="h-7 w-7"
	>
		<ChevronRight class="h-4 w-4" />
	</Button>
</div>
