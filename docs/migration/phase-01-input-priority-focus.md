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
- [ ] Leader key still preempts focused tree when expected
- [ ] History panel focused key handling unchanged
- [ ] Telescope input handling unchanged
- [ ] Urlline and command paste shortcuts unchanged
- [ ] Cmd/Ctrl shortcuts unchanged

## Validation
- [ ] Manual: baseline keyflow script A (normal browsing)
- [ ] Manual: keyflow script B (history/bookmark panel)
- [ ] Manual: keyflow script C (telescope + command + urlline)

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Accidental precedence change | condition reorder | snapshot precedence list + test each branch |
| Focus race around active buffer | stale webContents refs | preserve existing bind/unbind flow |

## Exit Criteria
- [ ] Resolver modules exist and are wired
- [ ] No behavior change observed
- [ ] Master phase status updated

## Handoff Notes
- Done:
- Remaining:
- Known pitfalls:
- Next exact step:
