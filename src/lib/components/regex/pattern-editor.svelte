<script lang="ts">
	import { cn } from '$lib/utils';
	import { renderHighlight } from '$lib/services/regex-highlight.js';

	interface Props {
		value?: string;
		placeholder?: string;
		class?: string;
	}

	let { value = $bindable(''), placeholder = '', class: className }: Props = $props();

	const highlighted = $derived(renderHighlight(value));
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let preEl = $state<HTMLPreElement | null>(null);

	const syncScroll = () => {
		if (!textareaEl || !preEl) return;
		preEl.scrollTop = textareaEl.scrollTop;
		preEl.scrollLeft = textareaEl.scrollLeft;
	};
</script>

<div class={cn('relative font-mono text-sm leading-6', className)}>
	<pre
		bind:this={preEl}
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-all rounded-md border bg-background px-3 py-2 text-sm leading-6">{@html highlighted ||
			'<span class="text-muted-foreground"></span>'}<br /></pre>
	<textarea
		bind:this={textareaEl}
		bind:value
		{placeholder}
		spellcheck="false"
		autocapitalize="off"
		autocomplete="off"
		onscroll={syncScroll}
		rows="2"
		class="relative w-full resize-none overflow-auto whitespace-pre-wrap break-all rounded-md border border-transparent bg-transparent px-3 py-2 text-sm leading-6 text-transparent caret-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
	></textarea>
</div>
