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
1. Inventory direct renderer/platform calls.
2. Define adapter interfaces preserving current capabilities.
3. Route callers through adapters.
4. Keep behavior and timing unchanged.

## Behavior Parity Checklist
- [ ] Overlay visibility/order unchanged
- [ ] Editor focus/blur hooks unchanged
- [ ] Window/platform actions unchanged
- [ ] Theme propagation unchanged

## Validation
- [ ] Overlay stack checks with splits
- [ ] Editor lifecycle checks
- [ ] Startup/shutdown checks

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| overlay z-order regressions | ownership handoff bugs | explicit ownership contract + syncOverlayStack checks |
| platform shortcut regressions | adapter normalization drift | preserve existing normalized input contract |

## Exit Criteria
- [ ] Adapters in place and used
- [ ] Cross-layer direct calls reduced in orchestrators
- [ ] Parity checks pass
