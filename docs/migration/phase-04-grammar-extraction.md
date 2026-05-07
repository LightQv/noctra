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
1. Extract reusable count/sequence timeout utilities.
2. Extract shared grammar helpers used by normal and tree contexts.
3. Keep sidepanel key semantics identical (`d`, `d2j`, `dgg`, `dG` behavior already implemented there).
4. Validate every existing motion path.

## Behavior Parity Checklist
- [ ] `gg`, `G`, counts in normal mode unchanged
- [ ] leader behavior unchanged
- [ ] tree delete pending flows unchanged
- [ ] no timing regressions in sequence timeout

## Validation
- [ ] Motion regression checklist
- [ ] Tree workflow checklist
- [ ] Repeat action behavior checks

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| subtle grammar timing drift | timeout handling differences | preserve exact timeout defaults and reset points |
| tree modal regressions | extraction from large panel module | incremental extraction + branch-level checks |

## Exit Criteria
- [ ] Shared grammar utilities adopted
- [ ] Tree and normal behavior unchanged
- [ ] Parity checklists pass
