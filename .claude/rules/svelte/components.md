---
paths: src/**/*.svelte
---

# Svelte 5 Component Conventions

## Runes Syntax (Required)

Always use Svelte 5 runes. Never use legacy `$:` or `export let`:

### State Management

```svelte
<script lang="ts">
	// Reactive state (deep reactivity by default)
	let count = $state(0);
	let items = $state<string[]>([]);
	let user = $state<User | null>(null);

	// Raw state (no deep reactivity, better performance for large arrays)
	let largeList = $state.raw<Item[]>([]);

	// Snapshot (for external libraries that don't expect proxies)
	const plainData = $state.snapshot(items);

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
	// Side effects (for external libraries, canvas, network requests)
	$effect(() => {
		console.log(`Count changed: ${count}`);

		// Cleanup function (optional)
		return () => {
			console.log('Cleanup');
		};
	});

	// Pre-effect (runs before DOM updates, useful for autoscroll)
	$effect.pre(() => {
		// ...
	});
</script>
```

> **Warning**: Do NOT update `$state` inside `$effect`. This leads to convoluted code and infinite update cycles. Use `$derived` instead for computed values.

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

### Customizing Primitives

Project-owned files under `src/lib/components/ui/` are copies of the official shadcn-svelte registry. Treat divergence from the registry as a deliberate decision:

- **Do** keep the registry baseline (class names, prop shape, internal data attributes) unless a concrete project requirement forces a change. Run `bunx shadcn-svelte@latest add <component>` periodically and reconcile diffs intentionally.
- **Do** justify each divergence with a comment in the file (or in a project rule under `.claude/rules/`).
- **Don't** invent utility classes that do not exist in Tailwind (e.g., there is no `ring-3`; use `ring-[3px]` or `ring-4`). When in doubt verify with `https://shadcn-svelte.com/registry/<name>.json`.
- **Don't** assume Tailwind variants exist project-wide. The shadcn-svelte registry sometimes ships classes that depend on a `@custom-variant` declaration (see `tailwind.md` for details). Prefer the arbitrary attribute selector form when copying registry source.

### Variant Composition Boundary

When a call site needs more than two `cn()` overrides on a primitive, treat it as a signal that a missing variant should be added to the primitive itself, not absorbed by the consumer:

```svelte
<!-- Anti-pattern: heavy override pile -->
<Button
	variant="default"
	class={cn(
		'h-auto rounded border bg-background',
		'hover:bg-interactive-hover',
		isSelected && 'ring-2 ring-ring',
		'border-l-2 border-l-transparent'
	)}>…</Button
>

<!-- Preferred: extend the primitive's CVA with a `card` variant. -->
<Button variant="card" class={isSelected ? 'ring-2 ring-ring' : ''}>…</Button>
```

The exception is **per-instance dynamic styling** (e.g., a color computed from item type). Variants encode static visual modes, so dynamic colors belong as call-site `cn()` arguments.

### shadcn vs Project Primitives

Use existing shadcn-svelte registry components first. Introduce a project-specific primitive in `src/lib/components/ui/` only when:

1. The use case repeats in three or more places.
2. The official registry has no equivalent.
3. Multiple call sites would otherwise rely on identical `cn()` overrides.

Project primitives must mirror the registry conventions: `tv()` from `tailwind-variants`, `cn` and `WithElementRef` from `$lib/utils.js`, `data-slot="<name>"` for theming, and types exported from the `<script lang="ts" module>` block.

### Toggle vs Radio Semantics

A `ToggleGroup type="single"` allows zero, one, or many selected (depending on the type). When a feature requires **exactly one** option always selected, the semantic is a radiogroup, not a toggle group:

- Use `ToggleGroup` when re-clicking the active item should deselect it.
- Use a radiogroup pattern (or guard the `onValueChange` callback against the empty value) when one option must remain selected.

When wrapping `ToggleGroup.Root` with a project component that enforces the radiogroup invariant, document it explicitly and prefer a typed value guard over silent fallback:

```svelte
<script lang="ts" generics="T extends string">
	let {
		value = $bindable(),
		options,
		onchange,
	}: { value?: T; options: { value: T; label: string }[]; onchange?: (v: T) => void } = $props();
	const isAllowedValue = (v: string): v is T => options.some((o) => o.value === v);
</script>

<ToggleGroup.Root
	type="single"
	{value}
	onValueChange={(v) => {
		if (isAllowedValue(v)) {
			value = v;
			onchange?.(v);
		}
	}}
>
	…
</ToggleGroup.Root>
```

Generic `T extends string` propagates the literal type to consumers so `onchange` callbacks do not need `as 'foo' | 'bar'` casts.

