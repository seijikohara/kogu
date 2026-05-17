# React Migration Phase 3 — Shared Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port every shared component (the 41 `.svelte` files under `src/lib/components/{action,editor,form,layout,panel,regex,shell,status,template}/` in the legacy tree) to TypeScript React under the matching paths in `kogu-react`, so Phase 5 route migration only needs to wire pre-built building blocks.

**Architecture:** Mirror the legacy Svelte folder layout one-to-one (`action/`, `form/`, ...). Each component is rewritten as a `.tsx` file with the same kebab-case name and exports a single named React function component. `index.ts` re-exports per category. React 19 + TypeScript 7-ready (no enum/namespace/parameter properties, `erasableSyntaxOnly`). State is local-only at this phase; Zustand store rewiring is Phase 4.

**Tech Stack:** React 19, TypeScript 5.8+ (TS7-ready), Radix UI primitives via the `radix-ui` umbrella, `class-variance-authority`, `lucide-react`, Monaco/CodeMirror via official React wrappers, `sonner` for toasts. Tailwind v4 + the WCAG-AA-tuned tokens from `app.css`.

---

## Branching & PR

Continue on `chore/react-migration` (single PR, started Phase 1). Commits remain granular per category sub-task.

## Task ordering rationale

The order is **inverse dependency**: components on the bottom (used by many) ship first so later tasks compile against React siblings, not Svelte residue.

```
[3.1 Form*]                       — 10 files, used by every route
   ↓
[3.2 Status* + Action*]           — 11 files, used by most routes
   ↓
[3.3 Panel + Regex + Shell]       — 9 files, used by tool-specific routes
   ↓
[3.4 Layout (sidebar, title-bar)] — 8 files, used by __root only
   ↓
[3.5 Editor wrappers]             — Monaco/CodeMirror React adapters
   ↓
[3.6 Template (tabbed pages)]     — 3 files, used by formatter routes
```

**Why this order:** Form/Status/Action components are leaf-level. Layout components are at the top of the tree and need their leaves. Editor and Template are heavy and used by ≤ 10 routes; doing them late minimizes throwaway work if their consumer routes are simplified in Phase 5.

---

## Per-task template

Each component port follows the same micro-loop. To avoid 41× repetition, the template is given once here. Tasks reference it.

**For component `<category>/<name>.svelte` → `src/lib/components/<category>/<name>.tsx`:**

- [ ] **Step A: Read the Svelte source**
      `cat src/lib/components/<category>/<name>.svelte` from the legacy tree (`/Users/seiji/git/GitHub/seijikohara/kogu`). Read both the `<script>` and the markup to understand props, state, and slots.

- [ ] **Step B: Identify React equivalents**
  - `let x = $state(...)` → `const [x, setX] = useState(...)`
  - `let y = $derived(expr)` → `const y = useMemo(() => expr, [...deps])` (omit `useMemo` for trivial expressions)
  - `let z = $derived.by(() => { ... })` → multiple `useMemo` / plain computation
  - `$props()` destructuring → React function-param destructuring with `Readonly<Props>` style
  - `$bindable()` → controlled-prop pattern (`value` + `onValueChange`)
  - `<slot />` → `children: React.ReactNode`
  - `<slot name="x" />` → named-render-prop or sub-component pattern
  - `<svelte:component>` → polymorphic `as` prop or direct conditional render
  - `onClick` / `on:click` → `onClick`
  - `class:foo={cond}` → `cn('foo', cond && 'extra')`
  - `bind:this` → `useRef`
  - Tailwind classes pass through unchanged.

- [ ] **Step C: Write `<name>.tsx`**
      Single named export matching PascalCase of the file name (e.g., `form-input.svelte` → `FormInput`). Keep the file under ~150 lines; if longer, the original was probably doing too much — split into helper components within the same file.

- [ ] **Step D: Update `<category>/index.ts`**
      Re-export from the new `.tsx`. Replace any Svelte-only types with React-equivalent types (`Snippet<T>` → `(props: T) => React.ReactNode`).

- [ ] **Step E: Run `bun run check`**
      Expected: PASS (zero tsc errors, validate-pages still happy, audit-design still happy).

