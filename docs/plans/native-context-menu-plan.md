# Native Context Menu Implementation Plan

## Objective

Implement native right-click context menus for **all** Noctra surfaces:

1. **Web page content** (inputs, text selections, links, images, page background)
2. **Noctra UI shell** (tabline, urlline, statusline)
3. **Sidepanel trees** (history, bookmarks, downloads)

Menus must be **native Electron** (`Menu.buildFromTemplate` + `popup`) for phase 1.
Right-click must be strictly separated from left-click: no text selection changes, no tab switches, no pane focus changes, no overlay dismissals.

---

## Principles

- **Native first**: use `electron.Menu` for speed, correctness, and disabled-state support.
- **Intent-driven**: menu actions dispatch existing intents or call existing services where possible.
- **Centralized**: one builder module per process boundary; no scattered menu logic.
- **Right-click isolation**: every handler filters `input.button === "right"` and does not fall through to left-click paths.
- **Security**: all navigable URLs validated through existing `validateNavigableUrl`; privileged actions stay in main.

---

## Global Rules

- **Video**: no context menu.
- **Statusline**: no context menu.
- **Left-click behavior**: never triggered by right-click.
- **Disabled items**: computed from runtime snapshot (nav state, split state, download state, selection state).

---

## 1. Web Content Context Menus

### 1.1 Input / Editable

**Trigger**: `webContents.on("context-menu", ...)` with `params.isEditable === true`.

**Items**:
- Cut
- Copy
- Paste
- Delete
- Select All
- ---
- DevTools (inspect targeted element)

**Implementation**:
- Use native roles (`cut`, `copy`, `paste`, `delete`, `selectAll`) where supported.
- DevTools: `webContents.inspectElement(params.x, params.y)`.

### 1.2 Text Selection

**Trigger**: `params.selectionText.length > 0` and not editable/link/image.

**Items**:
- Copy
- Search "<selection>" in default search engine
- ---
- DevTools (inspect targeted element)

**Implementation**:
- Search: `buildSearchUrl(defaultEngine, selectionText)` → dispatch `OPEN_URL` in new buffer.
- Default engine from `configService.getConfigValue("browser.default_search_engine", "duckduckgo")`.

### 1.3 Link

**Trigger**: `params.linkURL` present.

**Items**:
- Open Link in New Tab
- Open Link in Split
- Open Link in New Window
- Copy Link Address
- Search "<selection-or-link-text>" in default search engine
- ---
- DevTools (inspect targeted element)

**Implementation**:
- New tab: `buffers.create(validatedUrl)`.
- Split: `openUrlInRightSplit(validatedUrl)` (see helper in §6).
- New window: create new BrowserWindow + dispatch OPEN_URL (see §6.2).
- Copy: `clipboard.writeText(params.linkURL)`.

### 1.4 Image (direct image)

**Trigger**: `params.hasImageContents === true` and no link parent.

**Items**:
- Open Image in New Tab
- Save Image As...
- Copy Image
- Copy Image Address
- ---
- DevTools (inspect targeted element)

**Implementation**:
- Save image: use `session.downloadURL(srcURL)` or `webContents.downloadURL(srcURL)` with existing download policy.
- Copy image: `webContents.copyImageAt(params.x, params.y)` if available; otherwise disabled.
- Copy address: `clipboard.writeText(params.srcURL)`.

### 1.5 Linked Image (image inside a link)

**Trigger**: `params.linkURL` and `params.hasImageContents` both present.

**Items** (exact order):
1. Open Link in New Tab
2. Open Link in Split
3. Open Link in New Window
4. Copy Link Address
5. Search "<text>" in default engine
6. ---
7. Open Image in New Tab
8. Save Image As...
9. Copy Image
10. Copy Image Address
11. ---
12. DevTools (inspect targeted element)

### 1.6 Everything Else (page background)

**Trigger**: default fallback.

**Items**:
- Previous Page *(disabled if `!canGoBack`)*
- Next Page *(disabled if `!canGoForward`)*
- Refresh
- ---
- Bookmark...
- Save As...
- ---
- DevTools

