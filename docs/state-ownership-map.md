# State Ownership Map

This map defines the single-writer boundaries for modal state domains.

- `mode`: `core/modeTransitionService.js`
- `leaderActive`, `leaderPath`, `leaderNumericBuffer`, `leaderLastKeyTime`: `core/state/leaderState.js`
- `commandBuffer`, `commandCursorIndex`, `commandTarget`: `core/state/commandState.js`
- `urllineEditing`, `urllinePane`, `urllineBuffer`, `urllineCursorIndex`: `core/state/urllineState.js`
- `editorFocus`: `core/editorFocusState.js`
- `editorMode`: `core/state/editorModeState.js`

## Command Domain Rule

`core/modeTransitionService.js` owns command mode lifecycle (`enterCommandMode`, `exitCommandMode`) and delegates command field writes to `core/state/commandState.js`.

Callers should use:

- lifecycle changes: `core/modeTransitionService.js`
- command text/cursor editing: `core/state/commandState.js`
