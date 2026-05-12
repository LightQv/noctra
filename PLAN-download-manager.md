# Plan: Download Manager with Live Modal

## Status
- **Decision**: C — Modal and sidepanel can coexist; modal takes keyboard priority until `Esc`, then focus returns to the underlying panel.
- **Progress bar**: Unicode block glyphs (`██████████░░ 83%`)
- **Modal scope**: Active/paused only; completed items left visible if they finish while modal is open, cleared on next reopen
- **Sidepanel width**: Shared `0.2` ratio with history/bookmarks panel (single `leftInset` value)
- **Retention**: Auto-prune after 200 entries (same as notifications)

---

## Files to Create

### Domain Layer

#### 1. `core/downloads/store.js`
Mirrors `core/notifications/store.js`.
- Persists to `~/.config/noctra/downloads.yml` in **descending chronological order** (newest first)
- Atomic write: `tmp` → `rename`
- 200-entry limit (same as notifications)
- Schema per entry:
  ```yaml
  - id: "<uuid>"
    url: "https://example.com/file.zip"
    filename: "file.zip"
    savePath: "/Users/.../Downloads/file.zip"
    state: pending | paused | completed | cancelled | failed
    totalBytes: 10485760
    receivedBytes: 4194304
    startTime: 1715500800000
    endTime: null
    mimeType: "application/zip"
  ```
- Functions: `getDownloadsFilePath()`, `ensureDownloadsFile()`, `readDownloads()`, `writeDownloads(entries)`, `appendDownload(entry, limit = 200)`, `updateDownload(id, patch)`, `removeDownload(id)`

#### 2. `core/downloads/service.js`
Owns active `DownloadItem` references via `Map<id, item>`.
- `registerDownload(item, webContents)` — called from `will-download`
  - Applies policy (deny/prompt/allow), sets save path
  - Attaches `updated`/`done` listeners
  - Persists initial state to YAML
  - Triggers app icon progress update
- `pause(id)`, `resume(id)`, `cancel(id)`, `open(id)`, `reveal(id)`, `removeFromList(id)`
- `getActiveDownloads()`, `getAllDownloads()`, `subscribe(listener)`, `unsubscribe(listener)`
- **App icon integration**:
  - `BrowserWindow.setProgressBar(progress)` where `progress = max(received/total)` across active downloads
  - `-1` when no active downloads remain
  - macOS: `app.dock.setBadge(String(activeCount))` when active downloads exist
  - macOS: `app.dock.downloadFinished(filePath)` on individual completion
- Emits structured events: `{ type: 'updated'|'done'|'removed', download }`

#### 3. `core/downloads/panel.js`
Sidepanel `BrowserView` using `createPanelViewHost`, patterned after `core/history/panel.js`.

**Row layout**:
```
▶  file.zip                    4.2 MB / 10 MB   [████████░░░░░░░░░░] 40%  ↓ 2.1 MB/s
⏸  archive.tar.gz              1.1 MB / 5.0 MB  [████░░░░░░░░░░░░░░] 22%  paused
✓  document.pdf                2.3 MB           done
✗  big.iso                     0 B / 4.0 GB     [░░░░░░░░░░░░░░░░░░] 0%   cancelled
```

**Glyphs**: `▶` downloading, `⏸` paused, `✓` completed, `✗` cancelled/failed, `⚠` failed.

**Navigation**: `j`/`k`, `gg`/`G`, `<count>j`/`<count>k`, `Ctrl+d`/`Ctrl+u`
**Actions**:
- `p` — Pause / Resume toggle
- `dd` — Cancel active download, or Remove from list if finished/cancelled/failed
- `o` — Open file (completed only)
- `r` — Reveal in folder
- `y` — Yank path (or URL if incomplete) to clipboard
- `Enter` or `l` — Smart action: open if completed, toggle pause/resume if active, or open live modal if active/paused
- `Esc` — Unfocus panel

**Reactivity**: Subscribes to `downloadService` events. Every `updated`/`done`/`removed` event triggers `render()` without user intervention.

**Shared left inset**: Uses same `buffers.setLeftInset(width)` as history panel. Only one sidepanel visible at a time.

#### 4. `core/downloads/modal.js`
Centered overlay `BrowserView` for active/paused downloads only.

**Layout**:
```
┌─ Live Downloads ─────────────────────────┐
│                                          │
│  1. ▶  file.zip                          │
│        ████████████████████░░░░░░░░  67%   │
│        6.7 MB / 10 MB   ↓ 1.2 MB/s        │
│                                          │
│  2. ⏸  archive.tar.gz                    │
│        ████████░░░░░░░░░░░░░░░░░░░  25%   │
│        1.2 MB / 5.0 MB   paused           │
│                                          │
│  j/k navigate | p pause/resume | c cancel │
│  x remove | o open | r reveal | Esc close │
└──────────────────────────────────────────┘
```