**Implementation**:
- Previous/Next/Refresh: dispatch existing intents (`NAV_BACK`, `NAV_FORWARD`, `RELOAD_PAGE`).
- Bookmark: dispatch `BOOKMARKS_ADD_ROOT_ACTIVE` (adds current active page).
- Save As: `dialog.showSaveDialog` + `webContents.savePage(path, "HTMLComplete")`.
- DevTools: toggle devtools for active buffer.

### 1.7 Detection Precedence

1. Blocked video
2. Editable input
3. Linked image
4. Image
5. Link
6. Text selection
7. Default page

---

## 2. Noctra UI Shell Context Menus

All UI shell menus are triggered by renderer `contextmenu` events sent via **trusted IPC** (`ui-shell:context-menu`).

### 2.1 Urlline

**Right-click on URL input** (`data-urlline-action="start-edit"`):
- Cut
- Copy
- Paste
- Delete
- Select All

*No DevTools item.*

**Right-click on prev/next/refresh icon buttons** (`data-urlline-action` = back/forward/reload/stop):
- **No menu opened.**

**Right-click anywhere else on urlline** (empty background):
- Hide Urlline

**Implementation**:
- In `ui/urlline.js`, add `contextmenu` listener alongside existing `click` listener.
- Call `event.preventDefault()`.
- Send IPC: `window.uiShell.contextMenu({ zone: "urlline", target: actionOrNull, x: event.clientX, y: event.clientY })`.
- Main handler builds menu from `zone` and `target`.
- Hide urlline: dispatch `INTENTS.TOGGLE_URLLINE`.

### 2.2 Tabline

**Right-click on a tab** (`.tab` with `data-tab-id`):
- Close Tab
- Close All Tabs to the Left *(disabled if tab is first)*
- Close All Tabs to the Right *(disabled if tab is last)*
- Close All Tabs
- ---
- Duplicate Tab
- Split Tab *(disabled if split already active)*

**Right-click on new-tab button, action icons, or empty tabline background**:
- **No menu opened.**

**Implementation**:
- In `ui/tabline.js`, add `contextmenu` listener.
- Call `event.preventDefault()`.
- Send IPC: `window.uiShell.contextMenu({ zone: "tabline", target: "tab", tabId: Number(tab.dataset.tabId), x, y })`.
- Actions:
  - Close: `buffers.close(tabId)`.
  - Close left: find index, close all before it.
  - Close right: find index, close all after it.
  - Close all: close every buffer, then `openConfiguredBuffer()`.
  - Duplicate: `buffers.create(buffer.url)` (copy URL and kind).
  - Split: if `!buffers.isSplitEnabled()`, `openVerticalSplit()` then assign URL to right pane; else replace right pane source with this tab's buffer.

### 2.3 Statusline

**Right-click anywhere**:
- **No menu opened.**

**Implementation**:
- In `ui/shell/services/shellTemplates.js` STATUSLINE_OVERLAY_HTML, add script that calls `preventDefault()` on `contextmenu`.
- No IPC needed.

### 2.4 Urlline Editing Context Menu — Future Enhancement

The current urlline uses a custom `<button>` + `<span>` rendering with cursor-only state (`urllineBuffer` + `urllineCursorIndex`). This means the context menu for an actively-editing urlline only supports:

- Paste (inserts clipboard at cursor)
- Delete (deletes character at cursor)
- Select All (copies entire buffer)

**Future work**: Add a full text selection model (`selectionStart`/`selectionEnd`) to `urllineState`. This would enable:
- Proper Cut/Copy/Paste semantics with selection
- Shift+arrow selection in the urlline
- Mouse drag-to-select
- A truly native-equivalent editing context menu

This is a standalone feature worth its own design pass after the context menu plan is fully executed.

---

## 3. Sidepanel Context Menus

Sidepanel is a `BrowserView` with its own `webContents`. Right-click is intercepted via `before-mouse-event` or renderer `contextmenu` → IPC.

### 3.1 History

