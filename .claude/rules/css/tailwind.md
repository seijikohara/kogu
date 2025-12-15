---
paths: src/**/*.{svelte,css}
---

# Tailwind CSS Guidelines

## Use Tailwind Classes

Always prefer Tailwind utility classes over inline styles:

```svelte
<!-- Preferred: Tailwind classes -->
<div class="flex items-center gap-2 p-4 rounded-md bg-muted">
  <span class="text-sm font-medium">Label</span>
</div>

<!-- Avoid: Inline styles -->
<div style="display: flex; padding: 16px;">
```

## Use cn() for Conditional Classes

Use the `cn()` utility from `$lib/utils` for conditional class names:

```svelte
<script lang="ts">
	import { cn } from '$lib/utils';
</script>

<button
	class={cn(
		'px-4 py-2 rounded-md transition-colors',
		isActive && 'bg-primary text-primary-foreground',
		isDisabled && 'opacity-50 cursor-not-allowed'
	)}
>
	Button
</button>
```

## Scoped Styles

Only use `<style>` for styles that cannot be expressed with Tailwind:

```svelte
<style>
	/* Custom font for code */
	:global(.code-editor) {
		font-family: 'Monaco', 'Menlo', monospace;
	}
</style>
```
