# Phase 06 - Renderer/Platform Adapter Boundaries

## Goal
Harden boundaries so engine/platform details stay behind adapter interfaces.

## In Scope
- Renderer interaction adapter(s)
- Platform/electron action adapter(s)
- Minimize direct cross-layer JS injection calls from orchestration points

## Out of Scope
- Engine swap
- UI redesign

## Primary Current Files
- `main.js`
- `core/dispatcher.js`
- `ui/shell/manager.js`
- `browser/manager.js`

## Steps
1. [x] Inventory direct renderer/platform calls.
2. [x] Define adapter interfaces preserving current capabilities.
3. [x] Route callers through adapters.
4. [x] Keep behavior and timing unchanged.

## Behavior Parity Checklist
- [x] Overlay visibility/order unchanged
- [x] Editor focus/blur hooks unchanged
- [x] Window/platform actions unchanged
- [x] Theme propagation unchanged

## Validation
- [x] Overlay stack checks with splits
- [x] Editor lifecycle checks
- [x] Startup/shutdown checks

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| overlay z-order regressions | ownership handoff bugs | explicit ownership contract + syncOverlayStack checks |
| platform shortcut regressions | adapter normalization drift | preserve existing normalized input contract |

## Exit Criteria
- [x] Adapters in place and used
- [x] Cross-layer direct calls reduced in orchestrators
- [x] Parity checks pass

## Handoff Notes
- Done:
  - Added platform adapters:
    - `core/adapters/platform/windowActions.js`
    - `core/adapters/platform/webContentsActions.js`
  - Added renderer adapters:
    - `core/adapters/renderer/editorSurface.js`
    - `core/adapters/renderer/uiShellPush.js`
  - Routed direct orchestrator calls in `main.js` through adapters:
    - window actions (`minimize`, `toggleMaximize`, `close`)
    - urlline navigation actions (`back`, `forward`, `reload`)
    - editor surface focus bridge calls
    - web-mode focused editable detection
    - statusline scroll polling script execution
    - theme broadcast push fanout
  - Routed dispatcher calls through adapters in `core/dispatcher.js` and `core/dispatcher/handlers/navigation.js`.
- Remaining:
  - none.

## Validation Result
- Passed: module load/syntax sanity for modified modules.
- Passed: manual Phase 06 parity checklist (overlay order/stack with splits, editor focus/blur and command lifecycle hooks, startup/shutdown behavior).
