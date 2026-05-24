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

- [ ] Extend search state for hint mode/runtime tracking (`searchHintMode`, `searchHintInput`, etc.)
- [ ] Add/validate new search intents (`SEARCH_HINT_OPEN`, `SEARCH_HINT_INPUT`, `SEARCH_JUMP_TO_INDEX`, ...)
- [ ] Add/update payload contracts for all new intents
- [ ] Update state ownership guardrails
- [ ] Add/update state + contract tests
- [ ] Sprint review complete (notes added below)

Notes:

- 

---

## Sprint 2 - Runtime Scaffolding

- [ ] Add injected search runtime module scaffold
- [ ] Add main<->content command protocol helpers
- [ ] Implement runtime handshake and ready state
- [ ] Wire runtime lifecycle to buffer navigation/destroy events
- [ ] Verify basic `start/clear` roundtrip on active web buffer
- [ ] Sprint review complete (notes added below)

Notes:

- 

---

## Sprint 3 - Dispatcher Integration

- [ ] Replace native `findInPage` flow with runtime command flow
- [ ] Keep mode transitions centralized in dispatcher/services
- [ ] Enforce stale request rejection (`requestId` safety)
- [ ] Ensure count updates immediately on submit
- [ ] Add/update integration tests for submit/next/prev/clear
- [ ] Sprint review complete (notes added below)

Notes:

- 

---

## Sprint 4 - Themed Highlights

- [ ] Implement passive + active custom highlights
- [ ] Bind highlight colors to Noctra theme vars
- [ ] Re-apply theme on runtime/theme updates without full re-index
- [ ] Clear all overlay artifacts on `SEARCH_CLEAR` and mode exit
- [ ] Add visual/behavior tests for highlight correctness
- [ ] Sprint review complete (notes added below)

Notes:

- 

---

## Sprint 5 - Visible-First Hints and Jump

- [ ] Add hint mode key flow in SEARCH (`SEARCH_HINT_OPEN`, input, cancel)
- [ ] Compute visible match subset and stable ordering
- [ ] Implement compact key label assignment
- [ ] Render hint tooltips near visible matches
- [ ] Jump directly to selected visible match label
- [ ] Add tests for hint generation and jump behavior
- [ ] Sprint review complete (notes added below)

Notes:

- 

---

## Sprint 6 - Hardening and Performance

- [ ] Add match cap and warning behavior
- [ ] Batch DOM reads/writes for overlay updates
- [ ] Throttle scroll/resize/mutation-driven recalculation
- [ ] Add mutation observer invalidation/rebuild flow
- [ ] Validate behavior on medium/large pages
- [ ] Add race and stress tests
- [ ] Sprint review complete (notes added below)

Notes:

- 

---

## Sprint 7 - Polish and Optional Extensions

- [ ] Add optional fallback behavior strategy (if runtime fails)
- [ ] Validate statusline/search UX details and toasts
- [ ] Document known limitations (iframes/shadow roots if deferred)
- [ ] Evaluate optional active-match actions (`yank`, `open url`, split open)
- [ ] Final acceptance pass against plan criteria
- [ ] Sprint review complete (notes added below)

Notes:

- 

---

## Global Definition of Done

- [ ] Count is correct on first submit
- [ ] Highlights are fully themeable and stable
- [ ] Visible-first jump works reliably
- [ ] `n`/`N` navigation remains deterministic
- [ ] `Escape` cleanup is complete and reliable
- [ ] Performance is acceptable on common and larger pages
- [ ] Core tests for state/contracts/dispatcher/runtime are passing
