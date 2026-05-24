# Search Mode Implementation Plan

## Goal

Implement a first-class `SEARCH` mode in Noctra that provides Vim-like in-page search on active web buffers:

- `/` opens a search prompt (cmdline-like overlay)
- `Enter` submits query and jumps to first match
- `n` / `N` navigate next/previous match
- `Escape` exits search mode, clears highlights, empties query, and returns to `NORMAL`
- Search is only valid on active web buffers (not `noctra://` or editable/internal buffers)
- No-result and invalid-context feedback is shown through toast notifications
- Statusline shows `SEARCH` mode and match count `X/X` only when search mode has an active search

This document is the implementation blueprint for the first core version.

---

## Product Behavior (Acceptance Criteria)

### Core behavior

1. Pressing `/` in `NORMAL`:
   - Enters `SEARCH` mode.
   - Opens prompt UI reusing cmdline overlay behavior but with search context (`/` prefix).

2. In search prompt:
   - Typing edits query.
   - `Enter` submits query to page find API.
   - First submit jumps to first match.
   - Prompt closes after submit while remaining in `SEARCH` mode.

3. In `SEARCH` mode with active search:
   - `n` moves to next result.
   - `N` (Shift+n) moves to previous result.
   - `/` reopens prompt with current query for editing.

4. `Escape` in `SEARCH` mode:
   - Clears in-page highlights and selection.
   - Resets query and match counters.
   - Exits `SEARCH` mode and enters `NORMAL`.

### Context rules

5. Search is allowed only for active navigable web buffers.
6. Invalid context (dashboard/noctra page/editable buffer/no usable webContents):
   - No search action performed.
   - Toast warning shown.

### Result feedback

7. If query returns no match:
   - Toast displays no-result message.
8. Match count appears in statusline right cluster as `current/total`:
   - Visible only when `mode === SEARCH` and search is active.
   - Hidden otherwise.

### Theme behavior

9. Highlight color follows theme `mainColor`.
10. Highlight styling remains correct after:
    - navigation/load,
    - theme changes,
    - split focus changes.

---

## Architectural Principles

- Treat `SEARCH` as a real mode, not a flag inside `NORMAL` or `COMMAND`.
- Keep mode transitions centralized in `core/modeTransitionService.js`.
- Keep state ownership explicit via dedicated state helpers and ownership guardrail updates.
- Keep intent-driven input pipeline (`motions` -> `dispatcher` -> `adapters`).
- Keep keybindings data-driven via config defaults + schema validation + action builders.
- Keep platform API calls (find/stop find) behind adapter boundaries where possible.

---

## Implementation Phases

## Phase 1 - Mode and State Foundation

### Files

- `core/modeTransitionService.js`
- `core/state.js`
- `core/state/searchState.js` (new)
- `scripts/check-state-ownership.js`

### Work

1. Add `SEARCH` to allowed mode set in mode transition service.
2. Add helpers:
   - `enterSearchMode(state, options?)`
   - `exitSearchMode(state, options?)`
3. Add search fields to root state factory:
   - `searchQuery` (string)
   - `searchPromptVisible` (boolean)
   - `searchActive` (boolean)
   - `searchMatchIndex` (number)
   - `searchMatchTotal` (number)
   - `searchRequestId` (number or string token)
4. Create `core/state/searchState.js` with pure mutation helpers:
   - set query
   - set prompt visibility
   - set active flag
   - set/reset counters
   - reset whole search session
5. Register ownership constraints in `scripts/check-state-ownership.js` for all new fields.

### Exit criteria

- State and transitions compile cleanly.
- Ownership guardrail recognizes new search fields and owners.

---

## Phase 2 - Intents and Contracts

### Files

- `core/intents.js`
- `core/contracts/intents.js`

### Work

Add intent types:

- `SEARCH_OPEN_PROMPT`
- `SEARCH_SUBMIT`
- `SEARCH_NEXT`
- `SEARCH_PREV`
- `SEARCH_CLEAR`
- (optional internal sync intent if needed) `SEARCH_UPDATE_MATCHES`

Add payload validators for all new intents with strict shape rules.

### Exit criteria

- Dispatcher recognizes all new intent types.
- Contract tests can validate positive and negative payload cases.

---

## Phase 3 - Motion/Input Pipeline for SEARCH Mode

### Files

- `core/input.js`
- `motions/normal.js`
- `motions/search.js` (new)
- `motions/actionBuilders.js`
- `core/config/defaults.js`
- `core/config/schema.js`
- `motions/keymap.js` (if mode-specific keymap resolver extension is needed)

### Work

1. Route mode in `core/input.js`:
   - add `SEARCH` branch with `handleSearch(state, input)`.

2. In `NORMAL` mode:
   - map `/` to search mode entry intent flow (through action builder, not hardcoded logic where possible).

3. Implement `motions/search.js` behavior:
   - if prompt visible, handle text editing keys (`Left`, `Right`, `Home`, `End`, `Backspace`, `Delete`, paste insertion, printable chars).
   - `Enter` dispatches `SEARCH_SUBMIT` with query.
   - `Escape` dispatches `SEARCH_CLEAR` and exits to normal.
   - `n` dispatches `SEARCH_NEXT`.
   - `N` dispatches `SEARCH_PREV`.
   - `/` dispatches `SEARCH_OPEN_PROMPT` with prefilled query.

4. Keymap/data model:
   - Add search actions to action builders.
   - Add defaults and schema support to keep keymap override-friendly.

### Exit criteria

- Keyboard behavior matches acceptance criteria.
- No direct Electron API usage inside motions.

---

## Phase 4 - Dispatcher + Web Search Execution

### Files

