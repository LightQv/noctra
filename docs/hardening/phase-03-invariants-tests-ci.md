# Phase 03 - Invariants, Tests, and CI Gates

## Goal
Turn architecture and security expectations into enforceable regression gates.

## In Scope
- Promote critical invariants from warn-only to fail-fast in dev/CI
- Add focused unit tests around critical boundaries
- Add Electron smoke tests for core workflows
- Wire checks into CI with deterministic pass/fail signals

## Out of Scope
- Major UI redesign
- Deep adapter decomposition (Phase 04)
- Non-critical test expansion beyond boundary coverage

## Primary Current Files
- `core/invariants.js`
- `core/inputPriorityResolver.js`
- `core/focusResolver.js`
- `core/semanticContextResolver.js`
- `core/dispatcher.js`
- `motions/grammarPrimitives.js`
- CI workflow files (to be added/updated)

## Planned Outputs
- Critical invariant catalog with enforcement mode by environment
- Unit tests for resolver/parser/dispatcher contracts
- Electron smoke tests for modal and shell workflows
- CI pipeline running lint/test/build/smoke gates

## Steps
1. [ ] Classify invariants as critical vs advisory.
2. [ ] Promote critical invariants to fail-fast behavior in dev/CI.
3. [ ] Add unit tests for resolver + grammar + dispatch contracts.
4. [ ] Add Electron smoke tests for key interactive flows.
5. [ ] Add CI workflows and required checks for merge safety.
6. [ ] Stabilize flaky checks and document troubleshooting.

## Behavior Parity Checklist
- [ ] Existing workflows pass with invariants enabled
- [ ] No false-positive invariant failures in normal operation
- [ ] Test suite reflects current architecture boundaries accurately

## Validation
- [ ] CI run passes on clean branch
- [ ] Local runbook verifies lint/test/build/smoke sequence
- [ ] At least one intentional invariant violation fails as expected

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Excessive invariant failures block dev flow | over-broad critical set | start with minimal critical set and expand |
| Flaky Electron smoke tests | timing-sensitive UI lifecycle | deterministic wait helpers and reduced scope |
| CI cost/time too high | oversized test matrix | split fast gates vs nightly gates |

## Exit Criteria
- [ ] Critical invariants enforce in CI
- [ ] Core boundary tests pass consistently
- [ ] CI gating documented and active
- [ ] Phase status updated in master plan

## Handoff Notes
- Done:
  - none.
- Remaining:
  - all steps.
- Known pitfalls:
  - If critical/advisory split is unclear, CI noise can hide real regressions.
- Next exact step:
  - Execute step 1 and produce invariant classification table.
