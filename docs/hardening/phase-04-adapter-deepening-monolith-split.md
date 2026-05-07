# Phase 04 - Adapter Deepening + Monolith Split

## Goal
Deepen platform/renderer boundaries and reduce monolithic modules without changing user-visible behavior.

## In Scope
- Push Electron-specific logic behind adapter interfaces
- Decompose high-churn large modules into focused services
- Preserve stable intent/command boundary and lifecycle behavior
- Improve maintainability and future multi-engine optionality

## Out of Scope
- New end-user features
- Security boundary redesign already handled in Phase 01
- Large-scale rewrites without parity checkpoints

## Primary Current Files
- `main.js`
- `ui/shell/manager.js`
- `browser/manager.js`
- `core/history/panel.js`
- `core/adapters/platform/*`
- `core/adapters/renderer/*`

## Planned Outputs
- Reduced direct Electron API usage in orchestration modules
- Extracted domain services from monolithic files
- Stable adapter contracts with clear ownership boundaries
- Regression-safe module split sequence with parity checks

## Steps
1. [ ] Inventory direct Electron/WebContents/BrowserView calls by module.
2. [ ] Define target ownership map (orchestration vs adapter vs UI domain service).
3. [ ] Extract first decomposition slice (lowest-risk domain) and validate parity.
4. [ ] Continue incremental splits for remaining large modules.
5. [ ] Add/update tests for extracted boundaries and lifecycle ordering.
6. [ ] Remove deprecated passthroughs after parity verification.

## Behavior Parity Checklist
- [ ] Startup/shutdown behavior unchanged
- [ ] Overlay/panel z-order behavior unchanged
- [ ] Buffer lifecycle and focus behavior unchanged
- [ ] Statusline/tabline/urlline update cadence unchanged

## Validation
- [ ] Manual: startup/shutdown parity script
- [ ] Manual: overlay/panel split-view parity script
- [ ] Focused tests for extracted service contracts

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Lifecycle regressions during split | event order changes | isolate one lifecycle slice per PR |
| Adapter leakage back into orchestration | partial extraction | ownership map + lint/check rules |
| Hard-to-debug behavior drift | wide refactor scope | small PRs with strict parity checklist |

## Exit Criteria
- [ ] Direct Electron coupling reduced in target modules
- [ ] Monolith decomposition milestones completed
- [ ] All parity validations pass
- [ ] Phase status updated in master plan

## Handoff Notes
- Done:
  - none.
- Remaining:
  - all steps.
- Known pitfalls:
  - Splitting too many modules in one session reduces confidence and rollback safety.
- Next exact step:
  - Execute step 1 and produce direct Electron call inventory table.