- [ ] **Step F: Run `bunx biome lint <path>`**
      Expected: zero diagnostics. Fix any (typically `noArrayIndexKey`, `useExhaustiveDependencies`, `useUniqueElementIds`) inline. Apply `biome-ignore` only when the rule is wrong for the context, with a reason in the comment.

- [ ] **Step G: Commit**
      `git commit -m "feat(react)(<category>/<name>): port <Name> to React"`
      (Or batch 3–5 closely related components into one commit when they ship together, e.g., `form-info` + `form-error` + `form-section`.)

---

## Sub-Phase 3.1 — Form wrappers (10 components)

**Why first:** Every tool route in Phase 5 imports at least one `Form*`. Shipping these unblocks the whole route batch.

**Files (all under `src/lib/components/form/`):**

| Svelte source                | React target              | Notes                                                                                 |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| `form-section.svelte`        | `form-section.tsx`        | Layout-only wrapper around `<fieldset>` + `<legend>`                                  |
| `form-info.svelte`           | `form-info.tsx`           | Static `<Alert>`-style banner; reuses `Alert` primitive                               |
| `form-error.svelte`          | `form-error.tsx`          | Single-line error text with `aria-live`                                               |
| `form-input.svelte`          | `form-input.tsx`          | Wraps `Input` + `Label`; supports `description`, `error`, `id` generation via `useId` |
| `form-textarea.svelte`       | `form-textarea.tsx`       | Like `form-input` but for `Textarea`                                                  |
| `form-select.svelte`         | `form-select.tsx`         | Wraps the shadcn `Select` family; controlled value + label                            |
| `form-checkbox.svelte`       | `form-checkbox.tsx`       | Wraps `Checkbox` + `Label`                                                            |
| `form-checkbox-group.svelte` | `form-checkbox-group.tsx` | Grid of `FormCheckbox` with shared change handler; expects `readonly` options         |
| `form-mode.svelte`           | `form-mode.tsx`           | Wraps `ToggleGroup` for mode selection (Encode/Decode, Format/Minify, ...)            |
| `form-slider.svelte`         | `form-slider.tsx`         | Wraps `Slider` + label + value display                                                |

- [ ] **Task 3.1.1:** Port `form-info`, `form-error`, `form-section` (low-level scaffolds). Commit.
- [ ] **Task 3.1.2:** Port `form-input`, `form-textarea`. Commit.
- [ ] **Task 3.1.3:** Port `form-select`, `form-checkbox`, `form-checkbox-group`. Commit.
- [ ] **Task 3.1.4:** Port `form-mode`, `form-slider`. Commit.
- [ ] **Task 3.1.5:** Author `src/lib/components/form/index.ts` re-exporting all ten. Run `bun run check`. Commit.

DoD: `bun run check` clean, `bunx biome lint src/lib/components/form/` clean.

---

## Sub-Phase 3.2 — Status + Action (11 components)

**Why second:** Form already depends on `Alert` / `Badge` primitives; Status reuses those for `error-display`, `validity-badge`, `status-badge`. Action is small and self-contained.

**Files under `src/lib/components/action/`:**

- `action-button.tsx` — primary tool action (e.g., "Format", "Encode")
- `copy-button.tsx` — clipboard write + transient toast; uses `sonner.toast.success` instead of svelte-sonner
- `result-block.tsx` — output container with header + copy slot

**Files under `src/lib/components/status/`:**

- `empty-state.tsx`, `embedded-empty-state.tsx` — placeholder when no input/output
- `error-display.tsx` — wrapper around `Alert` for parsing errors
- `loading-overlay.tsx` — backdrop with spinner (Phase 5 routes that await async work)
- `stat-item.tsx` — small KPI tile (count, byte size, ...)
- `status-badge.tsx` — `<Badge>` with status semantics (ok/warn/error)
- `validity-badge.tsx` — boolean valid/invalid badge
- `detected-info.tsx` — content-type/format detection label

