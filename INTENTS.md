# Intent Contract

All motion handlers and command parsers must emit intents from `core/intents.js`.
Every emitted intent must be executable by the dispatcher.

## Current intents

- `NOOP`: Explicitly do nothing.
- `SCROLL`: Scroll by a pixel amount.
- `SCROLL_TOP`: Scroll to top of page.
- `SCROLL_BOTTOM`: Scroll to bottom of page.
- `PAGE_DOWN`: Scroll down by one viewport.
- `PAGE_UP`: Scroll up by one viewport.
- `NAV_BACK`: Browser history back.
- `NAV_FORWARD`: Browser history forward.
- `RELOAD_PAGE`: Reload the active buffer page.
- `ENTER_INSERT`: Enter insert mode.
- `ENTER_NORMAL`: Enter normal mode.
- `SHOW_COMMAND`: Show command palette.
- `HIDE_COMMAND`: Hide command palette.
- `COMMAND_INPUT`: Update command palette text from `state.commandBuffer`.
- `SUBMIT_EDITOR_COMMAND`: Submit command input from the editor command surface.
- `SHOW_WHICHKEY`: Show the leader help panel.
- `UPDATE_WHICHKEY`: Update leader help panel based on current prefix.
- `HIDE_WHICHKEY`: Hide the leader help panel.
- `OPEN_URL_PROMPT`: Open command palette prefilled for URL open command.
- `OPEN_URL`: Load a URL in the active buffer.
- `SEARCH_WEB`: Search using a configured engine and query.
- `SEARCH_OPEN_PROMPT`: Open the SEARCH prompt overlay context.
- `SEARCH_SUBMIT`: Submit current search query to runtime.
- `SEARCH_NEXT`: Jump to next search result.
- `SEARCH_PREV`: Jump to previous search result.
- `SEARCH_CLEAR`: Clear runtime overlays/session and exit SEARCH mode.
- `SEARCH_HINT_OPEN`: Open visible-first hint labels for current results.
- `SEARCH_HINT_INPUT`: Update hint input filter/selection text.
- `SEARCH_JUMP_TO_INDEX`: Jump to an explicit 1-based result index.
- `SEARCH_APPEND_TEXT`: Append typed/pasted text to search query.
- `SEARCH_BACKSPACE`: Remove one character from search query.
- `SEARCH_RUNTIME_UPDATE`: Internal runtime response update for counters/hints.
- `NEW_BUFFER`: Create a new buffer, optionally with URL.
- `BUFFER_NEXT`: Switch to next buffer.
- `BUFFER_PREV`: Switch to previous buffer.
- `SWITCH_BUFFER`: Switch to a specific buffer id.
- `CLOSE_BUFFER`: Close a buffer (active when id omitted).
- `REOPEN_BUFFER`: Reopen the most recently closed buffer.
- `CLOSE_FOCUSED`: Close focused context (close split when split is open, otherwise close active buffer).
- `CLOSE_LEFT_BUFFERS`: Close all buffers to the left of active (or at optional `index`).
- `CLOSE_RIGHT_BUFFERS`: Close all buffers to the right of active (or at optional `index`).
- `CLOSE_ALL_BUFFERS`: Close every buffer; fall back to configured home buffer.
- `DUPLICATE_BUFFER`: Create a copy of the specified buffer (`bufferId`).
- `OPEN_URL_IN_SPLIT`: Open a URL in the right split pane (creating the split if needed).
- `NEW_BUFFERS`: Bulk-create buffers from an array of URLs (`urls`).
- `SPLIT_VERTICAL`: Open a vertical split for the current buffer context.
- `SPLIT_CLOSE_RIGHT`: Close the right split pane.
- `SPLIT_DEVTOOLS`: Open devtools in right split pane.
- `FOCUS_SPLIT_LEFT`: Focus left split pane (or previous buffer fallback).
- `FOCUS_SPLIT_RIGHT`: Focus right split pane (or next buffer fallback).
- `CONFIG_RELOAD`: Reload `~/.config/noctra/config.yml` and apply runtime settings.
- `OPEN_SETTINGS_BUFFER`: Open/focus the editable settings buffer for `config.yml`.
- `OPEN_NOTIFICATIONS_BUFFER`: Open/focus the notifications buffer.
- `TOGGLE_FOCUS_CONTEXT`: Toggle editable buffer focus context (`SHELL`/`EDITOR`) when available.
- `TOGGLE_URLLINE`: Toggle URL line visibility for web panes at runtime.
- `SET_URLLINE_VISIBILITY`: Set URL line visibility state for web panes (`enabled` boolean).
- `SET_THEME_MODE`: Set theme mode from configuration or command.
- `SET_BROWSER_LANGUAGE`: Set browser language from configuration or command.
- `TOGGLE_COPY_SELECTION_TO_CLIPBOARD`: Toggle auto-copy of selected web text.
- `HISTORY_SHOW`: Show history panel.
- `HISTORY_HIDE`: Hide history panel.
- `HISTORY_TOGGLE`: Toggle history panel visibility.
- `HISTORY_TOGGLE_FOCUS`: Toggle focus between history panel and web content.
- `HISTORY_DELETE_ALL`: Delete all history entries.
- `HISTORY_DELETE_TODAY`: Delete history entries from today.
- `DELETE_HISTORY_ENTRY`: Remove a single history entry (`dateKey`, `entryId`).
- `DELETE_HISTORY_DATE`: Remove an entire history day/folder (`dateKey`).
- `BOOKMARKS_SHOW`: Show bookmarks panel.
- `BOOKMARKS_HIDE`: Hide bookmarks panel.
- `BOOKMARKS_TOGGLE`: Toggle bookmarks panel visibility.
- `BOOKMARKS_TOGGLE_FOCUS`: Toggle focus between bookmarks panel and web content.
- `BOOKMARKS_DELETE_ALL`: Delete all bookmarks.
- `BOOKMARKS_IMPORT`: Import bookmarks from Netscape HTML file.
- `BOOKMARKS_ADD_ROOT_ACTIVE`: Add active page to root bookmarks.
- `BOOKMARKS_ADD_SCOPED_PROMPT`: Open scoped bookmark insertion prompt.
- `DELETE_BOOKMARK_NODE`: Remove a bookmark entry or folder (`nodeId`).
- `DOWNLOADS_SHOW`: Show downloads panel.
- `DOWNLOADS_HIDE`: Hide downloads panel.
- `DOWNLOADS_TOGGLE`: Toggle downloads panel visibility.
- `DOWNLOADS_TOGGLE_FOCUS`: Toggle focus between downloads panel and web content.
- `DOWNLOADS_CLEAR_ALL`: Clear all download entries.
- `DOWNLOADS_CLEAR_COMPLETED`: Clear all completed download entries.
- `SHOW_DOWNLOAD_IN_FOLDER`: Reveal a downloaded file in the file manager (`downloadId`).
- `OPEN_DOWNLOAD_FILE`: Open a completed download with the default application (`downloadId`).
- `DOWNLOADS_LIVE_MODAL`: Show live download modal.
- `PASSWORD_MANAGER_OPEN`: Open selected password-manager extension popup when available.
- `TELESCOPE_OPEN_HISTORY`: Open telescope search for history entries.
- `TELESCOPE_OPEN_BOOKMARKS`: Open telescope search for bookmarks.
- `TELESCOPE_OPEN_BUFFERS`: Open telescope search for buffers.
- `TELESCOPE_REOPEN_LAST`: Reopen the last telescope selection source.
- `SESSION_SAVE`: Persist the current restorable browser session snapshot.
- `SESSION_RESTORE`: Restore the last persisted browser session snapshot.
- `QUIT`: Quit the application.
- `UNKNOWN_COMMAND`: Command parser fallback for unknown commands.

## Rules

- Resolution path is `motions/*` -> `core/input.js` -> `core/dispatcher.js`.
- Payload contracts are enforced at runtime via `core/contracts/intents.js`.
- Intent payload objects are strict: unknown extra keys are rejected.
- Unknown intent types must log a warning in dispatcher with code `contract_unknown_intent`.
- Invalid intent payloads are rejected before handlers run with code `contract_invalid_payload`.
- Follow-up intents must run through the same dispatcher path (`intent.next`).

## Contributor checklist

When adding or changing an intent:

1. Update `core/contracts/intents.js`.
2. Update dispatcher handler logic.
3. Add or update tests.
4. Update this file and architecture docs.
