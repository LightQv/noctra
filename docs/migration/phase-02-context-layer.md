# Phase 02 - Context Layer Normalization

## Goal
Separate focus scope from semantic context and introduce capability-driven context resolution.

## In Scope
- Define semantic contexts (`web`, `history`, `bookmarks`, `editor`, `tabs`)
- Create context resolver from active focus + active object
- Keep existing behavior and current state compatibility

## Out of Scope
- New user contexts/features
- Keybinding changes

## Primary Current Files
- `core/state.js`
- `core/input.js`
- `main.js`
- `core/history/panel.js`
- `core/dispatcher.js`

## Steps
1. Document current `interactionContext` transitions.
2. Introduce semantic context interface/contracts.
3. Add resolver mapping runtime facts -> semantic context.
4. Route interpretation through resolver while preserving old flags.
5. Keep compatibility path until later cleanup phase.

## Behavior Parity Checklist
- [x] Settings editor context behavior unchanged
- [x] Tree context behavior unchanged
- [x] Shell context behavior unchanged
- [x] Statusline labels remain unchanged

## Validation
- [x] Manual context transition matrix
- [x] Editor focus toggle checks
- [x] Sidepanel focus/unfocus checks

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Context mismatch | ambiguous source of truth | resolver authoritative + compatibility assertions |
| Hidden state drift | legacy writes remain | log all context writes during migration |

## Exit Criteria
- [x] Semantic context resolver in place
- [x] Existing flows unchanged
- [x] Transition docs updated

## Handoff Notes
- Done:
  - Added semantic context resolver in `core/semanticContextResolver.js`.
  - Resolver now distinguishes focused sidepanel semantic context as `history` vs `bookmarks` (not generic tree).
  - Integrated resolver-backed editor semantic checks in `core/input.js`, `main.js`, and `core/dispatcher.js` while preserving current statusline labels and compatibility behavior.
  - Added `historyPanel.getTreeKind()` accessor for context resolution.
- Remaining:
  - none.

## Validation Result
- Manual checks passed for editor focus toggle, sidepanel focus/unfocus, and shell path.
