# Hardening Session Changelog

## Session 2026-05-09 #18
### Objective
- Close Workstream B lifecycle/regression hardening to reviewer-ready status and remove remaining determinism risks in smoke orchestration.

### Completed
- Expanded Workstream B lifecycle smoke coverage and finalized deterministic scenario behavior:
  - settings lifecycle validates `open -> edit -> save -> restore -> close`,
  - devtools lifecycle validates `open -> close -> teardown` with host teardown assertions,
  - session lifecycle validates reopen + restore without timing-coupled control-flow sleeps,
  - focus lifecycle validates editable-buffer focus hooks via settings bridge events.
- Refactored smoke orchestration in `main.js` to scenario-driven completion:
  - selected scenario runner is awaited,
  - `app.quit()` now happens after scenario settle,
  - timeout is watchdog failure guard, not success path.
- Re-ran independent `senior-reviewer`; final verdict for Workstream B scope: `READY_TO_MARK_B_DONE`.
- Updated OSS/hardening planning docs to mark Workstream B complete with scope-accurate wording.

### Decisions
- Keep Workstream B claims precise: lifecycle/focus-sensitive coverage is complete; do not claim direct native-theme/window lifecycle smoke coverage unless explicitly added.

### Verification
- Passed: `npm run test:smoke:settings-lifecycle`.
- Passed: `npm run test:smoke:devtools-lifecycle`.
- Passed: `npm run test:smoke:session-lifecycle`.
- Passed: `npm run test:smoke:focus-lifecycle`.
- Passed: `npm run ci:test`.
- Passed: `senior-reviewer` verdict `READY_TO_MARK_B_DONE` (Workstream B scope).
- Failed: n/a.

### Risks/Notes
- Workstream B is complete; remaining Phase 08 closeout risk centers on pending `security-engineer` re-review and hosted post-change evidence reconciliation.

### Next Session Start Here
- Execute `security-engineer` re-review and then close remaining Phase 08 validation/risk reconciliation steps.

## Session 2026-05-08 #17
### Objective
- Execute Phase 07 using Path B (truthful rebaseline + explicit deferment of remaining high-risk extraction debt).

### Completed
- Built implementation-derived extraction table in `docs/hardening/phase-07-adapter-truth-reconciliation.md` with evidence-backed state per slice.
- Reconciled Phase 04 claims against implementation and recorded explicit deltas (`accurate`, `overstated`, `understated detail`).
- Selected Path B and documented rationale with deferred ownership/risk for remaining high-risk slices.
- Audited transitional/dead bridge and adapter surfaces and confirmed no additional dead transitional contract surface remained.
- Updated `docs/hardening/phase-04-adapter-deepening-monolith-split.md` with Phase 07 truth-alignment addendum to prevent overreading extraction completion.
- Marked Phase 07 complete and activated Phase 08 in `docs/hardening/00_master_plan.md` handoff.

### Decisions
- Use Path B for Phase 07 closeout: preserve parity safety and avoid high-risk extraction churn before final OSS certification.

### Verification
- Passed: `npm test`.
- Passed: `npm run test:smoke`.
- Passed: `npm run test:smoke:overlay`.
- Passed: `npm run test:smoke:ui-cadence`.
- Passed: `npm run test:smoke:security`.
- Failed: n/a.

### Risks/Notes
- High-risk extraction debt remains intentionally deferred and must stay explicit during Phase 08 gate reconciliation and reviewer sign-off.

### Next Session Start Here
- Execute `docs/hardening/phase-08-oss-readiness-certification.md` step 1: assemble proof bundle from latest local and hosted CI passes.

## Session 2026-05-08 #16
### Objective
- Fully close Phase 06 after hosted CI confirmation and advance hardening execution to Phase 07.

### Completed
- Confirmed hosted GitHub Actions pass for canonical hardening gate workflow (`xvfb-run -a npm run ci:test`).
- Updated `docs/hardening/phase-06-ci-proof-gate-alignment.md` to:
  - mark step 6 complete,
  - mark hosted-run validation complete,
  - mark all Phase 06 exit criteria complete,
  - set handoff to Phase 07 step 1.
- Updated `docs/hardening/00_master_plan.md` to:
  - mark Phase 06 as `done`,
  - set Phase 07 to `in progress`,
  - update session handoff to the Phase 07 starting step.

### Decisions
- Treat hosted CI confirmation as the final closure condition for Phase 06; no additional Phase 06 scope added.

### Verification
- Passed: hosted GitHub Actions run with canonical gate (`npm run ci:test` under xvfb).
- Passed: local canonical gate previously validated in Session #15.
- Failed: n/a.

### Risks/Notes
- Phase 07 reconciliation is now the main source of closeout risk; documentation must track implementation truth without overclaiming extraction depth.

### Next Session Start Here
- Execute `docs/hardening/phase-07-adapter-truth-reconciliation.md` step 1: generate implementation-derived extraction table for reconciliation.

## Session 2026-05-08 #15
### Objective
- Execute Phase 06 recommended path by aligning CI with canonical hardening proof gates and documenting gate policy.

### Completed
- Aligned GitHub Actions hardening job to canonical gate command in `.github/workflows/ci.yml`:
  - replaced partial unit/startup-smoke steps with `xvfb-run -a npm run ci:test`.
- Added informational non-blocking dependency audit job in `.github/workflows/ci.yml`:
  - `npm audit --audit-level=high` under `continue-on-error: true`.
- Updated `docs/hardening/phase-06-ci-proof-gate-alignment.md` with:
  - completed steps 1-5,
  - canonical gate definition,
  - explicit Phase 06 gate policy (required hardening gate, audit informational, build gate deferred to Phase 08),
  - CI troubleshooting notes,
  - updated handoff and remaining hosted confirmation item.
- Ran local dry-run and passed:
  - `npm run ci:test`.

### Decisions
- Keep `ci:test` as the single required hardening proof gate for merge safety in Phase 06.
- Keep dependency vulnerability signal informational-only for now; do not block merges on audit in this phase.
- Defer build/package gating policy to Phase 08 OSS certification.

### Verification
- Passed: `npm run ci:test`.
- Pending: hosted GitHub Actions run confirmation after workflow changes.
- Failed: n/a.

### Risks/Notes
- Hosted runner confirmation remains required before Phase 06 can be marked fully complete.

### Next Session Start Here
- Execute `docs/hardening/phase-06-ci-proof-gate-alignment.md` step 6 hosted-run confirmation and close remaining validation checkbox.

## Session 2026-05-08 #14
### Objective
- Execute Phase 05 security boundary closure and add runtime proof for trusted/untrusted boundary claims.

### Completed
- Added surface-role trust model in `core/security/surfaceTrust.js` and tagged trusted/untrusted webContents at creation boundaries.
- Hardened trusted-surface navigation policy in `core/adapters/platform/securityPolicy.js` to block remote navigation from trusted roles.
- Hardened privileged IPC checks in `main.js` using sender identity + surface role + `senderFrame.url` trust checks.
- Removed dead `ui-shell:editor-*` preload bridge methods from `ui/shell/preload.js` so exposed API matches live contracts.
- Tightened internal CSP coverage by adding panel CSP meta in `core/history/panel.js`.
- Escaped dynamic settings HTML interpolation (title/path) in `core/settings/page.js`.
- Added runtime security smoke scenario and script:
  - `tests/smoke/electron-security-boundary.smoke.js`
  - `npm run test:smoke:security`
- Updated `ci:test` script to include security smoke gate.
- Updated Phase 05 artifact and master plan status/handoff to Phase 06.

### Decisions
- Use strict trusted-surface remote-navigation blocking in Phase 05 rather than introducing a new unprivileged isolation surface in this phase.
- Add a smoke-test-only privileged IPC probe channel (`security:probe-privileged-ipc`) gated by `NOCTRA_SMOKE_TEST=1` for deterministic unauthorized sender/frame rejection proof.

### Verification
- Passed: `npm test`.
- Passed: `npm run test:smoke`.
- Passed: `npm run test:smoke:overlay`.
- Passed: `npm run test:smoke:ui-cadence`.
- Passed: `npm run test:smoke:security`.
- Failed: n/a.

### Risks/Notes
- Trusted-surface URL allowlist currently permits internal data URLs and `about:blank`; if future trusted internal surfaces use `file:` or custom schemes, update allowlist + tests together.

### Next Session Start Here
- Execute `docs/hardening/phase-06-ci-proof-gate-alignment.md` step 1: define and enforce canonical CI hardening gate command and workflow alignment.

