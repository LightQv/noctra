# OSS Finalization Plan (Strict No-Debt Release)

## Objective
Ship Noctra for OSS sharing with:
- no deferred high-risk architecture debt,
- no unresolved critical/high security risk,
- accurate permanent documentation,
- no dependency on temporary migration/hardening planning folders.

This plan replaces deferred closeout and targets a finished, shareable baseline suitable for external bug reports and feature contributions.

---

## Release Standard (Strict)

Release is considered OSS-ready only when all are true:

1. No open critical/high security findings.
2. No deferred high-risk extraction debt from previous reconciliation.
3. Core lifecycle-sensitive boundaries are adapterized and covered by deterministic tests.
4. Canonical CI hardening gate passes locally and on hosted CI.
5. Public docs (`README.md`, `docs/`, `docs/tutorials/`) reflect implementation truth.
6. Temporary execution-tracking folders (`docs/hardening/`, `docs/migration/`) are removed after permanent docs are complete and validated.

---

## Scope

### In Scope
- Complete remaining high-risk adapter extraction slices.
- Add focused tests for lifecycle and security-sensitive behavior.
- Tighten residual medium security conditions.
- Produce permanent OSS-facing documentation and security policy docs.
- Final independent review and sign-off.

### Out of Scope
- New end-user features.
- Visual redesign.
- Plugin ecosystem expansion.
- Broad exploratory refactors outside strict debt-closure targets.

---

## Workstreams

## Workstream A - Close Deferred Architecture Debt (Strict)

### Target modules
- `ui/shell/manager.js`
  - overlay BrowserView lifecycle ownership
  - overlay layout/z-order ownership
  - shell DOM patch transport boundary
- `browser/manager.js`
  - content host BrowserView operations
  - split/devtools host primitives
  - observer/copy bridge ownership
- `main.js`
  - web-mode tracking bind/sync split ownership

### Deliverables
- Adapter/service boundaries implemented for all deferred high-risk slices.
- Monolith-owned deferred rows cleared.
- Ownership truth reflected in permanent architecture docs.

### Acceptance criteria
- No remaining "defer" status for high-risk extraction debt.
- Behavior parity maintained for modal flows, overlays, splits, and buffer lifecycle.

---

## Workstream B - Lifecycle/Regression Test Hardening

### Add/expand tests
- Settings buffer lifecycle: open/edit/save/close.
- Devtools split lifecycle: open/close/teardown.
- Reopen/close/session restore sequences.
- Window/theme and focus-sensitive lifecycle hooks as needed.

### Gate policy
- Keep canonical hardening gate as required path:
  - `npm run ci:test`
- Hosted CI must run equivalent gate and pass reproducibly.

### Acceptance criteria
- New tests deterministic locally and in hosted CI.
- No unresolved flaky gate behavior.

---

## Workstream C - Residual Security Closure

### Target items
- Tighten trusted-surface URL allowance policy (`data:` handling) where feasible.
- Improve and/or explicitly constrain CSP posture for internal surfaces.
- Confirm dependency vulnerability gate policy for OSS release workflow.

### Acceptance criteria
- No critical/high security must-fix findings.
- Medium findings either fixed or explicitly accepted with owner + revisit trigger.

---

## Workstream D - Permanent OSS Documentation

### Update canonical docs
- `README.md`
- `docs/architecture.md`
- `docs/getting-started.md`
- `docs/tutorials/first-30-minutes.md`
- `docs/tutorials/customize-keymap.md`
- `docs/tutorials/sessions-history-bookmarks.md`
- `docs/faq.md` (if needed for stability messaging)

### Add missing security policy doc
- `SECURITY.md` with:
  - vulnerability reporting path,
  - supported versions,
  - security posture and guarantees,
  - disclosure expectations.

### Documentation rules
- Describe current reality only.
- Avoid overclaiming ("fully hardened" / "multi-engine ready") unless strictly true.
- Keep early-stage status explicit while presenting stable contributor entry points.

### Acceptance criteria
- Public docs are internally consistent and implementation-accurate.
- No dependency on migration/hardening planning docs for understanding project state.

---

## Workstream E - Final Certification + Cleanup

### Final verification
- Local canonical gate pass.
- Hosted canonical gate pass.
- Independent re-review:
  - `security-engineer`
  - `senior-reviewer`
- Resolve any must-fix findings and re-run verification if needed.

### Folder retirement
After all above pass:
- Remove `docs/hardening/`
- Remove `docs/migration/`
- Verify no broken links in `README.md` and `docs/`.

### Acceptance criteria
- Repo stands alone with permanent docs.
- No unresolved strict release blockers remain.

---

## Execution Order (Required)

1. Workstream A (architecture debt closure)
2. Workstream B (test coverage + CI confidence)
3. Workstream C (security closure)
4. Workstream D (permanent docs + SECURITY.md)
5. Workstream E (independent reviews, final validation, folder retirement)

Do not reorder unless blocked by dependency constraints.

---

## Definition of Done

Noctra is ready for OSS sharing when:
- strict no-debt criteria are met,
- security risk posture is acceptable with no critical/high open findings,
- regression confidence is established in CI,
- documentation is complete and truthful,
- temporary planning folders are retired cleanly.

---

## Session Handoff Template (for next sessions)

Use this block at the end of each execution session:

- Completed this session:
  - <items>
- Validation run:
  - <commands/results>
- Remaining blockers:
  - <items>
- Next exact step:
  - <single concrete step>
- Risks introduced/closed:
  - <items>
