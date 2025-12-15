---
paths: src/**/*.svelte
---

# Svelte 5 Component Conventions

## Runes Syntax (Required)

Always use Svelte 5 runes. Never use legacy `$:` or `export let`:

### State Management

```svelte
<script lang="ts">
	// Reactive state
	let count = $state(0);
	let items = $state<string[]>([]);
	let user = $state<User | null>(null);

	// Bindable state (for two-way binding)
	let { value = $bindable('') }: Props = $props();
</script>
```

### Derived Values

```svelte
<script lang="ts">
	// Simple derived
	const doubled = $derived(count * 2);

	// Complex derived with function (use method chaining)
	const filtered = $derived.by(() =>
		items.filter((item) => item.active).sort((a, b) => a.name.localeCompare(b.name))
	);
</script>
```

### Props

```svelte
<script lang="ts">
	interface Props {
		// Required props (readonly)
		readonly title: string;
		readonly items: readonly Item[];

		// Optional props with defaults
		variant?: 'default' | 'outline';
		size?: 'sm' | 'md' | 'lg';

		// Event handlers
		onclick?: () => void;
		onchange?: (value: string) => void;

		// Children (snippets)
		children?: Snippet;
	}

	let {
		title,
		items,
		variant = 'default',
		size = 'md',
		onclick,
		onchange,
		children,
	}: Props = $props();
</script>
```

### Effects

```svelte
<script lang="ts">
	// Side effects
	$effect(() => {
		console.log(`Count changed: ${count}`);

		// Cleanup function (optional)
		return () => {
			console.log('Cleanup');
		};
	});

	// Pre-effect (runs before DOM updates)
	$effect.pre(() => {
		// ...
	});
</script>
```

## Component Structure

Follow this order in `<script>` block:

```svelte
<script lang="ts">
	// 1. Imports
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';

	import type { Snippet } from 'svelte';
	import type { Item } from './types';

	// 2. Props interface
	interface Props {
		readonly items: readonly Item[];
		onselect?: (item: Item) => void;
	}

	// 3. Props destructuring
	let { items, onselect }: Props = $props();

	// 4. Local state
	let selected = $state<Item | null>(null);
	let isOpen = $state(false);

	// 5. Derived values
	const hasSelection = $derived(selected !== null);
	const filteredItems = $derived.by(() => items.filter((item) => item.visible));

	// 6. Effects
	$effect(() => {
		if (selected) {
			onselect?.(selected);
		}
	});

	// 7. Functions/handlers (use early returns)
	const handleSelect = (item: Item) => {
		selected = item;
	};

	const handleClear = () => {
		selected = null;
	};
</script>

<!-- 8. Template -->
<div class="container">
	{#if hasSelection}
		<span>{selected.name}</span>
	{/if}
</div>

<!-- 9. Scoped styles (if needed, prefer Tailwind) -->
<style>
	.container {
		/* styles */
	}
</style>
```

## Snippets (Children/Slots)

Use snippets instead of slots:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		header?: Snippet;
		footer?: Snippet<[{ count: number }]>;
	}

	let { children, header, footer }: Props = $props();

	const itemCount = $derived(10);
</script>

<div class="card">
	{#if header}
		<div class="card-header">
			{@render header()}
		</div>
	{/if}

	<div class="card-body">
		{@render children?.()}
	</div>

	{#if footer}
		<div class="card-footer">
			{@render footer({ count: itemCount })}
		</div>
	{/if}
</div>
```

Using snippets in parent:

```svelte
<Card>
	{#snippet header()}
		<h2>Title</h2>
	{/snippet}

	<p>Card content</p>

	{#snippet footer({ count })}
		<span>{count} items</span>
	{/snippet}
</Card>
```

## Event Handling

Use callback props instead of events:

```svelte
<script lang="ts">
	interface Props {
		onclick?: () => void;
		onchange?: (value: string) => void;
		onsubmit?: (data: FormData) => Promise<void>;
	}

	let { onclick, onchange, onsubmit }: Props = $props();

	const handleClick = () => {
		onclick?.();
	};

	const handleInput = (e: Event) => {
		const target = e.target as HTMLInputElement;
		onchange?.(target.value);
	};
</script>

<button onclick={handleClick}>Click</button>
<input oninput={handleInput} />
```

## Conditional Rendering

```svelte
<!-- if/else -->
{#if condition}
	<Component />
{:else if otherCondition}
	<OtherComponent />
{:else}
	<Fallback />
{/if}

<!-- each with key -->
{#each items as item (item.id)}
	<Item data={item} />
{/each}

<!-- each with index -->
{#each items as item, index (item.id)}
	<Item data={item} {index} />
{/each}

<!-- await -->
{#await promise}
	<Loading />
{:then data}
	<Content {data} />
{:catch error}
	<Error {error} />
{/await}
```

## shadcn-svelte Components

Import from `$lib/components/ui/`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
</script>

<Button variant="outline" size="sm" onclick={handleClick}>Click me</Button>

<Card.Root>
	<Card.Header>
		<Card.Title>Title</Card.Title>
	</Card.Header>
	<Card.Content>Content</Card.Content>
</Card.Root>
```

## Accessibility

Always include proper ARIA attributes:

```svelte
<button
	type="button"
	role="button"
	tabindex="0"
	aria-label="Close dialog"
	aria-expanded={isOpen}
	onclick={handleClick}
	onkeydown={(e) => e.key === 'Enter' && handleClick()}
>
	<XIcon />
</button>

<div role="treeitem" aria-selected={isSelected} aria-expanded={isExpandable ? expanded : undefined}>
	<!-- tree item content -->
</div>
```

## User Feedback

Use svelte-sonner for user notifications:

```typescript
import { toast } from 'svelte-sonner';

// Success
toast.success('Copied to clipboard');

// Error
toast.error('Failed to parse JSON');

// With description
toast.error('Parse failed', {
	description: 'Invalid JSON syntax at line 5',
});
```
