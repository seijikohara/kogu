# Kogu Project Instructions

See @README.md for project overview and @package.json for available commands and dependencies.

## Quick Reference

### Development Commands

```bash
bun run dev          # Start Vite dev server
bun run tauri dev    # Start Tauri dev mode
bun run build        # Build frontend
bun run tauri build  # Build desktop app
bun run check        # TypeScript/Svelte check
bun run format       # Format with Prettier
bun run format:check # Check formatting
```

### Prettier Settings

- Tab indentation (configured in `.prettierrc`)
- Single quotes for strings
- Trailing commas
- Print width: 120

### File Naming

| Type             | Convention | Example                 |
| ---------------- | ---------- | ----------------------- |
| Svelte component | kebab-case | `json-tree-view.svelte` |
| TypeScript       | kebab-case | `code-generators.ts`    |
| Index exports    | index.ts   | `index.ts`              |
| Types file       | types.ts   | `types.ts`              |

### Project Structure

```
src/
├── routes/           # SvelteKit routes
├── lib/
│   ├── components/   # UI components (shadcn-svelte based)
│   ├── services/     # Business logic (pure functions)
│   └── utils.ts      # Utility functions
└── app.css           # Global styles
src-tauri/            # Tauri (Rust) backend
```

## Technology Stack

| Category        | Technology                         |
| --------------- | ---------------------------------- |
| Framework       | SvelteKit                          |
| UI Framework    | Svelte 5 (runes: $state, $derived) |
| Desktop         | Tauri 2.x                          |
| Styling         | Tailwind CSS v4 + shadcn-svelte    |
| Code Editor     | CodeMirror 6                       |
| Package Manager | Bun                                |
| Language        | TypeScript (strict mode)           |

## Detailed Rules

See `.claude/rules/` for comprehensive guidelines:

- `typescript.md` - TypeScript conventions (mandatory rules)
- `rust.md` - Rust conventions (mandatory rules)
- `svelte/components.md` - Svelte 5 component patterns
- `css/tailwind.md` - Tailwind CSS guidelines
- `general/git.md` - Git conventions
- `general/pr.md` - PR guidelines
- `tauri/commands.md` - Tauri command patterns
- `testing/typescript.md` - TypeScript/Svelte testing
- `testing/rust.md` - Rust testing
- `testing/e2e.md` - E2E testing
