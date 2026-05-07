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
- [ ] Settings editor context behavior unchanged
- [ ] Tree context behavior unchanged
- [ ] Shell context behavior unchanged
- [ ] Statusline labels remain unchanged

## Validation
- [ ] Manual context transition matrix
- [ ] Editor focus toggle checks
- [ ] Sidepanel focus/unfocus checks

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Context mismatch | ambiguous source of truth | resolver authoritative + compatibility assertions |
| Hidden state drift | legacy writes remain | log all context writes during migration |

## Exit Criteria
- [ ] Semantic context resolver in place
- [ ] Existing flows unchanged
- [ ] Transition docs updated
