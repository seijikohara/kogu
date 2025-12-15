# Release Process

## Overview

This project uses `bumpp` for version management and GitHub Actions for automated releases.

## Release Types

| Type | Trigger | Description |
|------|---------|-------------|
| Nightly | Push to main | Automated pre-release build |
| Stable | Push `v*.*.*` tag | Official release with changelog |

## How to Release

### Prerequisites

- All changes merged to main
- CI passing on main branch

### Steps

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Run bumpp
bunx bumpp

# 3. Select version type
#    - patch: 0.0.1 → 0.0.2 (bug fixes)
#    - minor: 0.0.1 → 0.1.0 (new features)
#    - major: 0.0.1 → 1.0.0 (breaking changes)

# 4. Confirm the changes
#    bumpp will:
#    - Update package.json
#    - Update src-tauri/tauri.conf.json
#    - Update src-tauri/Cargo.toml
#    - Commit with message "chore: release vX.X.X"
#    - Create git tag vX.X.X
#    - Push to remote

# 5. Wait for GitHub Actions to complete
#    - Release workflow builds all platforms
#    - Creates GitHub Release with auto-generated notes
```

## Version Files

bumpp updates these files automatically:

| File | Field |
|------|-------|
| `package.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `version` |

## Configuration

See `bumpp.config.ts` for bumpp configuration.

## Build Artifacts

Releases include binaries for:

| Platform | Formats |
|----------|---------|
| Linux | `.deb`, `.rpm`, `.AppImage` |
| macOS (Intel) | `.dmg`, `.app.tar.gz` |
| macOS (Apple Silicon) | `.dmg`, `.app.tar.gz` |
| Windows | `.exe`, `.msi` |

## Troubleshooting

### Release workflow failed

1. Check GitHub Actions logs for errors
2. Fix the issue on main branch
3. Delete the failed release and tag if needed:
   ```bash
   gh release delete vX.X.X --yes
   git push --delete origin vX.X.X
   git tag -d vX.X.X
   ```
4. Run `bunx bumpp` again

### Version mismatch

If version files are out of sync, manually update all three files to the same version before running bumpp.
