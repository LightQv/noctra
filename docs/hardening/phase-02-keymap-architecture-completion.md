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
1. [x] Inventory all keymap sources (hardcoded + config-backed) by mode/context.
2. [x] Define and document canonical merge order and conflict rules.
3. [x] Move remaining hardcoded mappings into data-driven defaults.
4. [x] Implement user override merge with guardrails for unsafe/invalid mappings.
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

## Canonical Merge/Conflict Rules
- Precedence order: built-in defaults (`core/config/defaults.js`) -> user config overrides (`config.yml`, normalized in `core/config/schema.js`) -> runtime guards/context routing (`core/inputPriorityResolver.js`, `core/input.js`, semantic context).
- `keymap.normal` and `keymap.mod` are merged by key: defaults are always present, user keys override matching default keys.
- `keymap.leader` remains normalized as a validated tree under `keymap.leader`.
- Invalid mappings are dropped during normalization (empty key, non-string action id, unknown action id).
- Sequence conflicts are resolved deterministically by runtime parser behavior: exact sequence match first, prefix continuation otherwise (`motions/grammarPrimitives.js`).

## Keymap Source Inventory (Mode/Context)
| Mode | Context | Source | Notes |
|---|---|---|---|
| NORMAL | web | `keymap.normal` | Canonical normal motion/action map resolved in `motions/keymap.js`. |
| NORMAL | web (Ctrl-mod) | `keymap.mod` | Canonical modifier map resolved in `motions/keymap.js` + `motions/modifiers.js`. |
| NORMAL | web (leader) | `keymap.leader` | Tree-based leader map resolved in `motions/leaderMap.js`. |
| NORMAL | history/bookmarks tree | `keymap.normal` + `keymap.mod` + panel-local keys | Shared motions from keymap registry; tree-domain actions remain panel-local in `core/history/panel.js`. |
| INSERT | global | `motions/insert.js` | Escape-only modal transition remains hardcoded. |
| COMMAND | shell/editor | `motions/command.js` | Command-line editing/navigation keys remain hardcoded. |
| SETTINGS editor | editor surface | `core/settings/page.js` + `global.input.leader_key` | Local editor context uses leader key plus editor-specific control shortcuts. |

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
  - Added data-driven defaults for `keymap.normal` and `keymap.mod` in `core/config/defaults.js`.
  - Extended config normalization to merge/validate user `keymap.normal` and `keymap.mod` overrides.
  - Switched runtime normal/mod mapping resolution to config-backed keymaps in `motions/keymap.js`.
  - Updated shell shortcut label discovery in `main.js` to read effective config-backed keymaps.
  - Updated generated config guidance comments for keymap scope in `core/config/service.js`.
- Remaining:
  - step 5 (runtime reload confirmation/documentation), step 6 (tests), step 7 (manual parity validation).
- Known pitfalls:
  - Hidden hardcoded mappings in mode handlers can bypass override layer.
- Next exact step:
  - Execute step 5: verify and document config reload determinism for `keymap.normal`/`keymap.mod`/`keymap.leader`.
