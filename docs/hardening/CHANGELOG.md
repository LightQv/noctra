# Hardening Session Changelog

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
