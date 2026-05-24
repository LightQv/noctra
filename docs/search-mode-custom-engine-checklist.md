# Search Mode Custom Engine Checklist

Use this checklist to track execution across sprints.

Rule:

- At the end of each sprint, review this checklist, update item states, and add short notes on blockers/decisions.

Legend:

- [ ] not started
- [~] in progress
- [x] done

---

## Sprint 1 - Contracts and State

- [x] Extend search state for hint mode/runtime tracking (`searchHintMode`, `searchHintInput`, etc.)
- [x] Add/validate new search intents (`SEARCH_HINT_OPEN`, `SEARCH_HINT_INPUT`, `SEARCH_JUMP_TO_INDEX`, ...)
- [x] Add/update payload contracts for all new intents
- [x] Update state ownership guardrails
- [x] Add/update state + contract tests
- [x] Sprint review complete (notes added below)

Notes:

- Added root search hint fields and helper mutations; kept runtime readiness map out of root state (planned as adapter-side table).
- Added intents/contracts for hint open/input/jump and internal runtime update payload shape.
- Expanded tests for search state reset/normalization and new intent validation cases.

---

## Sprint 2 - Runtime Scaffolding

- [x] Add injected search runtime module scaffold
- [x] Add main<->content command protocol helpers
- [x] Implement runtime handshake and ready state
- [x] Wire runtime lifecycle to buffer navigation/destroy events
- [x] Verify basic `start/clear` roundtrip on active web buffer
- [x] Sprint review complete (notes added below)

Notes:

- Added `browser/searchRuntime.js` scaffold with bootstrap + command handler (`ping/start/clear/theme-update`).
- Added protocol helpers in `core/adapters/platform/webContentsActions.js` (`ensureSearchRuntime`, `sendSearchRuntimeCommand`, `searchRuntimeStart`, `searchRuntimeClear`) with requestId generation.
- Runtime ready cache is WebContents-scoped (WeakMap) and invalidated on navigation/destroy lifecycle hooks.
- Added focused adapter/runtime tests covering bootstrap caching, navigation invalidation, and `start/clear` roundtrip response shape.

---

## Sprint 3 - Dispatcher Integration

- [x] Replace native `findInPage` flow with runtime command flow
- [x] Keep mode transitions centralized in dispatcher/services
- [x] Enforce stale request rejection (`requestId` safety)
- [x] Ensure count updates immediately on submit
- [x] Add/update integration tests for submit/next/prev/clear
- [x] Sprint review complete (notes added below)

Notes:

- Search dispatcher now drives runtime actions (`start/next/prev/clear`) via protocol helper and no longer depends on `findInPage`.
- Added internal `SEARCH_RUNTIME_UPDATE` handling with strict `requestId` matching to ignore stale async responses.
- Submit now updates counters from the first runtime response path (immediate update contract for runtime-backed flow).
- Added runtime-flow tests for submit, next/prev, clear, and stale update ordering behavior.

---

## Sprint 4 - Themed Highlights

- [x] Implement passive + active custom highlights
- [x] Bind highlight colors to Noctra theme vars
- [x] Re-apply theme on runtime/theme updates without full re-index
- [x] Clear all overlay artifacts on `SEARCH_CLEAR` and mode exit
- [x] Add visual/behavior tests for highlight correctness
- [x] Sprint review complete (notes added below)

Notes:

- Added runtime overlay root with passive and active highlight nodes plus CSS vars for themed colors.
- Added `theme-update` handling in runtime to restyle overlay in-place without rebuilding match/runtime session state.
- Wired global theme application path to push `theme-update` command to all live webContents.
- `clear` command now removes overlay DOM root to avoid stale artifacts after search exit.
- Added focused DOM-style runtime tests for highlight creation, theme restyle, and cleanup.

---

## Sprint 5 - Visible-First Hints and Jump

- [x] Add hint mode key flow in SEARCH (`SEARCH_HINT_OPEN`, input, cancel)
- [x] Compute visible match subset and stable ordering
- [x] Implement compact key label assignment
- [x] Render hint tooltips near visible matches
- [x] Jump directly to selected visible match label
- [x] Add tests for hint generation and jump behavior
- [x] Sprint review complete (notes added below)

Notes:

- Added SEARCH hint key flow (`f` to open, typed hint input, `Escape` to cancel) with dispatcher/runtime integration.
- Runtime now builds compact labels (`asdf...` then 2-char expansion), renders hint chips, and narrows/jumps on typed input.
- Added jump command support and state synchronization for hint mode, hint input, and visible hint count.
- Added focused tests for runtime hint generation/jump and dispatcher hint-mode behavior.

---

## Sprint 6 - Hardening and Performance

- [x] Add match cap and warning behavior
- [x] Batch DOM reads/writes for overlay updates
- [x] Throttle scroll/resize/mutation-driven recalculation
- [x] Add mutation observer invalidation/rebuild flow
- [x] Validate behavior on medium/large pages
- [x] Add race and stress tests
- [x] Sprint review complete (notes added below)

Notes:

- Added runtime match cap (`maxMatches = 5000`) with capped response flag for oversized query estimates.
- Added batched overlay refresh scheduling (`requestAnimationFrame` fallback to timed flush) to avoid repeated write bursts.
- Added throttled viewport handlers (`scroll`/`resize`) and throttled mutation observer invalidation hooks.
- Added generation token/debug telemetry path for race-hardening validation and runtime introspection in tests.
- Extended runtime tests to cover cap behavior and observer/lifecycle binding on larger query inputs.

---

## Sprint 7 - Polish and Optional Extensions

- [x] Add optional fallback behavior strategy (if runtime fails)
- [x] Validate statusline/search UX details and toasts
- [x] Document known limitations (iframes/shadow roots if deferred)
- [x] Evaluate optional active-match actions (`yank`, `open url`, split open)
- [x] Final acceptance pass against plan criteria
- [x] Sprint review complete (notes added below)

Notes:

- Runtime path is now custom-only (no native fallback path), with warning toast `search_runtime_error` on runtime failures.
- Verified statusline/search counters remain driven by dispatcher state updates and no UX regressions in focused tests.
- Added known limitations doc: `docs/search-mode-custom-engine-limitations.md`.
- Optional active-match actions were reviewed and intentionally deferred to post-milestone follow-up to keep sprint scope stable.
- Final acceptance pass completed against current milestone criteria (runtime-backed flow, hints, theme behavior, fallback).

---

## Global Definition of Done

- [x] Count is correct on first submit
- [x] Highlights are fully themeable and stable
- [x] Visible-first jump works reliably
- [x] `n`/`N` navigation remains deterministic
- [x] `Escape` cleanup is complete and reliable
- [x] Performance is acceptable on common and larger pages
- [x] Core tests for state/contracts/dispatcher/runtime are passing
