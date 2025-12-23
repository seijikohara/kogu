<script lang="ts">
	import { Check } from '@lucide/svelte';
	import * as Command from '$lib/components/ui/command';
	import { cn } from '$lib/utils.js';
	import {
		closeLanguageCombobox,
		LANGUAGES,
		languageComboboxStore,
		selectLanguage,
	} from './language-combobox-state.svelte.js';

	// Local search input state
	let searchValue = $state('');

	// Filtered languages based on search
	const filteredLanguages = $derived(
		searchValue.trim() === ''
			? LANGUAGES
			: LANGUAGES.filter(
					(lang) =>
						lang.label.toLowerCase().includes(searchValue.toLowerCase()) ||
						lang.value.toLowerCase().includes(searchValue.toLowerCase())
				)
	);

	// Check if search value matches any language
	const hasExactMatch = $derived(
		LANGUAGES.some(
			(lang) =>
				lang.value.toLowerCase() === searchValue.toLowerCase() ||
				lang.label.toLowerCase() === searchValue.toLowerCase()
		)
	);

	// Show custom option when no exact match
	const showCustomOption = $derived(searchValue.trim() !== '' && !hasExactMatch);

	// Handle selecting a language
	const handleSelect = (value: string) => {
		selectLanguage(value);
		searchValue = '';
	};

	// Handle selecting custom language
	const handleSelectCustom = () => {
		selectLanguage(searchValue.trim().toLowerCase());
		searchValue = '';
	};

	// Handle click outside
	const handleClickOutside = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (!target.closest('.floating-language-combobox')) {
			closeLanguageCombobox();
			searchValue = '';
		}
	};

	// Handle escape key
	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			closeLanguageCombobox();
			searchValue = '';
		}
	};

	// Setup event listeners when open
	$effect(() => {
		if (languageComboboxStore.isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			document.addEventListener('keydown', handleKeydown);
			// Reset search when opening
			searchValue = '';
		} else {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	// Combobox dimensions
	const COMBOBOX_WIDTH = 200;
	const COMBOBOX_MAX_HEIGHT = 300;
	const PADDING = 8;

	// Calculate position with viewport boundary awareness
	const position = $derived.by(() => {
		const rect = languageComboboxStore.anchorRect;
		if (!rect) return { top: 0, left: 0 };

		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		// Calculate initial position (below the anchor)
		let top = rect.bottom + 4;
		let left = rect.left;

		// Adjust if overflowing right edge
		if (left + COMBOBOX_WIDTH > viewportWidth - PADDING) {
			left = viewportWidth - COMBOBOX_WIDTH - PADDING;
		}

		// Ensure not going off left edge
		if (left < PADDING) {
			left = PADDING;
		}

		// Adjust if overflowing bottom edge (show above anchor instead)
		if (top + COMBOBOX_MAX_HEIGHT > viewportHeight - PADDING) {
			top = rect.top - COMBOBOX_MAX_HEIGHT - 4;
			// If still overflowing top, just position at top with padding
			if (top < PADDING) {
				top = PADDING;
			}
		}

		return { top, left };
	});
</script>

{#if languageComboboxStore.isOpen && languageComboboxStore.anchorRect}
	<div
		class="floating-language-combobox fixed z-50"
		style="top: {position.top}px; left: {position.left}px;"
	>
		<Command.Root class="w-[200px] rounded-lg border shadow-md">
			<Command.Input placeholder="Search or enter custom..." bind:value={searchValue} />
			<Command.List>
				<Command.Empty>
					{#if showCustomOption}
						<button
							type="button"
							class="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
							onclick={handleSelectCustom}
						>
							<span class="text-muted-foreground">Use:</span>
							<code class="rounded bg-muted px-1 font-mono text-xs"
								>{searchValue.trim().toLowerCase()}</code
							>
						</button>
					{:else}
						No language found.
					{/if}
				</Command.Empty>
				<Command.Group>
					{#each filteredLanguages as language (language.value)}
						<Command.Item
							value={language.value || 'plain'}
							onSelect={() => handleSelect(language.value)}
						>
							<Check
								class={cn(
									'mr-2 h-4 w-4',
									languageComboboxStore.currentValue === language.value
										? 'opacity-100'
										: 'opacity-0'
								)}
							/>
							{language.label}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</div>
{/if}
