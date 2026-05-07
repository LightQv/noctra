# Phase 02 - Keymap Architecture Completion

## Goal
Complete the data-driven keymap architecture with user override layering and safe runtime behavior.

## In Scope
- Move remaining hardcoded mappings into registry/config path
- Implement precedence order: defaults -> user overrides -> runtime guards
- Ensure mode/context-aware resolution remains deterministic
- Add diagnostics for conflicts and invalid mappings

## Out of Scope
- New keybinding features beyond migration intent
- Security boundary changes from Phase 01
- Broad parser rewrites unrelated to keymap layering

## Primary Current Files
- `motions/constants.js`
- `core/config/service.js`
- `core/config/schema.js`
- `motions/*`
- `core/input.js`

## Planned Outputs
- Canonical keymap registry fed by config/defaults
- Override merge layer with stable precedence rules
- Runtime reload path (or explicitly documented restart-only path)
- Validation and conflict reporting for user mappings

## Steps
1. [ ] Inventory all keymap sources (hardcoded + config-backed) by mode/context.
2. [ ] Define and document canonical merge order and conflict rules.
3. [ ] Move remaining hardcoded mappings into data-driven defaults.
4. [ ] Implement user override merge with guardrails for unsafe/invalid mappings.
5. [ ] Add runtime reload handling (or document exact restart requirement).
6. [ ] Add tests for precedence, mode scoping, and conflict handling.
7. [ ] Validate parity for baseline Vim-like flows and tree/telescope flows.

## Behavior Parity Checklist
- [ ] Baseline Vim-like normal navigation unchanged
- [ ] Leader mappings remain stable
- [ ] Buffer/tab motions unchanged
- [ ] Tree/telescope key handling unchanged
- [ ] Existing user config mappings still resolve correctly

## Validation
- [ ] Manual: precedence matrix pass (default vs user override vs runtime guard)
- [ ] Manual: mode/context mapping pass (NORMAL/INSERT/COMMAND + panel states)
- [ ] Optional focused unit tests for resolver and merge behavior

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Precedence drift changes expected behavior | implicit merge order | codify order in one resolver and test matrix |
| Runtime reload introduces stale state | partial refresh logic | centralize reload transaction and invalidate caches |
| Invalid user mappings crash flows | missing schema/runtime validation | strict validation + safe fallback to defaults |

## Exit Criteria
- [ ] All keymaps resolve through canonical data-driven layer
- [ ] Override precedence documented and tested
- [ ] Runtime behavior deterministic across contexts
- [ ] Phase status updated in master plan

## Handoff Notes
- Done:
  - none.
- Remaining:
  - all steps.
- Known pitfalls:
  - Hidden hardcoded mappings in mode handlers can bypass override layer.
- Next exact step:
  - Execute step 1 and produce a keymap source inventory table.
