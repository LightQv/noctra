# Modal Browser v2 Migration - Master Plan

## Objective
Migrate current architecture toward `modal_browser_architecture_v_2.md` while preserving:
- UI appearance
- functionality
- motions
- keybindings
- configs
- workflows
- external behavior

## Constraints
- No feature additions
- No framework migration
- No plugin system
- No compatibility layers unless necessary
- No architectural improvisation

## Non-Goals
- New user-facing capabilities
- Visual redesign
- Rewriting stable modules without architecture-driven reason

## Source of Truth
- `modal_browser_architecture_v_2.md`
- `noctra.png`
- Current runtime behavior in repository

---

## Phase Overview
| Phase | Name | Status | Depends On | Last Update |
|---|---|---|---|---|
| 01 | Input/Priority/Focus extraction | not started | - | - |
| 02 | Context layer normalization | not started | 01 | - |
| 03 | Mode boundary hardening | not started | 01, 02 | - |
| 04 | Grammar extraction/alignment | not started | 03 | - |
| 05 | Dispatcher decomposition | not started | 02, 03 | - |
| 06 | Renderer/platform adapter boundaries | not started | 05 | - |
| 07 | Cleanup + invariants enforcement | not started | all | - |

Status values: `not started | in progress | blocked | done`

---

## Current Architecture Snapshot
- Input entrypoint: `main.js` (`before-input-event` hooks + `handleRawInput`)
- Core pipeline: `motions/* -> core/input.js -> core/dispatcher.js -> browser/* + ui/*`
- Global state: `core/state.js` mutable singleton
- Focus ownership: split across `browser/manager.js`, `ui/shell/manager.js`, `core/history/panel.js`
- Priority policy: imperative ordering inside `main.js`
- Sidepanel owns its own modal tree grammar in `core/history/panel.js`

## Gap Summary vs v2
- Missing first-class `priorityResolver`
- Missing first-class `focusResolver`
- Context currently UI-area-centric (`SHELL/EDITOR/TREE`) more than semantic-capability-centric (`web/history/bookmarks/editor/tabs`)
- Modes partially carry app-state responsibilities
- Grammar logic duplicated (main motions vs sidepanel tree flow)
- Dispatcher and main have mixed responsibilities

---

## Behavior Parity Gates (required each phase)
- [ ] Normal/modifier/leader keybindings unchanged
- [ ] Command mode behavior unchanged
- [ ] Urlline editing behavior unchanged
- [ ] Sidepanel history/bookmark workflows unchanged
- [ ] Telescope behavior unchanged
- [ ] Settings/notifications editor workflows unchanged
- [ ] Visual UI unchanged (tabline/urlline/statusline/panels/overlays)

---

## Risk Register
| Risk | Impact | Probability | Detection | Mitigation | Status |
|---|---|---|---|---|---|
| Input precedence regression | High | Medium | manual keyflow script | extract resolver with same order first | open |
| Focus/z-order conflict | High | Medium | split + overlays checks | centralize focus ownership | open |
| Mode/context drift | High | Medium | mode transition matrix | single transition API | open |
| Sidepanel modal breakage | High | High | tree interaction checklist | migrate sidepanel last in grammar phase | open |

---

## Decision Log (ADR-lite)
### DEC-001
- Date: YYYY-MM-DD
- Decision: Adopt phase-based migration docs under `docs/migration/`
- Context: Long-running refactor across sessions with token/context limits
- Alternatives considered: single doc, issue-only tracking
- Consequences: Better resumability; requires discipline in updates

---

## Session Handoff
- Last completed phase: none
- Active phase: none
- Blockers: none
- Next action: start phase 01 and update status to `in progress`