- [ ] **Task 3.2.1:** Port `action/copy-button` (Tauri clipboard + sonner toast). Critical: `import { writeText } from '@tauri-apps/plugin-clipboard-manager'` stays unchanged. Commit.
- [ ] **Task 3.2.2:** Port `action/action-button`, `action/result-block`. Author `action/index.ts`. Commit.
- [ ] **Task 3.2.3:** Port `status/status-badge`, `status/validity-badge`, `status/stat-item` (badge family). Commit.
- [ ] **Task 3.2.4:** Port `status/empty-state`, `status/embedded-empty-state`, `status/detected-info` (info family). Commit.
- [ ] **Task 3.2.5:** Port `status/error-display`, `status/loading-overlay`. Author `status/index.ts`. Commit.

DoD: `bun run check` clean. Copy-button verified manually against Tauri dev clipboard (defer until Phase 5 dev-server boot).

---

## Sub-Phase 3.3 — Panel + Regex + Shell (9 components)

**Files under `src/lib/components/panel/`:**

- `options-panel.tsx` — right-rail container; takes children + collapsed state
- `diff-legend.tsx` — color key for the diff viewer
- `diff-results.tsx` — diff renderer (likely depends on `react-diff-view` or hand-rolled — confirm at port time)

**Files under `src/lib/components/regex/`:**

- `pattern-editor.tsx` — CodeMirror-based regex input with syntax highlighting
- `railroad-view.tsx` — railroad diagram for parsed regex; **may depend on `regexp-tree` rendering helpers**

**Files under `src/lib/components/shell/`:**

- `tool-shell.tsx` — outer route shell: title bar + body + optional rail (the top-level box every tool sits in)
- `tool-bar.tsx` — action bar above tool content
- `options-rail.tsx` — left/right rail wrapper used by routes that need permanent options
- `status-bar.tsx` — footer bar with stats

- [ ] **Task 3.3.1:** Port `panel/options-panel`. Commit.
- [ ] **Task 3.3.2:** Port `panel/diff-legend`, `panel/diff-results`. Commit.
- [ ] **Task 3.3.3:** Port `regex/pattern-editor`. Depends on `@uiw/react-codemirror` (already in deps via Phase 2 Editor prep). Commit.
- [ ] **Task 3.3.4:** Port `regex/railroad-view`. Validate `regexp-tree` integration unchanged. Commit.
- [ ] **Task 3.3.5:** Port `shell/tool-shell`, `shell/tool-bar`, `shell/options-rail`, `shell/status-bar`. Author `shell/index.ts`. Commit.

DoD: `bun run check` clean. `regex/pattern-editor` renders without runtime errors (verify visually via `/primitives` gallery if added there during the port).

---

## Sub-Phase 3.4 — Layout (8 components)

**Why late:** These sit at the `__root` route level and aggregate everything below. Doing them late keeps the broken intermediate state visible only on the root tree itself, not on every tool route.

**Files under `src/lib/components/layout/`:**

- `section-header.tsx`, `section-label.tsx` — light wrappers (do these first)
- `split-pane.tsx` — resizable split using shadcn `resizable` (already ported in Phase 2)
- `nav-buttons.tsx` — sidebar nav row
- `keyboard-shortcuts-dialog.tsx` — `Dialog` + shortcut table
- `title-bar.tsx`, `title-bar-command.tsx` — Tauri custom title bar with command palette trigger
- `app-sidebar.tsx` — main sidebar; consumes Phase 2 shadcn `Sidebar` family; rewires the sidebar state hooks from `is-mobile.svelte.ts` / `persisted.svelte.ts` to React equivalents (`use-mobile.ts` already present; persisted state defers to Phase 4)

- [ ] **Task 3.4.1:** Port `section-header`, `section-label`. Commit.
- [ ] **Task 3.4.2:** Port `split-pane`. Commit.
- [ ] **Task 3.4.3:** Port `nav-buttons`, `keyboard-shortcuts-dialog`. Commit.
- [ ] **Task 3.4.4:** Port `title-bar`, `title-bar-command`. Commit.
- [ ] **Task 3.4.5:** Port `app-sidebar`. Wire to `useMobile` from `lib/hooks/use-mobile`. Persisted-state hooks are stubbed with `useState` defaults for now; a `TODO(Phase 4)` comment marks the Zustand wire-up site. Commit.
- [ ] **Task 3.4.6:** Update `src/routes/__root.tsx` to mount the new `<AppSidebar />` + `<TitleBar />` chrome instead of the Phase 1 placeholder header. Commit.