### Conditions Closeout Addendum
- Closed senior-reviewer high condition by gating preload probe export:
  - `ui/shell/preload.js` now exposes `probePrivilegedIpc` only when `NOCTRA_SMOKE_TEST=1`.
- Clarified proof semantics in Phase 05 artifact to avoid overclaiming hostile-renderer E2E equivalence.
- Recorded trusted-surface URL-allowance follow-up as monitoring (Phase 06/07), non-blocking for Phase 05.

## Session 2026-05-08 #13
### Objective
- Convert independent senior/security review findings into an executable multi-phase closeout plan to reach verifiable OSS readiness.

### Completed
- Added new hardening closeout phases:
  - `docs/hardening/phase-05-security-boundary-closure.md`
  - `docs/hardening/phase-06-ci-proof-gate-alignment.md`
  - `docs/hardening/phase-07-adapter-truth-reconciliation.md`
  - `docs/hardening/phase-08-oss-readiness-certification.md`
- Updated master plan `docs/hardening/00_master_plan.md` to:
  - add phases 05-08 with dependency ordering,
  - mark phase 04 as done but requiring re-review alignment,
  - replace stale gap snapshot with review-derived open blockers,
  - add explicit independent re-review requirement under OSS readiness gate,
  - set active phase to 05 with next exact step.

### Decisions
- Treat independent implementation review findings as authoritative closeout blockers until resolved and re-reviewed.
- Split closeout into security-first then CI-proof then architecture-truth then certification phases to preserve rollback safety and auditability.

### Verification
- Passed: hardening documentation consistency check across new phase files and master plan references.
- Failed: n/a.

### Risks/Notes
- This session adds planning artifacts only; code-level OSS blockers identified by independent review remain open until phase 05+ execution.

### Next Session Start Here
- Execute `docs/hardening/phase-05-security-boundary-closure.md` step 1 and begin security boundary closure implementation.

## Session 2026-05-08 #12
### Objective
- Complete remaining Phase 04 parity gate by automating statusline/tabline/urlline update-cadence verification and close phase exit criteria.

### Completed
- Added UI cadence smoke scenario path in `main.js` (`NOCTRA_SMOKE_SCENARIO=ui-cadence`) with cadence counters for:
  - `uiShell.renderTabline`,
  - `uiShell.renderUrlline`,
  - `uiShell.updateStatuslineMode`.
- Added smoke runner `tests/smoke/electron-ui-cadence.smoke.js`.
- Added script `test:smoke:ui-cadence` and updated `ci:test` to include it.
- Ran and passed:
  - `npm test` (22/22),
  - `npm run test:smoke`,
  - `npm run test:smoke:overlay`,
  - `npm run test:smoke:ui-cadence`,
  - `npm run ci:test`.
- Updated Phase 04 artifact to mark:
  - behavior parity checklist complete,
  - validation checklist complete,
  - exit criteria complete.
- Updated master plan status table to mark Phase 04 as `done` and handoff to OSS readiness final review.

### Decisions
- Use deterministic smoke-time cadence counters for contract-level UI update verification instead of ad-hoc manual cadence checks.

### Verification
- Passed: `npm test`.
- Passed: `npm run test:smoke`.
- Passed: `npm run test:smoke:overlay`.
- Passed: `npm run test:smoke:ui-cadence`.
- Passed: `npm run ci:test`.
- Failed: n/a.

### Risks/Notes
- Phase 04 is complete; remaining project-level risk tracking continues under OSS-readiness final review and risk register items.

### Next Session Start Here
- Run OSS readiness final review against remaining gate items and open risks in `docs/hardening/00_master_plan.md`.

## Session 2026-05-08 #11
### Objective
- Strengthen Phase 04 step-6 parity verification by turning remaining manual startup/overlay checks into deterministic smoke automation.

### Completed
- Added smoke scenario path in `main.js` (`NOCTRA_SMOKE_SCENARIO=overlay-panel-split`) to exercise:
  - history panel show/focus/unfocus,
  - regular split open/focus-left/focus-right/close,
  - startup-to-shutdown lifecycle completion.
- Added smoke runner `tests/smoke/electron-overlay-panel-split.smoke.js`.
- Added script `test:smoke:overlay` and updated `ci:test` to include both smoke checks.
- Ran and passed:
  - `npm test` (22/22),
  - `npm run test:smoke`,
  - `npm run test:smoke:overlay`.
