---
paths: '**/*'
---

# Pull Request Guidelines

## PR Title

Use Conventional Commits format (see `git.md` for types and scopes).

## PR Description Template

```markdown
## Summary

Brief description of changes (1-3 bullet points).

- Added JSON compare functionality
- Implemented diff highlighting
- Added options panel for comparison settings

## Changes

### Added

- New `compare-tab.svelte` component
- `findJsonDifferences` function in formatters

### Changed

- Updated sidebar navigation

### Fixed

- Editor scroll position on line highlight

## Test Plan

- [ ] Tested JSON comparison with valid inputs
- [ ] Tested with invalid JSON (error handling)
- [ ] Verified diff highlighting works correctly
- [ ] Checked responsive layout
```

## Before Creating PR

### Code Quality

```bash
# Run type checking
bun run check

# Format code
bun run format

# Manual testing
bun run dev
```

### Review Checklist

- [ ] Code follows project conventions
- [ ] No console.log or debugging code
- [ ] No commented-out code
- [ ] No hardcoded values that should be configurable
- [ ] Proper error handling
- [ ] Accessible UI (keyboard navigation, ARIA)

### Commits

- Squash WIP commits if needed
- Each commit should be meaningful
- Commit messages follow conventions

## PR Size

### Ideal PR

- Under 400 lines of changes
- Single focused feature or fix
- Easy to review in one session

### Large Changes

If PR is large, consider:

- Breaking into smaller PRs
- Adding detailed description
- Requesting specific reviewers
- Adding inline comments for complex parts

## Labels

Labels are **automatically assigned** based on PR title prefix (Conventional Commits).

| PR Title Prefix | Label           | Release Category |
| --------------- | --------------- | ---------------- |
| `feat:`         | `feature`       | 🚀 Features      |
| `fix:`          | `fix`           | 🐛 Bug Fixes     |
| `perf:`         | `performance`   | ⚡ Performance   |
| `refactor:`     | `refactor`      | 🔧 Refactoring   |
| `test:`         | `test`          | 🧪 Tests         |
| `docs:`         | `documentation` | 📝 Documentation |
| `chore:`        | `chore`         | 🔨 Maintenance   |
| `ci:`           | `ci`            | 🔨 Maintenance   |
| `build:`        | `build`         | 🔨 Maintenance   |

Additional labels (manually assigned):

| Label          | Description        |
| -------------- | ------------------ |
| `dependencies` | Dependency updates |

## Review Process

### As Author

- Respond to feedback promptly
- Explain reasoning when needed
- Update code based on feedback
- Re-request review after changes

### As Reviewer

- Be constructive and specific
- Suggest alternatives when rejecting
- Approve when ready, request changes when needed
- Focus on:
  - Logic correctness
  - Code quality
  - Security concerns
  - Performance implications

## Merging

### Requirements

- All checks passing
- Approved by reviewer (if required)
- No merge conflicts
- Up to date with base branch

### Merge Strategy

- **Squash and merge** for feature branches
- Keep commit history clean
- Use meaningful squash commit message

## After Merge

- Delete the feature branch
- Verify deployment (if applicable)
- Close related issues
- Update documentation if needed
