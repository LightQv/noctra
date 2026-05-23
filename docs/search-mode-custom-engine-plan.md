# Custom Search Engine Plan (Visible-First, Theme-Aware, Jump-Ready)

## Goal

Replace native `findInPage`-driven search with a custom in-page search runtime that provides:

- Noctra-themed highlights (full control over colors/styling)
- Correct count on first submit (no extra `n` needed)
- Direct match jumping via key hints (visible matches first)
- Strong performance on large documents
- A foundation for future navigation actions (`yank`, `open url`, etc.)

---

## Product Scope

## In Scope (Phase 1 target)

1. SEARCH mode remains first-class in app state/mode transitions.
2. Query submit computes match set and active result immediately.
3. Statusline shows `current/total` immediately after submit.
4. Highlights are custom-rendered and theme-aware (`theme.mainColor`).
5. `n` / `N` next/prev works with custom runtime.
6. Visible-first hint mode allows direct jump to a visible match.
7. Search clear removes overlays and state cleanly.
8. Performance safeguards for large/active pages.

## Out of Scope (initial custom release)

- Full-document hint labels for every match at once.
- Cross-iframe/shadow-root exhaustive support (optional extension).
- Regex/case/word toggles.
- Persistent search history.

---

## High-Level Architecture

## 1) Main Process / Dispatcher

- Owns mode transitions and search state.
- Sends command messages to content runtime:
  - `SEARCH_RUNTIME_START`
  - `SEARCH_RUNTIME_NEXT`
  - `SEARCH_RUNTIME_PREV`
  - `SEARCH_RUNTIME_JUMP`
  - `SEARCH_RUNTIME_HINT_OPEN`
  - `SEARCH_RUNTIME_HINT_INPUT`
  - `SEARCH_RUNTIME_CLEAR`
  - `SEARCH_RUNTIME_THEME_UPDATE`
- Receives result messages:
  - `SEARCH_RUNTIME_UPDATE` (`total`, `activeIndex`, `activeRect`, etc.)
  - `SEARCH_RUNTIME_HINTS` (visible labels + indexes)
  - `SEARCH_RUNTIME_ERROR`

## 2) Buffer/Content Runtime (Injected Script)

- Runs inside each searchable webContents context.
- Responsible for:
  - text indexing and matching
  - highlight overlay rendering
  - active match tracking
  - visible match calculation
  - hint label generation
- Exposes command handler + emits structured updates.

## 3) UI Shell

- Keeps prompt behavior and statusline integration.
- Adds hint mode status indicator (optional small statusline suffix).
- Uses existing toast pipeline for warnings/errors.

---

## State Model Changes

Add fields (or equivalent structure) in root state + search state helper:

- `searchQuery: string`
- `searchPromptVisible: boolean`
- `searchActive: boolean`
- `searchMatchIndex: number` (1-based UI display)
- `searchMatchTotal: number`
- `searchRequestId: number | string | null`
- `searchHintMode: boolean`
- `searchHintInput: string`
- `searchVisibleHintCount: number`
- `searchRuntimeReadyByBuffer: Map<bufferId, boolean>` (or side table)
- `searchLastActiveRect: {x,y,width,height} | null` (optional)

Ownership:

- Keep write ownership in `core/state/searchState.js` + mode transition service boundaries.

---

## Intent & Contract Additions

Add intents:

- `SEARCH_OPEN_PROMPT`
- `SEARCH_SUBMIT`
- `SEARCH_NEXT`
- `SEARCH_PREV`
- `SEARCH_CLEAR`
- `SEARCH_HINT_OPEN`
- `SEARCH_HINT_INPUT`
- `SEARCH_JUMP_TO_INDEX`
- `SEARCH_RUNTIME_UPDATE` (internal dispatch event if needed)

Contracts:

- Strict payload validators for all new intents.
- Structured runtime response validation before state writes.

---

## Runtime Protocol (Main <-> Content)

## Command envelope

```json
{
  "channel": "noctra:search-runtime:command",
  "requestId": "search-123",
  "action": "start|next|prev|jump|hint-open|hint-input|clear|theme-update",
  "payload": {}
}
```

