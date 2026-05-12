# Plan: Download Manager

## Status
- **Sidepanel**: ✅ Implemented as third tab in `core/history/panel.js` alongside History and Bookmarks
- **Modal**: 🔄 Phase 2 — live active/paused overlay (see below)
- **Retention**: Auto-prune after 200 entries (same as notifications)
- **Storage**: `~/.config/noctra/downloads.yml`

---

## What Was Built

### 1. `core/downloads/store.js`
YAML-backed storage mirroring `core/notifications/store.js`.
- Descending chronological order, atomic writes, 200-entry limit
- Functions: `readDownloads()`, `writeDownloads()`, `appendDownload()`, `removeDownloadsByIds()`

### 2. `core/downloads/service.js`
Active `DownloadItem` tracking via `Map<id, {item, ...}>`.
- `registerDownload(item, webContents, safePath)` — wired from `will-download`
- `pause(id)`, `resume(id)`, `cancel(id)`, `openFile(id)`, `showInFolder(id)`, `clearCompleted()`, `removePersistedByIds()`
- `getEntries()` returns `{active[], persisted[]}` with formatted bytes
- App icon progress via `BrowserWindow.setProgressBar()` and macOS dock badge
- Toast notifications on mutations (pause/resume/cancel/complete/interrupt)
- Emits to subscribers on every state change

### 3. Sidepanel Integration (`core/history/panel.js`)
Downloads implemented as `treeKind === "downloads"` — reuses all existing panel infrastructure.

**Row layout**:
```
▶  file.zip                    46% · 2.3 MB / 5.0 MB
⏸  archive.tar.gz             1.1 MB / 5.0 MB
✓  document.pdf               2.3 MB
✗  big.iso                    0 B / 4.0 GB
```

**Keybindings** (panel-focused only):
- `j`/`k` — navigate
- `d` — pause/resume active download
- `x` — cancel active / remove finished (floating y/n prompt)
- `D` — clear all finished downloads (floating y/n prompt)
- `r` — retry failed/interrupted download
- `o` or `Enter` — open downloaded file
- `gd` — show containing folder
- `H`/`L` — cycle tabs (history ↔ bookmarks ↔ downloads)

**Architecture note**: `d` is pause/resume; `x` is cancel/remove because `d` is already a delete-operator prefix in the sidepanel input state machine. `dd` is architecturally impossible as a single key match without rewriting the operator system.

### 4. Intents / Commands / Actions
- Intents: `DOWNLOADS_SHOW`, `DOWNLOADS_HIDE`, `DOWNLOADS_TOGGLE`, `DOWNLOADS_TOGGLE_FOCUS`, `DOWNLOADS_CLEAR_ALL`
- Action builders: `downloads_toggle`, `downloads_toggle_focus`
- Commands: `:downloads show/hide/toggle/focus/clear-all`

### 5. Dispatcher & Context
- Handlers live in `core/dispatcher/handlers/historyBookmarks.js`
- `core/semanticContextResolver.js` returns `"downloads"` context
- `core/focusResolver.js` and `core/statuslineModeLabel.js` required **no changes** — they already reference `historyPanel` generically

### 6. Config
- `global.storage.downloads_file` added to `defaults.js` and `schema.js`

### 7. Security Integration
- `core/adapters/platform/securityPolicy.js` calls `downloadsService.registerDownload()` on allowed/prompted `will-download`

---

## Phase 2: Live Downloads Modal

### Goal
Centered overlay showing **active/paused downloads only** with live progress bars, keyboard controls, and automatic updates. Modal takes keyboard priority; `Esc` closes it.

