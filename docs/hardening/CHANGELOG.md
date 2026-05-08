# Hardening Session Changelog

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
