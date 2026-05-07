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
1. [x] Remove compatibility leftovers from earlier phases.
2. [x] Enforce invariants in code and docs:
   - input -> priority -> focus -> context -> mode -> grammar -> intent -> action
3. [x] Consolidate duplicate logic (e.g., mode label computation ownership).
4. [x] Final parity and regression pass.

## Behavior Parity Checklist
- [x] External behavior unchanged from baseline
- [x] All previous phase checklists still pass
- [x] No known high-severity migration regressions open

## Validation
- [x] Full manual regression suite
- [x] Optional focused unit checks on resolvers/grammar components

## Handoff Notes
- Done:
  - Removed `interactionContext` transitional state and migrated editor focus ownership to `state.editorFocus` via `core/editorFocusState.js`.
  - Updated focus/context/history/dispatcher/editor command flows to use editor-focus helpers instead of context strings.
  - Added warn-only invariant guardrails in `core/invariants.js` and wired checks into input and dispatch orchestration.
  - Consolidated statusline mode-label ownership into `core/statuslineModeLabel.js` and reused it from both `main.js` and `core/dispatcher.js`.
  - Completed full Phase 07 manual parity/regression pass with no externally visible behavior changes.
  - Completed focused resolver/grammar checks and retained warn-only invariant enforcement in production.
- Remaining:
  - none.

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| removing needed compatibility too early | hidden dependency | only remove after usage audit |
| final pass scope creep | opportunistic fixes | strict freeze: migration-only changes |

## Exit Criteria
- [x] Master plan all phases marked `done`
- [x] Risks reviewed and closed/accepted
- [x] Final migration summary published