**Right-click on a day/folder row** (`data-row-type="day"`):
- Open Every Link in New Tab *(one tab per entry in that day)*
- Delete Folder
- Hide Sidepanel

**Right-click on an entry row** (`data-row-type="entry"`):
- Open in New Tab
- Open in Split *(if split active, replace right pane)*
- Delete Entry
- Hide Sidepanel

**Right-click anywhere else** (empty list background):
- Delete All
- Hide Sidepanel

### 3.2 Bookmarks

**Right-click on a folder row** (`data-row-type="folder"`):
- Open Every Link in New Tab *(one tab per entry in folder + descendants)*
- Delete Folder
- Hide Sidepanel

**Right-click on an entry row** (`data-row-type="entry"`):
- Open in New Tab
- Open in Split *(replace right pane if split active)*
- Delete Entry
- Hide Sidepanel

**Right-click anywhere else**:
- Delete All
- Hide Sidepanel

### 3.3 Downloads

**Right-click on a download row** (`data-row-type="download"`):
- Open File Location
- Open File *(disabled if not completed)*
- Hide Sidepanel

**Right-click anywhere else**:
- Delete All Complete
- Hide Sidepanel

**Implementation**:
- In `core/history/panel.js`, extend `handleMouseEvent` to branch on `input.button === "right"`.
- Call `event.preventDefault()` on the sidepanel webContents event.
- Use `resolveMouseTarget(x, y)` (already exists) to get `rowType` and `rowIndex`.
- Build menu in main based on `treeKind` and `rowType`.
- Actions reuse existing helpers:
  - Open entry: `sidepanelController.openCurrent(newTab = true)` for new tab; `openUrlInRightSplit(entry.url)` for split.
  - Open folder links: new helper `openFolderLinksInNewTabs(folderNode)` that walks children and creates one buffer per entry.
  - Delete entry: `historyService.deleteEntry(dateKey, entryId)` or `bookmarksService.deleteAll()` / `panel.deleteCurrentFavorite()`.
  - Delete all: `historyService.deleteAll()` / `bookmarksService.deleteAll()` / `downloadsService.clearCompleted()`.
  - Delete all complete downloads: `downloadsService.clearCompleted()`.
  - Open file location: `downloadsService.showInFolder(id)`.
  - Open file: `downloadsService.openFile(id)` but **only if state === "completed"**.
  - Hide sidepanel: `sidepanelController.hide()`.

---

## 4. Right-Click Isolation (No Left-Click Side Effects)

### 4.1 Web Contents

- Current: `selectionClipboardObserver.js` attaches `before-mouse-event` and triggers `manager.handlePaneInteraction()` on both mouseDown and mouseUp, regardless of button.
- **Fix**: filter `input.button === "left"` before calling `handlePaneInteraction()` and `maybeCopySelectionToClipboard()`.
- `inputCoordinator.js` already binds `before-mouse-event`; right-click events there should be routed to context menu and **not** to overlay dismissal.

### 4.2 UI Shell (Tabline / Urlline)

- Both `ui/tabline.js` and `ui/urlline.js` inject `click` listeners only.
- Add separate `contextmenu` listeners that `preventDefault()` and send IPC.
- Never fall through to the `click` handler.

### 4.3 Sidepanel

- `core/history/panel.js` `handleMouseEvent()` currently returns early for `input.button !== "left"`.
- Extend to handle `"right"` explicitly: resolve target, build menu, prevent default.
- Do **not** call `this.focus()` or `this.openCurrent()` on right-click.

### 4.4 Overlay Dismissal

- `main.js` `handleMouseInput()` currently only handles `input.button === "left"`.
- Ensure it stays that way; right-click must never dismiss telescope/selection modal/downloads modal/whichKey.

---

## 5. New / Modified Modules

### 5.1 Main Process

| File | Purpose |
|------|---------|
| `core/adapters/platform/contextMenuBuilder.js` | Builds `MenuItemConstructorOptions[]` from context descriptor and runtime snapshot. |
| `core/adapters/platform/contextMenuActions.js` | Executes actions: dispatch intents, call buffer/download services, open devtools, clipboard. |
| `runtime/contextMenuRegistration.js` | Registers `webContents.on("context-menu")` for all buffers; wires UI shell IPC; manages cleanup. |

