# React Migration Phase 4 — Zustand Stores

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Replace the Svelte `persisted.svelte.ts` `$state`-backed localStorage helper with Zustand stores (using `zustand/middleware/persist`), and resolve all `TODO(Phase 4)` markers seeded during Phase 3.

**Architecture:** Three small persisted stores (`useSidebarStore`, `useTabStore`, `useToolOptionsStore`) at `src/lib/stores/`. Each uses `persist` middleware with the same `kogu:` localStorage prefix the Svelte version used, so existing user data survives the migration. Selectors are colocated with the store.

**Tech Stack:** `zustand@^5` (latest at 2026-05). React 19. TypeScript 7-ready.

---

## Tasks

### Task 1 — Install Zustand

- [ ] `cd /Users/seiji/git/GitHub/seijikohara/kogu-react && bun add zustand`
- [ ] Verify `bun run check` still clean.
- [ ] Commit `chore(react)(deps): add zustand for persisted state`.

### Task 2 — Author sidebar store

- [ ] Create `src/lib/stores/sidebar.ts` with `useSidebarStore` exposing `{ collapsed: boolean, setCollapsed }`, `{ openGroups: Record<string, boolean>, toggleGroup, setGroupOpen }`.
- [ ] Use `persist` middleware with name `kogu:sidebar`.
- [ ] Update `src/lib/components/layout/app-sidebar.tsx` — remove the `TODO(Phase 4)` `useState` stubs and wire to the store.
- [ ] Commit `feat(react)(stores): add useSidebarStore`.

### Task 3 — Author tab store

- [ ] Create `src/lib/stores/tabs.ts` with a generic `useTabStore` keyed by route path; expose `{ getActive(key): string | null, setActive(key, value) }`.
- [ ] Update `src/lib/hooks/use-formatter-page.ts` to read/write the active tab via the store instead of the inline `kogu:tab:<key>` localStorage helpers.
- [ ] Commit `feat(react)(stores): add useTabStore + wire useFormatterPage`.

### Task 4 — Author tool-options store

- [ ] Create `src/lib/stores/tool-options.ts` with a generic `useToolOptionsStore<T>` factory that lets each route persist a typed options bag under `kogu:tool:<route>:options`.
- [ ] Add a single example consumer comment block in the file showing intended call-site shape (no consumer wires yet — that lands in Phase 5).
- [ ] Commit `feat(react)(stores): add useToolOptionsStore factory`.

### Task 5 — Verify & barrel

- [ ] Create `src/lib/stores/index.ts` re-exporting all three.
- [ ] `bun run check` must pass.
- [ ] `bunx biome lint src/lib/stores/` must pass.
- [ ] Commit `chore(react)(stores): add barrel export`.

---

## DoD

- [ ] `src/lib/stores/{sidebar,tabs,tool-options,index}.ts` exist and are linted.
- [ ] Every `TODO(Phase 4)` comment in `src/` is resolved or deleted.
- [ ] `bun run check` passes.
- [ ] localStorage keys keep the `kogu:` prefix.
