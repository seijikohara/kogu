---
paths: ['src/lib/components/**/*.tsx', 'src/routes/**/*.tsx']
---

# React 19 Component Conventions

## Function components only

Use named function declarations (or `forwardRef` for ref-forwarding components). Never write class components.

```tsx
interface ButtonProps {
	readonly label: string;
	readonly onClick?: () => void;
}

export function Button({ label, onClick }: ButtonProps) {
	return (
		<button type="button" onClick={onClick}>
			{label}
		</button>
	);
}
```

## Props

Define `interface Props` with every field marked `readonly`. Destructure the interface in the function signature, not via `props.foo`.

```tsx
interface CardProps {
	readonly title: string;
	readonly description?: string;
	readonly children: React.ReactNode;
}

export function Card({ title, description, children }: CardProps) {
	// …
}
```

Export the props interface as a named type at the bottom of the file when the component is consumed by other files:

```tsx
export type { CardProps };
```

## State and computed values

| Svelte rune                    | React equivalent                                                       |
| ------------------------------ | ---------------------------------------------------------------------- |
| `let x = $state(0)`            | `const [x, setX] = useState(0)`                                        |
| `let y = $derived(expr)`       | `const y = useMemo(() => expr, deps)` (omit `useMemo` for cheap reads) |
| `let z = $derived.by(() => …)` | `const z = useMemo(() => { … }, deps)`                                 |
| `$effect(() => …)`             | `useEffect(() => …, deps)`                                             |
| `$effect.pre`                  | `useLayoutEffect`                                                      |
| `bind:this`                    | `useRef`                                                               |

Do not update state inside `useEffect` to "react" to other state changes — derive with `useMemo` instead. `useEffect` is for side effects only (subscriptions, DOM imperative APIs, network calls).

## Controlled vs uncontrolled dual-mode

When a prop should be optional but the component must still work in the uncontrolled case, layer the controlled prop on top of an internal `useState`:

```tsx
interface DisclosureProps {
	readonly open?: boolean;
	readonly defaultOpen?: boolean;
	readonly onOpenChange?: (open: boolean) => void;
}

export function Disclosure({
	open: controlledOpen,
	defaultOpen = false,
	onOpenChange,
}: DisclosureProps) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const open = controlledOpen ?? internalOpen;

	const setOpen = (next: boolean) => {
		if (controlledOpen === undefined) setInternalOpen(next);
		onOpenChange?.(next);
	};
	// …
}
```

This is the established pattern in `CollapsibleAside`, `FormSection`, `ToolShell`, and others.

## Slots → children / render props

| Svelte                          | React                                                  |
| ------------------------------- | ------------------------------------------------------ |
| `<slot />`                      | `children: React.ReactNode`                            |
| `<slot name="x" />`             | Named `ReactNode` prop (`x?: ReactNode`)               |
| `Snippet<[args]>`               | Render prop callback (`renderX?: (args) => ReactNode`) |
| `<svelte:component this={C} />` | Direct conditional render, or polymorphic `as` prop    |

Prefer named `ReactNode` props over sub-component compounds when the slot has fixed semantics. Use a compound (`<Card.Header>` etc.) only when consumers expect a CSS layout slot (header / body / footer).

## Event handlers

Use camelCase callback props (`onClick`, `onChange`, `onValueChange`) — never the lowercase Svelte event-attribute form (`onclick`).

```tsx
<button type="button" onClick={handleClick}>Click</button>
<input onChange={(e) => onChange?.(e.target.value)} />
```

## shadcn / Radix integration

Imports use named exports from the flat shadcn React layout (no `Foo.*` namespace):

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/lib/components/ui/select';
```

When a Radix primitive needs to render a custom element (Svelte's `child` snippet), use the Radix `asChild` prop:

```tsx
<Tooltip.Trigger asChild>
	<Button variant="ghost" size="icon" onClick={handleClick}>
		<Icon />
		<span className="sr-only">Action label</span>
	</Button>
</Tooltip.Trigger>
```

## `cn()` for conditional classes

```tsx
import { cn } from '@/lib/utils';

<button
	className={cn(
		'rounded-md px-4 py-2 transition-colors',
		isActive && 'bg-primary text-primary-foreground',
		isDisabled && 'opacity-50 cursor-not-allowed'
	)}
>
	Click