### 5.2 Renderer / Preload

| File | Change |
|------|--------|
| `ui/shell/preload.js` | Add `contextMenu(payload)` → `ipcRenderer.send("ui-shell:context-menu", payload)`. |
| `ui/tabline.js` | Add `contextmenu` listener; send IPC with zone/tabId. |
| `ui/urlline.js` | Add `contextmenu` listener; send IPC with zone/action. |
| `ui/shell/services/shellTemplates.js` | Add `contextmenu` prevention for statusline. |

### 5.3 Sidepanel

| File | Change |
|------|--------|
| `core/history/panel.js` | Extend `handleMouseEvent` for right-click branch; add `openFolderLinksInNewTabs`, `openEntryInSplit` helpers. |
| `core/adapters/platform/panelViewHost.js` | Ensure `before-mouse-event` forwards right-clicks unchanged (already does). |

### 5.4 IPC Contracts

| File | Change |
|------|--------|
| `core/contracts/ipc.js` | Add `"ui-shell:context-menu"` validator: `{ zone: validateEnum(["urlline","tabline","sidepanel"]), target?: validateString, tabId?: validateInteger, x: validateFiniteNumber, y: validateFiniteNumber }`. |
| `runtime/ipcRegistration.js` | Add `onContextMenu` handler; route to `contextMenuBuilder`. |

### 5.5 Buffer Manager Helpers

| File | Change |
|------|--------|
| `browser/manager.js` | Add `duplicateTab(id)`, `closeAllTabs()`, `openUrlInRightSplit(url)`. |
| `browser/services/bufferLifecycleService.js` | Add `duplicateBuffer(manager, id)`, `closeAllBuffers(manager)`. |
| `browser/services/splitController.js` | Add `openUrlInRightSplit(manager, url)` helper. |

---

## 6. Helpers to Implement

### 6.1 `openUrlInRightSplit(manager, url)`

```
if (!manager.split.enabled) {
  manager.openVerticalSplit();
}
// Ensure right pane buffer exists
manager.ensureRightPaneBuffer();
// Create a new buffer with the URL and assign as right pane source
const buffer = manager.create(url);
manager.split.rightPaneSourceBuffer = buffer;
manager.focusedPane = "right";
manager.layoutViews();
manager.focusActive();
manager.notify({ kind: "structure", activeChanged: true });
```

*Open question*: should split-open create a new buffer (adds tab) or load into an existing mirrored pane?
**Decision**: create a new buffer so the URL becomes a first-class tab. This matches "open in split" semantics from modern browsers.

### 6.2 `openLinkInNewWindow(url)`

Since `setWindowOpenHandler` denies all `window.open`, context menu "Open in New Window" must use app-controlled window creation.

```
function openLinkInNewWindow(url) {
  createWindow(); // existing main.js helper
  // New window will have pending URL; dispatch after creation
  const context = getLastWindowContext();
  if (context) {
    context.dispatch(context.win, { type: INTENTS.OPEN_URL, url }, context.state);
  }
}
```

If multi-window URL dispatch race exists, queue the URL in `pendingUrls` and let `createWindow` drain it.

### 6.3 `openFolderLinksInNewTabs(folderNode)`

Recursive walk of folder children. For every `type === "entry"` node, call `buffers.create(entry.url)`.

---

## 7. Disabled-State Rules

| Context | Item | Disable When |
|---------|------|--------------|
| Page default | Previous Page | `!canGoBack` |
| Page default | Next Page | `!canGoForward` |
| Link | Open in New Window | Always disabled until multi-window polished *(or use §6.2)* |
| Tabline | Close All Left | Tab index === 0 |
| Tabline | Close All Right | Tab index === last |
| Tabline | Split Tab | `buffers.isSplitEnabled() && split.mode === "regular"` |
| Downloads | Open File | `entry.state !== "completed"` |
| Downloads | Open File Location | `!entry.savePath` |
| Sidepanel entry | Open in Split | *(never disabled; if split active, replaces right pane)* |