### bits-ui `child` Snippet Pattern

When a bits-ui primitive must render a custom element (the equivalent of React's `asChild`), use the `child` snippet. Spread the bits-ui props **first**, then layer your own:

```svelte
<Tooltip.Trigger>
	{#snippet child({ props })}
		<Button {...props} variant="ghost" size="icon-sm" onclick={handleClick}>
			<Icon />
			<span class="sr-only">Action label</span>
		</Button>
	{/snippet}
</Tooltip.Trigger>
<Tooltip.Content>Action label</Tooltip.Content>
```

The bits-ui `props` carry `aria-describedby`, focus management, and event wiring; spreading them first lets your overrides win without dropping the bits-ui contract.

### Tabs.Root Always Needs Tabs.Content

When using shadcn-svelte `Tabs.Root` + `Tabs.List` + `Tabs.Trigger`, you must also render `Tabs.Content` for each tab. The trigger's `aria-controls` points at a content panel id; without `Tabs.Content` the relationship is dangling and screen readers cannot navigate from tab to panel.

bits-ui keeps inactive `Tabs.Content` mounted by default (it sets `hidden=true` rather than unmounting), so wrapping each tab body in `<Tabs.Content value={tab.id}>` automatically preserves component state across switches without an explicit `forceMount`.

## Accessibility

Always include proper ARIA attributes:

```svelte
<script lang="ts">
	// Generate unique ID for form associations
	const uid = $props.id();
</script>

<!-- Form accessibility with $props.id() -->
<label for={uid}>Email</label>
<input id={uid} type="email" />

<!-- Button with icon (sr-only label preferred over aria-label when paired with a Tooltip) -->
<button type="button" aria-expanded={isOpen} onclick={handleClick}>
	<XIcon />
	<span class="sr-only">Close dialog</span>
</button>
```

> **Note**: Native HTML elements like `<button>` have implicit roles. Don't add `role="button"` to `<button>` elements.

### ARIA Selection on the Focusable Element

`aria-selected`, `aria-expanded`, and `aria-checked` belong on the element that receives keyboard focus. Wrapping a focusable button in an outer `<div role="treeitem" aria-selected="…">` splits the ARIA state away from the element a screen reader actually announces, so AT users hear "button" without the selection state and have to climb to the parent for context.

```svelte
<!-- Preferred: ARIA state on the focusable element. -->
<button
	role="treeitem"
	aria-selected={isSelected}
	aria-expanded={hasChildren ? expanded : undefined}
	tabindex={isSelected ? 0 : -1}
>
	…
</button>

<!-- Avoid: ARIA state on a non-focusable wrapper. -->
<div role="treeitem" aria-selected={isSelected}>
	<button tabindex={isSelected ? 0 : -1}>…</button>
</div>
```

`aria-selected` is supported only on roles `option`, `tab`, `gridcell`, `row`, `rowheader`, `columnheader`, and `treeitem`. Setting it on a `<button>` with implicit role `button` (or with `role="button"` explicitly) is invalid ARIA — either the button has the right role for selection, or selection state is dropped.

### WAI-ARIA Tree Pattern

Build trees per the W3C tree pattern (`https://www.w3.org/WAI/ARIA/apg/patterns/treeview/`):

```svelte
<div role="tree" aria-label="Files">
	<button role="treeitem" aria-selected={…} aria-expanded={true} tabindex={…}>Folder</button>
	<div role="group">
		<button role="treeitem" aria-selected={…} tabindex={…}>file-1.txt</button>
		<button role="treeitem" aria-selected={…} tabindex={…}>file-2.txt</button>
	</div>
</div>
```

- The outermost container of a tree gets `role="tree"`.
- Each row is a focusable `treeitem`.
- The children of an expanded branch are wrapped in `role="group"`.

### Tooltip + Icon Buttons

When a Tooltip wraps an icon-only button, the trigger still needs its own accessible name. Provide the name via an `<span class="sr-only">` inside the button rather than via `aria-label` that duplicates the visible Tooltip.Content text — the `aria-describedby` from Tooltip.Trigger already announces the tooltip text, so a redundant `aria-label` causes a double-read on most screen readers.

## Form Rhythm

Form-related primitives in `src/lib/components/ui/` (`Checkbox`, `Input`, `Select`, `Textarea`, `Slider`) are intentionally low-level. Do not compose them with `<Label>` directly in routes. Use the project's `Form*` wrappers in `src/lib/components/form/` so spacing, label typography, and hover treatment stay consistent across the app.

| Primitive     | Wrapper        | When to use the wrapper                                  |
| ------------- | -------------- | -------------------------------------------------------- |
| `Checkbox`    | `FormCheckbox` | Always — never expose `<Checkbox>` + `<Label>` directly. |
| `Input`       | `FormInput`    | Always for label + text input pairs.                     |
| `Select.Root` | `FormSelect`   | Always for label + dropdown pairs.                       |
| `Slider`      | `FormSlider`   | Always for label + slider pairs.                         |
| `Textarea`    | (none yet)     | Add `FormTextarea` if a second consumer appears.         |

```svelte
<!-- Preferred: Form* wrapper drives label, padding, hover, and rhythm. -->
<FormCheckbox label="Enable Google Fonts" bind:checked={fontSettings.google_fonts_enabled} />

<FormInput label="Root Type Name" bind:value={tsRootName} placeholder="Root" />

<!-- Avoid: hand-composed Label + primitive diverges from Form* rhythm. -->
<div class="flex items-center gap-2">
	<Checkbox bind:checked={fontSettings.google_fonts_enabled} />
	<Label class="text-sm font-medium">Enable Google Fonts</Label>
</div>
```

### `size="compact"` for Dense Panels

`FormInput` and `FormSelect` accept `size?: 'default' | 'compact'`:

- `default` (`h-9 text-sm`, label `text-sm font-medium`) — the standard option-rail rhythm.
- `compact` (`h-7 text-xs`, label `text-xs uppercase tracking-wide text-muted-foreground`) — for dense panels such as code-generator option groups.

```svelte
<FormInput label="Path Expression" bind:value={queryPath} size="compact" class="font-mono" />
```

Do not hand-construct the compact look with `<Label class="text-xs uppercase tracking-wide text-muted-foreground">` + `<Input class="h-7 text-xs">` — use `size="compact"` so all dense panels share the same vertical rhythm.

### When to Bypass the Wrappers

Bypassing a `Form*` wrapper is acceptable only when the control is part of an inline composition with a sibling that has its own height, and the wrapper's fixed heights would create misalignment. Document the reason in a comment. Examples:

- A `Select` and a `Button` paired in a single row at `h-8` — using `FormSelect` (`h-9` or `h-7`) would break the row's alignment.
- A search trigger that lives in the title bar with custom dimensions.

Prefer adding a new `size` value to the wrapper over inline overrides if the same composition repeats.

### `FormCheckboxGroup` for Dense Checkbox Lists

`FormSection` uses `space-y-3` (12px) between children, which feels too airy when the children are a list of related checkboxes. Wrap groups of two or more `FormCheckbox` instances in `FormCheckboxGroup` so the gap collapses to 6px (the dense rhythm shared with all other checkbox lists in the app):

```svelte
<FormSection title="Filter">
	<FormCheckboxGroup>
		<FormCheckbox label="Active" bind:checked={showActive} />
		<FormCheckbox label="Inactive" bind:checked={showInactive} />
		<FormCheckbox label="Loopback" bind:checked={showLoopback} />
	</FormCheckboxGroup>
</FormSection>
```

Use `class="pt-1"` (or `pt-2`) when the group follows a non-checkbox sibling such as a `FormSelect` and visually needs extra separation.

Do not use the legacy inline pattern `<div class="space-y-1.5">…FormCheckbox…</div>`; the explicit component is the discoverable convention.

## Inline Section Labels

`SectionHeader` (in `$lib/components/layout`) is the bordered, surface-2 header used at the top of a content panel. For inline labels above content cards inside that panel, use `SectionLabel` instead:

```svelte
<SectionLabel icon={Globe}>IP Addresses</SectionLabel>
<div class="rounded-lg border bg-card p-3">…</div>
```

The component renders an `<h3 class="mb-2 flex items-center gap-2 text-sm font-medium">` with an optional `h-4 w-4 text-muted-foreground` icon. For state-colored icons (success / warning / destructive on port summary headings), pass `iconClass`:

```svelte
<SectionLabel icon={CheckCircle2} iconClass="h-4 w-4 text-success">
	Open Ports ({openPorts.length})
</SectionLabel>
```

Do not hand-roll inline `<h3>` with custom typography for section labels; that produced two divergent visual treatments (uppercase muted vs sentence-case medium) before the audit.

## Embedded Empty States

`EmptyState` is the full-page, large empty state with a 16x16 icon container. For empty states embedded in a tab panel or a card, use `EmbeddedEmptyState`:

```svelte
<EmbeddedEmptyState
	icon={Network}
	title="No Port Scan Data"
	description="Select a scan mode and run a port scan to detect open services."
/>
```

Pass `fillHeight` when the empty state should occupy the parent's full height (typical for tab panels) instead of the default vertical padding.

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
