# Intent Lifecycle Workflow

Use this workflow for any new intent or intent contract change.

## 1) Define the intent

1. Add the constant in `core/intents.js`.
2. Keep the intent name uppercase snake case.
3. Make sure the motion/command layer emits this exact intent type.

## 2) Define the payload contract

1. Update `core/contracts/intents.js`.
2. Reject unknown keys (strict payload shape).
3. Keep required vs optional fields explicit.

## 3) Implement dispatcher handling

1. Add/update the handler path in `core/dispatcher.js`.
2. Return standardized boundary errors for contract failures.
3. If the intent emits follow-up intents (`intent.next`), ensure they pass through dispatcher validation too.

## 4) Cover tests

Required:

- Unit/contract tests under `tests/` for success and failure payloads.
- If behavior is integration-sensitive, add or update smoke tests.

Recommended:

- Add one malformed payload test that verifies fail-closed rejection.

## 5) Sync docs

1. Add/update the intent entry in `INTENTS.md`.
2. Update user-facing docs if command/keymap behavior changed (`docs/commands.md`, `docs/keybindings.md`, `README.md`).

## 6) Run required local checks

```bash
npm run check:intents
npm run check:state-ownership
npm run check:security-baseline
npm test
npm run ci:test
```

## 7) PR checklist for intent changes

- Intent constant, contract, and dispatcher are aligned.
- `INTENTS.md` parity passes.
- Contract tests include malformed payload rejection.
- Any keymap/command/doc changes are updated.
- CI is green with all required security gates.