---

## 8. Security Boundaries

- All new IPC channels validated via `core/contracts/ipc.js`.
- URL-line and tabline context menu IPC restricted to `SURFACE_ROLES.TRUSTED_SHELL`.
- Web content URLs validated via `validateNavigableUrl` before `buffers.create()` or `active.load()`.
- Download URLs for "Save Image As" go through existing `will-download` policy.
- `clipboard.writeText` only for strings derived from web params or sidepanel entries; never raw renderer input.
- DevTools inspect requires active `webContents` that is not destroyed.

---

## 9. Implementation Phases

### Phase A — Web Content Context Menu
1. Create `core/adapters/platform/contextMenuBuilder.js` with all web content branches.
2. Create `core/adapters/platform/contextMenuActions.js` with action executors.
3. Register `webContents.on("context-menu")` in `runtime/contextMenuRegistration.js`.
4. Wire into `main.js` window creation lifecycle.
5. Guard `selectionClipboardObserver.js` and `inputCoordinator.js` to ignore right-click for left-click side effects.
6. Tests: template composition per context type, disabled states, URL validation.

### Phase B — UI Shell Context Menus
1. Add `contextMenu` to `ui/shell/preload.js`.
2. Add `contextmenu` listeners to `ui/tabline.js` and `ui/urlline.js`.
3. Add IPC contract and handler in `runtime/ipcRegistration.js`.
4. Implement tabline actions: close left/right/all, duplicate, split.
5. Implement urlline actions: input edit menu, hide urlline.
6. Add statusline `preventDefault` in `shellTemplates.js`.
7. Tests: IPC payload validation, menu presence/absence per zone, action side effects.

### Phase C — Sidepanel Context Menus
1. Extend `core/history/panel.js` `handleMouseEvent` for right-click.
2. Add helpers: `openFolderLinksInNewTabs`, `openUrlInRightSplit`.
3. Build sidepanel menu templates in `contextMenuBuilder.js`.
4. Implement delete/open actions for history, bookmarks, downloads.
5. Tests: right-click target resolution, folder open, disabled download open.

### Phase D — Hardening & Polish
1. Verify right-click never triggers left-click behavior anywhere.
2. Verify disabled states update correctly after state changes.
3. Verify menu closes when window loses focus.
4. Add smoke tests for end-to-end flows.

### Step 0 — Intent Pipeline Refactor & Right-click Selection Fix

**Objective:** Before moving to Phase E, close the architectural gap between context menu actions and the intent/leader pipeline. Every browser-level behavior reachable from a context menu must also be reachable from the keyboard (via leader actions) and must flow through the dispatcher (via intents). Native/platform-only helpers (clipboard, inspect element, save dialog) may remain direct. Fix the right-click text selection flash on non-editable web content.

**Guiding Rules:**
1. Every leader action emits an intent — already true; do not break this.
2. Every browser-level context menu action dispatches an intent — close, duplicate, split, delete history/bookmark/download entries, bulk open, etc.
3. Native editing and platform helpers stay direct — `cut`, `copy`, `paste`, `selectAll`, `inspectElement`, `dialog.showSaveDialog`, `shell.openExternal`, `clipboard.writeText`.
4. Guard logic is not duplicated — extract shared predicates (e.g., `canBufferBeSplit`) and use them in both dispatcher handlers and context menu enablement.
5. Right-click isolation extends to selection — clear `window.getSelection()` after `event.preventDefault()` on non-editable content to suppress the word-under-cursor flash.

**New Intents:**