- Updated Phase 04 artifact validation/checklists to mark startup, overlay/panel, and buffer lifecycle parity checks complete via automated scripts.
- Updated master plan handoff to remaining statusline/tabline/urlline cadence parity check.

### Decisions
- Prefer deterministic smoke automation for lifecycle parity where feasible, while keeping higher-fidelity UI cadence parity as a final explicit check.

### Verification
- Passed: `npm test`.
- Passed: `npm run test:smoke`.
- Passed: `npm run test:smoke:overlay`.
- Failed: n/a.

### Risks/Notes
- Statusline/tabline/urlline cadence parity still requires final targeted verification before Phase 04 closeout.

### Next Session Start Here
- Validate statusline/tabline/urlline update-cadence parity and complete Phase 04 exit checklist.

## Session 2026-05-08 #10
### Objective
- Execute Phase 04 step 6 by removing remaining transitional passthrough indirection after adapter extraction.

### Completed
- Removed transitional security policy passthrough wrappers in `main.js`:
  - removed `registerSessionSecurityPolicy()` wrapper,
  - removed `registerWebContentsSecurityPolicy()` wrapper,
  - removed wrapper-only registration flags tied to those functions.
- Updated app startup wiring to invoke adapter contracts directly in `app.whenReady()` while preserving sequence/order.
- Updated Phase 04 artifact:
  - marked step 6 complete,
  - documented cleanup implementation and validation evidence,
  - updated handoff to manual parity validation and phase exit checklist.
- Updated master plan handoff next action to run manual parity scripts and closeout checklist.

### Decisions
- Keep startup orchestration explicit in `main.js`, but avoid wrapper indirection when adapter contracts are already stable and directly consumable.

### Verification
- Passed: `npm test` (22/22).
- Passed: `npm run test:smoke`.
- Failed: n/a.

### Risks/Notes
- Manual parity scripts remain required before marking phase-level behavior checklist and exit gates fully complete.

### Next Session Start Here
- Run manual parity validation scripts in `phase-04-adapter-deepening-monolith-split.md` and complete phase exit checklist.

## Session 2026-05-08 #09
### Objective
- Execute Phase 04 step 5 by adding focused tests for extracted adapter boundaries and lifecycle-sensitive registration/teardown behavior.

### Completed
- Added `tests/adapter-contracts.test.js` with contract coverage for:
  - `core/adapters/platform/ipcRegistry.js` (event/handler registration + symmetric teardown),
  - `core/adapters/platform/securityPolicy.js` (deny-all permissions + blocked window/navigation behavior),
  - `core/adapters/renderer/panelRenderTransport.js` (debounce and cancellation behavior).
- Updated Phase 04 artifact:
  - marked step 5 complete,
  - documented test strategy and validation evidence,
  - advanced handoff to step 6.
- Updated master plan handoff next action to Phase 04 step 6.

### Decisions
- Keep step-5 coverage lightweight and deterministic with stubs/mocks using built-in Node test tooling only (no new dependencies).

### Verification
- Passed: `npm test` (22/22).
- Passed: `npm run test:smoke`.
- Failed: n/a.

### Risks/Notes
- Step 6 cleanup must preserve newly asserted contracts (especially IPC teardown symmetry and security deny behavior).

### Next Session Start Here
- Execute `phase-04-adapter-deepening-monolith-split.md` step 6: remove temporary/deprecated passthroughs after parity verification.

## Session 2026-05-08 #08
### Objective
- Execute Phase 04 step 4 by continuing incremental splits on a medium-risk main-process slice.

### Completed
- Added platform adapter `core/adapters/platform/securityPolicy.js` and moved main-process security registration concerns behind adapter functions.
- Added platform adapter `core/adapters/platform/ipcRegistry.js` for centralized IPC event/handler registration and teardown.
- Refactored `main.js` to delegate security policy and IPC primitive wiring to adapters while preserving orchestration order and sender-guard behavior.
- Updated Phase 04 artifact:
  - marked step 4 complete,
  - documented implementation and validation evidence,
  - advanced handoff to step 5.
- Updated master plan handoff next action to Phase 04 step 5.

### Decisions
- Keep adapter extraction contract-preserving: no channel renames, no sender-validation broadening, and no change to policy outcomes (deny/notify behavior unchanged).

### Verification
- Passed: `npm test`.
- Passed: `npm run test:smoke`.
- Failed: n/a.

