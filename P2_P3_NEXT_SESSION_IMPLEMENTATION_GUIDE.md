# P2 + P3 Next Session Implementation Guide

Date: 2026-05-10
Project: Noctra
Purpose: Finish OSS readiness items #2 and #3 after the #1 runtime decomposition pass.

---

## Quick #1 Audit (Final Pass)

Status: **Substantially complete** for runtime decomposition and safe to proceed with #2/#3.

### What is now in runtime modules

- Window bootstrap and startup orchestration: `runtime/windowBootstrap.js`
- Browser language request policy: `runtime/browserLanguagePolicy.js`
- Theme runtime resolution/apply: `runtime/themeRuntime.js`
- URL policy runtime wiring: `runtime/urlPolicyRuntime.js`
- Config reload orchestration: `runtime/configRuntime.js`
- URL line input/edit orchestration: `runtime/urllineCoordinator.js`
- Existing lifecycle/input/ipc modules already in place:
  - `runtime/windowLifecycle.js`
  - `runtime/inputCoordinator.js`
  - `runtime/ipcRegistration.js`
  - `runtime/smokeScenarios.js`

### Remaining in `main.js` (acceptable for now)

- Input routing function (`handleRawInput`) and related focus/mode sync glue.
- Shortcut-label computation for tabline/urlline actions.
- `normalizeHistoryUrl` helper.

These are not blockers for starting #2/#3. They can be revisited later if we want an even thinner `main.js`.

### #1 completion call

- For the OSS plan intent (decompose runtime orchestration), #1 is **ready to mark done**.
- Any further slimming of `main.js` is polish, not a structural blocker.

---

## #2 Split Browser and Shell Managers

Goal: make `browser/manager.js` and `ui/shell/manager.js` thin facades with explicit service ownership.

### Current baseline

- Browser services already exist under `browser/services/*`.
- Shell services already exist under `ui/shell/services/*`.
- Managers still contain orchestration and behavior that can be reduced.

### Implementation tasks

1. **Browser manager facade pass**
   - Keep `browser/manager.js` as public API facade only.
   - Move remaining behavior-heavy logic into services:
     - buffer registry mutations -> dedicated buffer registry service
     - split and pane layout mutations -> existing split/layout services
     - devtools open/close lifecycle -> devtools service
     - selection observer policy -> selection observer service
   - Ensure each service owns one responsibility and has minimal cross-calls.

2. **Shell manager facade pass**
   - Keep `ui/shell/manager.js` as composition + call-through wrappers.
   - Push any remaining business logic into:
     - template host
     - render bridge
     - overlay lifecycle/controllers
   - Normalize service interfaces (`init`, `render`, `update`, `dispose`).

3. **Boundary hardening**
   - Avoid importing Electron APIs directly in non-adapter services.
   - Keep data flow explicit: manager facade -> service -> adapter.

### Acceptance checks for #2

- `browser/manager.js` and `ui/shell/manager.js` read like facades, not behavior monoliths.
- Service ownership is obvious from file names and call sites.
- Existing smoke behavior unchanged (startup, split, overlay, settings, session, focus).

---

## #3 Enforce State Ownership Domains

Goal: single-writer boundaries for modal state domains with no ad hoc writes.

### State domains in scope

- Mode state
- Leader sequence state
- Command-line state
- URL line/focus/editor-focus state

### Implementation tasks

1. **Write-path audit**
   - Grep for direct mutations of `state.*` across `main`, `runtime`, `motions`, `core`, `ui`.
   - Build a quick table: `state field -> authorized writer module`.

2. **Refactor unauthorized writes**
   - Replace direct assignments with transition functions from:
     - `core/modeTransitionService.js`
     - `core/state/leaderState.js`
     - `core/state/commandState.js`
     - `core/state/urllineState.js`
     - `core/editorFocusState.js`
     - `core/state/editorModeState.js`

3. **Guardrails**
   - Add advisory invariants where useful when boundary misuse is detected.
   - Prefer tiny helper functions over scattered inline state changes.

4. **Tests**
   - Extend existing state transition tests to cover refactored paths.
   - Add at least one regression test per domain for illegal/ignored write path behavior.

### Acceptance checks for #3

- Each state domain has one obvious write boundary.
- Call sites route through transition/service APIs, not ad hoc mutation.
- Transition tests remain green and cover the final ownership map.

---

## Suggested commit sequence for next session

1. `refactor(browser): finalize manager facade and service ownership boundaries`
2. `refactor(ui): finalize shell manager facade and overlay/render service boundaries`
3. `refactor(state): enforce single-writer ownership for modal state domains`
4. `test(state): lock ownership boundaries with transition regressions`

---

## Validation commands

- `npm test`
- `npm run test:smoke:ui-cadence`
- `npm run test:smoke:overlay`
- `npm run test:smoke:settings-lifecycle`
- `npm run test:smoke:session-lifecycle`
- `npm run test:smoke:focus-lifecycle`

If all pass, proceed to OSS items #5-#7.
