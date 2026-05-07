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
1. [x] Partition current switch cases by domain.
2. [x] Move case handlers into modules with identical behavior.
3. [x] Keep single `dispatch(win, intent, state)` API stable.
4. [x] Preserve unknown-intent warning behavior.
5. [x] Re-run parity checks.

## Behavior Parity Checklist
- [x] Every current intent still resolves identically
- [x] `intent.next` chain behavior unchanged
- [x] statusline/tabline post-dispatch updates unchanged
- [x] notifications behavior unchanged

## Validation
- [x] Intent-by-intent smoke checklist
- [x] Command parser -> intent -> action path checks
- [x] Sidepanel/telescope/session flows checks

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| missed side effect | handler extraction omissions | snapshot switch + parity table per intent |
| ordering change in chained intents | async/sync mismatch | preserve call order and sync semantics |

## Exit Criteria
- [x] Dispatcher split complete
- [x] Public API unchanged
- [x] Intent parity confirmed

## Handoff Notes
- Done:
  - Partitioned dispatcher intent handling into domain modules under `core/dispatcher/handlers/`.
  - Added dedicated handler modules for `telescope`, `session`, and `misc` intents.
  - Replaced monolithic `switch` in `core/dispatcher.js` with a handler registry while keeping `dispatch(win, intent, state)` unchanged.
  - Preserved unknown-intent warning guard before active-buffer checks.
  - Preserved post-dispatch statusline/tabline updates and `intent.next` chaining in root dispatcher.
- Remaining:
  - none.

## Validation Result
- Manual parity validation passed for intent smoke coverage, parser-to-action paths, and sidepanel/telescope/session workflows.
