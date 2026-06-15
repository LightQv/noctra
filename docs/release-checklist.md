# Release Checklist

Use this checklist before publishing a new Noctra release.

## Version and notes

- [ ] Decide the new version number.
  - Stable: `X.Y.Z` (e.g., `0.1.0`)
  - Pre-release: `X.Y.Z-alpha`, `X.Y.Z-beta.1`, `X.Y.Z-rc.1` (e.g., `0.1.0-alpha`)
  - The workflow auto-detects pre-releases and marks them on GitHub.
- [ ] Draft release notes with user-visible changes and migration notes.
- [ ] Document any keybinding or command contract changes.

## Quality gates

- [ ] Run `npm run lint`.
- [ ] Run `npm run format:check`.
- [ ] Run `npm run check:intents`.
- [ ] Run `npm run check:security-baseline`.
- [ ] Run `npm run ci:test`.

## Security and policy checks

- [ ] Confirm security-sensitive defaults remain intentional.
- [ ] Confirm trusted surface and IPC boundary tests are green.
- [ ] Confirm download governance (`will-download` deny/prompt/allow) behavior matches policy.
- [ ] Run `npm audit --audit-level=high` (blocking on high severity findings).

## Extension License Gate

- [ ] If release includes Chrome extension support, follow the GPL-compatible distribution path for `electron-chrome-extensions`.
- [ ] Include GPL-3 notice for `electron-chrome-extensions@4.9.0` in release notes or bundled notices.
- [ ] Include `electron-chrome-web-store@0.13.0` in dependency/license review.
- [ ] Ensure release notes do not describe the distributed app as MIT-only when GPL-covered extension support is included.
- [ ] Confirm source availability and redistribution terms satisfy GPL-compatible distribution requirements.

## Documentation sync

- [ ] `INTENTS.md` matches `core/intents.js`.
- [ ] Update relevant docs in `docs/` and `README.md`.
- [ ] Confirm `CONTRIBUTING.md` references current workflows.
- [ ] Confirm `docs/release-hygiene-status.md` matches active CI gate behavior.

## Packaging and distribution

- [ ] Run `npm run make` locally and verify the app launches from `out/make/`.
- [ ] Confirm app icon appears correctly on macOS and Linux.
- [ ] Verify packaged app can install selected managed extension provider.
- [ ] Verify packaged app can load installed managed extension provider after restart.
- [ ] Verify managed extension storage persists across restart.
- [ ] Verify packaged app has no missing Chrome extension preload/resource errors.
- [ ] If distributing a signed macOS build, confirm signing credentials are configured (see below).

## Create release

1. Go to **Actions → "Create Release" → "Run workflow"**.
2. Enter the new version (e.g., `0.1.1` or `0.1.1-alpha`) and your release notes.
3. Click **Run workflow**.
4. Wait for the workflow to complete (~5–10 minutes).
5. The release will be published automatically with all artifacts attached.

Only users with **write access** to the repository can trigger releases.

## macOS code signing (optional for v0.x)

Unsigned macOS builds work for early releases but show a Gatekeeper warning. To sign:

1. Obtain an Apple Developer ID Application certificate.
2. Add these repository secrets in GitHub:
   - `APPLE_ID` — your Apple ID email
   - `APPLE_PASSWORD` — app-specific password
   - `APPLE_TEAM_ID` — your Apple Developer Team ID
   - `APPLE_IDENTITY` — certificate identity (optional, defaults to "Developer ID Application")

The release workflow will automatically sign and notarize when these secrets are present.

## Final publish

- [ ] Verify the published release on the [Releases](https://github.com/LightQv/noctra/releases) page.
- [ ] Monitor post-release issues/regressions.