## Update envelope

```json
{
  "channel": "noctra:search-runtime:update",
  "requestId": "search-123",
  "ok": true,
  "payload": {
    "total": 42,
    "activeIndex": 1,
    "activeRect": {"x": 0, "y": 0, "width": 0, "height": 0},
    "visibleHintCount": 12
  }
}
```

Rules:

- Ignore stale `requestId`.
- Runtime must be idempotent for repeated commands.
- Runtime errors return `ok: false` + stable `code/message`.

---

## Content Runtime Design

## 1) Matching Engine

- Use `TreeWalker` over text nodes in `document.body`.
- Skip non-visible or irrelevant nodes (`script`, `style`, `noscript`, hidden).
- Build searchable segments:
  - original text
  - normalized text (lowercase, whitespace-normalized for v1 behavior)
- Produce match records:
  - `matchId`
  - `Range`
  - lazy rect cache
  - `isVisible` flag

## 2) Performance Strategy

- Debounce submit/recompute on rapid input.
- Chunk scanning work using `requestIdleCallback` fallback to `setTimeout`.
- Cap max matches (e.g., 5k) with warning toast if exceeded.
- Lazy rect computation:
  - all matches: no immediate full `getClientRects()`
  - visible subset only: compute rects on demand
- Recompute triggers:
  - query changed
  - viewport scroll/resize
  - significant DOM mutation

## 3) Mutation Handling

- `MutationObserver` with throttled invalidation.
- Mark index stale; rebuild asynchronously.
- Keep current query active and refresh overlays after rebuild.

---

## Themed Highlight Rendering

## Overlay Strategy

- Create a single fixed overlay root (`position: absolute/fixed`, pointer-events none).
- Render:
  - passive highlights for visible matches
  - stronger active highlight
  - optional active caret border/glow
- Use CSS vars fed by main theme payload:
  - `--search-main`
  - `--search-passive-bg`
  - `--search-active-bg`
  - `--search-active-border`
  - `--search-label-bg`
  - `--search-label-text`

## Theme Updates

- On app theme change, dispatch `SEARCH_RUNTIME_THEME_UPDATE`.
- Runtime updates vars without re-indexing matches.

---

## Visible-First Hint Mode

## UX

- In `SEARCH` mode, trigger hint mode (`f` recommended).
- Runtime computes visible matches only:
  - intersection with viewport
  - stable ordering (top-to-bottom, left-to-right)
- Assign compact labels:
  - alphabet set (e.g., `asdfjklqweruiopzxcvnm`)
  - 1-char then 2-char expansion when needed
- Show tiny tooltip near each visible match.
- Typing label jumps directly to associated index.

## Behavior

- `SEARCH_HINT_OPEN` -> enter hint mode + render labels
- `SEARCH_HINT_INPUT` -> accumulate chars, narrow candidates
- Exact label -> `SEARCH_JUMP_TO_INDEX`
- `Escape` -> close hint mode (stay in SEARCH)
- Query submit/next/prev invalidates old labels

---

## Navigation Extensions (Future-ready Hooks)

After active match is tracked robustly:

- `SEARCH_ACTION_YANK_TEXT`
- `SEARCH_ACTION_OPEN_URL`
- `SEARCH_ACTION_OPEN_URL_IN_SPLIT`

Detection:

- Active match text parse for URL candidates.
- Optional nearby-anchor resolution from active range.

These remain optional and can be deferred.

---

## File-Level Implementation Plan

## Phase A - Contracts and State

Files:

- `core/state.js`
- `core/state/searchState.js`
- `core/intents.js`
- `core/contracts/intents.js`
- `scripts/check-state-ownership.js`

Tasks:

1. Extend state for hint mode/runtime tracking.
2. Add intent types and payload validators.
3. Update ownership guardrails.

Exit:

- Unit tests for state helper behavior and contracts pass.

## Phase B - Runtime Scaffolding

Files:

- `browser/contentUi.js` or new `browser/searchRuntime.js`
- `browser/buffers.js`
- `core/adapters/platform/webContentsActions.js`

