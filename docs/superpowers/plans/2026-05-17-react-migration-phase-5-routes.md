# React Migration Phase 5 — Route Migration

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Replace each of the 23 placeholder routes in `src/routes/<tool>.tsx` with a full React port of the corresponding legacy SvelteKit `src/routes/<tool>/+page.svelte` from `/Users/seiji/git/GitHub/seijikohara/kogu`. After Phase 5 the app boots and every tool is functional.

**Architecture:** Each route remains a single `.tsx` under `src/routes/`, exporting `Route` via `createFileRoute('/<tool>')`. Routes import Phase 3 shared components (Form*, Action*, Status*, Shell*, Template\*) and Phase 4 Zustand stores instead of Svelte runes / `persisted.svelte.ts`. Business logic in `src/lib/services/` is mostly pure TS and reused unchanged; any `.svelte.ts` helpers (none should remain after Phase 4) trigger an inline port.

**Tech Stack:** React 19, TanStack Router, Zustand stores (Phase 4), shadcn React primitives (Phase 2). TypeScript 7-ready.

---

## Batching

Routes are grouped by **shared template / complexity tier**. Each batch ships in a separate subagent so parallel dispatch stays conflict-free.

| Batch                   | Routes                                                                                     | LoC  | Strategy                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------------------------------- |
| **A — Formatters**      | xml-formatter, yaml-formatter, json-formatter, sql-formatter, markdown-editor              | 1412 | All use `TabbedFormatterPage` — same skeleton, language-specific options                      |
| **B — Encoders/Hash**   | base64-encoder, url-encoder, hash-generator, jwt-decoder, string-case-converter            | 1679 | Single-input → output transforms, mostly `ConvertTab` or simple grid                          |
| **C — Generators**      | uuid-generator, password-generator, bcrypt-generator, ssh-key-generator, gpg-key-generator | 1790 | Random/keypair generators; reuse `ResultBlock`, `FormSlider`, `FormCheckbox` heavily          |
| **D — Builders/Visual** | cron-expression-builder, curl-builder, qr-code-generator, regex-tester                     | 1497 | Heavier UI (regex AST tree, QR styling preview, cron natural-language)                        |
| **E — Specialty**       | diff-viewer, settings                                                                      | 1004 | Diff renderer + global settings dialog page                                                   |
| **F — Network**         | network-interfaces, network-scanner                                                        | 1953 | Tauri backend integration (SNMP, netmask, OS APIs); both invoke `tauri-apps/api/core` heavily |

---

## Per-route template

Each route port follows the same loop. To keep this plan concise we describe it once.

- [ ] Read `/Users/seiji/git/GitHub/seijikohara/kogu/src/routes/<tool>/+page.svelte`.
- [ ] Read the existing placeholder `/Users/seiji/git/GitHub/seijikohara/kogu-react/src/routes/<tool>.tsx` to keep the `createFileRoute('/<tool>')` registration.
- [ ] Write the full React equivalent in-place, preserving the route registration. Use Phase 3 components and Phase 4 stores. Replace SvelteKit `$lib/*` imports with `@/lib/*`, `$page` with TanStack `useRouterState`/`useParams`, etc.
- [ ] Wire any tool options through `createToolOptionsStore('<route-id>', defaults)`.
- [ ] Run `cd /Users/seiji/git/GitHub/seijikohara/kogu-react && bun run check`. It MUST stay clean per route — if not, the route is not done.
- [ ] Run `bunx biome lint src/routes/<tool>.tsx` — zero diagnostics, fix inline; `biome-ignore` only with a written reason.
- [ ] Commit `feat(react)(<tool>): port to React`.

The subagent commits each route as it lands so a failure mid-batch leaves a recoverable tree.

---

## DoD

- [ ] Every `src/routes/<tool>.tsx` is a real port (no `PlaceholderPage`).
- [ ] `bun run check` clean.
- [ ] `bunx biome lint src/` clean.
- [ ] `bun run dev` boots; every tool route renders without runtime errors (visual verification deferred to Phase 6 smoke).
- [ ] `grep -rn "PlaceholderPage" src/` returns at most the component definition itself, no references.

## Risks

| Risk                                                                                                  | Mitigation                                                                                                         |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `network-scanner` (1287 LoC) is the single largest file; SNMP/`csnmp` backend is on Rust side.        | Treat it as one full subagent run; coordinator may need to manually finish if the subagent hits its own token cap. |
| `markdown-editor` (887 LoC) embeds Monaco + preview pane.                                             | Confirm `code-editor.tsx` (Phase 3.5) exposes the events markdown needs; extend if not.                            |
| `regex-tester` depends on `pattern-editor`, `railroad-view` (Phase 3.3) — those have shipped already. | No special action.                                                                                                 |
| Some tool options were not in `persisted.svelte.ts` (per-session only).                               | Use `useState` for those, not `createToolOptionsStore`.                                                            |

## Rollback

- Per-route commits mean `git revert` is a one-route knife.
- The Phase 1 `PlaceholderPage` is still in tree until Phase 6 cleanup, so any reverted route auto-falls-back to the placeholder.
