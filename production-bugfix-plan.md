# Production Bugfix Plan

## Scope

Fix bugs found in production around devtools split lifecycle, external URL opening, native new-tab focus, hard reload shortcut support, and new-tab visual flash.

## 1. Per-Tab Devtools Split

### Problem

Devtools split state is global. `manager.split.mode === "devtools"` plus one shared `manager.devtoolsView` / `manager.devtoolsTarget` applies across all tabs. When active tab changes, `syncDevtoolsTargetToLeftBuffer()` retargets the shared split. This leaves empty split space, can show stale content, and can crash when `openSplitDevtools()` receives an invalid or destroyed devtools view.

### Desired Behavior

Devtools split mode stays a split mode, but devtools ownership is per tab.

- Opening devtools on tab A opens a split tied to tab A.
- Switching to tab B hides/removes the devtools split unless tab B also has devtools open.
- Opening devtools on tab B creates/uses B's own devtools view.
- Switching back to tab A restores A's devtools split.
- Leader/devtools shortcut toggles devtools for the current tab only.

### Implementation

1. Add per-buffer devtools state.
   - Store `devtoolsView` on the buffer or in a `WeakMap` keyed by buffer.
   - Track whether that buffer's devtools split is open.

2. Replace shared `manager.devtoolsView` / `manager.devtoolsTarget` logic.
   - Keep only active presentation state in manager if needed.
   - Resolve active devtools view from `manager.getLeftBuffer()`.

3. Update `openDevtoolsSplit(manager, ratio)`.
   - Use current left buffer as owner.
   - Create owner devtools view if absent or destroyed.
   - Set split mode to `devtools` and ratio to configured value.
   - Attach only owner devtools view to window.
   - Call `setDevToolsWebContents()` on owner `webContents`.

4. Update tab switching.
   - Do not retarget devtools from one tab to another.
   - On active tab change, detach previous tab's devtools view from window.
   - If new active tab has devtools open, attach/layout its view and keep `split.mode = "devtools"`.
   - If new active tab has no devtools open, disable visible split or restore normal non-devtools split state as appropriate.

5. Update split layout.
   - `showSplit` for devtools should be true only when active left buffer has an open devtools view.
   - Layout only that active buffer's devtools view.
   - Move all inactive devtools views offscreen or detach them.

6. Update close behavior.
   - Closing right split while mode is `devtools` closes only active tab devtools.
   - Closing a buffer closes/destroys that buffer's devtools view.
   - Regular split close behavior unchanged.

7. Harden adapter.
   - In `openSplitDevtools()`, also guard `devtoolsView.webContents` and `devtoolsView.webContents.isDestroyed()`.
   - In `closeSplitDevtools()`, make close idempotent and safe for already-destroyed views.

### Tests

- Open devtools on tab A, switch to tab B: no split visible and no crash.
- Open devtools on tab A and B: switching restores each tab's own devtools.
- Close devtools on active tab: only active tab devtools closes.
- Close tab with devtools: devtools view destroyed safely.
- Extend `devtools-lifecycle` smoke to include tab switch.

## 2. External Links From Default Browser

### Problem

When Noctra is default browser, links opened from other apps dispatch `OPEN_URL`. `OPEN_URL` loads into the current active buffer. The receiving Noctra window is not reliably brought to front.

### Desired Behavior

- Every external URL opens in a new active tab.
- Existing Noctra window is brought to front.
- If no window exists, create one and then open URL in a new tab.

### Implementation

1. Change OS URL entry path.
   - `handleOpenUrl(url)` should not dispatch `OPEN_URL`.
   - Normalize/validate URL through existing URL policy.
   - Call `context.buffers.create(normalized, { activate: true })`.

2. Bring window forward.
   - If minimized, restore.
   - Call `show()` then `focus()`.
   - On macOS, call `app.focus({ steal: true })` if available/needed.

3. Fix `second-instance` flow.
   - Do not always call `createWindow()`.
   - Reuse latest existing window if present.
   - Create window only when there are no windows/contexts.
   - Queue URL if window is not ready.

4. Preserve internal `OPEN_URL` behavior.
   - Command-line URL open inside current tab can continue to use `OPEN_URL` if desired.
   - OS/default-browser URL path becomes distinct from in-app navigation.

### Tests

- `handleOpenUrl()` creates a new active buffer instead of loading current buffer.
- Existing focused tab URL remains unchanged after external URL open.
- Window `show()` / `focus()` is called for external URL.
- `second-instance` reuses existing window.

## 3. Cmd+T Native Shortcut Focus Loss

### Problem

Opening a new tab with native `Cmd+T` loses keyboard control for app shortcuts like leader. App menu path refocuses active buffer through `dispatchAndSync()`, but raw input shortcut path dispatches only.

