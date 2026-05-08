<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		label: string;
		value?: string;
		placeholder?: string;
		type?: 'text' | 'password' | 'email';
		showToggle?: boolean;
		hint?: string;
		size?: 'default' | 'compact';
		class?: string;
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
		size = 'default',
		class: className,
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

	const labelClass = $derived(
		size === 'compact'
			? 'text-xs uppercase tracking-wide text-muted-foreground'
			: 'text-sm font-medium'
	);

	const inputClass = $derived(
		cn(
			'bg-background',
			size === 'compact' ? 'h-7 text-xs' : 'h-9 text-sm',
			showToggle && type === 'password' ? 'pr-9' : '',
			className
		)
	);
</script>

<div class="space-y-1">
	<Label class={labelClass}>{label}</Label>
	<div class="relative">
		<Input
			type={inputType}
			{placeholder}
			{value}
			oninput={handleInput}
			{onblur}
			class={inputClass}
		/>
		{#if showToggle && type === 'password'}
			<Button
				variant="ghost"
				size="icon-sm"
				class="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
				aria-label={showValue ? 'Hide password' : 'Show password'}
				onclick={() => (showValue = !showValue)}
			>
				{#if showValue}
					<EyeOff class="h-3.5 w-3.5" />
				{:else}
					<Eye class="h-3.5 w-3.5" />
				{/if}
			</Button>
		{/if}
	</div>
	{#if hint}
		<p class="text-xs text-muted-foreground">{hint}</p>
	{/if}
</div>
