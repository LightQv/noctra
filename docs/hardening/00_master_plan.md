# Post-Migration Hardening - Master Plan

## Objective
Close post-migration gaps identified in architecture and security reviews while preserving:
- UI appearance
- functionality
- motions
- keybindings
- configs
- workflows
- external behavior

## Constraints
- Prioritize trust-boundary and regression safety first
- No unrelated feature additions during hardening phases
- Keep each phase small, verifiable, and reversible
- Preserve migration architecture direction and module boundaries

## Non-Goals
- Visual redesign
- Plugin architecture expansion
- Broad rewrites outside phase scope
- Documentation repass for user-facing docs (tracked separately)

## Source of Truth
- `docs/migration/00_master_plan.md`
- `docs/migration/CHANGELOG.md`
- Repository code as implemented after migration closeout
- Senior + security review outcomes (2026-05-07)

---

## Phase Overview
| Phase | Name | Status | Depends On | Last Update |
|---|---|---|---|---|
| 01 | Security boundary lockdown | done | - | 2026-05-07 |
| 02 | Keymap architecture completion | done | 01 | 2026-05-08 |
| 03 | Invariants, tests, and CI gates | done | 01, 02 | 2026-05-08 |
| 04 | Adapter deepening + monolith split | done (re-review required) | 03 | 2026-05-08 |
| 05 | Security boundary closure | done | 04 | 2026-05-08 |
| 06 | CI and proof gate alignment | done | 05 | 2026-05-08 |
| 07 | Adapter truth reconciliation | done | 06 | 2026-05-08 |
| 08 | OSS readiness certification | in progress | 05, 06, 07 | 2026-05-08 |

Status values: `not started | in progress | blocked | done`

---

## Current Gap Snapshot
- Independent senior/security re-review found OSS blockers despite phase docs marked done.
- Privileged preload bridges can persist on trusted surfaces if navigation reaches remote content (must be blocked or isolated per surface).
- CI workflow does not enforce the full hardening smoke gate set currently used as closeout evidence.
- Adapter deepening completion is overstated in docs versus actual extraction state in monolithic modules.
- Transitional/dead bridge surfaces remain and need cleanup or explicit wiring/tests.
- Runtime security proof coverage is incomplete for privileged bridge absence and sender/origin rejection paths.

---

## Global Hardening Gates (required each phase)
- [ ] No user-visible behavior regressions in baseline key flows
- [ ] New/changed trust boundaries are explicitly documented in phase artifact
- [ ] All phase checklist items, validation items, and exit criteria completed
- [ ] Session handoff updated with exact next starting step

---

## OSS Readiness Gate
- [ ] Untrusted web content has no privileged preload bridge
- [ ] IPC contracts are explicit, validated, and sender-allowlisted
- [ ] Internal pages do not load remote runtime assets
- [ ] Hardened BrowserView preferences are applied consistently
- [x] Keymap layering implemented: defaults -> user overrides -> runtime guards
- [x] Critical invariants fail in dev/CI (not warn-only)
- [x] Unit tests cover resolvers/parser/dispatcher contracts
- [x] Electron smoke tests run in CI for core flows

Additional closeout requirement before marking OSS gate complete:
- [ ] Independent `senior-reviewer` and `security-engineer` re-review returns `ready` or `ready-with-conditions` with no open critical/high must-fix findings.

---

## Risk Register
| Risk | Impact | Probability | Detection | Mitigation | Status |
|---|---|---|---|---|---|
| Trust-boundary regression while changing preload/IPC | High | Medium | targeted security smoke tests | split trusted vs untrusted surfaces first | open |
| Keymap precedence drift | High | Medium | keymap precedence matrix tests | lock merge order and add conflict assertions | open |
| Invariant noise causing alert fatigue | Medium | Medium | CI signal quality checks | promote only critical invariants to fail-fast first | open |
| Adapter refactor breaks UI lifecycle timing | Medium | Medium | startup/shutdown + overlay parity scripts | slice by domain, verify after each PR | open |

---

## Decision Log (ADR-lite)
### DEC-H01
- Date: 2026-05-07
- Decision: Track post-migration hardening in `docs/hardening/` using same structure as migration docs
- Context: Multi-session execution requires resumable state and strict ordering
- Alternatives considered: append to migration docs, issue-only tracking
- Consequences: better continuity and rollback clarity; requires changelog hygiene each session

---

## Session Handoff
- Last completed phase: 07
- Active phase: 08
- Blockers: independent re-review sign-off pending final certification proof bundle
- Next action: Execute `phase-08-oss-readiness-certification.md` step 1 and assemble latest proof bundle from local and hosted CI evidence.
