# Phase 03 - Invariants, Tests, and CI Gates

## Goal
Turn architecture and security expectations into enforceable regression gates.

## In Scope
- Promote critical invariants from warn-only to fail-fast in dev/CI
- Add focused unit tests around critical boundaries
- Add Electron smoke tests for core workflows
- Wire checks into CI with deterministic pass/fail signals

## Out of Scope
- Major UI redesign
- Deep adapter decomposition (Phase 04)
- Non-critical test expansion beyond boundary coverage

## Primary Current Files
- `core/invariants.js`
- `core/inputPriorityResolver.js`
- `core/focusResolver.js`
- `core/semanticContextResolver.js`
- `core/dispatcher.js`
- `motions/grammarPrimitives.js`
- CI workflow files (to be added/updated)

## Planned Outputs
- Critical invariant catalog with enforcement mode by environment
- Unit tests for resolver/parser/dispatcher contracts
- Electron smoke tests for modal and shell workflows
- CI pipeline running lint/test/build/smoke gates

## Steps
1. [x] Classify invariants as critical vs advisory.
2. [x] Promote critical invariants to fail-fast behavior in dev/CI.
3. [x] Add unit tests for resolver + grammar + dispatch contracts.
4. [x] Add Electron smoke tests for key interactive flows.
5. [x] Add CI workflows and required checks for merge safety.
6. [x] Stabilize flaky checks and document troubleshooting.

## Behavior Parity Checklist
- [x] Existing workflows pass with invariants enabled
- [x] No false-positive invariant failures in normal operation
- [x] Test suite reflects current architecture boundaries accurately

## Validation
- [x] CI run passes on clean branch
- [x] Local runbook verifies test/smoke sequence (`npm test`, `npm run test:smoke`)
- [x] At least one intentional invariant violation fails as expected (covered in `tests/invariants-enforcement.test.js`)

## Invariant Classification Table
| Invariant | Severity | Dev/CI behavior | Production behavior | Owner location |
|---|---|---|---|---|
| Input must be normalized `keyDown` | critical | throw | warn | `core/invariants.js#assertInputPipelinePreconditions` |
| Priority resolver output must exist/object | critical | throw | warn | `core/invariants.js#assertInputPipelinePreconditions` |
| Focus snapshot must exist/object | critical | throw | warn | `core/invariants.js#assertInputPipelinePreconditions` |
| Intent must include string `type` | critical | throw | warn | `core/invariants.js#assertIntentShape` |
| Known intents must have handlers | critical | throw | warn | `core/dispatcher.js#warnOnIntentCoverageGaps` |
| Mode write boundary desync | advisory | warn | warn | `core/invariants.js#assertModeWriteBoundary` |

## CI Gate Scope (current)
- Unit contracts: `npm test`
- Electron startup smoke: `npm run test:smoke`
- GitHub Actions workflow: `.github/workflows/ci.yml`

## Troubleshooting (initial)
- Linux CI smoke tests require a display server wrapper (`xvfb-run -a`).
- If invariant failures block local debugging, keep production-like behavior with `NODE_ENV=production` and no `NOCTRA_INVARIANTS=strict`.
- To force fail-fast locally outside CI, set `NOCTRA_INVARIANTS=strict`.

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Excessive invariant failures block dev flow | over-broad critical set | start with minimal critical set and expand |
| Flaky Electron smoke tests | timing-sensitive UI lifecycle | deterministic wait helpers and reduced scope |
| CI cost/time too high | oversized test matrix | split fast gates vs nightly gates |

## Exit Criteria
- [x] Critical invariants enforce in CI
- [x] Core boundary tests pass consistently
- [x] CI gating documented and active
- [x] Phase status updated in master plan

## Handoff Notes
- Done:
  - Classified invariants into critical/advisory and documented env-specific behavior.
  - Promoted critical invariants to fail-fast in dev/CI with advisory invariants warn-only.
  - Added contract tests for invariants enforcement, resolver behavior, and grammar primitive boundaries.
  - Added Electron startup smoke test and wired CI workflow gates.
- Remaining:
  - none.
- Known pitfalls:
  - If critical/advisory split is unclear, CI noise can hide real regressions.
- Next exact step:
  - Execute `phase-04-adapter-deepening-monolith-split.md` step 1: produce direct Electron call inventory table.
