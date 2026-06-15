# Release Hygiene Status

This page tracks the current OSS guardrails that must stay green for release readiness.

## Blocking CI gates

- `hardening-gate` (required): runs `npm run ci:test`.
- `dependency-audit` (required): runs `npm audit --audit-level=high` and fails on high severity findings.

## Release CI

- `build-release` (on tag push): builds signed/unsigned macOS `.dmg`/`.zip` and Linux `.deb`/`.rpm`/`.zip` artifacts, then creates a GitHub Release with attached binaries.

## Included checks in `npm run ci:test`

- Lint: `npm run lint`
- Format: `npm run format:check`
- Contract/docs parity: `npm run check:intents`
- State write ownership: `npm run check:state-ownership`
- Security defaults baseline: `npm run check:security-baseline`
- Dependency pin policy: `npm run check:deps-locked`
- Unit/contract tests: `npm test`
- Smoke: startup, overlays, UI cadence, security boundary, settings lifecycle, devtools lifecycle, session lifecycle, focus lifecycle

## Current policy posture

- Intent and IPC payload contracts are fail-closed at runtime boundaries.
- URL policy defaults allow local HTTP developer workflows while blocking non-local HTTP unless allowlisted.
- Trusted surfaces have narrowed navigation controls.
- Download governance is explicit deny/prompt/allow with trusted-surface opt-in disabled by default.
- Chrome extension support is managed through a generic extension registry. Password-manager support is the first consumer.
- Noctra does not store or log credentials, and extension surfaces use `SURFACE_ROLES.EXTENSION` without trusted Noctra IPC/preload access.
- Known managed-extension popouts use transient extension buffers that are excluded from history, bookmarks, session restore, closed-buffer reopen, and duplicate-buffer actions.

## Extension License Posture

- Public releases that include Chrome extension support must follow the GPL-compatible distribution path for `electron-chrome-extensions@4.9.0`.
- No Patron/proprietary license path is planned.
- Release notes and bundled notices must not present extension-enabled builds as MIT-only distributions.
- `electron-chrome-web-store@0.13.0` remains part of dependency/license review for provider auto-install support.
- `electron-chrome-context-menu` is not part of the current first stable pass; extension context-menu merge is deferred until after password-manager packaging and user-facing docs are complete.

## Maintainer expectations

- Treat any CI failure as release-blocking until fixed.
- Do not merge changes that skip parity/security baseline checks.
- Keep this status page aligned with `.github/workflows/ci.yml` and `package.json` scripts.