### Risks/Notes
- Higher-risk overlay and browser-manager splits are intentionally deferred until adapter contract tests are expanded in step 5.

### Next Session Start Here
- Execute `phase-04-adapter-deepening-monolith-split.md` step 5: add/update focused tests for extracted adapter contracts and lifecycle ordering.

## Session 2026-05-08 #07
### Objective
- Execute Phase 04 step 3 by extracting the first low-risk decomposition slice from `core/history/panel.js` behind adapter boundaries.

### Completed
- Added platform adapter `core/adapters/platform/panelViewHost.js` for sidepanel BrowserView lifecycle concerns:
  - hardened BrowserView creation,
  - attach/show/hide/focusTop operations,
  - host teardown.
- Added renderer adapter `core/adapters/renderer/panelRenderTransport.js` for debounced data-URL render transport.
- Refactored `core/history/panel.js` to consume `viewHost` and `renderTransport` adapters instead of direct BrowserView/render timer wiring.
- Updated Phase 04 artifact:
  - marked step 3 complete,
  - documented implementation and validation evidence,
  - advanced handoff to step 4.
- Updated master plan handoff next action to Phase 04 step 4.

### Decisions
- Keep history/bookmark tree state machine and key handling in `core/history/panel.js` for this slice; extract only Electron host + render transport concerns.

### Verification
- Passed: `npm test`.
- Passed: `npm run test:smoke`.
- Failed: n/a.

### Risks/Notes
- Manual parity checks for panel/overlay z-order and startup/shutdown are still required before marking broader parity checklist items complete.

### Next Session Start Here
- Execute `phase-04-adapter-deepening-monolith-split.md` step 4: continue incremental splits, starting with `main.js` security policy + IPC registry extraction.

## Session 2026-05-08 #06
### Objective
- Execute Phase 04 step 2 by defining the target ownership map for orchestration, platform adapters, renderer adapters, and UI domain services.

### Completed
- Completed Phase 04 step 2 in `docs/hardening/phase-04-adapter-deepening-monolith-split.md`.
- Added Step 2 ownership table with explicit mapping for:
  - current module responsibility slices,
  - target owner,
  - proposed module path,
  - public contract shape,
  - lifecycle sensitivity and dependencies.
- Added no-crossing rules to prevent adapter leakage and preserve clean boundaries during extraction.
- Added step-2 outcome extraction order for step 3+.
- Updated Phase 04 handoff to step 3.
- Updated master plan handoff next action to Phase 04 step 3.

### Decisions
- Keep `main.js` as orchestration-only after extraction; move Electron policy and transport concerns into adapters with explicit register/unregister contracts.

### Verification
- Passed: hardening documentation consistency check (phase file + master plan + changelog aligned).
- Failed: n/a.

### Risks/Notes
- High-risk slices remain unchanged (`ui/shell/manager.js` overlay stack/layout and `browser/manager.js` split/devtools host). Keep those after low-risk panel extraction.

### Next Session Start Here
- Execute `phase-04-adapter-deepening-monolith-split.md` step 3: extract first decomposition slice (`core/history/panel.js` BrowserView host boundary) and validate parity.

## Session 2026-05-08 #05
### Objective
- Execute Phase 04 step 1 by producing a direct Electron/WebContents/BrowserView call inventory and selecting the first low-risk decomposition slice.

### Completed
- Completed Phase 04 step 1 in `docs/hardening/phase-04-adapter-deepening-monolith-split.md`.
- Added a migration-oriented inventory table grouped by module with:
  - representative direct callsites,
  - target ownership (orchestration vs adapter/domain),
  - migration priority,
  - parity risk notes.
- Added step-1 outcome note selecting `core/history/panel.js` BrowserView host boundary as the first low-risk extraction candidate for step 3.
- Updated Phase 04 handoff to step 2.
- Updated master plan handoff next action to Phase 04 step 2.

### Decisions
- Use a migration-oriented inventory format (module -> callsite -> target owner -> risk) rather than API-count-only audit format to guide safe incremental split ordering.

### Verification
- Passed: documentation parity check across hardening artifacts (phase file + master plan + changelog updated consistently).
- Failed: n/a.

### Risks/Notes
- `ui/shell/manager.js` and split/devtools paths in `browser/manager.js` remain highest-risk slices due to z-order and lifecycle timing sensitivity.