| Intent | Payload | Description |
|--------|---------|-------------|
| `CLOSE_ALL_BUFFERS` | — | Close every buffer; fall back to configured home buffer. |
| `DUPLICATE_BUFFER` | `{ bufferId: integer }` | Create a copy of the specified buffer. |
| `OPEN_URL_IN_SPLIT` | `{ url: string }` | Open a URL in the right split pane (creating the split if needed). |
| `NEW_BUFFERS` | `{ urls: string[] }` | Bulk-create buffers from an array of URLs. |
| `DELETE_HISTORY_ENTRY` | `{ dateKey: string, entryId: string }` | Remove a single history entry. |
| `DELETE_HISTORY_DATE` | `{ dateKey: string }` | Remove an entire history day/folder. |
| `DELETE_BOOKMARK_NODE` | `{ nodeId: string }` | Remove a bookmark entry or folder. |
| `DOWNLOADS_CLEAR_COMPLETED` | — | Clear all completed download entries. |
| `SHOW_DOWNLOAD_IN_FOLDER` | `{ downloadId: string }` | Reveal a downloaded file in the file manager. |
| `OPEN_DOWNLOAD_FILE` | `{ downloadId: string }` | Open a completed download with the default application. |

**Extended Intents:**

| Intent | Added Payload Field | Behavior |
|--------|---------------------|----------|
| `CLOSE_LEFT_BUFFERS` | `{ index?: integer }` | If `index` omitted, close all left of *active* buffer. If provided, close all left of the buffer at that index. |
| `CLOSE_RIGHT_BUFFERS` | `{ index?: integer }` | Same pattern as `CLOSE_LEFT_BUFFERS`. |

**New Leader Actions:**

| Action ID | Intent | Availability Guard |
|-----------|--------|--------------------|
| `close_all_buffers` | `CLOSE_ALL_BUFFERS` | — |
| `duplicate_buffer` | `DUPLICATE_BUFFER` | Buffer must exist and not be editable. |
| `open_url_in_split` | `OPEN_URL_IN_SPLIT` | `canBufferBeSplit(activeBuffer)` |
| `new_buffers` | `NEW_BUFFERS` | — |
| `delete_history_entry` | `DELETE_HISTORY_ENTRY` | Sidepanel must be visible on history tree. |
| `delete_history_date` | `DELETE_HISTORY_DATE` | Sidepanel must be visible on history tree. |
| `delete_bookmark_node` | `DELETE_BOOKMARK_NODE` | Sidepanel must be visible on bookmarks tree. |
| `downloads_clear_completed` | `DOWNLOADS_CLEAR_COMPLETED` | Sidepanel must be visible on downloads tree. |
| `show_download_in_folder` | `SHOW_DOWNLOAD_IN_FOLDER` | Download entry selected and has `savePath`. |
| `open_download_file` | `OPEN_DOWNLOAD_FILE` | Download entry selected and `state === "completed"`. |

**Context Menu → Intent Mapping:**

*Web Content (`createWebContextMenuActions`):*
- `openLinkInSplit(url)` → `OPEN_URL_IN_SPLIT` (was direct `buffers.openUrlInRightSplit()`)
- `cut` / `copy` / `paste` / `selectAll` / `deleteItem` → **keep direct** (native editing)
- `copyLinkAddress` / `copyImageAddress` → **keep direct** (clipboard helper)
- `saveImageAs` / `savePageAs` → **keep direct** (platform download/dialog)
- `inspectElement` → **keep direct** (dev-only)
- `sendByEmail` → **keep direct** (platform sharing)
- All others already use intents — no change.

*UI Shell (`createUIShellContextMenuActions`):*
- `closeTab(tabId)` → `CLOSE_BUFFER` with `id: tabId`
- `closeAllTabsToLeft(tabId)` → `CLOSE_LEFT_BUFFERS` with `index`
- `closeAllTabsToRight(tabId)` → `CLOSE_RIGHT_BUFFERS` with `index`
- `closeAllTabs()` → `CLOSE_ALL_BUFFERS`
- `duplicateTab(tabId)` → `DUPLICATE_BUFFER` with `bufferId`
- `splitTab(tabId)` → `SPLIT_VERTICAL`, then assign URL to right pane via shared `canBufferBeSplit()`
- `copyUrl()` → **keep direct** (clipboard helper)
- `editUrl()` → **keep direct** (inline UI state)
- `hideUrlline()` → already uses `TOGGLE_URLLINE` — no change.

