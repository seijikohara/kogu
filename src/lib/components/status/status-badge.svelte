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
			className: 'text-success',
		},
		warning: {
			defaultIcon: AlertTriangle,
			className: 'text-warning',
		},
		error: {
			defaultIcon: X,
			className: 'text-destructive',
		},
		info: {
			defaultIcon: Info,
			className: 'text-info',
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
