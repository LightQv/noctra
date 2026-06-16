# Noctra Performance Improvement Plan

## Goal

Make Noctra feel snappy under normal browser use without fighting Electron/Chromium. Focus first on wasted main-process work, avoidable IPC, repeated renderer patches, and lifecycle leaks. Keep architecture compatible with the buffer-first browser model and future engine abstraction.

## Current Baseline

Noctra already has good separation in several areas:

- Buffers live under `browser/` and are exposed through `BufferManager`.
- UI shell overlays are isolated in `ui/shell/`.
- Runtime wiring is mostly centralized in `runtime/windowBootstrap.js` and `runtime/windowLifecycle.js`.
- Input binding has explicit cleanup through `runtime/inputCoordinator.js`.
- Buffer destruction clears loading timers and destroys `webContents` in `browser/buffers.js`.
- Context menu registration tracks disposables in `runtime/contextMenuRegistration.js`.

Main performance risk is not one obvious leak. It is fanout: small frequent events trigger too much work across shell renderers, menus, overlays, and webContents.

## Primary Findings

### 1. Buffer Change Fanout Is Too Broad

Location: `runtime/windowBootstrap.js:375`

Every `buffers.subscribe` notification currently performs broad UI work:

- `uiShell.renderTabline(snapshot)`
- `updateUrllineRender()`
- `updateLoadinglineRender()`
- `uiShell.updateStatuslineMode(...)`
- `uiShell.updateStatuslineSplitIndicator(...)`
- `uiShell.updateSplitDivider(...)`
- Possible input rebinding
- Possible overlay stack sync
- History/sidebar work for visits and titles

This happens for structure changes, title changes, pane interactions, and loading progress. Loading progress can tick often, so it can indirectly cause tabline, urlline, statusline, split divider, and app menu work.

Impact:

- Unnecessary main-process work.
- Extra `executeJavaScript` calls into shell UI.
- Extra layout and overlay stack churn.
- Risk of input latency spikes during navigation/loading.

Target:

- Route each change kind to the smallest needed update path.
- Loading progress should only update loadingline.
- Metadata should update tabline/urlline only when values that affect those views change.
- Structure/layout/active changes can still update the full shell.

### 2. App Menu Rebuilds On Every Buffer Notification

Location: `main.js:1739`

Current code:

```js
buffers.subscribe(() => appMenu.rebuild());
```

This rebuilds the application menu for all buffer changes, including loading progress. Menu rebuilds are much heavier than a small state update.

Impact:

- Repeated native menu work during page load.
- Possible stutter on macOS, where app menu updates can be expensive.

Target:

- Rebuild only on structural state changes: tab opened/closed/reordered, active buffer changed, split state changed, extension/menu capabilities changed.
- Prefer `appMenu.sync()` for mode/enablement changes if rebuild is not needed.

### 3. Loading Progress Timer Emits Generic Metadata

Location: `browser/buffers.js:103`

Current loading progress timer ticks every `120ms` and emits:

```js
this.emit("updated", { kind: "metadata" });
```

Impact:

- Loading progress looks like normal metadata.
- Subscribers cannot avoid full metadata render paths.
- Combined with app menu subscription, page load can rebuild menu repeatedly.

Target:

- Emit `kind: "loading"` for loading state/progress changes.
- Emit `kind: "metadata"`, `kind: "title"`, `kind: "favicon"`, or `kind: "url"` only when those fields change.
- Consider slowing progress ticks to `180-250ms` if visual quality remains OK.
- Consider only emitting when progress changed by a visible threshold.

### 4. Scroll Percent Polling Runs While Idle

Location: `runtime/windowLifecycle.js:84`

Current code polls every `200ms` and executes JS in the active page:

```js
webContentsActions.readScrollPercent(activeWebContents)
```

Impact:

- Constant JS execution into page even when user is idle.
- More work while content is already heavy.
- Battery and CPU cost.

Target:

- Near term: reduce fallback poll to `750-1000ms` and skip unless window focused.
- Better: update scroll percent after known Noctra scroll intents and on active buffer changes.
- Best later: a small content-side scroll observer sends throttled updates for trusted instrumented surfaces, with strict teardown on navigation/destroy.

### 5. Theme Push Broadcasts To All Buffers

Location: `core/adapters/renderer/uiShellPush.js:11`

`broadcastUiShellPush` sends `ui-shell:push` to the main window and every buffer webContents.

Impact:

- Theme update IPC goes to untrusted page surfaces that do not need shell messages.
- Work scales with tab count.
- Blurs process boundary intent.

Target:

- Send shell theme events only to shell UI webContents.
- Keep buffer content theme updates through explicit buffer mechanisms already present:
  - `buffers.setContentUiOptions(...)`
  - search runtime `theme-update`
  - dashboard/cat virtual buffer refresh

### 6. Loadingline Rendering Uses Repeated JS Injection

Location: `ui/shell/manager.js:398`

Each loadingline update runs `executeJavaScript` into loadingline overlay views. It also calls `syncOverlayStack()` from `renderLoadingline`.