**Behavior**:
- Opens via `:downloads live`, `<leader> D`, or sidepanel `Enter`/`l` on active/paused item
- Shows only active/paused downloads at open time
- If a download completes while modal is open, it stays visible (stale state) until modal is closed and reopened
- `j`/`k` navigate, `p` pause/resume, `c` cancel, `x` remove, `o` open, `r` reveal, `Esc` close
- Subscribes to service events for live progress updates
- Centered overlay, ~520×280px (adapts to content count)

---

### Dispatcher / Intents / Commands

#### 5. `core/dispatcher/handlers/downloads.js`
New handler file wiring intents to panel/service/modal.
Dependencies: `downloadService`, `downloadPanel`, `downloadModal`, `buffers`, `uiShell`, `notificationsService`, `clipboard`.

#### 6. Update `core/intents.js`
Add intents:
- `DOWNLOADS_SHOW`
- `DOWNLOADS_HIDE`
- `DOWNLOADS_TOGGLE`
- `DOWNLOADS_TOGGLE_FOCUS`
- `DOWNLOADS_LIVE_MODAL`
- `DOWNLOAD_PAUSE`
- `DOWNLOAD_RESUME`
- `DOWNLOAD_CANCEL`
- `DOWNLOAD_OPEN`
- `DOWNLOAD_REVEAL`
- `DOWNLOAD_REMOVE`

#### 7. Update `motions/actionBuilders.js`
Add builders:
- `downloads_toggle` → `<leader> d`
- `downloads_toggle_focus` → focus when panel already visible
- `downloads_live_modal` → `<leader> D`

#### 8. Update `core/commandParser.js`
Add commands:
- `:downloads` → `DOWNLOADS_SHOW`
- `:downloads hide` → `DOWNLOADS_HIDE`
- `:downloads toggle` → `DOWNLOADS_TOGGLE`
- `:downloads focus` → `DOWNLOADS_TOGGLE_FOCUS`
- `:downloads live` → `DOWNLOADS_LIVE_MODAL`
- `:download pause <id>` → `DOWNLOAD_PAUSE`
- `:download resume <id>` → `DOWNLOAD_RESUME`
- `:download cancel <id>` → `DOWNLOAD_CANCEL`
- `:download open <id>` → `DOWNLOAD_OPEN`
- `:download reveal <id>` → `DOWNLOAD_REVEAL`
- `:download remove <id>` → `DOWNLOAD_REMOVE`

---

### Integration

#### 9. Update `core/adapters/platform/securityPolicy.js`
Replace simple `will-download` handler with `downloadService.registerDownload(item, webContents)`.
The service then applies policy, sets save path, attaches listeners, and persists state.

#### 10. Update `runtime/windowBootstrap.js`
- Initialize `downloadPanel` alongside `historyPanel`
- Initialize `downloadModal`
- Wire `downloadPanel` `before-input-event` to `handleRawInput`
- Add `downloadPanel` to focus snapshot resolution
- Subscribe to `downloadService` for app icon progress updates

#### 11. Update `main.js`
- Import `downloadPanel`, `downloadModal`, `downloadService`
- Route focused input to `downloadPanel.handleFocusedInput()` when panel is focused (same pattern as `historyPanel`)
- Update `getStatuslineModeLabel()` and tabline/statusline sync when download panel focus changes

#### 12. Update `core/config/defaults.js` & `schema.js`
Add:
```yaml
global:
  storage:
    downloads_file: null  # defaults to ~/.config/noctra/downloads.yml
```

---

## Focus Coexistence Rules

- Modal and sidepanel **can coexist**
- Modal always takes **keyboard priority** when visible
- `Esc` closes modal, focus returns to whatever was underneath (sidepanel if visible, else normal buffer flow)
- Sidepanel can be opened/closed independently while modal is open, but modal retains keyboard focus
- Pattern matches existing bookmark modal behavior

---

## Testing Checklist

- [ ] Download starts → appears in sidepanel + modal + YAML store
- [ ] Progress updates → sidepanel re-renders live, modal bar advances
- [ ] Pause (`p`) → state toggles, glyph changes, download item pauses/resumes
- [ ] Cancel (`dd` on active) → state becomes cancelled, removed from modal on next reopen
- [ ] Complete → state becomes completed, app progress bar resets, dock badge clears
- [ ] `dd` on completed → removed from list and YAML
- [ ] `o` on completed → opens file with default app
- [ ] `r` → reveals file in finder/explorer
- [ ] `y` → copies path (or URL) to clipboard
- [ ] 200-entry limit prunes oldest entries
- [ ] Modal reopen clears completed items, shows only active/paused
- [ ] App icon progress bar accurate across multiple simultaneous downloads
