# Phase 06 - CI and Proof Gate Alignment

## Goal
Ensure CI enforces the same hardening proof matrix used for OSS closeout so no critical parity/security evidence remains local-only.

## In Scope
- Canonical hardening gate command definition
- GitHub Actions workflow alignment with full hardening smoke matrix
- Optional build and dependency security checks if required for OSS release policy
- Evidence contract for closeout reproducibility

## Out of Scope
- Security model redesign (Phase 05)
- Major adapter decomposition (Phase 07)
- Non-hardening feature work

## Primary Current Files
- `.github/workflows/ci.yml`
- `package.json`
- `tests/smoke/*`
- `docs/hardening/00_master_plan.md`

## Findings Carried In
- CI currently runs only a subset of smoke checks compared to closeout evidence claims.
- Hardening proof is not fully enforced on hosted runner path.

## Planned Outputs
- Single canonical hardening gate command and workflow usage
- CI workflow that runs full required hardening tests/smokes
- Clear evidence capture for final review and changelog references

## Steps
1. [x] Define canonical hardening gate command for OSS (`ci:test` or replacement) in `package.json`.
2. [x] Ensure command includes all required checks:
   - unit/contracts,
   - startup smoke,
   - overlay/split smoke,
   - UI cadence smoke,
   - new security smoke checks from Phase 05.
3. [x] Update `.github/workflows/ci.yml` to run canonical hardening gate.
4. [x] Decide and document build/package and dependency vulnerability gate policy:
   - add build gate if release policy requires it,
   - add dependency gate (`npm audit`/SCA) with explicit threshold policy.
5. [x] Add CI troubleshooting notes for deterministic reruns.
6. [x] Run local dry-run equivalent and one hosted CI run confirmation.

## Validation
- [x] `npm run ci:test`
- [x] GitHub Actions run passes using same gate set
- [x] Workflow file and docs reference same command list

## Canonical Gate Definition
- Canonical required hardening gate command: `npm run ci:test`.
- Current command contract in `package.json`:
  - `npm test`
  - `npm run test:smoke`
  - `npm run test:smoke:overlay`
  - `npm run test:smoke:ui-cadence`
  - `npm run test:smoke:security`
- CI must execute this contract via `xvfb-run -a npm run ci:test` on Linux hosted runners.

## Gate Policy (Phase 06)
- Required gate for merge safety: canonical hardening command only (`npm run ci:test`).
- Dependency gate policy: add `npm audit --audit-level=high` as informational, non-blocking CI signal in this phase.
- Build/package gate policy: deferred to Phase 08 certification decision; not required in Phase 06 hardening gate.

## CI Troubleshooting Notes
- Always run Electron smoke commands in CI behind `xvfb-run -a` on Linux runners.
- For transient smoke flakes, rerun the job once before escalating; if repeatable, capture failing scenario and timing context.
- Keep smoke checks sequential under canonical gate to avoid inter-test Electron state interference.
- If local/CI divergence appears, verify Node version parity (`20`) and `CI=true` invariant behavior.

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| CI runtime increase slows iteration | expanded smoke/security suite | keep split between required hardening gate and optional nightly jobs |
| Hosted runner flakiness | timing-sensitive Electron tests | deterministic waits, explicit retry guidance for known transient failures |
| Drift between docs and workflow | manual updates in one place only | keep canonical command in package scripts and reference it from docs/workflow |

## Exit Criteria
- [x] CI enforces full hardening proof matrix required for closeout
- [x] No required hardening check is local-only
- [x] Workflow/docs alignment verified and documented
- [x] Phase status updated in master plan

## Handoff Notes
- Done:
  - Confirmed canonical hardening gate command in `package.json` (`ci:test`) includes unit/contracts + startup/overlay/ui-cadence/security smoke checks.
  - Updated `.github/workflows/ci.yml` to run canonical gate (`xvfb-run -a npm run ci:test`) instead of partial smoke subset.
  - Added informational non-blocking dependency audit CI job (`npm audit --audit-level=high`).
  - Documented Phase 06 gate policy: required canonical hardening gate, audit informational, build gate deferred to Phase 08.
  - Added deterministic CI troubleshooting notes for Electron/xvfb reruns.
- Remaining:
  - none.
- Known pitfalls:
  - adding scripts without workflow updates reintroduces false confidence.
- Next exact step:
  - Execute `phase-07-adapter-truth-reconciliation.md` step 1: generate implementation-derived extraction table for reconciliation.
