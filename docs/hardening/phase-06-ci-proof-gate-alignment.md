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
1. [ ] Define canonical hardening gate command for OSS (`ci:test` or replacement) in `package.json`.
2. [ ] Ensure command includes all required checks:
   - unit/contracts,
   - startup smoke,
   - overlay/split smoke,
   - UI cadence smoke,
   - new security smoke checks from Phase 05.
3. [ ] Update `.github/workflows/ci.yml` to run canonical hardening gate.
4. [ ] Decide and document build/package and dependency vulnerability gate policy:
   - add build gate if release policy requires it,
   - add dependency gate (`npm audit`/SCA) with explicit threshold policy.
5. [ ] Add CI troubleshooting notes for deterministic reruns.
6. [ ] Run local dry-run equivalent and one hosted CI run confirmation.

## Validation
- [ ] `npm run ci:test`
- [ ] GitHub Actions run passes using same gate set
- [ ] Workflow file and docs reference same command list

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| CI runtime increase slows iteration | expanded smoke/security suite | keep split between required hardening gate and optional nightly jobs |
| Hosted runner flakiness | timing-sensitive Electron tests | deterministic waits, explicit retry guidance for known transient failures |
| Drift between docs and workflow | manual updates in one place only | keep canonical command in package scripts and reference it from docs/workflow |

## Exit Criteria
- [ ] CI enforces full hardening proof matrix required for closeout
- [ ] No required hardening check is local-only
- [ ] Workflow/docs alignment verified and documented
- [ ] Phase status updated in master plan

## Handoff Notes
- Done:
  - none.
- Remaining:
  - full phase execution.
- Known pitfalls:
  - adding scripts without workflow updates reintroduces false confidence.
- Next exact step:
  - Execute step 1: define canonical hardening gate command and required check list.
