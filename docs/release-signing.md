# Release Signing and Notarization

This document explains how Kogu can sign and notarize macOS builds.
The release workflow currently produces DMGs with **ad-hoc signing**
(`signingIdentity: "-"` in `src-tauri/tauri.conf.json`); enabling
Developer ID signing requires both configuring the secrets below and
re-wiring `.github/workflows/release.yml` to forward them to
`tauri-apps/tauri-action`. The forwarding step was removed because
GitHub Actions expressions cannot toggle env keys based on secret
presence, so passing empty strings caused `security import` to fail
in repositories where the secrets are not configured. See the
"Re-enabling signing" section below for the rewire pattern that
works.

## Required GitHub repository secrets

To sign and notarize macOS DMGs, configure the following secrets and
then re-enable the forwarding step (see below). All values are
case-sensitive.

| Secret                       | Value                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `APPLE_CERTIFICATE`          | Base64-encoded `.p12` export of the Developer ID Application certificate together with its private key.                                     |
| `APPLE_CERTIFICATE_PASSWORD` | Password set on the `.p12` export.                                                                                                          |
| `APPLE_SIGNING_IDENTITY`     | Full certificate common name, e.g. `Developer ID Application: Your Name (TEAMID)`. Must match an identity present in the imported keychain. |
| `APPLE_ID`                   | Apple ID email used for notarization. Must belong to an account enrolled in the Apple Developer Program.                                    |
| `APPLE_PASSWORD`             | App-specific password generated at <https://appleid.apple.com> for the `APPLE_ID` account.                                                  |
| `APPLE_TEAM_ID`              | Ten-character team identifier shown in the Apple Developer portal.                                                                          |

## Re-enabling signing once the secrets are set

Once every secret above is configured, restore the forwarding by
adding a precheck step that flips an output flag when the credentials
are available, then guard the `tauri-action` step on that flag. This
keeps env keys absent when secrets are missing, which `tauri-action`
treats as "skip signing" instead of "import the empty cert":

```yaml
- name: Check Apple signing secrets
  id: apple-signing
  if: runner.os == 'macOS'
  shell: bash
  env:
    HAS_CERT: ${{ secrets.APPLE_CERTIFICATE != '' }}
  run: echo "available=$HAS_CERT" >> "$GITHUB_OUTPUT"

- name: Build and release (macOS, signed)
  if: |
    runner.os == 'macOS' &&
    steps.apple-signing.outputs.available == 'true'
  uses: tauri-apps/tauri-action@v0.6.2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    # ... rest of APPLE_* secrets ...
  with:
    # ...

- name: Build and release (unsigned)
  if: |
    runner.os != 'macOS' ||
    steps.apple-signing.outputs.available != 'true'
  uses: tauri-apps/tauri-action@v0.6.2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    # ...
```

The remainder of this document covers preparing each secret.

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

## Scope

This wiring covers DMG distribution outside the Mac App Store. App
Store distribution would require additional sandbox entitlements and
a separate installer pipeline; that path is not currently planned.
