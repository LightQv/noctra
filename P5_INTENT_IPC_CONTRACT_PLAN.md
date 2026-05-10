# P5 Plan - Intent/IPC Contract Validation + Config Unknown-Key Warnings

Date: 2026-05-10  
Project: Noctra  
Scope: OSS Readiness Stabilization Plan - Item #4 (Intent/IPC Contract Validation), plus config unknown-key UX warning guardrail.

## Goal

Implement fail-closed contract validation at intent and IPC boundaries, standardize rejection shapes, and add non-breaking warning toasts for unknown config keys.

## Why This Matters

- Prevent malformed payloads from reaching privileged logic.
- Make contract behavior explicit and predictable for OSS contributors.
- Reduce hidden drift between emitters, dispatcher handlers, and IPC channels.
- Preserve UX safety by warning (not breaking) on unknown config keys.

## Success Criteria

- Dispatcher rejects malformed intent payloads consistently.
- IPC events/invokes reject malformed payloads before side effects.
- Rejection/error shape is unified across boundaries.
- Unknown config keys generate deduplicated warning toasts and logs.
- Tests cover valid + invalid matrix for intent, IPC, and config warnings.
- Docs explain how to add/update contracts safely.

---

## Proposed PR Breakdown

### PR5A - Contract Foundation

Add runtime contract primitives and canonical maps.

#### New modules

- `core/contracts/validation.js`
  - Minimal runtime validators:
    - object shape
    - enum
    - string
    - finite number
    - integer
    - boolean
    - optional / nullable wrappers
  - Strict object mode with **no unknown keys** support.

- `core/contracts/errors.js`
  - Standard error constructors with consistent shape:
    - `code` (`contract_invalid_payload`, `contract_unknown_intent`, `contract_unauthorized_sender`)
    - `boundary` (`dispatcher`, `ipc:event`, `ipc:invoke`)
    - `subject` (intent type or IPC channel)
    - `message`
    - `details` (compact diagnostic object)

- `core/contracts/intents.js`
  - Canonical `INTENTS.* -> validator` map.

- `core/contracts/ipc.js`
  - Canonical `channel -> { kind, validator }` map for both events and handlers.

#### Design rule

- Unknown extra keys are rejected for intent and IPC payloads (fail closed).

---

### PR5B - Dispatcher Enforcement

Wire intent payload contracts into `core/dispatcher.js`.

#### Changes

- Keep known-intent type guard, but add full payload validation per intent type.
- Validate follow-up chain (`intent.next`) with the same contract path.
- Reject malformed payloads before handler execution.
- Emit unified warning notification + structured context on rejection.

#### Behavior invariants

- Valid intents behave exactly as today.
- Invalid intents do not execute side effects.
- Unknown intent types keep warning behavior, but with unified code/shape.

---

### PR5C - IPC Enforcement

Wire IPC payload contracts into `runtime/ipcRegistration.js`.

#### Changes

- Per-channel wrappers:
  1. sender trust check
  2. payload contract validation
  3. handler execution

- Event channels:
  - reject invalid payloads and return early.
  - emit structured warning log/notification.

- Invoke channels:
  - return stable error object:
    - `{ ok: false, error: { code, boundary, subject, message, details } }`

#### Covered channels (current set)

- Events:
  - `ui-shell:window-action`
  - `ui-shell:open-settings`
  - `ui-shell:new-tab`
  - `ui-shell:open-history`
  - `ui-shell:tab-activate`
  - `ui-shell:tab-close`
  - `ui-shell:urlline-start-edit`
  - `ui-shell:urlline-action`
  - `settings:editor-toggle-context`
  - `settings:editor-mode-change`
  - `settings:editor-focus-request`
  - `settings:editor-open-command`
  - `settings:editor-ready`

- Handlers:
  - `settings:get`
  - `settings:save`
  - `settings:close`
  - `security:probe-privileged-ipc` (smoke mode only)

---

### PR5D - Config Unknown-Key Warnings (Non-Breaking UX)