*Sidepanel (`createSidepanelContextMenuActions`):*
- `openInNewTab()` → `NEW_BUFFER`
- `openInSplit()` → `OPEN_URL_IN_SPLIT`
- `openFolderLinksInNewTabs()` → `NEW_BUFFERS`
- `deleteEntry()` → `DELETE_HISTORY_ENTRY` / `DELETE_BOOKMARK_NODE`
- `deleteFolder()` → `DELETE_HISTORY_DATE` / `DELETE_BOOKMARK_NODE`
- `deleteAll()` → `HISTORY_DELETE_ALL` / `BOOKMARKS_DELETE_ALL`
- `deleteAllComplete()` → `DOWNLOADS_CLEAR_COMPLETED`
- `showInFolder()` → `SHOW_DOWNLOAD_IN_FOLDER`
- `openFile()` → `OPEN_DOWNLOAD_FILE`
- `hideSidepanel()` → `HISTORY_HIDE` / `BOOKMARKS_HIDE` / `DOWNLOADS_HIDE` (based on `treeKind`)

**Right-click Selection Fix:**

In `runtime/contextMenuRegistration.js`, inside `handleContextMenu`, immediately after `event.preventDefault()`:

```javascript
if (!params.isEditable && webContents && !webContents.isDestroyed()) {
  webContents.executeJavaScript(
    "window.getSelection && window.getSelection().removeAllRanges()",
    true,
  ).catch(() => {});
}
```

- `isEditable === true` (text inputs, CodeMirror) → **skip**. The selection is needed for Cut/Copy/Paste.
- `isEditable === false` (page background, links, images) → **clear**. Removes the word-under-cursor flash before the native menu renders.

**Guard Deduplication:**

Extract `browser/services/splitEligibility.js` with a shared `canBufferBeSplit(buffer)` predicate. Use in:
1. `core/dispatcher/handlers/buffers.js` — `SPLIT_VERTICAL` handler
2. `core/adapters/platform/contextMenuBuilder.js` — `canSplit` runtime snapshot field
3. `core/adapters/platform/contextMenuActions.js` — `splitTab()` action

**Files to Modify / Create:**

| File | Purpose |
|------|---------|
| `core/intents.js` | Add new intent constants |
| `core/contracts/intents.js` | Add payload contracts for new intents; extend `CLOSE_LEFT_BUFFERS` / `CLOSE_RIGHT_BUFFERS` |
| `motions/actionBuilders.js` | Add new leader actions |
| `core/dispatcher/handlers/buffers.js` | Add `CLOSE_ALL_BUFFERS`, `DUPLICATE_BUFFER`, `OPEN_URL_IN_SPLIT`, `NEW_BUFFERS` handlers; refactor `SPLIT_VERTICAL` to use `canBufferBeSplit()` |
| `core/dispatcher/handlers/history.js` | Add `DELETE_HISTORY_ENTRY`, `DELETE_HISTORY_DATE` handlers |
| `core/dispatcher/handlers/bookmarks.js` | Add `DELETE_BOOKMARK_NODE` handler |
| `core/dispatcher/handlers/downloads.js` | Add `DOWNLOADS_CLEAR_COMPLETED`, `SHOW_DOWNLOAD_IN_FOLDER`, `OPEN_DOWNLOAD_FILE` handlers |
| `browser/services/splitEligibility.js` | **New** — shared `canBufferBeSplit()` helper |
| `core/adapters/platform/contextMenuActions.js` | Refactor all three factories to dispatch intents; plumb `dispatch`/`win`/`INTENTS` into sidepanel factory |
| `core/adapters/platform/contextMenuBuilder.js` | Import `canBufferBeSplit()` for `canSplit` computation |
| `runtime/contextMenuRegistration.js` | Add selection clearing after `event.preventDefault()` |
| `INTENTS.md` | Document new intents |
| `tests/app/web-context-menu.test.js` | Add `openLinkInSplit` intent dispatch test |
| `tests/app/ui-shell-context-menu.test.js` | Update tests for intent dispatch (not direct service calls) |
| `tests/app/sidepanel-context-menu.test.js` | Update tests for intent dispatch; mock dispatcher instead of services |
| `tests/app/right-click-isolation.test.js` | Add selection clearing test |
| `tests/security/intent-contracts.test.js` | Add payload validation for new intents |

