---
paths: src/**/*.{svelte,css}
---

# Tailwind CSS v4 Guidelines

## CSS-First Configuration

Tailwind CSS v4 uses CSS-first configuration. No `tailwind.config.js` required.

### Import Syntax

```css
/* app.css - v4 syntax */
@import 'tailwindcss';

/* Not v3 syntax */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Theme Configuration with `@theme`

Use `@theme inline` to define design tokens that map to Tailwind utilities:

```css
@theme inline {
	/* Custom colors - available as bg-primary, text-primary, etc. */
	--color-primary: var(--primary);
	--color-primary-foreground: var(--primary-foreground);

	/* Custom radius - available as rounded-sm, rounded-md, etc. */
	--radius-sm: calc(var(--radius) - 4px);
	--radius-md: calc(var(--radius) - 2px);
	--radius-lg: var(--radius);
}
```

### CSS Variables for Theming

Define CSS variables in `:root` and `.dark` for light/dark mode:

```css
:root {
	--background: oklch(1 0 0);
	--foreground: oklch(0.129 0.042 264.695);
	--primary: oklch(0.208 0.042 265.755);
}

.dark {
	--background: oklch(0.129 0.042 264.695);
	--foreground: oklch(0.984 0.003 247.858);
	--primary: oklch(0.929 0.013 255.508);
}
```

### Custom Variants

Use `@custom-variant` for custom variant definitions:

```css
/* Dark mode variant */
@custom-variant dark (&:is(.dark *));
```

## OKLCH Color Space

Use OKLCH for perceptually uniform colors with P3 gamut support:

```css
/* OKLCH format: oklch(lightness chroma hue) */
--primary: oklch(0.208 0.042 265.755);

/* With alpha: oklch(l c h / alpha) */
--border: oklch(1 0 0 / 10%);
```

| Component | Range  | Description                |
| --------- | ------ | -------------------------- |
| Lightness | 0-1    | 0 = black, 1 = white       |
| Chroma    | 0-0.4+ | Color intensity (0 = gray) |
| Hue       | 0-360  | Color angle on color wheel |

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

## Container Queries

Container queries are built-in (no plugin required):

```svelte
<!-- Define container -->
<div class="@container">
	<!-- Responsive to container width -->
	<div class="@sm:flex @md:grid @lg:grid-cols-3">
		<!-- Content adapts to container, not viewport -->
	</div>
</div>
```

| Query  | Min Width |
| ------ | --------- |
| `@xs`  | 20rem     |
| `@sm`  | 24rem     |
| `@md`  | 28rem     |
| `@lg`  | 32rem     |
| `@xl`  | 36rem     |
| `@2xl` | 42rem     |

## 3D Transforms

Use built-in 3D transform utilities:

```svelte
<div class="rotate-x-45 rotate-y-12 perspective-500">
	<!-- 3D transformed element -->
</div>
```

| Utility               | Description          |
| --------------------- | -------------------- |
| `rotate-x-{deg}`      | Rotate around X axis |
| `rotate-y-{deg}`      | Rotate around Y axis |
| `rotate-z-{deg}`      | Rotate around Z axis |
| `perspective-{value}` | Set perspective      |
| `transform-3d`        | Enable 3D transforms |

## shadcn-svelte Integration

This project uses shadcn-svelte components with Tailwind CSS v4.

### Color Tokens

Use semantic color tokens defined in `app.css`:

```svelte
<!-- Background colors -->
<div class="bg-background">Primary background</div>
<div class="bg-card">Card background</div>
<div class="bg-muted">Muted background</div>

<!-- Text colors -->
<span class="text-foreground">Primary text</span>
<span class="text-muted-foreground">Secondary text</span>

<!-- Interactive states -->
<button class="bg-primary text-primary-foreground hover:bg-primary/90"> Primary Button </button>
```

### Available Color Tokens

| Token                    | Usage                |
| ------------------------ | -------------------- |
| `background/foreground`  | Page background/text |
| `card/card-foreground`   | Card surfaces        |
| `primary/primary-fg`     | Primary actions      |
| `secondary/secondary-fg` | Secondary actions    |
| `muted/muted-foreground` | Muted elements       |
| `accent/accent-fg`       | Accented elements    |
| `destructive`            | Destructive actions  |
| `border`                 | Border color         |
| `input`                  | Input borders        |
| `ring`                   | Focus rings          |

## Layer Organization

Use `@layer` for proper cascade ordering:

```css
@layer base {
	/* Reset and base styles */
	* {
		@apply border-border;
	}
	body {
		@apply bg-background text-foreground;
	}
}

@layer components {
	/* Reusable component styles */
	.btn-primary {
		@apply bg-primary text-primary-foreground rounded-md px-4 py-2;
	}
}

@layer utilities {
	/* Custom utilities */
	.scrollbar-thin {
		scrollbar-width: thin;
	}
}
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

## Best Practices

### Do

- Use semantic color tokens (`bg-primary`) over raw colors
- Use `cn()` for conditional classes
- Use container queries for component-level responsiveness
- Use OKLCH for custom colors
- Define design tokens in `@theme inline`

### Avoid

- Inline styles
- Arbitrary values when a utility exists
- `!important` (use proper specificity)
- v3 syntax (`@tailwind`, `tailwind.config.js`)
- Raw hex/rgb colors (use OKLCH)

## Automatic Content Detection

Tailwind v4 automatically detects content files. No configuration needed.

To explicitly include additional sources:

```css
@source "../node_modules/some-package";
```