Tasks:

1. Inject runtime bootstrap per web buffer.
2. Add command send/response helpers.
3. Wire lifecycle cleanup on destroy/navigation.

Exit:

- Runtime handshake and basic `start/clear` command roundtrip works.

## Phase C - Dispatcher Integration

Files:

- `core/dispatcher/handlers/search.js`
- `core/dispatcher.js`

Tasks:

1. Replace native `findInPage` calls with runtime protocol.
2. Keep mode transitions in dispatcher (not motions).
3. Handle stale request rejection and deterministic updates.

Exit:

- Submit shows correct count immediately; next/prev stable.

## Phase D - Themed Highlights

Files:

- runtime module(s), theme update pathways (`core/dispatcher.js`, `browser/*`)

Tasks:

1. Render passive+active highlights with theme vars.
2. Re-style on theme change.
3. Clear overlays on search clear/mode exit.

Exit:

- Highlight style matches Noctra theme consistently.

## Phase E - Hint Mode (Visible-first)

Files:

- `motions/search.js`
- `core/dispatcher/handlers/search.js`
- runtime hint renderer module
- statusline hooks if adding hint indicator

Tasks:

1. Add hint mode intents + key handling.
2. Compute visible matches + label assignment.
3. Jump directly on label resolution.

Exit:

- User can jump to a visible match without `n` spam.

## Phase F - Hardening + Tests

Files:

- `tests/app/*`
- `tests/security/*`
- new runtime-focused tests (unit + integration)

Tasks:

1. Add race, mutation, and large-page tests.
2. Verify cleanup across buffer switches and reloads.
3. Add fallback strategy tests (optional native fallback).

Exit:

- Stable pass on focused and full suites.

---

## Performance Guardrails (Mandatory)

1. Match cap with graceful warning:
   - e.g. max 5000 matches.
2. Visible-only overlay rendering:
   - avoid rendering all offscreen marks.
3. Batched DOM reads/writes:
   - read rects together, write overlay DOM in one frame.
4. Throttled scroll/resize/mutation reaction.
5. Avoid full re-index on minor incremental changes when possible.

---

## Risk Register & Mitigation

1. **Dynamic pages mutate frequently**
   - Mitigation: stale flag + throttled rebuild, maintain UX continuity.
2. **Large document slowdown**
   - Mitigation: chunked indexing + cap + visible-only rendering.
3. **Selection/range invalidation**
   - Mitigation: rebuild from text segments, not long-lived fragile DOM refs only.
4. **Cross-origin iframes limitations**
   - Mitigation: explicit v1 limitation + later partial support where accessible.
5. **Theme contrast issues**
   - Mitigation: enforce contrast-aware fallback palette.

---

## Acceptance Criteria (Custom Engine Milestone)

1. Enter query and press `Enter` -> non-zero count appears immediately when matches exist.
2. Statusline `X/X` updates on submit and next/prev.
3. Highlights are Noctra-themed and react to theme changes.
4. `n` / `N` navigation is deterministic and smooth.
5. Visible-first hint mode:
   - labels appear quickly
   - typing label jumps to exact visible match.
6. `Escape` fully clears overlays/runtime/session and returns to `NORMAL`.
7. No significant UI jank on common pages.

---

## Suggested Execution Order

1. State + intents/contracts.
2. Runtime scaffold + command protocol.
3. Dispatcher switch from native to runtime.
4. Themed highlights.
5. Visible-first hints + jump.
6. Hardening/perf tuning.
7. Tests and polish.

Sprint discipline:

- At the end of each sprint, review and update `docs/search-mode-custom-engine-checklist.md` before starting the next sprint.

---

## Definition of Done

Feature is done when:

- SEARCH is fully backed by custom runtime (not native `findInPage` for primary behavior).
- Count is correct on first submit.
- Themeable highlights are stable across page/theme/focus changes.
- Visible-first direct jump works reliably.
- Performance is acceptable on medium/large pages.
- Tests cover happy path + mutation/race/perf edges.
