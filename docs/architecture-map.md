# Architecture Map

This map is the contributor-first index of where responsibilities live.
It is a curated boundary map, not an exhaustive file-by-file index.

## Runtime boundaries

- `main.js`: composition entrypoint that wires app lifecycle, runtime registration, and startup flow.
- `runtime/windowLifecycle.js`: window create/show/close lifecycle orchestration.
- `runtime/inputCoordinator.js`: renderer input event wiring into the intent pipeline.
- `runtime/ipcRegistration.js`: IPC channel registration, trust checks, payload validation.
- `runtime/smokeScenarios.js`: runtime smoke probes used by test harnesses.

## Intent pipeline

- `motions/*`: mode-aware key handling.
- `core/input.js`: input normalization and mode/context routing.
- `core/intents.js`: canonical intent enum.
- `core/contracts/intents.js`: dispatcher payload contracts (strict keys, fail-closed).
- `core/dispatcher.js`: intent execution and domain handoff.

## State ownership

- `core/state.js`: shared runtime state container.
- `core/modeTransitionService.js`: mode transitions.
- `core/state/leaderState.js`: leader sequence and counts.
- `core/state/commandState.js`: command-line buffer/cursor/target.
- `core/state/urllineState.js`: urlline edit state and cursor.
- `core/editorFocusState.js`: shell/editor focus transitions.
- `core/state/editorModeState.js`: editor mode transitions.

## Browser domain

- `browser/manager.js`: browser orchestration for buffers, splits, and devtools lifecycle.
- `browser/buffers.js`: buffer registry, active buffer tracking, and buffer lifecycle helpers.
- `browser/contentUi.js`: in-page UI helpers and content-surface interactions.

## UI shell domain

- `ui/shell/services/shellTemplates.js`: trusted internal UI templates.
- `ui/shell/services/shellTemplateHost.js`: trusted shell content host and template mounting.
- `ui/shell/services/shellRenderBridge.js`: renderer patch/update bridge for shell UI synchronization.
- `ui/shell/services/overlayLifecycle.js`: overlay lifecycle orchestration and shared overlay coordination.
- `ui/shell/services/commandOverlayController.js`: command overlay visibility and command-surface behavior.
- `ui/shell/services/whichKeyOverlayController.js`: leader/which-key overlay state and rendering.
- `ui/shell/services/auxOverlayController.js`: auxiliary overlay controls and panel behavior.

## Security boundaries

- `core/contracts/ipc.js`: IPC payload contract map.
- `core/contracts/errors.js`: standardized rejection shape.
- `core/adapters/platform/securityPolicy.js`: navigation, trusted-surface, and download runtime policy wiring.
- `core/security/urlPolicy.js`: URL validation policy.
- `core/security/downloadPolicy.js`: explicit deny/prompt/allow download decisions.

## OSS guardrails

- `INTENTS.md`: public intent contract reference.
- `scripts/check-intents-parity.js`: blocks drift between `INTENTS.md` and `core/intents.js`.
- `scripts/check-state-ownership.js`: blocks unauthorized modal-state writes.
- `scripts/check-security-baseline.js`: blocks insecure default policy drift.
- `.github/workflows/ci.yml`: required CI gates.
