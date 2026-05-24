# Search Mode Custom Engine Limitations (Current)

This document tracks known constraints for the current custom SEARCH runtime.

## Current limitations

- Matching and overlay placement are scaffolded and not yet full-document accurate for all DOM layouts.
- Visible-first hints are computed from runtime-scoped match data, not exhaustive viewport geometry.
- Cross-origin iframes are not searched.
- Shadow-root traversal is not exhaustive.
- Runtime match estimation/cap is currently heuristic-driven for performance safety.

## Runtime error behavior

- If custom runtime commands fail, SEARCH stays in custom mode and emits a warning toast (`search_runtime_error`).
- No native fallback path is used.

## Follow-up candidates

- Replace heuristic match totals with full index-backed counting.
- Add stronger viewport geometry ordering for hint labels.
- Expand iframe/shadow support where allowed.
- Add stronger runtime recovery strategy after command failures.
