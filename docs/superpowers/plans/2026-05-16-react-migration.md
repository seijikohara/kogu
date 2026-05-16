# Kogu Svelte 5 → React 19 Migration — Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement each phase plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **This file is the overview; each phase has its own detailed plan file.**

**Goal:** Replace the SvelteKit + Svelte 5 frontend with a React 19 + Vite + TanStack Router stack while preserving every tool feature, persisted state, and design language. The Tauri Rust backend is untouched. Ship as a single PR composed of phase-aligned commits, each leaving `bun run check` and `cargo check` in a green state.

**Architecture:** Vite remains the build tool. SvelteKit-style file-based routing is replaced by TanStack Router's file-based mode (`src/routes/__root.tsx` + per-route files). Reactivity moves from Svelte 5 runes (`$state` / `$derived` / `$effect`) to React Compiler-optimized hooks (`useState` / `useMemo` / `useEffect`) with Zustand for cross-cutting persisted state. The shadcn-svelte primitive set is replaced 1:1 by the official React shadcn/ui registry (same Tailwind v4 tokens, same `data-slot` conventions). Editor wrappers (`@tiptap/react`, `@monaco-editor/react`, `@uiw/react-codemirror`) replace the hand-rolled Svelte editor shells. Tests move from `svelte-testing-library` to `@testing-library/react` under Vitest.

**Tech Stack:**

- React 19 (with React Compiler via `babel-plugin-react-compiler`)
- Vite 8 (kept) + `@vitejs/plugin-react`
- TanStack Router (file-based via `@tanstack/router-vite-plugin`)
- Zustand (with `persist` middleware)
- shadcn/ui (Radix UI primitives) + Tailwind CSS v4 (kept)
- `@tiptap/react`, `@monaco-editor/react`, `@uiw/react-codemirror`
- Vitest (kept) + `@testing-library/react`, `@testing-library/jest-dom`
- Tauri 2.x (kept, no backend changes)
- TypeScript strict + **TypeScript 7 Ready** (`erasableSyntaxOnly: true` — no enum / namespace / parameter properties / `import = require(...)`)
- Biome + Prettier + Lefthook (kept, config adjusted)

---

## Why a Master Plan + Sub-Plans

This migration touches ~250 source files and rewrites every UI surface. A single monolithic plan would exceed practical reading and execution scope. Instead, this master plan defines the phase graph and definition-of-done for each phase; each phase has its own detailed plan file with bite-sized steps.