DoD: `bun run check` clean. Visual: home page (`/`) renders inside the new chrome.

---

## Sub-Phase 3.5 — Editor wrappers

The legacy `editor/code/` sub-tree wraps Monaco/CodeMirror in opinionated Kogu components (theme bridging, language detection, default keybindings).

- [ ] **Task 3.5.1:** Inspect `src/lib/components/editor/code/` files in the legacy tree. List the `.svelte` files and their dependencies.
- [ ] **Task 3.5.2:** Port each file one-by-one using the per-task template. Use `@monaco-editor/react` for Monaco and `@uiw/react-codemirror` for CodeMirror (both already on the dependency list as of Phase 2). Commit per file.
- [ ] **Task 3.5.3:** Author `src/lib/components/editor/code/index.ts` and `src/lib/components/editor/index.ts`. Commit.

DoD: `bun run check` clean. Editor renders without runtime errors (visual verification via a Phase 5 route once it lands).

---

## Sub-Phase 3.6 — Template (3 components)

The `template/` folder holds page-level templates that several formatter routes share.

**Files:**

- `tabbed-formatter-page.tsx` — formatter route shell with `Format` / `Compare` / `Convert` tabs
- `compare-tab.tsx`, `convert-tab.tsx` — concrete tab contents that the template hosts

- [ ] **Task 3.6.1:** Port `compare-tab`, `convert-tab` (these are leaves of the template). Commit.
- [ ] **Task 3.6.2:** Port `tabbed-formatter-page`. Composes the two tabs plus a primary `Format` tab. Commit.
- [ ] **Task 3.6.3:** Author `src/lib/components/template/index.ts`. Run `bun run check`. Commit.

DoD: `bun run check` clean.

---

## Phase 3 DoD checklist

- [ ] All 9 categories (`action`, `editor`, `form`, `layout`, `panel`, `regex`, `shell`, `status`, `template`) contain only `.tsx` files plus `index.ts`. **Zero `.svelte` files remain under `src/lib/components/`** (the `ui/` subtree was already cleaned in Phase 2).
- [ ] `bun run check` passes (tsc, validate-pages, audit-design).
- [ ] `bunx biome lint src/lib/components/` passes.
- [ ] `bun run dev` boots and `http://localhost:1420/` renders the new sidebar chrome with the tool list.
- [ ] `/primitives` debug route still works.
- [ ] Every component preserves Kogu-specific behavior (a11y attributes, focus management, Tauri clipboard calls, sonner toasts).
- [ ] No `TODO(Phase 4)` left **except** persisted-state wiring placeholders — those are explicitly deferred and counted by `grep -rn "TODO(Phase 4)" src/`.

## Risks / open questions

| Risk                                                                                  | Mitigation                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pattern-editor` (regex) bundles syntax highlighting that may not transplant cleanly. | If `@uiw/react-codemirror` regex highlight is insufficient, fall back to `monaco-editor` with `regex` language id, or hand-roll using `regexp-tree` AST + a `<pre>`. Allowed to defer to Phase 5 — emit a placeholder. |
| `app-sidebar` depends on persisted state that doesn't exist yet (Phase 4).            | Stub with `useState` defaults; mark with `TODO(Phase 4)`.                                                                                                                                                              |
| Monaco React wrappers may pull a different web-worker config.                         | Mirror `vite.config.ts` worker setup from the legacy repo verbatim.                                                                                                                                                    |
| Some `keyboard-shortcuts-dialog` shortcuts call Tauri commands.                       | Keep the `invoke()` calls intact — Tauri backend is unchanged.                                                                                                                                                         |
| `editor/code/` could be deeper than expected.                                         | Inspect at the start of 3.5; if > 5 files, split into 3.5a/3.5b.                                                                                                                                                       |

## Rollback

If a sub-phase derails:

1. `git revert` the offending commits (granular per category).
2. Leave a `TODO(Phase 3)` comment in `__root.tsx` or the affected route.
3. Phase 5 routes that need the missing component substitute the Phase 1 placeholder.

---

**Status:** Plan authored 2026-05-17. Execution starts with Sub-Phase 3.1 (Form wrappers).
