# Phase 08 - OSS Readiness Certification

## Goal

Produce final auditable OSS-readiness certification by reconciling implementation, CI evidence, risk posture, and independent reviewer sign-off.

## In Scope

- Master plan gate reconciliation using implementation and CI evidence
- Risk register final status updates with rationale and ownership
- Final hardening changelog closeout entry
- Independent re-review by senior and security reviewers

## Out of Scope

- New feature development
- Additional architecture work not required by gate closure

## Primary Current Files

- `docs/hardening/00_master_plan.md`
- `docs/hardening/CHANGELOG.md`
- `docs/hardening/phase-05-security-boundary-closure.md`
- `docs/hardening/phase-06-ci-proof-gate-alignment.md`
- `docs/hardening/phase-07-adapter-truth-reconciliation.md`

## Dependencies

- Phase 05 complete
- Phase 06 complete
- Phase 07 complete

## Planned Outputs

- Updated master plan with all gate statuses justified by evidence
- Final risk register with no unmanaged critical hardening risk
- Final closeout changelog entry with verification artifacts
- Independent reviewer verdict package
- Completed certification bundle using `docs/hardening/phase-08-certification-bundle-template.md`

## Steps

1. [x] Collect proof bundle (fill in `docs/hardening/phase-08-certification-bundle-template.md`):
   - latest passing CI runs for full hardening gate,
   - relevant test outputs,
   - references to security/parity checks.
2. [ ] Reconcile `Current Gap Snapshot` and remove stale/resolved statements.
3. [ ] Update global hardening gates with evidence references.
4. [ ] Update OSS readiness gates with evidence references and explicit residual notes (if any).
5. [ ] Reclassify risk register items from `open` to `mitigated`, `monitoring`, or `accepted` with rationale.
6. [ ] Run independent re-review:
   - [x] `senior-reviewer` (verdict: `READY_TO_MARK_B_DONE` for Workstream B lifecycle/regression scope)
   - `security-engineer`
7. [ ] Resolve any remaining must-fix findings and rerun re-review if needed.
8. [ ] Add final changelog session entry and mark Phase 08 done.

## Validation

- [x] Full hardening CI gate passes locally (`npm run ci:test`)
- [ ] Full hardening CI gate passes on hosted runner (latest post-Workstream-B run link to be attached in proof bundle)
- [x] Independent senior reviewer verdict is `ready` for Workstream B lifecycle/regression scope
- [ ] Independent security reviewer verdict pending
- [ ] No open critical/high must-fix blocker remains (pending security re-review)

## Risks

| Risk                             | Trigger                            | Mitigation                                                 |
| -------------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| False closeout confidence        | docs updated before proof complete | require proof bundle before gate checkboxes are updated    |
| Residual risk hidden in wording  | ambiguous risk statuses            | force explicit status plus rationale per risk line         |
| Re-review regression after fixes | unverified final changes           | rerun independent review after any material closeout patch |

## Exit Criteria

- [ ] Hardening master plan, phase docs, and changelog are mutually consistent
- [ ] OSS gate items are evidence-backed and closed
- [ ] Independent reviewers sign off without open critical/high blockers
- [ ] Final handoff marks hardening plan fully complete

## Handoff Notes

- Done:
  - Workstream B lifecycle/regression hardening completed and independently re-reviewed by `senior-reviewer` with verdict `READY_TO_MARK_B_DONE`.
  - Canonical hardening gate with expanded lifecycle suites passes locally (`npm run ci:test`).
- Remaining:
  - hosted canonical gate evidence refresh after latest lifecycle changes,
  - `security-engineer` re-review,
  - risk register reconciliation and final closeout updates.
- Known pitfalls:
  - skipping independent re-review after final fixes can miss last-minute regressions.
- Next exact step:
  - Execute `security-engineer` independent re-review, then reconcile remaining Phase 08 validation/risk items.
