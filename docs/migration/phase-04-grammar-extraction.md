# Phase 04 - Grammar Extraction/Alignment

## Goal
Extract shared grammar primitives and align interpretation with v2 layering while preserving current motions.

## In Scope
- Shared count/sequence primitives
- Operator-pending primitives where already behaviorally present
- Sidepanel tree delete grammar alignment (no behavior change)

## Out of Scope
- New Vim grammar features
- New motions/operators

## Primary Current Files
- `motions/normal.js`
- `motions/modifiers.js`
- `core/history/panel.js`

## Steps
1. [x] Extract reusable count/sequence timeout utilities.
2. [x] Extract shared grammar helpers used by normal and tree contexts.
3. [x] Keep sidepanel key semantics identical (`d`, `d2j`, `dgg`, `dG` behavior already implemented there).
4. [x] Validate every existing motion path.

## Behavior Parity Checklist
- [x] `gg`, `G`, counts in normal mode unchanged
- [x] leader behavior unchanged
- [x] tree delete pending flows unchanged
- [x] no timing regressions in sequence timeout

## Validation
- [x] Motion regression checklist
- [x] Tree workflow checklist
- [x] Repeat action behavior checks

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| subtle grammar timing drift | timeout handling differences | preserve exact timeout defaults and reset points |
| tree modal regressions | extraction from large panel module | incremental extraction + branch-level checks |

## Exit Criteria
- [x] Shared grammar utilities adopted
- [x] Tree and normal behavior unchanged
- [x] Parity checklists pass

## Handoff Notes
- Done:
  - Added shared grammar primitives in `motions/grammarPrimitives.js`.
  - Routed normal-mode sequence timeout and count parsing through shared helpers in `motions/normal.js`.
  - Routed tree sequence timeout, count parsing, and key-sequence match logic through shared helpers in `core/history/panel.js`.
- Remaining:
  - none.

## Validation Result
- Manual parity checks passed for normal motion grammar (`gg`, `G`, counts), leader flows, sidepanel delete-pending flows (`d`, `d2j`, `dgg`, `dG`), sequence timeout behavior, and repeat action behavior.