### Desired Behavior

After `Cmd+T`, new tab is active and app keyboard shortcuts work immediately.

### Implementation

1. Update raw buffer shortcut path in `handleRawInput()`.
   - After dispatching `NEW_BUFFER` or `REOPEN_BUFFER`, call `buffers.focusActive()`.
   - Keep `appMenu.sync()`.

2. Confirm input coordinator binding.
   - Existing `buffers.subscribe()` should bind active input webContents on active change.
   - If focus still races, explicitly defer one focus with `setImmediate()` or equivalent after layout.

3. Keep menu behavior unchanged.

### Tests

- Simulate buffer shortcut path and assert `buffers.focusActive()` called.
- Smoke/manual: press `Cmd+T`, then leader shortcut works without mouse click.

## 4. Hard Reload Shortcut

### Problem

`CtrlOrCmd+Shift+R` is missing. Browsers use this for hard reload / cache bypass.

### Desired Behavior

- `Cmd+R` / `Ctrl+R`: normal reload.
- `Cmd+Shift+R` / `Ctrl+Shift+R`: hard reload ignoring cache.

### Implementation

1. Extend `RELOAD_PAGE` intent contract.
   - Add optional `ignoreCache: boolean`.

2. Extend dispatcher.
   - In reload handler, call `webContentsActions.reloadIgnoringCache()` when `intent.ignoreCache` is true.
   - Else call normal reload.

3. Extend platform adapter.
   - Add `reloadIgnoringCache(webContents)` using Electron `webContents.reloadIgnoringCache()`.
   - Guard with same `isUsableWebContents()` check.

4. Add app menu item.
   - Add `Hard Reload Page` with accelerator `CmdOrCtrl+Shift+R`.
   - Dispatch `{ type: INTENTS.RELOAD_PAGE, ignoreCache: true }`.

5. Consider keymap action only if needed.
   - Current request is native browser shortcut parity, so app menu accelerator is enough.

### Tests

- Intent contract accepts `ignoreCache`.
- Reload handler calls `reloadIgnoringCache` when true.
- App menu includes `CmdOrCtrl+Shift+R` item.

## 5. New Tab Content Flash

### Problem

Opening a new tab from command-line briefly shows content from the first tab. `createBuffer()` attaches and lays out the new `BrowserView` before target URL/dashboard load is ready, allowing stale or intermediate paint.

### Desired Behavior

New tabs should not show another tab's content, even briefly.

### Implementation

1. Change buffer creation ordering.
   - Create buffer and attach view.
   - Keep new view offscreen initially.
   - Start load or virtual document render.
   - Move into visible layout after initial load start/ready signal.

2. Avoid `about:blank` intermediate visibility.
   - For configured opening buffer, decide target before making active view visible.
   - For virtual dashboard, load virtual document before final visible layout.

3. Add safe fallback.
   - If load never starts or URL is `about:blank`, show view after short timeout to avoid invisible tab.

4. Keep split behavior intact.
   - Regular split and devtools split layout must still hide inactive buffers offscreen.

### Tests

- Create new active tab and assert previous active view is moved offscreen before new view is visible.
- Dashboard/opening buffer creation should not expose previous buffer bounds.
- Manual packaged check for command-line new tab flash.

## Verification Matrix

### Unit Tests

- Devtools adapter guards destroyed/missing webContents.
- Buffer manager devtools split ownership is per-buffer.
- External URL opens new buffer and focuses window.
- Raw `Cmd+T` path refocuses active buffer.
- Hard reload intent and menu path work.
- New buffer initial layout avoids stale visible bounds.

### Smoke Tests

- `devtools-lifecycle`: open devtools, create/switch tab, verify split visibility per tab, close devtools.
- Default browser/open-url: open two URLs from external entry and verify two tabs.
- Keyboard focus: `Cmd+T`, then leader action.

### Manual Production Checks

- Packaged macOS app: open external links from another app.
- Packaged macOS app: bring existing hidden/background window to front.
- Packaged macOS app: devtools split per tab across mouse and keyboard tab switching.
- Packaged macOS app: `Cmd+Shift+R` bypasses cache.
- Packaged macOS app: no visible previous-tab flash when opening command-line/new tabs.

## Risk Notes

- Devtools per-tab state touches layout, buffer lifecycle, and Electron devtools APIs. Most regression risk is split visibility and destroyed view handling.
- External URL behavior must stay separate from in-app `OPEN_URL`, otherwise command-line/open prompt semantics may change unintentionally.
- New-tab flash fix should avoid delaying interactive focus too much; use small ready/timeout fallback.
