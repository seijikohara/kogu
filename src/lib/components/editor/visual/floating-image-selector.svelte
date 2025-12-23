<script lang="ts">
	import { ExternalLink, Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		closeImageSelector,
		imageSelectorStore,
		openCurrentImage,
		removeImage,
		updateImage,
	} from './image-selector-state.svelte.js';

	// Local input states
	let srcValue = $state('');
	let altValue = $state('');

	// Sync input values when store opens
	$effect(() => {
		if (imageSelectorStore.isOpen) {
			srcValue = imageSelectorStore.currentSrc;
			altValue = imageSelectorStore.currentAlt;
		}
	});

	// Handle form submit
	const handleSubmit = (e: SubmitEvent) => {
		e.preventDefault();
		updateImage({
			src: srcValue.trim(),
			alt: altValue.trim(),
		});
	};

	// Handle click outside
	const handleClickOutside = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (!target.closest('.floating-image-selector')) {
			closeImageSelector();
		}
	};

	// Handle escape key
	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			closeImageSelector();
		}
	};

	// Setup event listeners when open
	$effect(() => {
		if (imageSelectorStore.isOpen) {
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
	const POPUP_HEIGHT = 120;
	const PADDING = 8;

	// Calculate position with viewport boundary awareness
	const position = $derived.by(() => {
		const rect = imageSelectorStore.anchorRect;
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

{#if imageSelectorStore.isOpen && imageSelectorStore.anchorRect}
	<div
		class="floating-image-selector fixed z-50"
		style="top: {position.top}px; left: {position.left}px;"
	>
		<form
			onsubmit={handleSubmit}
			class="flex flex-col gap-2 rounded-lg border bg-popover p-3 shadow-md"
			style="width: {POPUP_WIDTH}px;"
		>
			<div class="flex flex-col gap-1">
				<Label for="image-src" class="text-xs">Image URL</Label>
				<div class="flex items-center gap-1">
					<Input
						id="image-src"
						type="text"
						placeholder="https://example.com/image.png"
						bind:value={srcValue}
						class="h-8 text-sm"
					/>
					{#if srcValue}
						<Button
							type="button"
							variant="ghost"
							size="icon"
							class="h-8 w-8 shrink-0"
							onclick={openCurrentImage}
							title="Open image"
						>
							<ExternalLink class="h-4 w-4" />
						</Button>
					{/if}
				</div>
			</div>

			<div class="flex flex-col gap-1">
				<Label for="image-alt" class="text-xs">Alt Text</Label>
				<Input
					id="image-alt"
					type="text"
					placeholder="Description of the image"
					bind:value={altValue}
					class="h-8 text-sm"
				/>
			</div>

			<div class="flex items-center justify-between pt-1">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
					onclick={removeImage}
				>
					<Trash2 class="mr-1 h-3.5 w-3.5" />
					Remove
				</Button>
				<Button type="submit" size="sm" class="h-7">Save</Button>
			</div>
		</form>
	</div>
{/if}
