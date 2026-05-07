# Phase 05 - Dispatcher Decomposition

## Goal
Decompose monolithic dispatcher into domain action modules behind unchanged dispatch API.

## In Scope
- Split dispatcher internals into browser/ui/state/platform action handlers
- Preserve intent contract and `intent.next` chaining
- Preserve post-dispatch side effects

## Out of Scope
- Intent renaming
- Intent additions/removals

## Primary Current Files
- `core/dispatcher.js`
- `core/intents.js`
- `browser/*`
- `ui/*`

## Steps
1. Partition current switch cases by domain.
2. Move case handlers into modules with identical behavior.
3. Keep single `dispatch(win, intent, state)` API stable.
4. Preserve unknown-intent warning behavior.
5. Re-run parity checks.

## Behavior Parity Checklist
- [ ] Every current intent still resolves identically
- [ ] `intent.next` chain behavior unchanged
- [ ] statusline/tabline post-dispatch updates unchanged
- [ ] notifications behavior unchanged

## Validation
- [ ] Intent-by-intent smoke checklist
- [ ] Command parser -> intent -> action path checks
- [ ] Sidepanel/telescope/session flows checks

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| missed side effect | handler extraction omissions | snapshot switch + parity table per intent |
| ordering change in chained intents | async/sync mismatch | preserve call order and sync semantics |

## Exit Criteria
- [ ] Dispatcher split complete
- [ ] Public API unchanged
- [ ] Intent parity confirmed
