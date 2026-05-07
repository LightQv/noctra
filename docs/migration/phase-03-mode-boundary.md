# Phase 03 - Mode Boundary Hardening

## Goal
Make modes interpretation-only and centralize mode transitions behind one controlled service.

## In Scope
- Consolidate writes to mode-related state
- Keep `NORMAL/INSERT/COMMAND` behavior exact
- Keep editor and command target transitions exact

## Out of Scope
- New modes
- Rebinding keys

## Primary Current Files
- `core/state.js`
- `motions/normal.js`
- `motions/insert.js`
- `motions/command.js`
- `main.js`
- `core/dispatcher.js`

## Steps
1. [x] Inventory all mode mutations in codebase.
2. [x] Define mode transition API.
3. [x] Replace scattered direct writes incrementally.
4. [x] Add assertions for illegal transitions.
5. [x] Validate parity matrix.

## Behavior Parity Checklist
- [x] `:` enters command mode exactly as before
- [x] `Escape` exits insert/command exactly as before
- [x] Editor mode and shell mode labeling unchanged
- [x] Urlline mode behavior unchanged

## Validation
- [x] Mode transition matrix runs clean
- [x] Command buffer lifecycle unchanged
- [x] Editor command submission unchanged

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| mode desync | mixed legacy/new writes | enforce single write API + grep audit |
| command regressions | cursor/buffer reset differences | preserve current command lifecycle exactly |

## Exit Criteria
- [x] Transition API owns mode writes
- [x] No direct unsafe writes remain in touched scope
- [x] Parity checks pass

## Handoff Notes
- Done:
  - Added `core/modeTransitionService.js` to centralize mode transitions and command lifecycle entry/exit state updates.
  - Replaced direct `state.mode` writes in `motions/*`, `motions/actionBuilders.js`, `core/dispatcher.js`, `main.js`, and `core/history/panel.js` with transition service calls.
  - Added non-breaking illegal transition warnings for command-mode exits when not currently in command mode.
  - Completed grep audit for `state.mode =` writes; only transition service now mutates app mode.
- Remaining:
  - none.

## Validation Result
- Manual parity matrix passed for command entry (`:`), insert/command exit (`Escape`), urlline lifecycle, editor command submission, and statusline mode labeling.