**Checklist:**

- [ ] Add new intents to `core/intents.js`
- [ ] Extend `CLOSE_LEFT_BUFFERS` / `CLOSE_RIGHT_BUFFERS` contracts with optional `index`
- [ ] Add payload contracts to `core/contracts/intents.js`
- [ ] Add leader actions to `motions/actionBuilders.js`
- [ ] Add dispatcher handlers for new intents
- [ ] Create `browser/services/splitEligibility.js`
- [ ] Refactor `SPLIT_VERTICAL` handler to use `canBufferBeSplit()`
- [ ] Refactor `contextMenuBuilder.js` `canSplit` to use `canBufferBeSplit()`
- [ ] Refactor `contextMenuActions.js` web actions (`openLinkInSplit` → intent)
- [ ] Refactor `contextMenuActions.js` UI shell actions (close/duplicate/split → intents)
- [ ] Refactor `contextMenuActions.js` sidepanel actions (all → intents; plumb `dispatch`/`win`/`INTENTS`)
- [ ] Add selection clearing in `contextMenuRegistration.js`
- [ ] Update `INTENTS.md`
- [ ] Update all context menu tests to assert intent dispatch instead of direct calls
- [ ] Add intent contract tests for new payloads
- [ ] Run full test suite; ensure 0 failures
- [ ] Run lint; ensure 0 errors

### Phase E — Custom Themed Menu (Future)
1. Replace `Menu.buildFromTemplate` with custom overlay-based menu renderer.
2. Reuse existing overlay infrastructure (`createOverlayBrowserView`).
3. Keep same action dispatch paths; only UI surface changes.

---

## 10. Files to Modify (Checklist)

- [ ] `core/adapters/platform/contextMenuBuilder.js` *(new)*
- [ ] `core/adapters/platform/contextMenuActions.js` *(new)*
- [ ] `runtime/contextMenuRegistration.js` *(new)*
- [ ] `main.js` — integrate registration, add `openUrlInRightSplit` wiring
- [ ] `ui/shell/preload.js` — add `contextMenu` bridge
- [ ] `ui/tabline.js` — add `contextmenu` listener
- [ ] `ui/urlline.js` — add `contextmenu` listener
- [ ] `ui/shell/services/shellTemplates.js` — statusline prevention
- [ ] `core/history/panel.js` — right-click branch + helpers
- [ ] `browser/manager.js` — new public methods
- [ ] `browser/services/bufferLifecycleService.js` — `duplicateBuffer`, `closeAllBuffers`
- [ ] `browser/services/splitController.js` — `openUrlInRightSplit`
- [ ] `core/contracts/ipc.js` — new validator
- [ ] `runtime/ipcRegistration.js` — new handler
- [ ] `browser/services/selectionClipboardObserver.js` — right-click guard
- [ ] `INTENTS.md` — add any new intents if needed
- [ ] `tests/security/ipc-contracts.test.js` — new payload tests
- [ ] `tests/security/adapter-contracts.test.js` — context-menu registration test
- [ ] `tests/app/` — new context-menu behavior tests

---

## 11. Open Decisions

1. **Custom theme vs native**: Locked to **native first** (this plan).
2. **Open in new window**: Enable via app-controlled `createWindow` (§6.2) or keep disabled? **Recommendation**: enable via app control to avoid security policy conflict.
3. **Split tab behavior**: Create new buffer or reuse mirrored pane? **Recommendation**: create new buffer (becomes a tab).
4. **Bookmark "..." on page background**: Open bookmarks panel or add current page? **Recommendation**: dispatch `BOOKMARKS_ADD_ROOT_ACTIVE` (adds current page).
5. **Image "Send by email"**: Use `mailto:` with image URL, or omit? **Recommendation**: include as lightweight mailto link.
