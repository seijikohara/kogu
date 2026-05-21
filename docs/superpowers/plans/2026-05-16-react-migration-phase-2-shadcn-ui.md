# Phase 2: shadcn/ui Primitives Migration

> **For agentic workers:** Execute task-by-task. The controller (typically the human or a foreground Claude session) implements each task directly with Edit/Write/Bash and verifies via `bun run check` + `bun run dev` after each commit; subagent dispatch is reserved for tasks where multi-file judgment is needed. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace every Svelte primitive under `src/lib/components/ui/` (31 directories) with React equivalents from shadcn/ui (Radix UI based). Preserve Kogu-specific variants (`Card.Root density="compact"`, `Button` extensions, etc.) and the two Kogu-original primitives (`collapsible-aside`, `list-item-button`). Verify visual parity through a debug route at `/__primitives` that mounts every primitive with all variants.

**Architecture:** `bunx shadcn@latest init` produces `components.json`, installs core dependencies (Radix UI primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`), and writes a baseline `cn` helper. The existing `src/lib/utils/cn.ts` is replaced by shadcn's idiomatic helper. Each primitive is added via `bunx shadcn@latest add <name>`, then Kogu-specific variants are layered on top. The `/__primitives` debug route is **not** a placeholder — it is a live page that imports and renders each primitive's full variant set, used for visual diff against the Svelte build (via screenshot comparison).

**Tech Stack (added/changed this phase):**

- shadcn/ui (latest) + Radix UI primitives (`@radix-ui/react-*`)
- `class-variance-authority` (replaces `tailwind-variants` `tv` in shadcn-generated files; both libraries coexist if needed)
- `tailwind-merge` (kept, used by `cn`)
- `clsx` (added by shadcn)
- `lucide-react` (replaces `@lucide/svelte`)
- `sonner` (toast primitive, replaces `svelte-sonner`)
- `vaul` (drawer primitive, used by `Sheet` on mobile per shadcn convention)
- `cmdk` (command palette, used by `Command`)
- `embla-carousel-react` (only if Carousel ends up needed — verify against current usage)

**TypeScript 7 Ready constraints** (per `feedback_typescript7_ready_policy`): shadcn/ui registry may emit `enum`-based code in a few places; rewrite to `const X = { ... } as const` + literal union when porting. `bun run check` will surface every such violation.

---

## Definition of Done

- `components.json` exists at repo root with React conventions (`rsc: false`, `tsx: true`, `tailwind.cssVariables: true`, `aliases: { components: "@/lib/components", utils: "@/lib/utils" }`)
- `src/lib/utils/cn.ts` works under React's import graph (no Svelte residue)
- All 31 primitives are present as `src/lib/components/ui/<name>/<name>.tsx` (+ `index.ts` re-exports) and their Svelte counterparts (`*.svelte` files + Svelte index.ts) are deleted
- Kogu-specific variants are preserved:
  - `Card.Root` has `density: "default" | "compact"` prop wiring `data-density` and a `group/card` Tailwind group
  - `Button` keeps the existing variant set (`default`, `outline`, `ghost`, `card`, etc. — match the current `tv()` definition from `button.svelte`)
  - `ToggleGroup` enforces "exactly one selected" radiogroup semantic via guarded `onValueChange` (per current Svelte rule)
  - `FormCheckbox` / `FormInput` / `FormSelect` / `FormSlider` `size: "default" | "compact"` (these are in `src/lib/components/form/`, Phase 3 — but Phase 2 primitives must support the underlying mechanics)
- `lucide-react` replaces `@lucide/svelte`; all icon imports in this phase compile
- `/__primitives` debug route mounts every primitive with **every variant in its CVA / `tv()` definition**, accessible via dev server. No JS console errors.
- `bun run check` passes (tsc --noEmit + validate:pages + audit:design)
- `bun run dev` runs without warnings
- `bun run tauri:dev` smoke (driver_session + screenshot + read_logs) green
- The home page (`src/routes/index.tsx`) updates the `__primitives` link list so it's reachable; the placeholder route system stays untouched for the 23 tool routes

---

## File Structure (created/modified)

```
components.json                                        # new — shadcn config
src/
├── lib/
│   ├── components/
│   │   └── ui/
│   │       ├── accordion/index.ts                     # rewritten — re-export React component
│   │       ├── accordion/accordion.tsx                # new
│   │       ├── alert/alert.tsx                        # new (+ index.ts)
│   │       ├── badge/badge.tsx                        # new
│   │       ├── button/button.tsx                      # new
│   │       ├── card/card.tsx                          # new — with density variant
│   │       ├── checkbox/checkbox.tsx                  # new
│   │       ├── collapsible/collapsible.tsx            # new
│   │       ├── collapsible-aside/collapsible-aside.tsx # new — Kogu-original
│   │       ├── command/command.tsx                    # new
│   │       ├── context-menu/context-menu.tsx          # new
│   │       ├── dialog/dialog.tsx                      # new
│   │       ├── dropdown-menu/dropdown-menu.tsx        # new
│   │       ├── input/input.tsx                        # new
│   │       ├── label/label.tsx                        # new
│   │       ├── list-item-button/list-item-button.tsx  # new — Kogu-original
│   │       ├── popover/popover.tsx                    # new
│   │       ├── progress/progress.tsx                  # new
│   │       ├── resizable/resizable.tsx                # new
│   │       ├── scroll-area/scroll-area.tsx            # new
│   │       ├── select/select.tsx                      # new
│   │       ├── separator/separator.tsx                # new
│   │       ├── sheet/sheet.tsx                        # new
│   │       ├── sidebar/sidebar.tsx                    # new — with provider
│   │       ├── sidebar/use-sidebar.ts                 # new (or co-located in sidebar.tsx)
│   │       ├── skeleton/skeleton.tsx                  # new
│   │       ├── slider/slider.tsx                      # new
│   │       ├── sonner/sonner.tsx                      # new
│   │       ├── tabs/tabs.tsx                          # new
│   │       ├── textarea/textarea.tsx                  # new
│   │       ├── toggle/toggle.tsx                      # new
│   │       ├── toggle-group/toggle-group.tsx          # new
│   │       └── tooltip/tooltip.tsx                    # new
│   └── utils/
│       └── cn.ts                                      # rewritten (replace if Svelte-tied)
└── routes/
    ├── __primitives.tsx                                # new — debug route
    └── index.tsx                                       # MODIFIED — add /__primitives link
```

## File Structure (deleted)

All `*.svelte` files under `src/lib/components/ui/` and the Svelte-flavored TS files (`context.svelte.ts` etc.) — roughly 100+ files. Bulk delete via `git rm -r` per primitive directory's old Svelte content.

---

## Validation Gates (every commit)

Same as Phase 1: `bun run check` + `bun run format:check` + lefthook pre-commit must pass with `--no-verify` only in genuine emergencies. The `frontend-format` and `frontend-lint` hooks (now matching `.tsx` / `.jsx`) are the active gates.

`/__primitives` route runs only in dev (not registered as a tool route), so does not need a `pages.ts` entry — it lives outside the `validate:pages` walk by being prefixed with `__`.

---

## Task Order Rationale

Primitives are grouped by **API surface** and **dependency layering**:

1. **Group A — Foundation utilities and zero-dep atoms** (Task 1-3). These have no Radix UI dependency.
2. **Group B — Single-Radix-component primitives** (Task 4-15). One Radix import each, no nested usage.
3. **Group C — Composite primitives that use other primitives** (Task 16-22). Built on top of Group B.
4. **Group D — Kogu-specific primitives** (Task 23-24). Hand-written, no shadcn registry.
5. **Group E — Debug route + lucide-react swap + cleanup** (Task 25-28).

Each task is a single commit. The order means later tasks can import earlier primitives without circularity.

---

## Task 1: Initialize shadcn/ui and rebase cn helper

**Files:**

- Create: `components.json`
- Modify: `src/lib/utils/cn.ts`
- Modify: `package.json` (deps shadcn adds)

- [ ] **Step 1: Run shadcn init**

```bash
cd /Users/seiji/git/GitHub/seijikohara/kogu-react
bunx shadcn@latest init --yes --base-color slate --css-variables
```

Expected: `components.json` created. Prompts auto-answered via flags. Installed deps include `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`.

If `--yes` is unavailable in the installed CLI version, run interactively and answer:

- TypeScript: yes
- Style: New York (matches current shadcn-svelte choice)
- Base color: slate (matches current)
- Global CSS file: `src/app.css`
- CSS variables: yes
- Tailwind config: leave blank (Tailwind v4 has no JS config)
- Components alias: `@/lib/components`
- Utils alias: `@/lib/utils`
- RSC: no
- Components in TypeScript: yes

- [ ] **Step 2: Inspect generated cn helper**

shadcn may overwrite `src/lib/utils/cn.ts` or create `src/lib/utils.ts`. Reconcile:

```bash
cat src/lib/utils/cn.ts
ls src/lib/utils/
```

Expected `cn.ts` content (after reconciliation):

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
```

If shadcn placed it elsewhere, move it to `src/lib/utils/cn.ts` and update `src/lib/utils/index.ts` to re-export.

- [ ] **Step 3: Verify components.json**

```bash
cat components.json
```

Expected (key fields):

```json
{
	"style": "new-york",
	"rsc": false,
	"tsx": true,
	"tailwind": {
		"config": "",
		"css": "src/app.css",
		"baseColor": "slate",
		"cssVariables": true
	},
	"aliases": {
		"components": "@/lib/components",
		"utils": "@/lib/utils"
	}
}
```

Edit by hand if any field drifted.

- [ ] **Step 4: Verify check still passes**

```bash
bun run check
```

Expected: pass (`cn` is the only meaningful TS change; nothing imports it yet at runtime).

- [ ] **Step 5: Commit**

```bash
git add components.json src/lib/utils/cn.ts src/lib/utils/index.ts package.json bun.lock
git commit -m "chore(react): initialize shadcn/ui and bring cn helper to React idioms

Run \`bunx shadcn@latest init\` with style=new-york, base-color=slate,
CSS variables enabled, alias roots @/lib/components and @/lib/utils.

Reconcile cn helper at src/lib/utils/cn.ts to use clsx + twMerge
in the canonical shadcn pattern. The existing tailwind-merge dep
is kept; clsx is added by shadcn. lucide-react and
class-variance-authority are also pulled in.

components.json is committed to the repo so the shadcn CLI can be
re-run to add new primitives later without re-prompting."
```

---

## Task 2: Replace `@lucide/svelte` with `lucide-react` (sweep)

**Files:**

- Modify: `package.json` (remove `@lucide/svelte`)
- Modify: no source files yet — Phase 1 React code does not import lucide

- [ ] **Step 1: Remove the Svelte lucide package**

```bash
bun remove @lucide/svelte
```

The Svelte component files under `src/lib/components/` (still on disk from Phase 1, unreferenced) will get broken imports — that's fine because nothing imports those Svelte files anymore, and they'll be bulk-deleted in later tasks.

- [ ] **Step 2: Verify lucide-react is installed**

```bash
grep '"lucide-react"' package.json
```

Expected: present in `dependencies` (added by Task 1).

- [ ] **Step 3: Verify check still passes**

```bash
bun run check
```

Expected: pass. No source file in the active include set (after Phase 1's `tsconfig` tightening) imports `@lucide/svelte`, so removal is safe.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(react): remove @lucide/svelte, lucide-react takes over

@lucide/svelte was the icon library for the Svelte UI. lucide-react
(installed by shadcn init in the previous commit) is the
equivalent under React. The two packages export identical icon
names — actual icon swaps land in each primitive's task as it gets
ported."
```

---

## Task 3: Button primitive (foundation)

**Files:**

- Create: `src/lib/components/ui/button/button.tsx`
- Create: `src/lib/components/ui/button/index.ts`
- Delete: `src/lib/components/ui/button/button.svelte`

**Context:** `Button` is the most-used primitive in Kogu (it appears in every form, dialog, sidebar item, etc.). The current Svelte version under `src/lib/components/ui/button/button.svelte` has a customized variant set going beyond shadcn defaults. Read it first, then add the shadcn React version, then layer Kogu's variants on top.

- [ ] **Step 1: Read existing Svelte Button variants**

```bash
cat src/lib/components/ui/button/button.svelte
```

Note the `tv()` (tailwind-variants) call near the bottom — that's the source of truth for `variant` and `size` enums.

- [ ] **Step 2: Add shadcn button**

```bash
bunx shadcn@latest add button --yes
```

This creates `src/lib/components/ui/button/button.tsx` with shadcn's canonical variants (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`) and sizes (`default`, `sm`, `lg`, `icon`).

- [ ] **Step 3: Layer Kogu variants from the Svelte version**

Edit `button.tsx` to add any Kogu-specific variants found in Step 1 (commonly `card`, `icon-sm`, etc.). Use shadcn's `cva` (`class-variance-authority`) — not `tailwind-variants`. The `cva` call looks like:

```typescript
const buttonVariants = cva('inline-flex items-center justify-center gap-2 ... base classes ...', {
	variants: {
		variant: {
			default: '...',
			destructive: '...',
			outline: '...',
			ghost: '...',
			link: '...',
			card: '...', // Kogu-specific
		},
		size: {
			default: 'h-9 px-4 py-2',
			sm: 'h-8 px-3',
			lg: 'h-10 px-6',
			icon: 'h-9 w-9',
			'icon-sm': 'h-7 w-7', // Kogu-specific
		},
	},
	defaultVariants: { variant: 'default', size: 'default' },
});
```

Copy each variant's class string verbatim from the Svelte source so colors / spacing / hover states match.

- [ ] **Step 4: Write index.ts re-export**

```typescript
// src/lib/components/ui/button/index.ts
export { Button, buttonVariants, type ButtonProps } from './button';
```

- [ ] **Step 5: Delete the Svelte button file**

```bash
git rm src/lib/components/ui/button/button.svelte
```

- [ ] **Step 6: Verify check passes**

```bash
bun run check
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/ui/button/
git commit -m "feat(react)(ui/button): port Button primitive from shadcn-svelte to shadcn/ui

Run \`shadcn add button\` to scaffold the React/Radix version, then
layer Kogu-specific variants (\`card\`, \`icon-sm\`) carried over
verbatim from the Svelte tv() definition.

The Svelte source file button.svelte is removed in the same commit."
```

---

## Tasks 4-15: Group B (single-Radix-component primitives)

Each follows the same pattern as Task 3. The list below names each primitive, the shadcn CLI command, and any Kogu-specific variant to preserve. Each task is one commit titled `feat(react)(ui/<name>): port <Name> primitive from shadcn-svelte to shadcn/ui`.

| #   | Primitive   | shadcn CLI      | Kogu variants to preserve                                                                                                                                          |
| --- | ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4   | `label`     | `add label`     | —                                                                                                                                                                  |
| 5   | `input`     | `add input`     | — (size variants live in `FormInput`, Phase 3)                                                                                                                     |
| 6   | `textarea`  | `add textarea`  | —                                                                                                                                                                  |
| 7   | `checkbox`  | `add checkbox`  | —                                                                                                                                                                  |
| 8   | `separator` | `add separator` | —                                                                                                                                                                  |
| 9   | `badge`     | `add badge`     | Verify outline variant has correct semantic tone class set                                                                                                         |
| 10  | `progress`  | `add progress`  | —                                                                                                                                                                  |
| 11  | `skeleton`  | `add skeleton`  | `skeleton-card` and `skeleton-row` sub-components — port these as named exports in `skeleton.tsx`                                                                  |
| 12  | `alert`     | `add alert`     | —                                                                                                                                                                  |
| 13  | `slider`    | `add slider`    | —                                                                                                                                                                  |
| 14  | `toggle`    | `add toggle`    | —                                                                                                                                                                  |
| 15  | `tooltip`   | `add tooltip`   | **Provider must be explicit at `__root.tsx`** (see [[feedback-tooltip-provider-explicit]]); leave a TODO comment in `tooltip.tsx` re-export reminding the consumer |

For each, the steps are:

- [ ] **Step 1: Read existing Svelte primitive** to capture variants
- [ ] **Step 2: `bunx shadcn@latest add <name> --yes`**
- [ ] **Step 3: Layer Kogu variants** (if any from the table above)
- [ ] **Step 4: Write `index.ts` re-export**
- [ ] **Step 5: `git rm` the old `.svelte` files** in the primitive directory
- [ ] **Step 6: `bun run check`**
- [ ] **Step 7: Commit**

Re-explain Step 7's commit message template:

```
feat(react)(ui/<name>): port <Name> primitive from shadcn-svelte to shadcn/ui

Run \`shadcn add <name>\` for the React/Radix scaffold and carry
over any Kogu-specific variant from the Svelte source. The Svelte
source files are removed in the same commit.
```

---

## Tasks 16-22: Group C (composite primitives)

These primitives import lower-level primitives from Group B or use Radix's compound APIs. Use the same per-task pattern; the table notes additional integration steps.

| #   | Primitive       | shadcn CLI          | Notes                                                                                                         |
| --- | --------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| 16  | `popover`       | `add popover`       | —                                                                                                             |
| 17  | `dialog`        | `add dialog`        | —                                                                                                             |
| 18  | `dropdown-menu` | `add dropdown-menu` | —                                                                                                             |
| 19  | `context-menu`  | `add context-menu`  | —                                                                                                             |
| 20  | `select`        | `add select`        | —                                                                                                             |
| 21  | `command`       | `add command`       | Brings in `cmdk` dep                                                                                          |
| 22  | `sheet`         | `add sheet`         | Brings in `vaul` dep (mobile drawer; Kogu is desktop-only but the dep is required by shadcn's implementation) |

---

## Tasks 23-26: Group C continued (specialized)

| #   | Primitive      | shadcn CLI         | Notes                                                                                                                                                                                                                                                                                                     |
| --- | -------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23  | `accordion`    | `add accordion`    | Verify `type="single"` vs `type="multiple"` API is identical to bits-ui                                                                                                                                                                                                                                   |
| 24  | `collapsible`  | `add collapsible`  | —                                                                                                                                                                                                                                                                                                         |
| 25  | `tabs`         | `add tabs`         | **Tabs.Content must always be rendered** (per [[feedback-tabs-content-mandatory]] equivalent — kept from project rules)                                                                                                                                                                                   |
| 26  | `toggle-group` | `add toggle-group` | Layer the **"exactly one selected" radiogroup guard** from `.claude/rules/svelte/components.md` § Toggle vs Radio Semantics. The shadcn version permits zero-selection; Kogu uses a wrapper with `onValueChange` guard. The wrapper either lives in `toggle-group.tsx` or as a sibling `radio-group.tsx`. |

---

## Tasks 27-29: Group C continued (layout / nav)

| #   | Primitive     | shadcn CLI        | Notes                                                                                                                                                                                                                                                                                                            |
| --- | ------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | `scroll-area` | `add scroll-area` | —                                                                                                                                                                                                                                                                                                                |
| 28  | `resizable`   | `add resizable`   | shadcn uses `react-resizable-panels` (replaces `paneforge`); Kogu's split-pane usage (`src/lib/components/layout/split-pane.svelte`) will adapt in Phase 3                                                                                                                                                       |
| 29  | `sidebar`     | `add sidebar`     | **Largest** primitive; shadcn ships a full Sidebar.Provider + Sidebar + SidebarRail + SidebarTrigger + SidebarMenu set. After scaffolding, port the **persisted state** wiring (sidebar open/close localStorage key) to use the Phase 4 Zustand store; for now leave a TODO in `sidebar.tsx` pointing at Phase 4 |

---

## Task 30: Sonner (toast notifications)

**Files:**

- Create: `src/lib/components/ui/sonner/sonner.tsx`
- Delete: `src/lib/components/ui/sonner/sonner.svelte`

- [ ] **Step 1: Add via shadcn**

```bash
bunx shadcn@latest add sonner --yes
```

Brings in `sonner` (the React lib, not `svelte-sonner` which was already removed in Phase 1 Task 2).

- [ ] **Step 2: Verify the generated Toaster component**

It should look like:

```typescript
'use client';

import { Toaster as Sonner } from 'sonner';

const Toaster = ({ ...props }: React.ComponentProps<typeof Sonner>) => {
	return <Sonner className="toaster group" {...props} />;
};

export { Toaster };
```

Remove `'use client';` (Kogu is CSR-only, no Next.js, RSC=false). Keep the rest.

- [ ] **Step 3: Write index.ts re-export**

- [ ] **Step 4: Delete Svelte sonner file**

```bash
git rm src/lib/components/ui/sonner/sonner.svelte
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(react)(ui/sonner): port Sonner toast primitive

Replaces svelte-sonner with the React sonner package (added by
shadcn). \`use client\` directive removed — Kogu is a Vite SPA,
not Next.js."
```

---

## Task 31: collapsible-aside (Kogu-original primitive)

**Files:**

- Create: `src/lib/components/ui/collapsible-aside/collapsible-aside.tsx`
- Create: `src/lib/components/ui/collapsible-aside/index.ts`
- Delete: `src/lib/components/ui/collapsible-aside/collapsible-aside.svelte`

**Context:** Not in the shadcn registry — must be hand-written. Read the Svelte source first to understand the API and behavior.

- [ ] **Step 1: Read existing Svelte source**

```bash
cat src/lib/components/ui/collapsible-aside/collapsible-aside.svelte
```

Note the props, slots, and class structure.

- [ ] **Step 2: Write the React equivalent**

```typescript
// src/lib/components/ui/collapsible-aside/collapsible-aside.tsx
import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface CollapsibleAsideProps {
	readonly children: ReactNode;
	readonly defaultOpen?: boolean;
	readonly side?: 'left' | 'right';
	readonly className?: string;
}

export function CollapsibleAside({
	children,
	defaultOpen = true,
	side = 'right',
	className,
}: CollapsibleAsideProps) {
	const [open, setOpen] = useState(defaultOpen);
	const Icon = side === 'right' ? (open ? ChevronRight : ChevronLeft) : open ? ChevronLeft : ChevronRight;

	return (
		<aside
			data-state={open ? 'open' : 'closed'}
			data-side={side}
			className={cn(
				'relative flex flex-col border-l bg-surface-3 transition-[width] duration-200',
				open ? 'w-64' : 'w-8',
				side === 'left' && 'border-l-0 border-r',
				className
			)}
		>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
				aria-label={open ? 'Collapse aside' : 'Expand aside'}
			>
				<Icon className="h-4 w-4" />
			</button>
			{open ? <div className="flex-1 overflow-auto p-3">{children}</div> : null}
		</aside>
	);
}
```

Adjust class strings to match the Svelte source's exact Tailwind classes (read Step 1 output and port verbatim).

- [ ] **Step 3: index.ts**

```typescript
export { CollapsibleAside } from './collapsible-aside';
```

- [ ] **Step 4: Delete Svelte source**

```bash
git rm src/lib/components/ui/collapsible-aside/collapsible-aside.svelte
```

- [ ] **Step 5: `bun run check`**, then commit:

```bash
git commit -m "feat(react)(ui/collapsible-aside): port Kogu-original CollapsibleAside primitive

Not part of the shadcn registry. Hand-written in React with the
same props (children, defaultOpen, side, className) and the same
Tailwind class set as the Svelte version. Internal state moves
from \$state to useState; aria-label and data-state attributes
preserved for the audit tooling."
```

---

## Task 32: list-item-button (Kogu-original)

Same structure as Task 31. The current Svelte source defines a button-like row with semantic states. Port to React with `useState` if it has internal state, or as a stateless prop-driven component if not.

- [ ] **Step 1: Read existing Svelte source**

```bash
cat src/lib/components/ui/list-item-button/list-item-button.svelte
```

- [ ] **Step 2-5: Write `.tsx` + index + delete Svelte + verify + commit**

Commit message template:

```
feat(react)(ui/list-item-button): port Kogu-original ListItemButton primitive

Hand-written port preserving the Svelte API (variant, selected,
disabled, etc.). Internal click handler signature unchanged.
```

---

## Task 33: Card primitive with density variant

**Files:**

- Create: `src/lib/components/ui/card/card.tsx`
- Delete: `src/lib/components/ui/card/*.svelte`

**Context:** `Card.Root` has a Kogu-specific `density` prop. The default shadcn Card has no density concept; we layer it on.

- [ ] **Step 1: Read existing Svelte Card files**

```bash
cat src/lib/components/ui/card/card.svelte
cat src/lib/components/ui/card/card-header.svelte
cat src/lib/components/ui/card/card-content.svelte
cat src/lib/components/ui/card/card-title.svelte
cat src/lib/components/ui/card/card-description.svelte
cat src/lib/components/ui/card/card-footer.svelte
cat src/lib/components/ui/card/card-action.svelte
```

Capture the **density variant**: `default` → `py-6 gap-6` on Root, `px-6` on Header/Content/Footer; `compact` → `py-4 gap-3` on Root, `px-4` on Header/Content/Footer (and `pb-4`/`pt-4` for the `[.border-b]`/`[.border-t]` strip).

- [ ] **Step 2: Add shadcn card**

```bash
bunx shadcn@latest add card --yes
```

- [ ] **Step 3: Layer density variant**

Edit `card.tsx`:

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils/cn';

type Density = 'default' | 'compact';
const CardContext = React.createContext<Density>('default');

interface CardRootProps extends React.HTMLAttributes<HTMLDivElement> {
	readonly density?: Density;
}

const Root = React.forwardRef<HTMLDivElement, CardRootProps>(
	({ className, density = 'default', ...props }, ref) => (
		<CardContext.Provider value={density}>
			<div
				ref={ref}
				data-slot="card"
				data-density={density}
				className={cn(
					'group/card rounded-xl border bg-card text-card-foreground shadow-sm',
					density === 'default' ? 'py-6 gap-6' : 'py-4 gap-3',
					className
				)}
				{...props}
			/>
		</CardContext.Provider>
	)
);
Root.displayName = 'Card.Root';

const Header = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => {
		const density = React.useContext(CardContext);
		return (
			<div
				ref={ref}
				data-slot="card-header"
				className={cn(
					density === 'default' ? 'px-6' : 'px-4',
					'flex flex-col space-y-1.5',
					'[.border-b]:' + (density === 'compact' ? 'pb-4' : 'pb-6'),
					className
				)}
				{...props}
			/>
		);
	}
);
Header.displayName = 'Card.Header';

// Content, Footer, Title, Description, Action follow the same pattern.
// Title and Description don't consume density (they have no padding).

export const Card = { Root, Header, Content, Footer, Title, Description, Action };
```

Adjust class strings to match the Svelte version exactly. Use Context to propagate density without prop drilling.

- [ ] **Step 4: index.ts**

```typescript
export { Card } from './card';
export type { CardRootProps } from './card';
```

- [ ] **Step 5: Delete Svelte Card files**

```bash
git rm src/lib/components/ui/card/*.svelte
```

- [ ] **Step 6: Verify + commit**

```bash
git commit -m "feat(react)(ui/card): port Card with density variant

Card.Root accepts density: 'default' | 'compact' and propagates it
to Header/Content/Footer via React context (no prop drilling).
data-slot='card' and data-density attributes match the Svelte
audit hooks. Class strings are carried over verbatim from the
Svelte source so visual parity is exact."
```

---

## Task 34: Sweep remaining Svelte component files and Svelte-flavored .ts files

**Context:** After Tasks 3-33 each delete their primitive's `.svelte` files, the only Svelte files left under `src/lib/components/` should be:

- Stale `index.ts` files that re-export `.svelte` modules (rewritten per task already)
- `src/lib/components/ui/sidebar/context.svelte.ts` (Svelte 5 rune file)

This task bulk-deletes anything remaining.

- [ ] **Step 1: List remaining .svelte and .svelte.ts files**

```bash
find src/lib/components -name '*.svelte' -o -name '*.svelte.ts' | sort
```

- [ ] **Step 2: Delete all** (if any remain after primitive-task deletes)

```bash
find src/lib/components -name '*.svelte' -delete
find src/lib/components -name '*.svelte.ts' -delete
```

- [ ] **Step 3: Verify nothing broken**

```bash
bun run check
bun run dev   # smoke
```

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(react): sweep residual Svelte component files

After porting all 31 primitives, no Svelte file should remain
under src/lib/components/ui/. Any leftover .svelte or .svelte.ts
files (from intermediate Phase 1 deletes that left orphans) are
removed here. The shared component categories (action, form,
layout, panel, regex, shell, status, template) still contain
Svelte files — those are addressed in Phase 3."
```

---

## Task 35: `/__primitives` debug route

**Files:**

- Create: `src/routes/__primitives.tsx`
- Modify: `src/routes/index.tsx` (add dev-only link)

**Context:** Visual parity verification page. Mounts every primitive with all variants. Not a user-facing tool route, so prefix with `__` to exempt from `validate:pages`.

- [ ] **Step 1: Write the debug route**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/lib/components/ui/button';
import { Card } from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
// ... import every primitive

export const Route = createFileRoute('/__primitives')({
	component: PrimitivesPage,
});

function PrimitivesPage() {
	return (
		<div className="container mx-auto space-y-8 py-8">
			<section>
				<h2 className="text-xl font-medium">Button</h2>
				<div className="flex flex-wrap gap-2">
					<Button variant="default">Default</Button>
					<Button variant="outline">Outline</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="card">Card</Button>
					<Button variant="default" size="sm">
						Small
					</Button>
					<Button variant="default" size="icon-sm" aria-label="Icon">
						<span>·</span>
					</Button>
					<Button disabled>Disabled</Button>
				</div>
			</section>

			<section>
				<h2 className="text-xl font-medium">Card</h2>
				<div className="grid grid-cols-2 gap-4">
					<Card.Root>
						<Card.Header>
							<Card.Title>Default density</Card.Title>
						</Card.Header>
						<Card.Content>Lorem ipsum dolor sit amet.</Card.Content>
					</Card.Root>
					<Card.Root density="compact">
						<Card.Header>
							<Card.Title>Compact density</Card.Title>
						</Card.Header>
						<Card.Content>Lorem ipsum dolor sit amet.</Card.Content>
					</Card.Root>
				</div>
			</section>

			{/* ... repeat for each primitive, exercising every variant */}
		</div>
	);
}
```

Write a section per primitive. Match the variants exercised in the Svelte audit, if any. For toast (Sonner), include a Button that calls `toast.success(...)` so the bubble is visible during testing.

- [ ] **Step 2: Update home page to link to /\_\_primitives in dev**

In `src/routes/index.tsx`, add (just before the closing `</div>`):

```tsx
{
	import.meta.env.DEV ? (
		<Link
			to="/__primitives"
			className="text-xs text-muted-foreground underline-offset-4 hover:underline"
		>
			/__primitives (dev)
		</Link>
	) : null;
}
```

- [ ] **Step 3: Verify**

```bash
bun run check
bun run dev    # navigate to /__primitives in browser, eyeball every section
```

- [ ] **Step 4: Tauri MCP screenshot for parity record**

Optional but useful: snapshot `/__primitives` via the same MCP flow as Phase 1's smoke test. Save the image as `docs/superpowers/plans/2026-05-16-react-migration-phase-2-primitives.png` and commit alongside.

- [ ] **Step 5: Commit**

```bash
git add src/routes/__primitives.tsx src/routes/index.tsx [optional png]
git commit -m "feat(react)(debug): add /__primitives showcase route