### Next Session Start Here
- Execute `phase-04-adapter-deepening-monolith-split.md` step 2: define target ownership map (orchestration vs adapter vs UI domain service).

## Session 2026-05-08 #04
### Objective
- Close Phase 03 by finalizing stabilization evidence, checklists, and handoff to Phase 04.

### Completed
- Completed Phase 03 step 6 by finalizing stabilization/troubleshooting status in `docs/hardening/phase-03-invariants-tests-ci.md`.
- Marked all remaining Phase 03 behavior parity, validation, and exit criteria items complete.
- Updated Phase 03 handoff to start Phase 04 step 1.
- Updated master plan status table:
  - Phase 03 -> `done`
  - Phase 04 -> `in progress`
- Updated OSS readiness gate items for invariants/tests/smoke CI to complete in `docs/hardening/00_master_plan.md`.

### Decisions
- Keep smoke scope minimal and deterministic (startup/core shell path) to preserve CI reliability while deferring broader interactive coverage to future slices.

### Verification
- Passed: `npm test` (18/18).
- Passed: `npm run test:smoke`.
- Failed: n/a.

### Risks/Notes
- Phase 04 remains the primary remaining OSS hardening risk area due to direct Electron coupling and monolithic module churn.

### Next Session Start Here
- Execute `phase-04-adapter-deepening-monolith-split.md` step 1: produce direct Electron/WebContents/BrowserView call inventory by module.

## Session 2026-05-08 #03
### Objective
- Start and implement core Phase 03 gates: invariant enforcement, contract tests, smoke test, and CI wiring.

### Completed
- Introduced invariant severity/enforcement policy in `core/invariants.js`:
  - critical invariants fail-fast in dev/CI (`NODE_ENV=development`, `CI=true`, or `NOCTRA_INVARIANTS=strict`)
  - advisory invariants remain warn-only.
- Promoted dispatcher intent coverage gap detection to invariant enforcement in `core/dispatcher.js`.
- Added focused contract tests:
  - `tests/invariants-enforcement.test.js`
  - `tests/resolver-contracts.test.js`
  - `tests/grammar-primitives-contracts.test.js`
- Added Electron startup smoke test:
  - `tests/smoke/electron-startup.smoke.js`
  - `main.js` smoke auto-exit path gated by `NOCTRA_SMOKE_TEST=1`.
- Added CI scripts in `package.json`: `test:smoke`, `ci:test`.
- Added GitHub Actions workflow: `.github/workflows/ci.yml` (unit + smoke).
- Updated Phase 03 artifact with classification table, completed steps 1-5, and initial troubleshooting notes.

### Decisions
- Keep OSS readiness gates dependency-light for now using Node built-in tests and a minimal Electron smoke harness.

### Verification
- Passed: `npm test`.
- Passed: `npm run test:smoke`.
- Failed: n/a.

### Risks/Notes
- CI smoke stability still needs first feedback loop on hosted runners (Phase 03 step 6 remains open).

### Next Session Start Here
- Execute `phase-03-invariants-tests-ci.md` step 6: stabilize flaky checks and refine troubleshooting.

## Session 2026-05-08 #02
### Objective
- Complete remaining Phase 02 work: runtime reload determinism, tests, and parity validation.

### Completed
- Added a centralized config-application path for reload transactions in `main.js` (`applyReloadedConfig`).
- Added runtime key-sequence safety reset on reload (leader/key/count buffers) to prevent stale-prefix behavior.
- Kept hot-reload behavior for keymap updates from settings save, including immediate shortcut label refresh.
- Added Node built-in tests (`node:test`) for keymap contract coverage:
  - `tests/config-schema-keymap.test.js`
  - `tests/grammar-keymap-conflicts.test.js`
  - `tests/input-priority-mode-scope.test.js`
- Added test scripts in `package.json`: `test`, `test:keymap`.
- Updated Phase 02 artifact to mark steps 5/6/7 complete and document runtime reload behavior + test strategy.
- Updated master plan to mark Phase 02 done and activate Phase 03.

### Decisions
- Preserve lightweight OSS test tooling for this phase using Node built-ins (no third-party test framework added yet).

### Verification
- Passed: `npm test` (10/10 tests).
- Passed: user-confirmed parity during app usage after keymap architecture changes.
- Failed: n/a.

### Risks/Notes
- Tree-domain-only actions in `core/history/panel.js` remain intentionally panel-local and outside user override scope in this phase.

