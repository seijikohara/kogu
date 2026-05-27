# Mac App Store Readiness

This document captures what would change for Kogu to be distributed
through the Mac App Store (MAS) and what remains unfinished or blocked.
The current default distribution path is a signed and notarized DMG
hosted on GitHub Releases (see `docs/release-signing.md`); MAS
distribution is an additive option that requires a separate build with
different entitlements and a different installer.

## Current state inventory

`src-tauri/resources/macos/Kogu.entitlements` declares hardened-runtime
entitlements but **not** the App Sandbox entitlement. The active set is:

| Entitlement                                              | Purpose                                             |
| -------------------------------------------------------- | --------------------------------------------------- |
| `com.apple.security.cs.allow-jit`                        | WebView JIT compilation.                            |
| `com.apple.security.cs.allow-unsigned-executable-memory` | WebView fallback.                                   |
| `com.apple.security.cs.disable-library-validation`       | Allow loading third-party plugins / Tauri sidecars. |
| `com.apple.security.network.client`                      | Outbound connections (HTTP probes, scanners).       |
| `com.apple.security.network.server`                      | Inbound connections used by future MCP bridge.      |

This entitlement set is acceptable for Developer ID distribution but
will be rejected by App Store review: MAS requires
`com.apple.security.app-sandbox` and forbids several of the hardened-
runtime relaxations above.

## Entitlements required for MAS

A MAS build needs at minimum:

| Entitlement                                         | Why                                                   |
| --------------------------------------------------- | ----------------------------------------------------- |
| `com.apple.security.app-sandbox`                    | Required by App Store review.                         |
| `com.apple.security.network.client`                 | Outbound HTTP, TCP probes.                            |
| `com.apple.security.network.server`                 | Inbound for the MCP bridge.                           |
| `com.apple.security.files.user-selected.read-write` | Read or write files the user picks via `open` dialog. |
| `com.apple.security.files.bookmarks.app-scope`      | Persist user-selected paths across launches.          |

Several existing entitlements have no MAS-compatible equivalent:

- `com.apple.security.cs.allow-jit` — replaced by App Sandbox's automatic
  WebKit JIT entitlement; the explicit key is rejected.
- `com.apple.security.cs.disable-library-validation` — disallowed.
- `com.apple.security.cs.allow-unsigned-executable-memory` — disallowed.

## Feature compatibility

| Feature                            | Sandbox status   | Mitigation                                                                                                                                 |
| ---------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Network Scanner (ARP / NDP probes) | **Incompatible** | Shells out to `arp`, `ndp`, `ip`, `netsh`; sandbox blocks `posix_spawn` of external binaries. Remove or hide on MAS.                       |
| Network Scanner (TCP / TLS probes) | Compatible       | Pure socket I/O via `com.apple.security.network.client`.                                                                                   |
| Drive Info                         | **Incompatible** | Enumerates mounted volumes outside container; the unsandboxed paths return `EPERM`. Limit to the app's own container on MAS.               |
| File Watcher                       | **Incompatible** | `inotify`-style watches on arbitrary paths require either a security-scoped bookmark per path or a sandbox-extension brokered by the user. |
| Folder Tree Visualizer             | Conditional      | Works on user-selected directories via security-scoped bookmark.                                                                           |
| File Inspector / Hex Editor        | Conditional      | Same: works on user-selected files.                                                                                                        |
| Duplicate Finder                   | Conditional      | Same; also note that hard-link replacement on Windows is unaffected by MAS.                                                                |
| Archive Inspector                  | Conditional      | Works on user-selected archive.                                                                                                            |
| GPG / SSH key generators (CLI)     | **Incompatible** | `Command::new("gpg")` is blocked by sandbox. The in-process Rust paths (`generate_ssh_keypair` etc.) remain available.                     |
| Hash / Lorem / UUID / formatters   | Compatible       | Pure in-process Rust; no external resources required.                                                                                      |

## Path forward strategy

The recommended approach is a **dual-config build matrix** rather than
sandboxing the existing build outright. The default `tauri.conf.json`
continues to drive the DMG release. A second overlay
`tauri.macos.app-store.conf.json` enables the sandbox entitlement set
and switches incompatible features off via a `MAS_DISTRIBUTION` feature
flag in the Rust crate.

```toml
# src-tauri/Cargo.toml
[features]
default = []
mas_distribution = []
```

```rust
// Inside affected modules
#[cfg(not(feature = "mas_distribution"))]
pub fn arp_cache_discovery(...) -> DiscoveryResult { /* current path */ }

#[cfg(feature = "mas_distribution")]
pub fn arp_cache_discovery(...) -> DiscoveryResult {
    DiscoveryResult::unsupported("ARP discovery is not available in the App Store build")
}
```

The MAS workflow would invoke `tauri build` with the overlay config and
the feature flag, then run `productbuild` to assemble the installer
package consumed by App Store Connect.

## SMAppService privileged helper status

`src-tauri/resources/macos/io.github.seijikohara.kogu.NetScannerDaemon.plist`,
`src-tauri/resources/macos/NetScannerDaemon.entitlements`, and
`scripts/bundle-macos-daemon.sh` describe a privileged helper that
would run `arp` / `ndp` / `netsh` from a launchd daemon registered via
`SMAppService`. The Swift bridge in `src-tauri/swift/KoguHelper/`
includes the FFI surface (`KoguHelper.h`) for Rust to call into the
helper.

However, **the daemon executable does not exist in this codebase**.
There is no `src-tauri/swift/NetScannerDaemon/` Swift package, the
Rust side has no `extern "C"` call into the `KoguHelper` FFI, and no
Tauri command invokes the registration code. The current scaffold
documents the intended architecture but is not wired up at runtime.

Implications:

- The cross-platform audit item "bundle the daemon in CI" is a no-op
  until the daemon itself is implemented. The corresponding workflow
  step is intentionally absent in `release.yml`.
- The non-privileged ARP / NDP path (`src-tauri/src/network/arp_cache.rs`)
  remains the only neighbor-discovery mechanism, and PR #358 hardened
  that path with strict MAC validation and a Linux fallback chain.
- For App Store distribution the daemon is a non-goal: SMAppService
  daemons are incompatible with the App Sandbox, so a MAS build would
  necessarily fall back to the same non-privileged path.

When the daemon is eventually implemented, a follow-up PR should:

1. Add a `swift/NetScannerDaemon/` Swift package producing an
   executable target with the existing `NetScannerDaemon.entitlements`.
2. Wire Rust calls into the `KoguHelper` FFI for registration and
   IPC.
3. Update `scripts/bundle-macos-daemon.sh` if the build layout
   differs from the current assumptions.
4. Add a workflow step that runs the bundling script on macOS legs
   between `tauri build` and the DMG packaging step, re-signing the
   outer `.app` afterwards so notarization succeeds.

## Recommended next steps

The work to actually ship a MAS build is a multi-PR effort beyond the
scope of this rollout:

1. Author `tauri.macos.app-store.conf.json` overlay with the sandbox
   entitlement set.
2. Add the `mas_distribution` Rust feature and stub out incompatible
   commands behind it.
3. Replace direct filesystem access with security-scoped bookmark
   helpers in the file-tool routes.
4. Extend the release workflow to optionally produce a MAS-flavored
   pkg under a separate matrix entry.

This document records the gap; closing it is intentionally deferred.