Mount every shadcn/ui primitive with all variants on a single page
for visual parity verification. The route is dev-only (link is
gated behind import.meta.env.DEV in the home page); the route file
prefix __ keeps it out of the validate:pages walk.

A screenshot of the rendered page is included for the migration
record."
```

---

## Phase 2 Definition of Done — Checklist

- [ ] `components.json` checked in
- [ ] All 31 primitives present under `src/lib/components/ui/*/`.tsx + `index.ts`
- [ ] Zero `*.svelte` files remain under `src/lib/components/ui/`
- [ ] Zero `*.svelte.ts` files remain under `src/lib/components/ui/`
- [ ] `Card.Root density="compact"` works
- [ ] `Button` Kogu variants (`card`, `icon-sm`) render
- [ ] `ToggleGroup` radiogroup-guarded wrapper preserves "exactly one selected"
- [ ] `lucide-react` is the only icon library; `@lucide/svelte` is removed
- [ ] `sonner` (React) replaces `svelte-sonner`
- [ ] `/__primitives` renders every primitive with no JS errors in browser console
- [ ] `bun run check` passes
- [ ] `bun run dev` boots cleanly
- [ ] `bun run tauri:dev` smoke (driver_session + screenshot + console logs) green
- [ ] **Re-evaluation gate**: do the primitives feel right? Are class-variance-authority + Radix UI ergonomics acceptable? If not, this is the moment to reconsider — Phases 3-6 build heavily on this foundation

## Notes for Future Self

- shadcn/ui's "New York" style matches what Kogu currently uses in the Svelte version. If "Default" style differs visibly during /\_\_primitives review, switch via `components.json` and re-run `shadcn add <name>` for affected primitives
- `class-variance-authority` (`cva`) is the React idiom; `tailwind-variants` (`tv`) was the Svelte idiom. They are similar but not identical (e.g., `cva` has no `slots` API). If a Svelte primitive used `tv` `slots`, decompose into multiple `cva` calls
- The Tailwind v4 `@theme inline` config in `src/app.css` is **untouched** in Phase 2 — design tokens stay the same so visual parity is achievable
- If shadcn primitives generate code with `enum` (rare but possible in deeply imported registry components), the `erasableSyntaxOnly: true` setting from Phase 1 will catch it at `bun run check`. Rewrite the `enum` to `const X = { ... } as const` + literal union before committing
- A common gotcha when porting variant strings from `tv()` → `cva()`: tv supports nested compound variants with the `compoundVariants` array; cva does too but the syntax is slightly different. Cross-check the cva docs if a variant doesn't render correctly
