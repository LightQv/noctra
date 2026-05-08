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
1. [x] Build a current-state extraction table from implementation (not prior docs).
2. [x] Compare current-state table to Phase 04 claims and mark deltas.
3. [x] Decide path:
   - Path A: finish remaining planned extraction slices, or
   - Path B: rebaseline docs and defer remaining slices explicitly.
4. [x] Remove or fully wire/test stale transitional/dead adapter/bridge paths.
5. [x] Re-run parity test sequence after each meaningful change slice.
6. [x] Update Phase 04 and Phase 07 artifacts with final truthful state and next-step ownership.

## Validation
- [x] `npm test`
- [x] `npm run test:smoke`
- [x] `npm run test:smoke:overlay`
- [x] `npm run test:smoke:ui-cadence`
- [x] `npm run test:smoke:security`

## Step 1 - Implementation-Derived Extraction Table
Status values: `adapterized | partial | monolith-owned | unknown`

| ID | Module | Responsibility slice | Current owner (implementation) | Target owner (Phase 04) | State | Evidence | Delta vs Phase 04 claim | Action (Path B) | Risk |
|---|---|---|---|---|---|---|---|---|---|
| EX-01 | `main.js` | Session/webContents security policy registration | Adapter | Adapter | adapterized | `main.js:1728`, `core/adapters/platform/securityPolicy.js:1` | accurate | none | low |
| EX-02 | `main.js` | IPC registration/teardown | Adapter | Adapter | adapterized | `main.js:1185`, `core/adapters/platform/ipcRegistry.js:1` | accurate | none | low |
| EX-03 | `core/history/panel.js` | Sidepanel BrowserView host boundary | Adapter + panel domain service | Adapter + panel domain service | adapterized | `core/adapters/platform/panelViewHost.js:1`, `core/history/panel.js:122` | accurate | none | low |
| EX-04 | `core/history/panel.js` | Debounced renderer transport | Adapter | Adapter | adapterized | `core/adapters/renderer/panelRenderTransport.js:1`, `core/history/panel.js:129` | accurate | none | low |
| EX-05 | `main.js` | Web mode tracking bind/sync lifecycle | Monolith | Adapter + core service split | monolith-owned | `main.js:370`, `main.js:495`, `main.js:513` | understated detail in Phase 04 | doc-rebaseline | medium |
| EX-06 | `ui/shell/manager.js` | Overlay BrowserView creation/attach/destroy | Monolith | Platform adapter | monolith-owned | `ui/shell/manager.js:1011`, `ui/shell/manager.js:1031`, `ui/shell/manager.js:1172` | overstated if read as fully extracted | defer | high |
| EX-07 | `ui/shell/manager.js` | Overlay geometry and z-order stack | Monolith | Platform adapter | monolith-owned | `ui/shell/manager.js:1364`, `ui/shell/manager.js:1474`, `ui/shell/manager.js:1498` | overstated if read as fully extracted | defer | high |
| EX-08 | `ui/shell/manager.js` | DOM patch transport (`executeJavaScript`) | Monolith | Renderer adapter | monolith-owned | `ui/shell/manager.js:1247`, `ui/shell/manager.js:1271`, `ui/shell/manager.js:1583` | overstated if read as fully extracted | defer | medium |
| EX-09 | `browser/manager.js` | Content BrowserView host operations | Monolith | Platform adapter | monolith-owned | `browser/manager.js:92`, `browser/manager.js:409`, `browser/manager.js:1091` | overstated if read as fully extracted | defer | high |
| EX-10 | `browser/manager.js` | Split/devtools host primitives | Monolith | Platform adapter | monolith-owned | `browser/manager.js:503`, `browser/manager.js:515`, `browser/manager.js:1122`, `browser/manager.js:1130` | overstated if read as fully extracted | defer | high |
| EX-11 | `browser/manager.js` | WebContents observer + selection copy bridge | Monolith | Platform adapter | monolith-owned | `browser/manager.js:1165`, `browser/manager.js:1227` | understated detail in Phase 04 | doc-rebaseline | medium |
| EX-12 | `core/adapters/renderer/uiShellPush.js` | Shell update broadcast transport | Adapter | Not explicitly listed in Phase 04 map | partial | `core/adapters/renderer/uiShellPush.js:1`, `main.js:49` | understated | doc-rebaseline | low |

