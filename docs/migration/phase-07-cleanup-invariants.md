# Phase 07 - Cleanup + Invariants Enforcement

## Goal
Remove transitional paths and enforce architectural invariants from v2.

## In Scope
- Remove deprecated transitional glue
- Enforce downward resolution path
- Add guardrails/assertions/docs for invariants

## Out of Scope
- New features
- Broad refactors unrelated to migration

## Steps
1. Remove compatibility leftovers from earlier phases.
2. Enforce invariants in code and docs:
   - input -> priority -> focus -> context -> mode -> grammar -> intent -> action
3. Consolidate duplicate logic (e.g., mode label computation ownership).
4. Final parity and regression pass.

## Behavior Parity Checklist
- [ ] External behavior unchanged from baseline
- [ ] All previous phase checklists still pass
- [ ] No known high-severity migration regressions open

## Validation
- [ ] Full manual regression suite
- [ ] Optional focused unit checks on resolvers/grammar components

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| removing needed compatibility too early | hidden dependency | only remove after usage audit |
| final pass scope creep | opportunistic fixes | strict freeze: migration-only changes |

## Exit Criteria
- [ ] Master plan all phases marked `done`
- [ ] Risks reviewed and closed/accepted
- [ ] Final migration summary published
