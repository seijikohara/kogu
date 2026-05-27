# Release Signing and Notarization

This document explains how Kogu's release workflow signs and notarizes
macOS builds. Without these secrets configured, the workflow still
produces DMG artifacts using ad-hoc signing (the fallback declared in
`src-tauri/tauri.conf.json` via `signingIdentity: "-"`). Ad-hoc-signed
DMGs trigger a Gatekeeper warning on first launch; signed and
notarized DMGs install cleanly.

## Required GitHub repository secrets

The `Build and release` step in `.github/workflows/release.yml` forwards
the following secrets to `tauri-apps/tauri-action`, which passes them
to the Tauri bundler. All values are case-sensitive.

| Secret                       | Value                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `APPLE_CERTIFICATE`          | Base64-encoded `.p12` export of the Developer ID Application certificate together with its private key.                                     |
| `APPLE_CERTIFICATE_PASSWORD` | Password set on the `.p12` export.                                                                                                          |
| `APPLE_SIGNING_IDENTITY`     | Full certificate common name, e.g. `Developer ID Application: Your Name (TEAMID)`. Must match an identity present in the imported keychain. |
| `APPLE_ID`                   | Apple ID email used for notarization. Must belong to an account enrolled in the Apple Developer Program.                                    |
| `APPLE_PASSWORD`             | App-specific password generated at <https://appleid.apple.com> for the `APPLE_ID` account.                                                  |
| `APPLE_TEAM_ID`              | Ten-character team identifier shown in the Apple Developer portal.                                                                          |

When any one of these is missing, the bundler skips both signing and
notarization for that build and falls back to ad-hoc signing.

The secrets are gated on the macOS matrix legs in the workflow, so
they are never forwarded to the Linux or Windows runners. This limits
the credentials' reachable surface to the job that actually consumes
them.

## Preparing the certificate

1. In Xcode or via the Apple Developer portal, create a **Developer ID
   Application** certificate. Save the resulting `.cer` plus its
   private key into the macOS Keychain.
2. From Keychain Access, select both the certificate and its private
   key, right-click, and choose **Export 2 items…**. Save as `.p12`
   and assign a password.
3. Encode the `.p12` for transport as a GitHub secret:

   ```sh
   base64 -i developer-id.p12 -o developer-id.p12.b64
   ```

   Paste the contents of `developer-id.p12.b64` into the
   `APPLE_CERTIFICATE` secret. Paste the `.p12` password into
   `APPLE_CERTIFICATE_PASSWORD`.

4. Inspect the certificate's common name to populate
   `APPLE_SIGNING_IDENTITY`:

   ```sh
   security find-identity -v -p codesigning
   ```

## Preparing the notarization credential

1. Sign in to <https://appleid.apple.com> with the same Apple ID you
   intend to use, then under **App-Specific Passwords** generate a new
   password labeled `kogu-release` (or similar).
2. Paste the generated password into `APPLE_PASSWORD`. Note that
   notarization can also be authenticated with an App Store Connect
   API key; this document covers the password path because it has
   fewer moving parts. Switching to an API key requires updating the
   secret names per the `tauri-action` documentation.
3. The team identifier (`APPLE_TEAM_ID`) is shown next to the
   account name on <https://developer.apple.com/account>.

## Verifying a release build

After the workflow finishes, download the produced DMG and confirm it
is signed and notarized:

```sh
# Should report "satisfies its Designated Requirement".
codesign --verify --deep --strict --verbose=2 Kogu.app

# Should print "source=Notarized Developer ID".
spctl -a -t exec -vv Kogu.app
```

Gatekeeper accepts notarized DMGs without prompting the user, so a
clean run of `spctl` is the most direct end-to-end check.

## Local testing without the CI workflow

To exercise the same signing path locally, export the same env vars
before running `bun run tauri build`:

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="ABCD123456"
# Skip APPLE_CERTIFICATE/PASSWORD when the certificate is already in
# the user's login keychain.
bun run tauri build --target aarch64-apple-darwin
```

## Scope and follow-ups

This wiring covers DMG distribution outside the Mac App Store. The
App-Store path requires additional sandbox entitlements and a separate
installer; see `docs/app-store-readiness.md` (added in a later
follow-up PR).
