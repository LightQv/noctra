# Phase 01 - Security Boundary Lockdown

## Goal
Eliminate high-risk trust-boundary issues before further architectural work.

## In Scope
- Separate trusted internal UI preload from untrusted web buffer surfaces
- Tighten IPC contracts and sender validation
- Remove remote runtime assets from privileged internal pages
- Enforce consistent hardened webPreferences on BrowserView surfaces

## Out of Scope
- Keymap architecture redesign
- Broad adapter decomposition
- Non-security feature work

## Primary Current Files
- `browser/manager.js`
- `main.js`
- `ui/shell/preload.js`
- `ui/shell/manager.js`
- `core/history/panel.js`
- `core/settings/page.js`

## Planned Outputs
- Trusted/untrusted preload split with explicit usage rules
- Explicit IPC APIs with payload validation and sender allowlists
- Local-vendored settings editor assets and strict internal CSP
- Hardened BrowserView preferences consistently applied

## Steps
1. [x] Audit all BrowserView/Window creation sites and classify trusted vs untrusted surfaces.
2. [x] Remove preload bridge from untrusted web buffers (including reopen/split paths).
3. [x] Replace generic renderer bridge (`emit/invoke`) with explicit IPC contracts.
4. [x] Add sender allowlist enforcement for internal IPC channels.
5. [x] Vendor internal settings editor assets locally; remove CDN runtime dependencies.
6. [x] Add strict CSP for internal UI surfaces.
7. [x] Apply consistent hardened `webPreferences` everywhere applicable.
8. [x] Run targeted manual exploit checks and baseline behavior parity checks.

## Behavior Parity Checklist
- [x] Normal browsing and tab operations unchanged
- [x] Command mode, urlline, and telescope workflows unchanged
- [x] Sidepanel history/bookmark workflows unchanged
- [x] Settings editor still works offline without remote runtime loads

## Validation
- [x] Manual: untrusted page cannot access privileged bridge (`window.uiShell` absent)
- [x] Manual: unauthorized sender rejected by IPC handlers
- [x] Manual: settings/internal surfaces load without remote script/css requests
- [x] Manual: baseline keyflow scripts A/B/C still pass

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Internal UI breaks due to preload split | trusted surface misclassification | inventory all trusted surfaces before switch |
| IPC contract migration misses a caller | generic bridge removed too early | introduce explicit contracts first, then remove generic path |
| CSP blocks required scripts/styles | overly strict policy | start report-only or staged policy in dev, then enforce |

## Exit Criteria
- [x] No privileged bridge exposed to untrusted content
- [x] IPC contract surface explicit and sender-validated
- [x] No remote runtime assets in internal privileged pages
- [x] BrowserView hardening baseline applied consistently
- [x] Phase status updated in master plan

## Handoff Notes
- Done:
  - Completed trusted/untrusted surface inventory for all BrowserWindow/BrowserView creation sites.
  - Removed privileged preload from untrusted web buffer paths, including reopen and split flows.
  - Replaced generic preload bridge and IPC channels with explicit APIs/channels.
  - Added sender checks scoped to window shell vs editable settings surfaces.
  - Replaced remote settings editor runtime assets with local vendored assets.
  - Added strict CSP to internal UI surfaces and hardened BrowserView webPreferences consistently.
  - Passed manual exploit checks and baseline behavior parity checks.
- Remaining:
  - none.
- Known pitfalls:
  - Reopen/split buffer paths can silently reintroduce privileged preload if future buffer creation bypasses centralized defaults.
- Next exact step:
  - Execute `phase-02-keymap-architecture-completion.md` step 1: keymap source inventory by mode/context.