Step 1 outcome:
- No `unknown` rows remain.
- Four extracted slices are fully adapterized and validated (EX-01 to EX-04).
- High-risk overlay/split slices remain monolith-owned and are explicitly tracked for deferment.

## Step 2 - Delta Reconciliation vs Phase 04 Claims
| Claim reference | Claim summary | Implementation verdict | Required change |
|---|---|---|---|
| `docs/hardening/phase-04-adapter-deepening-monolith-split.md:4` | "Deepen platform/renderer boundaries" | true but broad wording can be overread as complete extraction | clarify as incremental extraction with deferred high-risk slices |
| `docs/hardening/phase-04-adapter-deepening-monolith-split.md:26` | "Reduced direct Electron API usage in orchestration modules" | accurate for `main.js`; not equivalent to broad monolith extraction | add explicit scope boundary note |
| `docs/hardening/phase-04-adapter-deepening-monolith-split.md:173` | "Direct Electron coupling reduced in target modules" | partially true; significant coupling remains in `ui/shell/manager.js` and `browser/manager.js` | update with reconciliation addendum and deferred debt list |

## Step 3 - Path Decision
- Selected path: **Path B**.
- Rationale:
  - preserves rollback safety by avoiding high-risk extraction in closeout window,
  - avoids parity drift in overlay stack and split/devtools lifecycle,
  - satisfies truth-alignment objective by explicitly rebaselining remaining debt.

## Step 4 - Transitional/Dead Surface Cleanup
- Audited preload bridge surfaces and adapter wiring for stale transitional interfaces.
- Result: no dead privileged preload bridge method remains on current trusted surfaces.
  - Shell preload API is limited to active channels (`ui/shell/preload.js:3`).
  - Settings preload API maps to live channels (`ui/settings/preload.js:3`).
  - Security-policy passthrough wrappers removed earlier in Phase 04 remain absent from `main.js` startup path.
- Code changes required in this step: none.

## Step 5 - Parity Evidence
- Passed: `npm test`
- Passed: `npm run test:smoke`
- Passed: `npm run test:smoke:overlay`
- Passed: `npm run test:smoke:ui-cadence`
- Passed: `npm run test:smoke:security`

## Step 6 - Final Truth State and Ownership
- Confirmed completed extraction slices:
  - `main.js` security policy registration -> `core/adapters/platform/securityPolicy.js`.
  - `main.js` IPC registration -> `core/adapters/platform/ipcRegistry.js`.
  - `core/history/panel.js` host/transport boundaries -> `panelViewHost` + `panelRenderTransport`.
- Deferred extraction debt (explicit owners):
  - Overlay host/layout/patch transport in `ui/shell/manager.js` (owner: shell/platform/renderer; risk: high).
  - Content host + split/devtools + observers in `browser/manager.js` (owner: browser/platform; risk: high).
  - Web mode tracking split from `main.js` into adapter/service boundary (owner: core/platform; risk: medium).

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Scope creep in extraction work | too many modules changed at once | choose path A/B explicitly and keep incremental slices |
| Behavior drift while refactoring | lifecycle ordering changes | parity suite after each slice and rollback-safe commits |
| Documentation remains overstated | updates lag code | update docs immediately after each verified slice |

## Exit Criteria
- [x] Documentation and implementation state are fully aligned
- [x] No known dead transitional contract surface remains
- [x] Any deferred extraction debt is explicit, owned, and tracked
- [x] Phase status updated in master plan

## Handoff Notes
- Done:
  - Completed implementation-derived extraction table and reconciliation deltas.
  - Selected Path B and rebaselined extraction scope with explicit deferred ownership.
  - Audited transitional/dead bridge and adapter contract surfaces; no additional dead surface found.
  - Passed full parity/security gate sequence.
- Remaining:
  - none.
- Known pitfalls:
  - deferred high-risk extraction debt must stay explicit in Phase 08 certification wording.
- Next exact step:
  - Execute `phase-08-oss-readiness-certification.md` step 1: assemble latest proof bundle and begin gate reconciliation.
