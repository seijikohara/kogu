<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	interface Props {
		label: string;
		value?: string;
		placeholder?: string;
		type?: 'text' | 'password' | 'email';
		showToggle?: boolean;
		hint?: string;
		onchange?: (value: string) => void;
		onblur?: () => void;
	}

	let {
		label,
		value = $bindable(''),
		placeholder = '',
		type = 'text',
		showToggle = false,
		hint,
		onchange,
		onblur,
	}: Props = $props();

	let showValue = $state(false);

	const inputType = $derived(type === 'password' && !showValue ? 'password' : 'text');

	const handleInput = (e: Event) => {
		const target = e.target as HTMLInputElement;
		value = target.value;
		onchange?.(target.value);
	};
</script>

<div class="space-y-1">
	<Label class="text-xs font-medium text-muted-foreground">{label}</Label>
	<div class="relative">
		<Input
			type={inputType}
			{placeholder}
			{value}
			oninput={handleInput}
			{onblur}
			class="h-8 text-sm {showToggle && type === 'password' ? 'pr-8' : ''}"
		/>
		{#if showToggle && type === 'password'}
			<button
				type="button"
				class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
				onclick={() => (showValue = !showValue)}
			>
				{#if showValue}
					<EyeOff class="h-3.5 w-3.5" />
				{:else}
					<Eye class="h-3.5 w-3.5" />
				{/if}
			</button>
		{/if}
	</div>
	{#if hint}
		<p class="text-xs text-muted-foreground">{hint}</p>
	{/if}
</div>
