<script lang="ts">
	import type { Snippet } from 'svelte';
	import OptionsPanel from '$lib/components/options/options-panel.svelte';

	interface Props {
		showOptions?: boolean;
		oncloseOptions?: () => void;
		header?: Snippet;
		options?: Snippet;
		children?: Snippet;
		class?: string;
	}

	let {
		showOptions = true,
		oncloseOptions,
		header,
		options,
		children,
		class: className = '',
	}: Props = $props();
</script>

<div class="flex h-full flex-col overflow-hidden {className}">
	<!-- Header -->
	{#if header}
		{@render header()}
	{/if}

	<!-- Main Content Area -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Options Panel -->
		{#if options}
			<OptionsPanel show={showOptions} onclose={oncloseOptions}>
				{@render options()}
			</OptionsPanel>
		{/if}

		<!-- Main Content -->
		<div class="flex flex-1 flex-col overflow-hidden">
			{#if children}
				{@render children()}
			{/if}
		</div>
	</div>
</div>
