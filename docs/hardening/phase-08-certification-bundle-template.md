# Phase 08 OSS Certification Bundle Template

Bundle ID: phase08-oss-cert-2026-05-09-f7c03c0
Prepared by: OpenCode session
Date: 2026-05-09
Branch: rework/hardening_09
Commit SHA: f7c03c0

## 1) Hosted CI Evidence (Required)
- Workflow URL: <url>
- Job name: <job>
- Commit SHA tested: <sha>
- Canonical command: `xvfb-run -a npm run ci:test`
- Result: <pass/fail>
- Timestamp (UTC): <time>

### Check Matrix (Hosted)
- [ ] `npm test` (pass)
- [ ] `npm run test:smoke` (pass)
- [ ] `npm run test:smoke:overlay` (pass)
- [ ] `npm run test:smoke:ui-cadence` (pass)
- [ ] `npm run test:smoke:security` (pass)

Evidence refs:
- <log/screenshot ref 1>
- <log/screenshot ref 2>

## 2) Local Reproduction Evidence (Required)
- Environment: darwin, Node v23.11.0, npm 10.9.2
- Date/time (UTC): 2026-05-09T12:06:07Z
- Command: `npm run ci:test`
- Result: pass
- Retries/flakes: none

Evidence refs:
- local CLI transcript: `npm run ci:test` (2026-05-09 UTC, this session)

## 3) Security Boundary Proof (Phase 05 Carry-through)
- [ ] Untrusted content has no privileged bridge (`window.uiShell` absent)
- [ ] Privileged IPC rejects unauthorized sender/frame/origin
- [ ] Trusted internal surfaces block remote navigation
- [ ] Disallowed `window.open` and navigation behavior is blocked

Evidence refs:
- `tests/smoke/electron-security-boundary.smoke.js`
- <security smoke output ref>
- <optional focused test ref>

Notes:
- <any caveat>

## 4) Parity and Regression Proof
- [ ] Browsing and tab operations unchanged
- [ ] Command, urlline, and telescope unchanged
- [ ] Sidepanel history and bookmark workflows unchanged
- [ ] Statusline, tabline, and urlline cadence unchanged

Evidence refs:
- `npm run test:smoke`
- `npm run test:smoke:overlay`
- `npm run test:smoke:ui-cadence`
- <local/hosted outputs>

## 5) Master Plan Reconciliation (`docs/hardening/00_master_plan.md`)

### Current Gap Snapshot
- Removed stale statements:
  - <item 1>
  - <item 2>
- Remaining active gaps:
  - <item>

### Global Hardening Gates
- [ ] No user-visible behavior regressions (evidence: <refs>)
- [ ] Trust-boundary changes documented (evidence: <refs>)
- [ ] Checklist, validation, and exit criteria complete (evidence: <refs>)
- [ ] Session handoff updated (evidence: <ref>)

### OSS Readiness Gate
- [ ] Untrusted content has no privileged preload bridge (evidence: <refs>)
- [ ] IPC contracts explicit, validated, sender-allowlisted (evidence: <refs>)
- [ ] Internal pages do not load remote runtime assets (evidence: <refs>)
- [ ] Hardened BrowserView preferences consistently applied (evidence: <refs>)
- [x] Keymap layering implemented
- [x] Critical invariants fail in dev/CI
- [x] Unit tests cover resolver/parser/dispatcher
- [x] Electron smoke tests run in CI
- [ ] Independent re-review verdict ready/ready-with-conditions and no open critical/high must-fix (evidence: <refs>)

Residual notes (required):
- <explicitly restate Phase 07 deferred extraction debt as non-blocking for certification>

## 6) Risk Register Disposition
For each risk line in master plan:
- Risk: <name>
- Previous: open
- New status: <mitigated/monitoring/accepted>
- Rationale: <1-2 lines>
- Evidence: <refs>
- Owner: <owner>
- Reopen trigger: <trigger>

## 7) Independent Re-Review Dossier (Required)

### senior-reviewer
- Run date: 2026-05-09
- Verdict: `READY_WITH_CONDITIONS`
- Critical/high must-fix findings: none
- Evidence ref: OpenCode task result (`senior-reviewer`, task id `ses_1f362a2a5ffe3keRSEd4I3KPfK`)

### security-engineer
- Run date: 2026-05-09
- Verdict: `READY`
- Critical/high must-fix findings: none
- Evidence ref: OpenCode task result (`security-engineer`, task id `ses_1f362a2aeffeU6VbkfUGC4newW`)

If findings exist:
- Finding ID: <id>
- Fix summary: <summary>
- Verification rerun: <commands + result>
- Re-review outcome: <updated verdict>

## 8) Final Closeout

### Changelog Entry (`docs/hardening/CHANGELOG.md`)
- Objective: <text>
- Completed: <bullets>
- Decisions: <bullets>
- Verification: <commands/results>
- Risks/Notes: <bullets>
- Next Session Start Here: none (hardening complete)

### Final Master Plan Status
- Phase 08: done
- Active phase: none
- Blockers: none
- Final handoff: hardening plan complete

---

## Final Validation Checklist
- [ ] Hosted canonical gate passed
- [x] Local canonical gate passed
- [ ] Master plan gates evidence-backed
- [ ] Risk register reclassified with rationale
- [x] Both independent reviews completed
- [x] No open critical/high must-fix finding
- [ ] Changelog final closeout entry prepared
- [ ] Phase 08 marked done