### Next Session Start Here
- Execute `phase-03-invariants-tests-ci.md` step 1: classify invariants as critical vs advisory.

## Session 2026-05-08 #01
### Objective
- Start Phase 02 keymap architecture completion by moving normal/mod maps to canonical config-backed layering.

### Completed
- Implemented data-driven defaults for `keymap.normal` and `keymap.mod` in `core/config/defaults.js`.
- Extended config normalization to merge user overrides onto defaults for normal/mod maps with action-id validation.
- Switched runtime keymap resolution (`motions/keymap.js`) to effective config values for normal/mod mappings.
- Updated shortcut label discovery in `main.js` to use effective config keymaps (normal/mod) instead of static constants.
- Updated generated `config.yml` comments in `core/config/service.js` to document keymap scope and shape.
- Updated Phase 02 artifact with source inventory table and documented precedence/conflict rules.

### Decisions
- Keep tree-domain-only actions (bookmark/history-specific edit/delete/filter operations) panel-local for now; only shared NORMAL/mod motions are moved to canonical config-backed keymap layer in this slice.

### Verification
- Passed: module load/syntax check for changed non-Electron modules (`defaults/schema/service/keymap`).
- Not run: full app parity validation and runtime reload matrix.
- Failed: n/a.

### Risks/Notes
- `core/history/panel.js` still contains tree-local hardcoded bindings that intentionally bypass user override until explicitly migrated.

### Next Session Start Here
- Execute `phase-02-keymap-architecture-completion.md` step 5: verify and document deterministic runtime reload behavior for normal/mod/leader maps.

## Session 2026-05-07 #02
### Objective
- Complete Phase 01 security boundary lockdown for OSS-readiness gate items.

### Completed
- Completed trusted/untrusted surface inventory across BrowserWindow/BrowserView creation paths.
- Removed privileged preload bridge exposure from untrusted web buffers, including reopen/split paths.
- Replaced generic renderer bridge (`emit/invoke`) and generic IPC request/event channels with explicit contracts.
- Added sender-scoped checks for internal shell channels and editable settings channels.
- Switched settings editor to local vendored CodeMirror runtime assets; removed CDN runtime dependencies.
- Added strict CSP to internal shell/settings surfaces.
- Applied consistent BrowserView hardening (`contextIsolation`, `nodeIntegration`, `sandbox`, `webviewTag`) on internal surfaces.
- Updated phase/master artifacts to mark Phase 01 complete and activate Phase 02.

### Decisions
- Continue enforcing explicit IPC contracts and sender scoping as a hard requirement for future internal surfaces.

### Verification
- Passed: manual exploit checks (bridge absence on untrusted pages, unauthorized sender rejection).
- Passed: baseline behavior parity checks (browsing/tab ops, command/urlline/telescope, sidepanel workflows).
- Passed: settings editor offline behavior without remote runtime asset requests.
- Failed: n/a.

### Risks/Notes
- Reopen/split/new buffer creation paths remain a high-sensitivity area for accidental privileged preload regressions.

### Next Session Start Here
- Execute `phase-02-keymap-architecture-completion.md` step 1: produce keymap source inventory table by mode/context.

## Session 2026-05-07 #01
### Objective
- Initialize post-migration hardening tracking using the same structure as `docs/migration/`.

### Completed
- Added hardening master plan at `docs/hardening/00_master_plan.md`.
- Added phase artifacts:
  - `docs/hardening/phase-01-security-boundary-lockdown.md`
  - `docs/hardening/phase-02-keymap-architecture-completion.md`
  - `docs/hardening/phase-03-invariants-tests-ci.md`
  - `docs/hardening/phase-04-adapter-deepening-monolith-split.md`
- Added hardening changelog at `docs/hardening/CHANGELOG.md`.
- Set initial execution state:
  - Phase 01 `in progress`
  - Phase 02/03/04 `not started`

### Decisions
- DEC-H01: Track post-migration hardening in `docs/hardening/` with master plan + per-phase files + session changelog.

### Verification
- Passed: structure parity with migration docs pattern
- Failed: n/a
- Not run: code-level hardening changes (documentation-only session)

### Risks/Notes
- Hardening order must remain strict to avoid compounding regressions.

### Next Session Start Here
- Execute `phase-01-security-boundary-lockdown.md` step 1: trusted/untrusted surface inventory across BrowserWindow/BrowserView creation paths.
