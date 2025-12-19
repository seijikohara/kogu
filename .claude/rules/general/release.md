# Release Process

## Overview

This project uses a fully automated release workflow:

1. Run `bun run release` (interactive script)
2. Review and merge the created PR
3. GitHub Actions automatically creates a tag and triggers the release build

## Release Types

| Type    | Trigger           | Description                                     |
| ------- | ----------------- | ----------------------------------------------- |
| Nightly | Push to main      | Pre-release build with version `X.X.X-{commit}` |
| Stable  | Push `v*.*.*` tag | Official release with changelog                 |

## How to Release

### Prerequisites

- On `main` branch (script validates this)
- Working directory is clean (script validates this)
- GitHub CLI (`gh`) installed and authenticated

### Steps

```bash
# Just run the release script
bun run release
```

The script handles everything automatically:

1. Validates you're on `main` with clean working directory
2. Pulls latest changes from origin
3. Shows recent commits since last release
4. Prompts for version type (patch/minor/major)
5. Updates all version files
6. Runs `bun install` to update lockfile
7. Creates `release/vX.X.X` branch
8. Commits and pushes changes
9. Creates PR with auto-generated changelog
10. Returns to `main` branch

After the script completes:

1. Review the PR
2. Merge the PR
3. Tag is created automatically (via GitHub Actions)
4. Release build starts automatically

## Automated Workflow

```
bun run release
       │
       ▼
┌─────────────────┐
│ Validate        │  ← main branch, clean directory
│ Pull latest     │
│ Show commits    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Select version  │  ← Interactive (patch/minor/major)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Update files    │  ← package.json, tauri.conf.json, Cargo.toml
│ Update lockfile │  ← bun install
│ Create branch   │  ← release/vX.X.X
│ Commit & push   │
│ Create PR       │  ← with auto-generated changelog
│ Return to main  │
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

## Nightly Builds

Nightly builds are triggered automatically on every push to `main`:

- Version format: `{current-version}-{commit-hash}` (e.g., `0.0.4-abc1234`)
- Previous nightly release is deleted before rebuild
- Tagged as `nightly` (pre-release)

## Configuration

| File                                       | Purpose                   |
| ------------------------------------------ | ------------------------- |
| `scripts/release.ts`                       | Release automation script |
| `.github/workflows/create-release-tag.yml` | Auto tag creation         |
| `.github/workflows/release.yml`            | Build and publish         |

## Build Artifacts

Releases include binaries for:

| Platform              | Formats                     |
| --------------------- | --------------------------- |
| Linux (x64)           | `.deb`, `.rpm`, `.AppImage` |
| macOS (Intel)         | `.dmg`, `.app.tar.gz`       |
| macOS (Apple Silicon) | `.dmg`, `.app.tar.gz`       |
| Windows (x64)         | `.exe` (NSIS)               |

## Troubleshooting

### Release script fails

```bash
# Check current branch
git branch --show-current  # Should be: main

# Check working directory
git status  # Should be clean

# Ensure gh CLI is authenticated
gh auth status
```

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