Impact:

- Extra async work per progress tick.
- Overlay stack/layout can be touched more often than necessary.

Target:

- Only call `syncOverlayStack()` when loadingline visibility changes, not every render.
- Cache last loadingline pane model and skip no-op renders.
- Longer term: expose an explicit preload/API for overlay updates instead of string JS injection.

### 7. Closed Buffer History Can Retain Large Virtual HTML

Location: `browser/services/bufferLifecycleService.js:70`

Closed buffer history stores up to 50 snapshots. For virtual documents it stores full HTML.

Impact:

- Usually fine for dashboard/cat pages.
- Could become memory-heavy if future virtual buffers hold large generated documents.

Target:

- Add size cap for stored virtual document HTML.
- Store only restorable virtual docs from known internal URLs.
- Drop or compress large virtual documents.

## Implementation Phases

## Phase 1: Stop Hot-Path Fanout

Priority: highest

Risk: low to medium

Expected payoff: high

### Tasks

1. Add explicit loading update kind.

Files:

- `browser/buffers.js`
- `browser/services/bufferLifecycleService.js`
- `browser/services/rightPaneBufferService.js`

Change loading events from generic metadata to loading-specific notifications:

```js
this.emit("updated", { kind: "loading" });
```

Use this for:

- `did-start-loading`
- `dom-ready` progress bump
- progress timer ticks
- `did-finish-load` progress completion
- `did-stop-loading`
- `did-fail-load`

Keep `metadata` for URL/title/favicon/display-affecting changes.

2. Filter buffer subscriber work by change kind.

File:

- `runtime/windowBootstrap.js`

Suggested routing:

| Change kind | Work |
| --- | --- |
| `loading` | `updateLoadinglineRender()` only |
| `metadata`, `title-updated`, `visit` | tabline, urlline, loadingline if needed |
| `pane-interaction` | focus/status/split only |
| `layout` | urlline/loadingline/split divider/layout-related only |
| `structure` or `activeChanged` | full shell update |

3. Restrict app menu rebuilds.

File:

- `main.js`

Replace broad subscription:

```js
buffers.subscribe(() => appMenu.rebuild());
```

With filtered logic:

```js
buffers.subscribe((_snapshot, _active, change = {}) => {
  if (change.activeChanged || change.kind === "structure") {
    appMenu.rebuild();
  }
});
```

Review whether `layout` or split changes need rebuild. If they only affect enabled state, prefer `appMenu.sync()`.

4. Add tests.

Likely tests:

- `tests/app/buffer-lifecycle.test.js`: loading updates use `kind: "loading"`.
- New or existing runtime test: loading notification does not call tabline render or app menu rebuild.
- Existing smoke tests must still pass.

### Acceptance Criteria

- Loading progress no longer causes app menu rebuild.
- Loading progress no longer renders tabline/urlline/statusline unless required.
- Page load indicator still appears and completes.
- Tab title/url/favicon still update promptly.

## Phase 2: Reduce Idle Work

Priority: high

Risk: medium

Expected payoff: medium to high

### Tasks

1. Reduce scroll polling.

File:

- `runtime/windowLifecycle.js`

Near-term approach:

- Increase interval from `200ms` to `750-1000ms`.
- Skip if `win.isFocused()` is false.
- Skip for hidden/minimized windows if available.
- Keep immediate update after known scroll intents.

2. Add explicit scroll update hook after Noctra scroll commands.

Files likely involved:

- `core/dispatcher/handlers/navigation.js`
- `core/adapters/platform/webContentsActions.js`
- `runtime/windowLifecycle.js`

When Noctra executes scroll intents (`j`, `k`, `gg`, `G`, page up/down), schedule one read after the command settles.

3. Avoid polling while command overlays own focus.

If active UI mode does not need page scroll percent, skip.

### Acceptance Criteria

- Statusline scroll percent remains useful after scroll commands.
- Idle app no longer executes page JS five times per second.
- Input latency does not regress.

## Phase 3: De-Duplicate Shell Rendering

Priority: high

Risk: medium

Expected payoff: medium

### Tasks

1. Cache last render models.

Files:

- `ui/shell/manager.js`
- `ui/shell/services/shellRenderBridge.js`

Add cheap equality checks for:

- tabline snapshot if identical object or serialized stable key
- urlline panes/editing model
- loadingline pane state
- split divider state
- statusline mode/scroll/split indicator

Avoid sending `executeJavaScript` or `pushShellPatch` when state did not change.

2. Make loadingline stack sync conditional.

File:

- `ui/shell/manager.js`

Only call `syncOverlayStack()` when left/right visibility changes. Use `relayout()` only when bounds changed.

3. Batch shell patches where practical.

Current tabline has a 16ms debounce. Similar batching can be used for urlline/loadingline if needed.

### Acceptance Criteria

- Repeated same-state updates do not execute renderer JS.
- Loadingline progress updates do not relayout overlays unless visibility/bounds change.
- Existing UI cadence smoke test passes.

