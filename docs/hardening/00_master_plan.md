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
| 04 | Adapter deepening + monolith split | in progress | 03 | 2026-05-08 |

Status values: `not started | in progress | blocked | done`

---

## Current Gap Snapshot
- Preload/IPC trust boundary still too broad in some buffer paths
- Internal settings editor loads remote CDN assets
- BrowserView hardening not uniformly enforced across all surfaces
- Invariants are mostly warn-only and not CI-enforced
- Automated regression and security smoke tests are limited
- High-churn modules remain large and tightly coupled

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
- Last completed phase: 03
- Active phase: 04
- Blockers: none
- Next action: Execute `phase-04-adapter-deepening-monolith-split.md` step 1.
