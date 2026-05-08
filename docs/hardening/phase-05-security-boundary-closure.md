# Phase 05 - Security Boundary Closure

## Goal
Close all critical/high OSS security blockers by enforcing strict trusted/untrusted surface boundaries with runtime proof.

## In Scope
- Surface role model for internal shell, internal settings, and untrusted web content
- Navigation lockdown per surface role
- Privileged preload non-propagation guarantees
- Sender and origin/frame enforcement for privileged IPC
- Internal CSP tightening and privileged HTML interpolation safety
- Runtime security smoke/integration evidence for boundary claims

## Out of Scope
- Broad feature additions
- Large adapter decomposition work not required for immediate security closure
- UI redesign

## Primary Current Files
- `main.js`
- `core/adapters/platform/securityPolicy.js`
- `core/security/urlPolicy.js`
- `ui/shell/preload.js`
- `ui/settings/preload.js`
- `core/dispatcher.js`
- `core/settings/page.js`
- `tests/smoke/*`
- `tests/adapter-contracts.test.js`

## Findings Carried In
- Privileged preload bridges may remain available if trusted surfaces navigate to remote content.
- Privileged IPC sender checks rely on sender identity but need strict trusted-origin/frame constraints.
- Runtime proof is missing for bridge absence on untrusted content and privileged IPC rejection from unauthorized senders.

## Planned Outputs
- Explicit role-based trust policy and enforcement points
- Surface-specific navigation restrictions that prevent privileged bridge exposure on remote pages
- Hardened IPC guard helpers for sender and expected origin/frame checks
- Security smoke tests that prove trusted/untrusted boundary behavior in Electron runtime

## Steps
1. [x] Define trusted surface role model and invariants in code comments/docs.
2. [x] Enforce per-surface navigation policy:
   - block remote navigation from trusted internal shell/settings surfaces, or
   - isolate remote navigation into unprivileged no-preload surfaces.
3. [x] Add strict sender + frame/origin checks for privileged channels (`settings:*`, privileged `ui-shell:*`).
4. [x] Remove or wire/test dead privileged bridge methods so exposed preload API matches live contracts.
5. [x] Tighten internal CSP and document any required exceptions.
6. [x] Escape/sanitize dynamic interpolation on privileged internal HTML surfaces.
7. [x] Add runtime security tests for:
   - bridge absence on untrusted pages,
   - privileged IPC rejection for unauthorized sender/frame/origin,
   - blocked trusted-surface remote navigation,
   - blocked `window.open`/disallowed navigation behavior.
8. [x] Run and pass local security validation sequence.

## Behavior Parity Checklist
- [x] Baseline browsing/tab behavior unchanged for regular buffers
- [x] Command/urlline/telescope workflows unchanged
- [x] Settings editing workflow unchanged in trusted internal context
- [x] Sidepanel history/bookmark workflows unchanged

## Validation
- [x] `npm test`
- [x] `npm run test:smoke`
- [x] `npm run test:smoke:overlay`
- [x] `npm run test:smoke:ui-cadence`
- [x] New security smoke command(s) added in this phase (`npm run test:smoke:security`)

### Runtime Proof Scope Note
- Privileged IPC rejection proof for this phase is runtime smoke + centralized guard-path verification.
- The smoke scenario uses a test-only probe channel gated by `NOCTRA_SMOKE_TEST=1` to exercise unauthorized sender/frame rejection deterministically.
- This is not a full hostile-renderer exploit simulation; treat hostile-renderer E2E adversarial testing as a follow-up depth item.

### Trusted Surface URL Allowance Note
- Current trusted-surface URL allowance accepts `about:blank` and app-generated `data:text/html` documents.
- This is acceptable for current internal surfaces and Phase 05 closure, but should be narrowed if future trusted surfaces require additional schemes.
- Follow-up owner: Phase 06/07 reconciliation (monitoring, non-blocking for Phase 05).

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Overblocking breaks trusted workflows | policy too strict | define role allowlist precisely and run parity suite each change |
| Security checks bypassed via alternate renderer path | inconsistent guard usage | centralize privileged guard helper and require for all privileged handlers |
| CSP tightening breaks internal scripts | missing nonce/hash migration | migrate incrementally and verify each internal surface with smoke checks |

## Exit Criteria
- [x] No privileged bridge reachable from untrusted remote content in tested runtime paths
- [x] Privileged IPC channels enforce sender + origin/frame trust constraints
- [x] Security runtime tests are present, deterministic, and passing
- [x] Phase status updated in master plan

## Handoff Notes
- Done:
  - Added explicit surface role model and role tagging in `core/security/surfaceTrust.js` and trusted creation paths.
  - Hardened navigation policy for trusted surfaces in `core/adapters/platform/securityPolicy.js` with explicit trusted-surface remote navigation blocking.
  - Added strict privileged IPC guard checks in `main.js` using sender identity + role + senderFrame URL trust.
  - Removed dead shell preload editor bridge methods in `ui/shell/preload.js` that were not backed by live `main` handlers.
  - Added panel CSP meta policy in `core/history/panel.js` to align internal surface CSP hardening.
  - Escaped dynamic settings HTML interpolation for title/path in `core/settings/page.js`.
  - Added runtime security smoke scenario + script (`tests/smoke/electron-security-boundary.smoke.js`) and package script `test:smoke:security`.
  - Added/updated contract tests for trusted-surface navigation blocking in `tests/adapter-contracts.test.js`.
- Remaining:
  - none.
- Known pitfalls:
  - security assumptions documented in code can drift if runtime tests are absent.
- Next exact step:
  - Execute `phase-06-ci-proof-gate-alignment.md` step 1: define canonical hardening gate command including new security smoke checks.
