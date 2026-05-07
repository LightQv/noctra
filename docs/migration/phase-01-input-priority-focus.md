# Phase 01 - Input/Priority/Focus Extraction

## Goal
Extract explicit input priority and focus resolution modules without behavior changes.

## In Scope
- Lift `main.js` raw-input precedence into dedicated resolver(s)
- Define explicit focus ownership query API
- Keep all key behavior and ordering identical

## Out of Scope
- Semantic context redesign
- Mode model changes
- Dispatcher decomposition

## Primary Current Files
- `main.js`
- `core/input.js`
- `core/history/panel.js`
- `browser/manager.js`
- `ui/shell/manager.js`

## Planned Outputs
- Input priority resolver module (pure decision order)
- Focus resolver module (who currently owns input)
- Thin integration in entrypoint

## Steps
1. Freeze and document current precedence order from `handleRawInput`.
2. Build resolver API reflecting exact current gates (bookmark modal, telescope, history panel, urlline, command paste, global shortcuts).
3. Build focus resolver abstraction returning active scope.
4. Integrate resolvers with no reordering and no behavior change.
5. Validate full parity matrix.

## Behavior Parity Checklist
- [x] Leader key still preempts focused tree when expected
- [x] History panel focused key handling unchanged
- [x] Telescope input handling unchanged
- [x] Urlline and command paste shortcuts unchanged
- [x] Cmd/Ctrl shortcuts unchanged

## Validation
- [x] Manual: baseline keyflow script A (normal browsing)
- [x] Manual: keyflow script B (history/bookmark panel)
- [x] Manual: keyflow script C (telescope + command + urlline)

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Accidental precedence change | condition reorder | snapshot precedence list + test each branch |
| Focus race around active buffer | stale webContents refs | preserve existing bind/unbind flow |

## Exit Criteria
- [x] Resolver modules exist and are wired
- [x] No behavior change observed
- [x] Master phase status updated

## Handoff Notes
- Done:
  - Added focus snapshot resolver in `core/focusResolver.js`.
  - Added priority resolver in `core/inputPriorityResolver.js`.
  - Integrated both into `main.js::handleRawInput` with original precedence preserved.
- Remaining:
  - none.
- Known pitfalls:
  - Any subtle change in branch order inside `handleRawInput` can regress focused tree and leader precedence.
- Next exact step:
  - Start Phase 02 step 1: document current `interactionContext` transitions.
