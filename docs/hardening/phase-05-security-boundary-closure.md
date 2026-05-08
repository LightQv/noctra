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
1. [ ] Define trusted surface role model and invariants in code comments/docs.
2. [ ] Enforce per-surface navigation policy:
   - block remote navigation from trusted internal shell/settings surfaces, or
   - isolate remote navigation into unprivileged no-preload surfaces.
3. [ ] Add strict sender + frame/origin checks for privileged channels (`settings:*`, privileged `ui-shell:*`).
4. [ ] Remove or wire/test dead privileged bridge methods so exposed preload API matches live contracts.
5. [ ] Tighten internal CSP and document any required exceptions.
6. [ ] Escape/sanitize dynamic interpolation on privileged internal HTML surfaces.
7. [ ] Add runtime security tests for:
   - bridge absence on untrusted pages,
   - privileged IPC rejection for unauthorized sender/frame/origin,
   - blocked trusted-surface remote navigation,
   - blocked `window.open`/disallowed navigation behavior.
8. [ ] Run and pass local security validation sequence.

## Behavior Parity Checklist
- [ ] Baseline browsing/tab behavior unchanged for regular buffers
- [ ] Command/urlline/telescope workflows unchanged
- [ ] Settings editing workflow unchanged in trusted internal context
- [ ] Sidepanel history/bookmark workflows unchanged

## Validation
- [ ] `npm test`
- [ ] `npm run test:smoke`
- [ ] `npm run test:smoke:overlay`
- [ ] `npm run test:smoke:ui-cadence`
- [ ] New security smoke command(s) added in this phase

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Overblocking breaks trusted workflows | policy too strict | define role allowlist precisely and run parity suite each change |
| Security checks bypassed via alternate renderer path | inconsistent guard usage | centralize privileged guard helper and require for all privileged handlers |
| CSP tightening breaks internal scripts | missing nonce/hash migration | migrate incrementally and verify each internal surface with smoke checks |

## Exit Criteria
- [ ] No privileged bridge reachable from untrusted remote content in tested runtime paths
- [ ] Privileged IPC channels enforce sender + origin/frame trust constraints
- [ ] Security runtime tests are present, deterministic, and passing
- [ ] Phase status updated in master plan

## Handoff Notes
- Done:
  - none.
- Remaining:
  - full phase execution.
- Known pitfalls:
  - security assumptions documented in code can drift if runtime tests are absent.
- Next exact step:
  - Execute step 1: define surface role model and trusted boundary invariants.