### Design Decisions
1. **Modal scope on open**: Show only active/paused at open time; completed items stay visible as stale state until modal closes. Avoids items disappearing under the user's cursor.
2. **Progress bar style**: Unicode block glyphs (`██████░░░░`) for visual density.
3. **Pause/resume key in modal**: `p` (distinct from sidepanel's `d` since modal has no operator state machine; keeping keys distinct avoids confusion).
4. **Default keybinding**: `<leader> D` opens the live modal.
5. **Empty list behavior**: If no active/paused downloads exist when opening (via icon button or `<leader> D`), show a toast notification instead of opening an empty modal.
6. **Tabline icon button**: Add a downloads icon to the tabline action buttons (right side) with a tooltip hint on hover, matching the existing icon button pattern.

### Approach
Follow the **bookmark insert scope modal** pattern exactly:
1. Custom HTML overlay view managed by `uiShellManager`
2. Controller class (`core/downloads/modal.js`) with `open()`/`close()`/`handleInput()`
3. Input routed via `main.js` before tree/buffer input
4. Focus resolver updated for `downloadsModalActive`

### Files to Create

#### `core/downloads/modal.js`
Controller class:
- `open()` — captures snapshot of active downloads, shows overlay. If no active/paused downloads, shows toast and returns without opening.
- `close()` — hides overlay, unsubscribes from live updates
- `isActive()` — boolean
- `handleInput(input)` — `j`/`k`, `p`, `c`, `x`, `o`, `r`, `Escape`
- `rerender()` — pushes updated HTML to overlay view
- Subscribes to `downloadsService` for live progress while open

### Files to Modify

#### `ui/shell/services/shellTemplates.js`
Add `DOWNLOADS_MODAL_OVERLAY_HTML` — centered card with:
- Title: "Live Downloads"
- List of active/paused items with Unicode block progress bars
- Footer hint row

#### `ui/shell/manager.js`
- Add `downloadsModalView`, `downloadsModalReady`, `downloadsModalVisible`
- `initializeDownloadsModalView()` following `initializeSelectionModalView()` pattern

#### `core/adapters/platform/overlayLayoutHost.js`
- Add `downloadsModalView` to `applyOverlayLayout` and `applyOverlayStack`
- Centered positioning: ~560px wide, height adapts to item count
- Z-order: above selection modal, below toast

#### `core/focusResolver.js`
- Add `downloadsModalActive` to snapshot
- Return `"DOWNLOADS_MODAL"` as focus owner when active

#### `main.js`
- Import `downloadsModal`
- Route input to `downloadsModal.handleInput()` when `focusSnapshot.downloadsModalActive`
- On close, return focus to underlying panel if visible

#### `core/dispatcher/handlers/historyBookmarks.js`
- Add `DOWNLOADS_LIVE_MODAL` intent → `downloadsModal.open()`

#### `core/intents.js`
- Add `DOWNLOADS_LIVE_MODAL`

#### `core/commandParser.js`
- Add `:downloads live` → `DOWNLOADS_LIVE_MODAL`

#### `motions/actionBuilders.js`
- Add `downloads_live_modal` action builder

#### `core/config/schema.js`
- Add `downloads_live_modal` to `ACTION_IDS`

#### Tabline Integration
- Add downloads icon button to tabline actions with tooltip hint on hover
- Clicking the icon triggers `DOWNLOADS_LIVE_MODAL` intent
- Icon should reflect active download state (e.g., badge or color change when downloads are active)

---

## Testing Checklist

- [x] Download starts → appears in sidepanel + YAML store
- [x] Progress updates → sidepanel re-renders live
- [x] Pause (`d`) → state toggles, glyph changes, download item pauses/resumes
- [x] Cancel (`x`) → state becomes cancelled, removed after 2s grace period
- [x] Complete → state becomes completed, app progress bar resets, dock badge clears
- [x] `D` on finished → clears all completed/cancelled/failed
- [x] `o` on completed → opens file with default app
- [x] `gd` → reveals file in finder/explorer
- [x] 200-entry limit prunes oldest entries
- [x] App icon progress bar accurate across multiple simultaneous downloads
- [x] Modal opens via `<leader> D` and tabline icon
- [x] Empty modal → toast instead
- [x] Modal shows live progress bars
- [x] Modal keyboard controls work (j/k/p/c/x/o/r/Esc)
- [x] Modal closes on Esc, focus returns correctly