- `core/dispatcher/handlers/navigation.js` (or `core/dispatcher/handlers/search.js` new)
- `core/dispatcher.js`
- `core/adapters/platform/webContentsActions.js`
- `browser/buffers.js` (listener lifecycle support if needed)

### Work

1. Add adapter methods in `webContentsActions`:
   - `findInPage(webContents, text, options)`
   - `stopFindInPage(webContents, action)`

2. Implement handlers for search intents:
   - Validate active buffer context.
   - On invalid context: toast warning, keep deterministic state.
   - On submit:
     - store query
     - mark active search
     - execute `findInPage` with forward first jump.
   - On next/prev:
     - repeat search with `findNext: true`, direction based on intent.
   - On clear:
     - call `stopFindInPage("clearSelection")`
     - reset search state
     - close prompt if open
     - mode transition to `NORMAL`.

3. Bind `found-in-page` event:
   - Track active request id and `activeMatchOrdinal` / `matches`.
   - Update search counters in state.
   - Emit no-result toast when matches are zero.

### Exit criteria

- Search executes only on valid web buffer.
- Request/result updates are stable and race-safe.

---

## Phase 5 - Prompt UI Reuse in Search Context

### Files

- `ui/shell/services/commandOverlayController.js`
- `ui/shell/services/shellTemplates.js`
- `core/dispatcher/handlers/commandUi.js` (if prompt open/close remains there)
- `core/focusResolver.js`
- `core/inputPriorityResolver.js`
- `main.js`

### Work

1. Extend command overlay context model:
   - support context value `search` in addition to `shell`/`editor`.
   - set overlay title to `Search` and prefix to `/` when search context is active.

2. Reuse editing/render path:
   - same cursor and text rendering primitives.
   - independent from command parser logic.

3. Input priority / paste:
   - ensure paste shortcut is routed correctly when search prompt is focused/visible.
   - extend focus snapshot to represent search prompt context if required.

### Exit criteria

- Prompt feels identical to cmdline mechanics but search-specific labeling and behavior.

---

## Phase 6 - Statusline Match Counter

### Files

- `ui/shell/services/shellTemplates.js`
- `ui/shell/services/auxOverlayController.js`
- `ui/shell/manager.js`
- `core/statuslineModeLabel.js`
- `core/dispatcher.js`

### Work

1. Add new statusline node in right cluster, positioned as the leftmost element:
   - e.g. `#statusline-search-count`.

2. Add `updateStatuslineSearchCount(model)` API:
   - sets text `X/X`.
   - toggles visibility according to state (`SEARCH` + active search).

3. Ensure statusline mode label returns `SEARCH` for search mode.

4. Wire updates after intents and mode transitions so count stays synchronized.

### Exit criteria

- Count visibility and values are accurate and stable.

---

## Phase 7 - Themed Highlight Styling

### Files

- `browser/contentUi.js`
- `browser/buffers.js`
- `core/dispatcher.js` (theme refresh hooks if needed)

### Work

1. Implement/extend highlight styling injection to use `theme.mainColor`.
2. Ensure styling re-applies on:
   - `did-finish-load`
   - `dom-ready`
   - theme updates
3. Ensure clear removes visible artifacts when leaving search mode.

### Exit criteria

- Highlight color tracks active theme main color consistently.

---

## Phase 8 - Test Plan

### Tests to add/update

1. Mode/state tests
   - `tests/app/state-mode-transitions.test.js`
   - new `tests/app/state-search-transitions.test.js`

2. Intent contract tests
   - `tests/security/intent-contracts.test.js`

3. Keymap/schema tests
   - `tests/app/config-schema-keymap.test.js`

4. Input behavior tests
   - add/search-specific tests around input routing and mode-specific keys.

5. Dispatcher/search handler tests
   - valid/invalid context
   - submit/next/prev/clear
   - no-result toast
   - match counter update

6. Statusline tests
   - show/hide `X/X`
   - correct positioning and update behavior.

7. Guardrail tests
   - ensure state ownership checker supports new fields.

### Exit criteria

- Full test suite passes.
- New search tests cover happy path + key edge cases.

---

## Toast and Error Messaging (Initial Strings)

- Invalid context:
  - `Search unavailable in current buffer`
- Empty query submit:
  - `Search query is empty`
- No result:
  - `No result`

All should be non-persistent warning/info toasts unless product decides otherwise.

---

## Edge Cases

1. Query submitted, then active buffer changes before result event returns.
2. Buffer/webContents destroyed while search session active.
3. Split mode enabled and focus changes between panes.
4. Prompt reopened with `/` while stale counters exist.
5. Repeated `Escape` presses across prompt-visible and prompt-hidden states.
6. Empty string edits and submit behavior.
7. Theme switch while search highlight is currently visible.

---

## Non-Goals for This First Iteration

- Regex search.
- Case sensitivity toggles.
- Whole-word toggles.
- Persistent search history.
- Cross-buffer/global search.

---

## Suggested Implementation Order (Execution Checklist)

1. Foundation: mode + state + ownership guardrails.
2. Intents + payload contracts.
3. Search motion handler and input routing.
4. Dispatcher handlers + webContents adapter methods.
5. Prompt context extension (`search`).
6. Statusline count `X/X` integration.
7. Highlight color theming.
8. Tests and polish.

---

## Done Definition

Feature is done when:

- `SEARCH` is a distinct mode shown in statusline.
- `/`, `Enter`, `n`, `N`, and `Escape` follow the defined behavior exactly.
- Search is restricted to valid active web buffers with toast feedback on invalid contexts.
- First submit jumps to first match.
- Match count `X/X` is shown only when appropriate.
- Highlight follows theme main color and clears correctly on exit.
- Added/updated tests pass.
