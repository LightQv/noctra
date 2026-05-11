# Release Hygiene Status

This page tracks the current OSS guardrails that must stay green for release readiness.

## Blocking CI gates

- `hardening-gate` (required): runs `npm run ci:test`.
- `dependency-audit` (required): runs `npm audit --audit-level=high` and fails on high severity findings.

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

## Maintainer expectations

- Treat any CI failure as release-blocking until fixed.
- Do not merge changes that skip parity/security baseline checks.
- Keep this status page aligned with `.github/workflows/ci.yml` and `package.json` scripts.