</button>;
```

If a call site needs **three or more `cn()` overrides** on a primitive, add a `variant` to the primitive's `cva()` definition instead. Per-instance dynamic values (computed colors, item-type tints) are the exception.

## Container patterns

| Role                       | Canonical container                                 | Notes                                                                      |
| -------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| Card section in main UI    | `Card` + `CardHeader` / `CardTitle` / `CardContent` | Always. Never roll a hand-built `<div class="rounded-lg border bg-…">`.    |
| Compact tool-page card     | `<Card density="compact">`                          | Default for every tool route. `default` density is for marketing surfaces. |
| Section heading in a panel | `CardTitle` inside `CardHeader`                     | Use `SectionLabel` for inline labels above content cards.                  |
| Status / count / category  | `Badge`                                             | Apply tone via `variant` + `bg-{success,warning,info,destructive}/10`.     |
| Collapsible disclosure     | `Accordion` (single or multiple)                    | Use for groups of related panels.                                          |
| Boolean toggle             | `Switch` (true on/off) or `Button` (two-state).     | Reserve `ToggleGroup type="single"` for radiogroup-style mutual exclusion. |
| Modal / dialog             | `Dialog`                                            | Use `AlertDialog` for destructive confirmations.                           |

## `density="compact"` for tool pages

`Card` accepts `density: 'default' | 'compact'` (mapped to `data-size` internally):

- `default` — `py-4 gap-4`, header / content / footer `px-4`. Reserved for the home page and other deliberately airy surfaces.
- `compact` — `py-3 gap-3`, header / content / footer `px-3`. Default for every tool route.

```tsx
<Card density="compact">
	<CardHeader>
		<CardTitle>Test text</CardTitle>
	</CardHeader>
	<CardContent>…</CardContent>
</Card>
```

Density propagates from `Card` to its descendants via `data-density` + `group/card`. Override `density` at the call site rather than reaching for ad-hoc `p-3` / `px-4` overrides.

## Accessibility

Place `aria-selected`, `aria-expanded`, and `aria-checked` on the focusable element, not on a wrapper. `aria-selected` is only valid on roles `option`, `tab`, `gridcell`, `row`, `rowheader`, `columnheader`, and `treeitem`.

```tsx
<button
	role="treeitem"
	aria-selected={isSelected}
	aria-expanded={hasChildren ? expanded : undefined}
	tabIndex={isSelected ? 0 : -1}
>
	…
</button>
```

For icon-only buttons wrapped in a Tooltip, give the button an `sr-only` accessible name; the Tooltip provides the visible label via `aria-describedby`. Do not duplicate the text via `aria-label`.

## Toggle vs radio semantics

`ToggleGroup type="single"` allows zero or one selection. When the UI requires **exactly one** option always selected, the semantic is a radiogroup — either guard `onValueChange` against the empty string or use a typed-value guard:

```tsx
const isAllowedValue = (v: string): v is Mode => MODES.includes(v as Mode);
<ToggleGroup
	type="single"
	value={value}
	onValueChange={(v) => {
		if (isAllowedValue(v)) onChange(v);
	}}
>
```

## Form rhythm

Tool-page forms compose `Form*` wrappers from `@/lib/components/form` instead of pairing primitives by hand:

| Primitive     | Wrapper        | When                                                     |
| ------------- | -------------- | -------------------------------------------------------- |
| `Checkbox`    | `FormCheckbox` | Always — never expose `<Checkbox>` + `<Label>` directly. |
| `Input`       | `FormInput`    | Always for label + text input pairs.                     |
| `Textarea`    | `FormTextarea` | Always for label + multiline input pairs.                |
| `Select`      | `FormSelect`   | Always for label + dropdown pairs.                       |
| `Slider`      | `FormSlider`   | Always for label + slider pairs.                         |
| `ToggleGroup` | `FormMode`     | Always for mode selection (Encode/Decode etc.).          |

`FormInput` / `FormSelect` accept `size: 'default' | 'compact'` — use `compact` in dense option panels.

Bypassing a wrapper is acceptable only when an inline composition demands a custom height that the wrapper's fixed heights would break; document the reason in a comment.

## React hooks ordering inside a component

1. Imports (kept at the top of the file, not the component).
2. Props destructuring (function signature).
3. Local state (`useState`).
4. Refs (`useRef`).
5. Zustand selectors (`const x = useFooStore((s) => s.x)`).
6. Memoized derived values (`useMemo`).
7. Memoized callbacks (`useCallback`) — only when the callback is in a dependency array elsewhere.
8. Effects (`useEffect`).
9. Imperative handle (`useImperativeHandle` inside `forwardRef`).
10. Return JSX.

## Auditing

A grep across `src/routes/` and `src/lib/components/` for static `bg-surface-3` paired with `rounded` (e.g. `rounded-(lg|md|xl) border ... bg-surface-3`) should return zero hits. `bun run audit:design` enforces this.

```sh
grep -rEn 'rounded(-(lg|md|xl))? (border [^ ]+ )?bg-surface-3|bg-surface-3 rounded(-(lg|md|xl))?' src/routes src/lib/components
```
