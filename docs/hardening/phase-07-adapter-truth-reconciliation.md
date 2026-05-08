# Phase 07 - Adapter Truth Reconciliation

## Goal
Align hardening documentation with actual adapter extraction state and close or explicitly defer remaining decomposition debt without overstating completion.

## In Scope
- Reconcile Phase 04 claims versus implementation state
- Remove stale/dead transitional paths and ambiguous contract surfaces
- Choose and execute one path:
  - complete remaining extraction slices, or
  - rebaseline scope with explicit deferred backlog and risk notes
- Validate behavior parity after any extraction/cleanup changes

## Out of Scope
- Rewriting architecture beyond parity-safe incremental changes
- Security boundary fixes already scoped to Phase 05
- CI gate alignment already scoped to Phase 06

## Primary Current Files
- `docs/hardening/phase-04-adapter-deepening-monolith-split.md`
- `ui/shell/manager.js`
- `browser/manager.js`
- `main.js`
- `core/adapters/platform/*`
- `core/adapters/renderer/*`

## Findings Carried In
- Current docs mark Phase 04 complete while key adapter slices remain in monolithic modules.
- Transitional/dead preload bridge surface(s) remain and reduce contract clarity.

## Planned Outputs
- Truthful inventory of completed extraction versus remaining debt
- Cleaned transitional interfaces and stale paths
- Explicit scope decision with parity evidence

## Steps
1. [ ] Build a current-state extraction table from implementation (not prior docs).
2. [ ] Compare current-state table to Phase 04 claims and mark deltas.
3. [ ] Decide path:
   - Path A: finish remaining planned extraction slices, or
   - Path B: rebaseline docs and defer remaining slices explicitly.
4. [ ] Remove or fully wire/test stale transitional/dead adapter/bridge paths.
5. [ ] Re-run parity test sequence after each meaningful change slice.
6. [ ] Update Phase 04 and Phase 07 artifacts with final truthful state and next-step ownership.

## Validation
- [ ] `npm test`
- [ ] `npm run test:smoke`
- [ ] `npm run test:smoke:overlay`
- [ ] `npm run test:smoke:ui-cadence`

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Scope creep in extraction work | too many modules changed at once | choose path A/B explicitly and keep incremental slices |
| Behavior drift while refactoring | lifecycle ordering changes | parity suite after each slice and rollback-safe commits |
| Documentation remains overstated | updates lag code | update docs immediately after each verified slice |

## Exit Criteria
- [ ] Documentation and implementation state are fully aligned
- [ ] No known dead transitional contract surface remains
- [ ] Any deferred extraction debt is explicit, owned, and tracked
- [ ] Phase status updated in master plan

## Handoff Notes
- Done:
  - none.
- Remaining:
  - full phase execution.
- Known pitfalls:
  - marking extraction complete before CI-proofed parity creates closeout risk.
- Next exact step:
  - Execute step 1: generate implementation-derived extraction table for reconciliation.