The PR itself remains single (per the user's explicit decision) — each phase becomes a series of commits on the same branch `chore/react-migration`, with the merge being one PR with ~100+ commits ordered by phase.

## Branch & Worktree Strategy

- Single long-lived branch: `chore/react-migration` (off `main`)
- Develop in an **isolated worktree** so `main` stays clean for small fixes: `git worktree add ../kogu-react chore/react-migration`
- Rebase against `main` weekly (or on Renovate / dependency PR landings) to keep merge debt bounded
- Lefthook pre-commit must pass at every commit: `bun run check` will be the formatter+typecheck gate during the React era (after Phase 1 swap)

## Coexistence Strategy (during phases 2-5)

Svelte and React **do not coexist in the same SPA**. Phase 1 deletes the Svelte runtime entirely and replaces it with the React shell. From Phase 2 onward, every route that hasn't been migrated yet renders a **placeholder page**:

```tsx
// src/routes/<tool>.tsx (unmigrated)
import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/<tool>')({
	component: () => <PlaceholderPage tool="<Tool Display Name>" />,
});
```

`PlaceholderPage` shows "This tool is being rebuilt — check back soon" and provides a back-to-home link. This keeps the build green and the app launchable at every phase boundary, while making un-migrated routes visibly distinct from broken ones.

## Phase Graph

```
Phase 1 (Foundation) ──┬─→ Phase 2 (shadcn/ui)
                       └─→ Phase 4 (State & Services) ──→ Phase 5 (Routes)
Phase 2 (shadcn/ui) ─────→ Phase 3 (Shared components) ─→ Phase 5 (Routes)
Phase 5 (Routes) ────────→ Phase 6 (Tests + Docs + Cleanup)
```

Phases 2 and 4 can be developed in parallel after Phase 1. Phase 3 depends on Phase 2's primitives. Phase 5 depends on Phases 2-4. Phase 6 is the final pass.

## Phase Summary

| #   | Phase                                                                                                                                 | Detailed Plan File                                                               | DoD                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Foundation** — toolchain swap, build, root layout, placeholder routes                                                               | `2026-05-16-react-migration-phase-1-foundation.md` ✅ **DONE 2026-05-16**        | `bun run dev` boots a React app showing all 23 tool entries as PlaceholderPage instances; `bun run check` and `cargo check` green; Tauri smoke (`bun run tauri:dev`) opens the React shell. **15 commits on `chore/react-migration` (b0d34a5..09b4680)**. `erasableSyntaxOnly: true` enabled for TS7 readiness. |
| 2   | **shadcn/ui primitives** — port all 31 primitives from `src/lib/components/ui/`                                                       | `2026-05-16-react-migration-phase-2-shadcn-ui.md` (to be authored after Phase 1) | All 31 primitives mounted as story components in a `/__primitives` debug route; visual parity with the Svelte versions; all variants render                                                                                                                                                                     |
| 3   | **Shared components** — `action`, `form`, `layout`, `panel`, `regex`, `shell`, `status`, `template` categories                        | `2026-05-16-react-migration-phase-3-shared-components.md` (TBA)                  | All non-route shared components mounted in `/__components` debug route; `FormCheckbox` / `FormInput` / `FormSelect` / `FormSlider` / `Card.Root` + density variants all behave identically to Svelte                                                                                                            |
| 4   | **State & services** — Zustand stores (settings, sidebar, persistence), services move unchanged (pure TS)                             | `2026-05-16-react-migration-phase-4-state-services.md` (TBA)                     | All `src/lib/services/**` files unchanged (already pure TS); persisted state from `persisted.svelte.ts` replaced by Zustand `persist` stores with same localStorage keys                                                                                                                                        |
| 5   | **Route migration** — 22 routes in 3 batches                                                                                          | `2026-05-16-react-migration-phase-5-routes.md` (TBA, may split per batch)        | All routes functional, no PlaceholderPage remains, `bun run test` (Vitest) green for all migrated route tests                                                                                                                                                                                                   |
| 6   | **Tests, docs, cleanup** — finalize, delete Svelte traces, rewrite `.claude/rules/svelte/*` as `.claude/rules/react/*`, update README | `2026-05-16-react-migration-phase-6-cleanup.md` (TBA)                            | Zero `*.svelte` / `*.svelte.ts` files remain; `package.json` has no `svelte-*` deps; CLAUDE.md and rules describe React conventions; `bun run check` + `cargo check` + `bun run test` + `cargo test --lib` + `cargo clippy --all-targets -- -D warnings` all green; Tauri smoke green                           |

## Validation Gates (run at every commit)

Every commit on `chore/react-migration` must pass these checks before pushing:

1. **Frontend type-check**: `bun run check`
   - Currently: `svelte-kit sync && svelte-check ... && bun run validate:pages && bun run audit:design`
   - After Phase 1: `tsc --noEmit && bun run validate:pages && bun run audit:design`
2. **Frontend tests** (when added): `bun run test`
3. **Backend check**: `cd src-tauri && cargo check --all-targets`
4. **Backend tests**: `cd src-tauri && cargo test --lib`
5. **Backend lint**: `cd src-tauri && cargo clippy --all-targets -- -D warnings`
6. **Format check**: `bun run format:check`

Lefthook is reconfigured in Phase 1 to enforce these on `pre-commit`.

## Tauri Smoke Gate (run at phase boundaries)

At the end of each phase, before opening the next, run:

```bash
bun run tauri:dev
```

Then verify via Tauri MCP (per the workflow used in the dep-bump verification):

```
mcp__tauri__driver_session action=start
mcp__tauri__ipc_get_backend_state          # confirms Tauri 2.11.1 still loading
mcp__tauri__webview_screenshot             # confirms UI renders
mcp__tauri__read_logs source=console       # confirms no JS errors
```

Then clean up:

```
mcp__tauri__driver_session action=stop
lsof -tiTCP:9223 -sTCP:LISTEN | xargs kill
```

## Rollback Strategy

A single PR is irreversible after merge, but the **branch itself can be discarded** before merge with zero cost. If at any phase boundary the migration feels worse than expected:

- Phase 1 complete but Phase 2 looks bad → discard branch, return to Svelte 5
- Phase 5 complete but final UX feels worse → discard branch, return to Svelte 5

This is why **each phase boundary is also a re-evaluation gate**, not just a technical milestone.

After the PR merges, the rollback path is `git revert <merge-commit>` which works but produces a "reverted to Svelte" commit on `main` — keep this in mind as the last decision point.

## Out of Scope (this migration)

- Tauri backend changes (Rust code stays as-is)
- Adding new features
- Changing the Tailwind design tokens (`src/app.css` color palette stays)
- Changing CI infrastructure beyond the script swaps necessary for the toolchain
- Replacing third-party tools (CodeMirror 6 stays, Monaco stays, Tiptap stays, mermaid stays, KaTeX stays, etc.)
- Renaming routes / changing URL structure
- Mobile responsive rework (current desktop-only sizing preserved)

## Risks & Mitigations

| Risk                                                                                                              | Probability | Mitigation                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack Router file-based mode doesn't produce identical URL shape to SvelteKit                                  | Med         | Phase 1 explicitly verifies URL parity for all 22 routes via placeholder pages                                                                    |
| `@tiptap/react` API differs from `@tiptap/core` direct usage we have today                                        | Low         | Tiptap React wrapper is a thin layer over core; markdown-editor route is the only consumer                                                        |
| Monaco's React wrapper has different lifecycle behavior than the manual mount we do today                         | Med         | Plan dedicates a Phase 5b sub-step to verify Monaco YAML + JSON modes including `monaco-yaml` worker integration (which we just fixed in PR #257) |
| Zustand `persist` middleware uses different localStorage key serialization than our current `persisted.svelte.ts` | Low         | Phase 4 explicitly preserves the existing localStorage keys via `persist` `name` option                                                           |
| React Compiler breaks `useEffect` dependencies we'd expect to be stable                                           | Med         | Phase 1 ships **without** Compiler enabled; opt in only after all routes work without it                                                          |
| Build time becomes slower (Vite + React Compiler + JSX)                                                           | Low         | Vite's React plugin is highly optimized; baseline expected                                                                                        |
| Test rewrite (svelte-testing-library → @testing-library/react) loses coverage                                     | Med         | Phase 6 explicitly verifies test count parity; flag any tests that don't port cleanly                                                             |
| Long-lived branch accumulates merge conflicts with `main`                                                         | High        | Rebase against `main` on every Renovate / fix PR landing; worktree isolation supports this                                                        |
| AI pair-programming produces React code that still uses Svelte mental models                                      | Med         | Phase 1 establishes new `.claude/rules/react/*` files early so subsequent phases benefit from on-load context                                     |

---

## Execution Order

1. Author Phase 1 detailed plan (this session)
2. Execute Phase 1 via `superpowers:subagent-driven-development` or `superpowers:executing-plans`
3. **STOP** — re-evaluate feel: is the React 19 + TanStack Router + Vite shell what you expected?
4. If yes, author Phase 2 detailed plan, execute, re-evaluate
5. Repeat for Phases 3 → 4 → 5 → 6
6. Open PR `chore/react-migration` against `main`, request review (or self-merge)

Each phase boundary is a **commit-and-pause checkpoint**, not an auto-continue. Re-evaluation may surface a need to adjust the next phase's plan, change library choices, or abort and return to Svelte.

---

## Notes for the Engineer Executing This

- This codebase uses **Bun** as the package manager, not npm/yarn/pnpm. All commands use `bun` (`bun install`, `bun run dev`, `bun run check`, etc.)
- This codebase uses **tab indentation** and **single quotes** (see `.prettierrc`); ensure the React stack matches (TanStack Router's generated files default to spaces — configure or post-format)
- The project has **strict TypeScript** and **strict Biome lint** enforced via `lefthook`. Plan for `bun run check` and `bunx biome lint .` to pass before every commit
- Tauri runs as a **CSR-only SPA** — there is no SSR. TanStack Router should be configured in SPA mode (not the upcoming SSR mode)
- The `src/lib/services/` directory is **already pure TypeScript** (no `.svelte` imports). It moves to React unchanged; verify by `grep -rn 'svelte' src/lib/services/` returning zero matches before counting on this
- The Rust backend's **Tauri commands** are exposed via `@tauri-apps/api/core`'s `invoke()` and `listen()` from `@tauri-apps/api/event`. Type signatures live in `src/lib/services/*` and are framework-agnostic
- The current `src/routes/+layout.ts` simply exports `prerender = true` and `ssr = false` for SvelteKit's adapter-static. The TanStack Router equivalent (SPA mode) is the default, no equivalent file needed