Add config key drift detection in config normalization/load path.

#### Requirements

- Unknown keys do not break config loading.
- Unknown keys are ignored by normalization (existing behavior preserved).
- Warnings are deduplicated per load/reload.
- User sees one warning toast per reload cycle; details stay in log/context.

#### Suggested implementation points

- Extend `core/config/schema.js` normalization pipeline to collect unknown key paths.
- Return metadata from normalize path (example: `{ config, diagnostics }`).
- In `core/config/service.js` `loadConfig()/reloadConfig()`, emit one warning if diagnostics include unknown keys.

#### Notification contract

- Code: `config_unknown_keys_detected`
- Severity: `warning`
- Message: `Unsupported config keys were ignored`
- Context:
  - `path`
  - `unknownKeys` (array of full dot paths)

#### Dedup strategy

- Deduplicate warnings within one load/reload cycle.
- Optional cap for toast payload context (e.g. first N keys in toast context, full list in console).

---

### PR5E - Tests + Docs

#### Tests to add

- `tests/intent-contracts.test.js`
  - valid payload accepted
  - missing required field rejected
  - wrong type rejected
  - unknown extra key rejected
  - malformed `intent.next` rejected
  - unknown intent type rejection shape verified

- `tests/ipc-contracts.test.js`
  - valid payload accepted for sample channels
  - unknown extra key rejected
  - event rejection prevents side effects
  - invoke rejection shape stable and machine-readable

- `tests/config-schema-keymap.test.js` (extend) or new `tests/config-unknown-keys.test.js`
  - unknown top-level keys detected
  - unknown nested keys detected
  - single dedup warning emission behavior

#### Docs updates

- `INTENTS.md`
  - add payload contract section and strict-key policy.

- `docs/architecture.md`
  - add contract layer callout at dispatcher + IPC boundaries.

- Add contributor checklist doc/section:
  - "When adding intent/channel, update:
    1) contracts map
    2) handler
    3) tests
    4) INTENTS/docs"

---

## Intent Contract Matrix (Initial)

- `SCROLL`: `direction` enum + `amount` finite number
- `OPEN_URL`: `url` string
- `NEW_BUFFER`: optional `url` string
- `SWITCH_BUFFER`: `id` integer
- `CLOSE_BUFFER`: optional/nullable `id` integer
- `SET_URLLINE_VISIBILITY`: `enabled` boolean
- `SET_THEME_MODE`: mode enum (`dark|light|auto|custom`)
- `SET_BROWSER_LANGUAGE`: language enum (`en|fr`), optional `reload` boolean
- `TOGGLE_COPY_SELECTION_TO_CLIPBOARD`: optional `enabled` boolean
- `SHOW_WHICHKEY` / `UPDATE_WHICHKEY`: optional model + timing values
- `SUBMIT_EDITOR_COMMAND`: `command` string
- `UNKNOWN_COMMAND`: `raw` string
- all remaining intents: no payload keys beyond allowed standard fields (`type`, optional `next`)

---

## Rollout/Risk Controls

- Keep enforcement fail-closed but non-throwing in runtime (reject + warn).
- Preserve existing successful flows for valid payloads.
- Do not mix security-policy changes unrelated to contracts in this PR set.
- Land in small reviewable commits:
  1. contracts foundation
  2. dispatcher wiring
  3. IPC wiring
  4. config unknown-key warnings
  5. tests/docs

---

## Validation Plan

Run after each chunk:

- `npm test`
- `npm run test:smoke:ui-cadence`
- `npm run test:smoke:overlay`
- `npm run test:smoke:settings-lifecycle`

Final gate:

- `npm run ci:test`

Expected result:

- Full green CI with existing baseline warnings only.
- Added tests for contracts and config unknown-key diagnostics pass.

---

## Out of Scope for P5

- Tightening URL policy defaults (P6).
- Download governance (P7).
- Broader CI/doc OSS guardrails beyond contract/docs alignment (P8).
