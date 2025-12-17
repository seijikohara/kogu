# Release Process

## Overview

This project uses an automated release workflow:

1. `bun run release` creates a release PR
2. Merge the PR
3. GitHub Actions automatically creates a tag and triggers the release build

## Release Types

| Type    | Trigger           | Description                     |
| ------- | ----------------- | ------------------------------- |
| Nightly | Push to main      | Automated pre-release build     |
| Stable  | Push `v*.*.*` tag | Official release with changelog |

## How to Release

### Prerequisites

- On main branch
- Working directory is clean
- CI passing on main branch

### Steps

```bash
# Run the release script
bun run release

# Select version type:
#   - patch: 0.0.1 → 0.0.2 (bug fixes)
#   - minor: 0.0.1 → 0.1.0 (new features)
#   - major: 0.0.1 → 1.0.0 (breaking changes)

# The script will:
# 1. Update version in all config files
# 2. Create release/vX.X.X branch
# 3. Commit and push changes
# 4. Create a PR automatically

# Then:
# 1. Review the PR
# 2. Merge the PR
# 3. Tag is created automatically (via GitHub Actions)
# 4. Release build starts automatically
```

## Automated Workflow

```
bun run release
       │
       ▼
┌─────────────────┐
│ Select version  │  ← Interactive (patch/minor/major)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create branch   │  ← release/vX.X.X
│ Update files    │
│ Create PR       │
└────────┬────────┘
         │
         ▼
    (Review & Merge PR)
         │
         ▼
┌─────────────────┐
│ GitHub Actions  │  ← create-release-tag.yml
│ Create tag      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ GitHub Actions  │  ← release.yml
│ Build & Release │
└─────────────────┘
```

## Version Files

The release script updates these files automatically:

| File                        | Field     |
| --------------------------- | --------- |
| `package.json`              | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml`      | `version` |

## Configuration

- `scripts/release.ts` - Release automation script
- `.github/workflows/create-release-tag.yml` - Auto tag creation
- `.github/workflows/release.yml` - Build and publish

## Build Artifacts

Releases include binaries for:

| Platform              | Formats                     |
| --------------------- | --------------------------- |
| Linux                 | `.deb`, `.rpm`, `.AppImage` |
| macOS (Intel)         | `.dmg`, `.app.tar.gz`       |
| macOS (Apple Silicon) | `.dmg`, `.app.tar.gz`       |
| Windows               | `.exe`, `.msi`              |

## Troubleshooting

### Release script fails

1. Ensure you're on the main branch
2. Ensure working directory is clean (`git status`)
3. Ensure you have push access to the repository

### Tag creation fails

1. Check GitHub Actions logs for `create-release-tag` workflow
2. Verify GitHub App permissions are configured correctly
3. Check tag protection rules allow the GitHub App

### Release build fails

1. Check GitHub Actions logs for `release` workflow
2. Fix the issue and create a new release

### Delete a failed release

```bash
# Delete release and tag
gh release delete vX.X.X --yes
git push --delete origin vX.X.X
```
