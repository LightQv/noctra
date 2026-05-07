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
1. Inventory all mode mutations in codebase.
2. Define mode transition API.
3. Replace scattered direct writes incrementally.
4. Add assertions for illegal transitions.
5. Validate parity matrix.

## Behavior Parity Checklist
- [ ] `:` enters command mode exactly as before
- [ ] `Escape` exits insert/command exactly as before
- [ ] Editor mode and shell mode labeling unchanged
- [ ] Urlline mode behavior unchanged

## Validation
- [ ] Mode transition matrix runs clean
- [ ] Command buffer lifecycle unchanged
- [ ] Editor command submission unchanged

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| mode desync | mixed legacy/new writes | enforce single write API + grep audit |
| command regressions | cursor/buffer reset differences | preserve current command lifecycle exactly |

## Exit Criteria
- [ ] Transition API owns mode writes
- [ ] No direct unsafe writes remain in touched scope
- [ ] Parity checks pass