## Phase 4: Narrow IPC And Surface Broadcasts

Priority: medium

Risk: medium

Expected payoff: medium, improves security clarity

### Tasks

1. Replace broad `broadcastUiShellPush` for theme updates.

Files:

- `core/adapters/renderer/uiShellPush.js`
- `main.js`
- `core/dispatcher.js`

Create explicit helpers:

```js
sendUiShellPush({ win, type, payload })
sendBufferRuntimePush({ buffers, type, payload })
```

Use shell-only helper for `theme:update` consumed by `ui/shell/preload.js`.

2. Confirm no buffer webContents needs `ui-shell:push`.

Search before change:

```bash
rg "ui-shell:push|onThemeUpdate"
```

3. Keep search-runtime theme updates explicit.

Do not remove existing `sendSearchRuntimeCommand(..., "theme-update", ...)` unless replaced by a better content runtime channel.

### Acceptance Criteria

- `ui-shell:push` reaches only shell UI unless explicitly needed elsewhere.
- Theme updates still refresh shell, overlays, sidepanel, search highlights, dashboard/cat pages.
- Security tests still pass.

## Phase 5: Memory Retention Guardrails

Priority: medium

Risk: low

Expected payoff: protects future features

### Tasks

1. Cap closed virtual document snapshots.

File:

- `browser/services/bufferLifecycleService.js`

Suggested policy:

- Store full virtual document only when URL starts with `noctra://` and HTML length is below a configured cap.
- Use a constant like `MAX_CLOSED_VIRTUAL_DOCUMENT_HTML_BYTES`.
- If over cap, store URL/title but not HTML.

2. Keep closed buffer count at 50 or make configurable.

Current `maxClosedBuffers = 50` is reasonable.

3. Add tests for large virtual docs.

File:

- `tests/app/buffer-lifecycle.test.js`

### Acceptance Criteria

- Closing a huge virtual buffer does not retain huge HTML.
- Reopen still works for small internal virtual buffers.
- Normal web tab reopen behavior unchanged.

## Phase 6: Instrumentation And Regression Gates

Priority: high after first fixes

Risk: low

Expected payoff: keeps app snappy over time

### Tasks

1. Add lightweight perf counters in development/smoke mode.

Track counts for:

- tabline renders
- urlline renders
- loadingline renders
- app menu rebuilds
- `executeJavaScript` shell patch calls
- buffer notifications by kind

2. Extend smoke cadence probe.

Existing script:

- `tests/smoke/electron-ui-cadence.smoke.js`

Add scenario:

- Open page/load virtual page.
- Trigger loading events or mock navigation if possible.
- Assert loading does not cause excessive tabline/menu renders.

3. Document budgets.

Example budgets:

- Loading a page should cause zero app menu rebuilds after tab exists.
- Loading progress should not render tabline more than once unless title/url changes.
- Idle focused window should not execute page JS every 200ms.

### Acceptance Criteria

- Perf-sensitive render counts are testable.
- New UI work has guardrails.

## Suggested First Pull Request

Scope:

- Add `loading` notification kind.
- Filter `runtime/windowBootstrap.js` subscriber work.
- Filter app menu rebuild subscription.
- Add focused tests.

Why first:

- Highest expected payoff.
- Smallest architectural change.
- Directly addresses loading/page navigation stutter.
- Creates foundation for later render caching.

Files likely touched:

- `browser/buffers.js`
- `runtime/windowBootstrap.js`
- `main.js`
- `tests/app/buffer-lifecycle.test.js`
- Possibly one new runtime unit test if test harness exists.

Verification:

```bash
npm run test:app
npm run test:smoke:ui-cadence
npm run lint
```

If full app tests are slow, start with narrower tests:

```bash
node --test tests/app/buffer-lifecycle.test.js
node --test tests/app/shell-render-bridge.test.js
```

## Risks And Tradeoffs

### Risk: stale UI after filtering notifications

Mitigation:

- Start conservative.
- Full update on `structure`, `activeChanged`, and unknown kinds.
- Add tests for title/url/loadingline behavior.

### Risk: scroll percent feels less live

Mitigation:

- Update after Noctra-owned scroll commands.
- Keep slower fallback poll.
- Later add content-side throttled observer.

### Risk: changing shell broadcast breaks theme updates

Mitigation:

- Search all consumers first.
- Keep buffer theme paths explicit.
- Test theme runtime refresh.

### Risk: render caching hides needed updates

Mitigation:

- Cache only normalized render models.
- Invalidate on theme changes.
- Keep tests around theme refresh and shell rendering.

## Long-Term Direction

The app should move toward event-driven, minimal updates:

- Main process owns buffer state and privileged APIs.
- Renderer/shell receives typed, narrow updates.
- Hot paths avoid string JS injection where possible.
- Loading, scroll, title, favicon, split, and mode changes have separate event kinds.
- Perf budgets become part of tests, not manual taste.

This keeps Electron usable now and makes a future Rust rewrite clearer: the performance model becomes explicit before changing languages.
