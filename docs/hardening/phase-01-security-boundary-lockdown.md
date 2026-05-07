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
1. [ ] Audit all BrowserView/Window creation sites and classify trusted vs untrusted surfaces.
2. [ ] Remove preload bridge from untrusted web buffers (including reopen/split paths).
3. [ ] Replace generic renderer bridge (`emit/invoke`) with explicit IPC contracts.
4. [ ] Add sender allowlist enforcement for internal IPC channels.
5. [ ] Vendor internal settings editor assets locally; remove CDN runtime dependencies.
6. [ ] Add strict CSP for internal UI surfaces.
7. [ ] Apply consistent hardened `webPreferences` everywhere applicable.
8. [ ] Run targeted manual exploit checks and baseline behavior parity checks.

## Behavior Parity Checklist
- [ ] Normal browsing and tab operations unchanged
- [ ] Command mode, urlline, and telescope workflows unchanged
- [ ] Sidepanel history/bookmark workflows unchanged
- [ ] Settings editor still works offline without remote runtime loads

## Validation
- [ ] Manual: untrusted page cannot access privileged bridge (`window.uiShell` absent)
- [ ] Manual: unauthorized sender rejected by IPC handlers
- [ ] Manual: settings/internal surfaces load without remote script/css requests
- [ ] Manual: baseline keyflow scripts A/B/C still pass

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Internal UI breaks due to preload split | trusted surface misclassification | inventory all trusted surfaces before switch |
| IPC contract migration misses a caller | generic bridge removed too early | introduce explicit contracts first, then remove generic path |
| CSP blocks required scripts/styles | overly strict policy | start report-only or staged policy in dev, then enforce |

## Exit Criteria
- [ ] No privileged bridge exposed to untrusted content
- [ ] IPC contract surface explicit and sender-validated
- [ ] No remote runtime assets in internal privileged pages
- [ ] BrowserView hardening baseline applied consistently
- [ ] Phase status updated in master plan

## Handoff Notes
- Done:
  - none.
- Remaining:
  - all steps.
- Known pitfalls:
  - Reopen/split buffer paths can silently reintroduce privileged preload.
- Next exact step:
  - Complete step 1 with a file-by-file trusted/untrusted surface inventory.
