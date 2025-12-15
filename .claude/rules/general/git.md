---
paths: '**/*'
---

# Git Conventions

## Commit Messages

Use Conventional Commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type     | Description                     |
| -------- | ------------------------------- |
| feat     | New feature                     |
| fix      | Bug fix                         |
| docs     | Documentation only              |
| style    | Formatting, no code change      |
| refactor | Code change without feature/fix |
| perf     | Performance improvement         |
| test     | Adding/updating tests           |
| chore    | Build, config, dependencies     |
| ci       | CI/CD changes                   |

### Scopes (Optional)

- `ui` - UI components
- `json-formatter` - JSON formatter tool
- `tauri` - Tauri/Rust code
- `deps` - Dependencies

### Examples

```bash
feat(json-formatter): add JSON compare functionality

fix(ui): correct button alignment in sidebar

refactor: convert loops to method chaining

chore(deps): update svelte to 5.45.10

docs: update README with build instructions
```

## Branch Strategy

### Branch Naming

```
<type>/<description>

feat/json-compare-tab
fix/editor-highlight-issue
refactor/typescript-functional-style
chore/update-dependencies
```

### Main Branches

- `main` - Production-ready code
- Feature branches are created from `main`
- PRs are merged back to `main`

## Workflow

### Before Committing

```bash
# Check types
bun run check

# Format code
bun run format

# Review changes
git status
git diff
```

### Creating a Feature

```bash
# Create branch from main
git checkout main
git pull origin main
git checkout -b feat/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push -u origin feat/new-feature
```

### Keep Branch Updated

```bash
git checkout main
git pull origin main
git checkout feat/my-feature
git rebase main
```

## Best Practices

### Commits

- Make atomic commits (one logical change per commit)
- Write clear, descriptive messages
- Don't commit generated files (check `.gitignore`)
- Don't commit sensitive data (API keys, secrets)

### Files to Never Commit

- `.env` files with secrets
- `node_modules/`
- Build outputs (`dist/`, `build/`)
- IDE settings (unless shared)
- OS files (`.DS_Store`, `Thumbs.db`)

### Before Push

- Ensure all tests pass
- Ensure type checking passes
- Ensure formatting is correct
- Review the diff one more time

## Dangerous Operations

Always confirm before:

- Force push (`git push --force`)
- Hard reset (`git reset --hard`)
- Rebase shared branches
- Deleting branches

```bash
# Safer force push
git push --force-with-lease

# Check before hard reset
git log --oneline -5
git reset --hard HEAD~1
```

## Documentation Standards

All documentation (code comments, commit messages, PR descriptions) must:

- **Language**: Always use English
- **Tone**: Use formal, professional language (avoid casual expressions)
- **Objectivity**: State facts only; avoid subjective opinions or evaluations
