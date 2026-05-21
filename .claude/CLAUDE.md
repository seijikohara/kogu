# Kogu Project Instructions

See @README.md for project overview and @package.json for available commands and dependencies.

## Quick Reference

### Development Commands

```bash
bun run dev           # Start Vite dev server
bun run tauri dev     # Start Tauri dev mode
bun run build         # Build frontend
bun run tauri build   # Build desktop app
bun run check         # TypeScript check + validate-pages + audit-design
bun run audit:design  # Container Patterns audit (Card density rule)
bun run format        # Format with Prettier
bun run format:check  # Check formatting
bun run lint          # Biome lint
bun run lint:fix      # Biome lint with auto-fix
```

### Prettier Settings

- Tab indentation (configured in `.prettierrc`)
- Single quotes for strings
- Trailing commas
- Print width: 120

### File Naming

| Type            | Convention | Example              |
| --------------- | ---------- | -------------------- |
| React component | kebab-case | `json-tree-view.tsx` |
| TypeScript      | kebab-case | `code-generators.ts` |
| Index exports   | index.ts   | `index.ts`           |
| Types file      | types.ts   | `types.ts`           |
| Zustand store   | kebab-case | `sidebar.ts`         |

### Project Structure

```
src/
├── routes/           # TanStack Router file-based routes (.tsx)
├── lib/
│   ├── components/   # UI components (shadcn React-based + Kogu primitives)
│   ├── hooks/        # React hooks (use-formatter-page, use-mobile)
│   ├── services/     # Business logic (pure functions, framework-agnostic)
│   ├── stores/       # Zustand persisted stores (sidebar / tabs / tool-options)
│   └── utils.ts      # Utility functions (cn)
└── app.css           # Global styles
src-tauri/            # Tauri (Rust) backend (unchanged across the React migration)
```

## Technology Stack

| Category        | Technology                                                 |
| --------------- | ---------------------------------------------------------- |
| Framework       | React 19                                                   |
| Routing         | TanStack Router (file-based)                               |
| State           | Zustand (persist middleware)                               |
| Desktop         | Tauri 2.x                                                  |
| Styling         | Tailwind CSS v4 + shadcn React (Radix UI)                  |
| Code Editor     | Monaco (via @monaco-editor wrappers)                       |
| Package Manager | Bun                                                        |
| Language        | TypeScript 5.8+ (TypeScript 7 ready: `erasableSyntaxOnly`) |

## Detailed Rules

See `.claude/rules/` for comprehensive guidelines. All rules use `paths:` frontmatter so they only load when Claude reads matching files (per the [Claude Code memory spec](https://docs.claude.com/en/docs/claude-code/memory#path-specific-rules)):

- `typescript.md` - TypeScript conventions (mandatory rules)
- `rust.md` - Rust conventions (mandatory rules)
- `react/components.md` - React 19 component patterns
- `react/layouts.md` - Page layout patterns and shell components
- `css/tailwind.md` - Tailwind CSS guidelines
- `general/git.md` - Git conventions (universal)
- `general/pr.md` - PR guidelines (universal)
- `tauri/commands.md` - Tauri command patterns
- `testing/typescript.md` - TypeScript/React testing
- `testing/rust.md` - Rust testing
- `testing/e2e.md` - E2E testing

Procedural workflows are packaged as on-demand skills in `.claude/skills/`:

- `release/` - Release process (`/release`, see `.claude/skills/release/SKILL.md`)
- `tauri-dev/` - Tauri dev restart with cache cleanup (`/tauri-dev`, see `.claude/skills/tauri-dev/SKILL.md`)
