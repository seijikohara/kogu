<script lang="ts">
	import { ExternalLink, Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		closeLinkSelector,
		getUrlFromString,
		linkSelectorStore,
		openCurrentLink,
		removeLink,
		setLink,
	} from './link-selector-state.svelte.js';

	// Local input state
	let inputValue = $state('');

	// Sync input value when store opens
	$effect(() => {
		if (linkSelectorStore.isOpen) {
			inputValue = linkSelectorStore.currentUrl;
		}
	});

	// Check if current link is valid
	const hasValidLink = $derived(linkSelectorStore.currentUrl.length > 0);

	// Handle form submit
	const handleSubmit = (e: SubmitEvent) => {
		e.preventDefault();
		const url = inputValue.trim();
		if (url) {
			const validUrl = getUrlFromString(url);
			if (validUrl) {
				setLink(validUrl);
			}
		}
	};

	// Handle click outside
	const handleClickOutside = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (!target.closest('.floating-link-selector')) {
			closeLinkSelector();
		}
	};

	// Handle escape key
	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			closeLinkSelector();
		}
	};

	// Setup event listeners when open
	$effect(() => {
		if (linkSelectorStore.isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			document.addEventListener('keydown', handleKeydown);
		} else {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	// Popup dimensions
	const POPUP_WIDTH = 320;
	const POPUP_HEIGHT = 48;
	const PADDING = 8;

	// Calculate position with viewport boundary awareness
	const position = $derived.by(() => {
		const rect = linkSelectorStore.anchorRect;
		if (!rect) return { top: 0, left: 0 };

		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		// Calculate initial position (below the anchor, centered)
		let top = rect.bottom + 8;
		let left = rect.left + rect.width / 2 - POPUP_WIDTH / 2;

		// Adjust if overflowing right edge
		if (left + POPUP_WIDTH > viewportWidth - PADDING) {
			left = viewportWidth - POPUP_WIDTH - PADDING;
		}

		// Ensure not going off left edge
		if (left < PADDING) {
			left = PADDING;
		}

		// Adjust if overflowing bottom edge (show above anchor instead)
		if (top + POPUP_HEIGHT > viewportHeight - PADDING) {
			top = rect.top - POPUP_HEIGHT - 8;
			if (top < PADDING) {
				top = PADDING;
			}
		}

		return { top, left };
	});
</script>

{#if linkSelectorStore.isOpen && linkSelectorStore.anchorRect}
	<div
		class="floating-link-selector fixed z-50"
		style="top: {position.top}px; left: {position.left}px;"
	>
		<form
			onsubmit={handleSubmit}
			class="flex items-center gap-1 rounded-lg border bg-popover p-1 shadow-md"
		>
			<Input
				type="text"
				placeholder="Paste a link..."
				bind:value={inputValue}
				class="h-8 w-[200px] border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
			{#if hasValidLink}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					class="h-8 w-8 shrink-0"
					onclick={openCurrentLink}
					title="Open link"
				>
					<ExternalLink class="h-4 w-4" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					class="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
					onclick={removeLink}
					title="Remove link"
				>
					<Trash2 class="h-4 w-4" />
				</Button>
			{/if}
		</form>
	</div>
{/if}
