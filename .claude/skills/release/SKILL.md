---
description: Cut a new release of Kogu (patch/minor/major). Runs the interactive `bun run release` script that validates `main`, bumps versions across `package.json`/`tauri.conf.json`/`Cargo.toml`, opens a `release/vX.X.X` branch with a changelog PR, and lets GitHub Actions handle tagging and binary builds. Use when the user asks to release, ship, cut, tag, or publish a new version.
disable-model-invocation: true
allowed-tools: Bash(bun run release), Bash(git status), Bash(git branch *), Bash(gh auth status), Bash(gh release *), Bash(gh pr *)
---

# Release Process

Cut a new release of Kogu. This skill drives the interactive release script and verifies the surrounding state.

## Pipeline overview

| Stage             | Trigger              | Owner                                     |
| ----------------- | -------------------- | ----------------------------------------- |
| Version bump + PR | `bun run release`    | This skill                                |
| Tag creation      | PR merge to `main`   | GitHub Actions (`create-release-tag.yml`) |
| Binary build      | Push of `v*.*.*` tag | GitHub Actions (`release.yml`)            |
| Nightly build     | Push to `main`       | GitHub Actions (rolling pre-release)      |

## Steps

1. Verify prerequisites:
   - Current branch is `main` (`git branch --show-current`)
   - Working directory is clean (`git status`)
   - `gh` CLI is authenticated (`gh auth status`)
2. Run `bun run release`. The script is interactive:
   - Pulls latest `main`
   - Shows commits since the last release
   - Prompts for version type: patch / minor / major
   - Updates version in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
   - Runs `bun install` to refresh the lockfile
   - Creates branch `release/vX.X.X`, commits, pushes
   - Opens a PR with auto-generated changelog
   - Returns to `main`
3. Hand off to the user:
   - Tell them the PR URL and ask them to review and merge
   - Once merged, GitHub Actions creates the tag and the binary build runs

## Files the script touches

| File                        | Field     |
| --------------------------- | --------- |
| `package.json`              | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml`      | `version` |

## Workflow files (do not edit during release)

| File                                       | Purpose                       |
| ------------------------------------------ | ----------------------------- |
| `scripts/release.ts`                       | Release automation script     |
| `.github/workflows/create-release-tag.yml` | Auto tag creation on PR merge |
| `.github/workflows/release.yml`            | Build and publish on tag push |

## Build artifacts

Successful tag pushes produce binaries for:

| Platform              | Formats                     |
| --------------------- | --------------------------- |
| Linux (x64)           | `.deb`, `.rpm`, `.AppImage` |
| macOS (Intel)         | `.dmg`, `.app.tar.gz`       |
| macOS (Apple Silicon) | `.dmg`, `.app.tar.gz`       |
| Windows (x64)         | `.exe` (NSIS)               |

## Nightly builds

Nightly builds are triggered automatically on every push to `main`:

- Version format: `{current-version}-{commit-hash}` (e.g., `0.0.4-abc1234`)
- Previous nightly release is deleted before rebuild
- Tagged as `nightly` (pre-release)

This skill does not invoke nightlies; they are CI-driven.

## Troubleshooting

### Release script aborts before opening the PR

Likely causes:

- Not on `main`: `git branch --show-current` should print `main`
- Dirty working tree: `git status` should be clean
- `gh` not authenticated: run `gh auth status`

Fix the underlying issue, then re-run `bun run release`.

### Tag creation fails after PR merge

1. Open GitHub Actions and read the `create-release-tag` workflow log
2. Verify the GitHub App has tag-creation permission on the repo
3. Verify tag protection rules allow the GitHub App

### Release build fails on tag push

1. Open GitHub Actions and read the `release` workflow log
2. Fix the underlying issue
3. Cut a new patch release (do not retag the same version)

### Roll back a botched release

```bash
gh release delete vX.X.X --yes
git push --delete origin vX.X.X
```

Then cut a fresh release with the fix.

## Safety rules

- Never push tags directly. Tags are created by `create-release-tag.yml` after the PR merges.
- Never amend or force-push the `release/vX.X.X` branch after the PR is opened. If you need to fix the changelog or version bump, close the PR and run `bun run release` again.
- Do not skip hooks (`--no-verify`) or signing on release commits.
- Do not touch `.github/workflows/*.yml` as part of a release. Workflow changes belong in their own PR.
