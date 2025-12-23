<script lang="ts">
	import { AlertTriangle, Check, Info, X } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		status: 'success' | 'warning' | 'error' | 'info';
		label: string;
		icon?: Component;
		size?: 'sm' | 'md';
	}

	let { status, label, icon, size = 'sm' }: Props = $props();

	const statusConfig = {
		success: {
			defaultIcon: Check,
			className: 'text-green-600 dark:text-green-400',
		},
		warning: {
			defaultIcon: AlertTriangle,
			className: 'text-amber-600 dark:text-amber-400',
		},
		error: {
			defaultIcon: X,
			className: 'text-red-600 dark:text-red-400',
		},
		info: {
			defaultIcon: Info,
			className: 'text-blue-600 dark:text-blue-400',
		},
	};

	const config = $derived(statusConfig[status]);
	const Icon = $derived(icon ?? config.defaultIcon);
	const iconSize = $derived(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4');
	const textSize = $derived(size === 'sm' ? 'text-xs' : 'text-sm');
</script>

<span class={cn('flex items-center gap-1', textSize, config.className)}>
	<Icon class={iconSize} />
	<span class="font-medium">{label}</span>
</span>
