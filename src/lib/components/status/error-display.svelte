<script lang="ts">
	import { AlertTriangle } from '@lucide/svelte';
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		readonly message: string;
		readonly title?: string;
		readonly variant?: 'inline' | 'centered' | 'banner';
		readonly icon?: Component;
		readonly children?: Snippet;
	}

	let {
		message,
		title,
		variant = 'centered',
		icon: Icon = AlertTriangle,
		children,
	}: Props = $props();
</script>

{#if variant === 'inline'}
	<span class="max-w-md truncate text-destructive">{message}</span>
{:else if variant === 'centered'}
	<div class="flex h-full items-center justify-center">
		<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
			<Icon class="mx-auto mb-3 h-10 w-10 text-destructive opacity-60" />
			{#if title}
				<h3 class="mb-1 text-sm font-medium text-destructive">{title}</h3>
			{/if}
			<p class="text-sm text-destructive">{message}</p>
			{#if children}
				<div class="mt-3">
					{@render children()}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div
		class={cn(
			'flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3'
		)}
	>
		<Icon class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
		<div class="min-w-0 flex-1">
			{#if title}
				<p class="text-sm font-medium text-destructive">{title}</p>
			{/if}
			<p class="text-sm text-destructive">{message}</p>
			{#if children}
				<div class="mt-2">
					{@render children()}
				</div>
			{/if}
		</div>
	</div>
{/if}
