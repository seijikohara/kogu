# React Migration Phase 6 — Cleanup, Rules, README, Smoke

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Finalize the React migration. After Phase 6 the worktree is mergeable into `main`: no Svelte residue anywhere, project rules describe React conventions, README reflects the new stack, and the desktop app boots end-to-end.

**Architecture:** Drop dev-only artifacts (`/primitives` debug route, `PlaceholderPage`). Rewrite `.claude/rules/svelte/*` as `.claude/rules/react/*`. Update top-level docs. Final Tauri smoke verifies the desktop binary still launches and every tool route renders.

---

## Tasks

### Task 1 — Drop dev artifacts

- [ ] Delete `src/routes/primitives.tsx`.
- [ ] Delete the dev link from `src/routes/index.tsx` (the `import.meta.env.DEV` block).
- [ ] Delete `src/lib/components/system/placeholder-page.tsx` and the `system/` directory if it becomes empty.
- [ ] `grep -rn "PlaceholderPage\|/primitives" src/` returns zero.
- [ ] `bun run check` clean.
- [ ] Commit `chore(react): drop /primitives debug route and PlaceholderPage`.

### Task 2 — Author `.claude/rules/react/components.md`

Mirror the Svelte version (`.claude/rules/svelte/components.md` in the legacy repo) but for React. Cover:

- Functional components only (no class components).
- `interface Props { readonly … }` with destructuring.
- `useState`, `useMemo`, `useCallback`, `useEffect` patterns.
- Controlled vs uncontrolled prop dual-mode (`prop ?? internal`).
- Container pattern: `Card` compound, `density="compact"` for tool pages, `Badge` for status, `Accordion` for grouped disclosure.
- `cn()` only for ≤ 2 overrides — if 3+, extend the primitive variant.
- ARIA attributes on the focusable element (not wrappers).
- shadcn React import pattern (named imports, not `Foo.*` namespace).

### Task 3 — Author `.claude/rules/react/layouts.md`

Cover the route-level shell, sidebar, and form rhythm. Include the `Form*` wrapper table from Svelte rules, adapted to React imports.

### Task 4 — Delete `.claude/rules/svelte/`

After 2 + 3 land, remove the entire `.claude/rules/svelte/` directory (it was carried over from the worktree; in the main project this still exists in the legacy repo).

### Task 5 — Update README.md

- [ ] Replace "SvelteKit / Svelte 5" mentions with "React 19 + TanStack Router".
- [ ] Update tech-stack table.
- [ ] Update screenshots only if they obviously diverge (defer otherwise — same Tailwind tokens).
- [ ] Update any references to `*.svelte` files in the project structure section.

### Task 6 — Update `.claude/CLAUDE.md`

- [ ] Tech-stack table: Svelte 5 → React 19.
- [ ] File naming table: `Svelte component` row drops, `React component` row replaces.
- [ ] Rules path table: `svelte/*` → `react/*`.

### Task 7 — Update `components.json`

- [ ] `style: radix-nova` stays; verify shadcn alias paths still point to `@/lib/...`.

### Task 8 — Validate full check + lint

- [ ] `bun run check` clean.
- [ ] `bunx biome lint .` clean.
- [ ] `bun run format:check` clean.
- [ ] `grep -rn "svelte\|Svelte" src/ docs/ scripts/ .claude/ --include="*.ts" --include="*.tsx" --include="*.md"` reviewed — every remaining match should be deliberate (e.g., commit history mentions, migration plan docs).

### Task 9 — Tauri smoke

- [ ] `bun run build` succeeds (Vite production build).
- [ ] `bun run tauri build` succeeds (desktop binary).
- [ ] `bun run tauri dev` launches; manually click each tool from the sidebar and confirm it renders without console errors.
- [ ] Record the smoke result in the commit message.

### Task 10 — Open the PR

- [ ] `git push -u origin chore/react-migration`.
- [ ] `gh pr create --title "feat(react)!: migrate frontend from Svelte 5 to React 19" --body-file docs/superpowers/plans/2026-05-17-react-migration-pr-body.md`. The body file is authored as part of this task and summarizes Phase 1–6 outcomes.

---

## DoD

- [ ] No `*.svelte`, `*.svelte.ts`, `+page.svelte`, or SvelteKit virtual-module imports anywhere in `src/`.
- [ ] `.claude/rules/svelte/` deleted; `.claude/rules/react/` populated.
- [ ] README, `.claude/CLAUDE.md` describe React.
- [ ] `bun run check`, `bunx biome lint .`, `bun run format:check`, `bun run build`, `bun run tauri build` all green.
- [ ] PR opened against `main`.

## Rollback

If Tauri smoke fails on a specific route, file an issue, mark that route's commit for revert, and document the gap in the PR body. The placeholder reinstatement is one `git revert` away.
