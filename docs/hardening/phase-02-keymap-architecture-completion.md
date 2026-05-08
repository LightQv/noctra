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
5. [x] Add runtime reload handling (or document exact restart requirement).
6. [x] Add tests for precedence, mode scoping, and conflict handling.
7. [x] Validate parity for baseline Vim-like flows and tree/telescope flows.

## Behavior Parity Checklist
- [x] Baseline Vim-like normal navigation unchanged
- [x] Leader mappings remain stable
- [x] Buffer/tab motions unchanged
- [x] Tree/telescope key handling unchanged
- [x] Existing user config mappings still resolve correctly

## Validation
- [x] Manual: precedence matrix pass (default vs user override vs runtime guard)
- [x] Manual: mode/context mapping pass (NORMAL/INSERT/COMMAND + panel states)
- [x] Optional focused unit tests for resolver and merge behavior

## Runtime Reload Behavior
- Keymap updates from settings save are hot-reloaded through `configService.reloadConfig()` and `applyReloadedConfig(...)` in `main.js`.
- No restart is required for `keymap.normal`, `keymap.mod`, or `keymap.leader` changes when saving the active app config.
- Reload transaction resets leader/key sequence runtime buffers to avoid stale-prefix behavior after keymap/leader changes.
- Shortcut labels (tabline/urlline) are refreshed immediately from effective keymap config after reload.

## Step 6 Test Strategy (Contract-Preserving)
- Fast developer contract tests use Node built-ins (`node:test`, `node:assert/strict`) with no third-party harness.
- Added coverage areas:
  - precedence and fallback safety in `tests/config-schema-keymap.test.js`
  - sequence conflict determinism in `tests/grammar-keymap-conflicts.test.js`
  - mode/context routing behavior in `tests/input-priority-mode-scope.test.js`
- Package scripts added in `package.json`: `test`, `test:keymap`.

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
- [x] All keymaps resolve through canonical data-driven layer
- [x] Override precedence documented and tested
- [x] Runtime behavior deterministic across contexts
- [x] Phase status updated in master plan

## Handoff Notes
- Done:
  - Added data-driven defaults for `keymap.normal` and `keymap.mod` in `core/config/defaults.js`.
  - Extended config normalization to merge/validate user `keymap.normal` and `keymap.mod` overrides.
  - Switched runtime normal/mod mapping resolution to config-backed keymaps in `motions/keymap.js`.
  - Updated shell shortcut label discovery in `main.js` to read effective config-backed keymaps.
  - Updated generated config guidance comments for keymap scope in `core/config/service.js`.
  - Added explicit hot-reload application path for runtime config updates and sequence-state reset in `main.js`.
  - Added focused tests for precedence, mode scoping, conflict handling, and invalid/malformed keymap safety.
  - Verified parity across baseline flows after rollout (manual matrix pass).
- Remaining:
  - none.
- Known pitfalls:
  - Hidden hardcoded mappings in mode handlers can bypass override layer.
- Next exact step:
  - Execute `phase-03-invariants-tests-ci.md` step 1: classify invariants as critical vs advisory.
