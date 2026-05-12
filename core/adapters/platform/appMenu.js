const { Menu, dialog } = require("electron");

function createAppMenu({
  win,
  state,
  buffers,
  historyPanel,
  dispatch,
  INTENTS,
  app,
  isBookmarkableBuffer,
  openDoc,
  configService,
  historyService,
  bookmarksService,
}) {
  let lastSnapshot = null;
  const isMac = process.platform === "darwin";
  let folderIcon = null;

  function dispatchAndSync(win, intent, state) {
    dispatch(win, intent, state);
    sync();
  }

  function truncateLabel(label, maxLen = 60) {
    const s = String(label || "").trim();
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  }

  function getRecentHistoryEntries(count = 5) {
    if (!historyService || typeof historyService.readHistoryTree !== "function") {
      return [];
    }
    const tree = historyService.readHistoryTree();
    const entries = [];
    for (const day of tree) {
      for (const entry of day.entries) {
        entries.push(entry);
        if (entries.length >= count) break;
      }
      if (entries.length >= count) break;
    }
    return entries;
  }

  function buildBookmarkSubmenu(nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return [];
    }
    return nodes.map((node) => {
      if (node.type === "folder") {
        const item = {
          label: node.name || "Untitled Folder",
          submenu: buildBookmarkSubmenu(node.children || []),
        };
        if (folderIcon) {
          item.icon = folderIcon;
        }
        return item;
      }
      return {
        label: truncateLabel(node.title || node.url || "Untitled"),
        click: () =>
          dispatchAndSync(
            win,
            { type: INTENTS.OPEN_URL, url: node.url },
            state,
          ),
      };
    });
  }

  function captureSnapshot() {
    const active = buffers.getActive();
    const bufferList = buffers.getBuffers();
    const activeIndex = bufferList.findIndex((b) => b === active);

    let canGoBack = false;
    let canGoForward = false;
    let canReload = false;
    let canSplitDevtools = false;

    if (
      active &&
      !active.isEditable &&
      active.webContents &&
      !active.webContents.isDestroyed()
    ) {
      canReload = true;
      canSplitDevtools = true;
      if (active.webContents.navigationHistory) {
        canGoBack = Boolean(
          active.webContents.navigationHistory.canGoBack?.(),
        );
        canGoForward = Boolean(
          active.webContents.navigationHistory.canGoForward?.(),
        );
      }
    }

    const closedBufferCount =
      typeof buffers.getClosedBufferCount === "function"
        ? buffers.getClosedBufferCount()
        : 0;

    const copySelectionEnabled = Boolean(
      configService &&
        typeof configService.getConfigValue === "function"
        ? configService.getConfigValue(
            "browser.copy_selection_to_clipboard",
            false,
          )
        : false,
    );

    return {
      platform: process.platform,
      mode: state.mode,
      bufferCount: bufferList.length,
      activeBufferId: active ? active.id : null,
      activeBufferIsEditable: active ? active.isEditable : false,
      canGoBack,
      canGoForward,
      canReload,
      isBookmarkable: isBookmarkableBuffer(active),
      splitEnabled: buffers.isSplitEnabled(),
      splitMode: buffers.getSplitStatus().mode,
      focusedPane: buffers.getSplitStatus().focusedPane,
      urllineVisible: buffers.isUrllineVisible(),
      historyVisible:
        historyPanel.isVisible() && historyPanel.treeKind === "history",
      bookmarksVisible:
        historyPanel.isVisible() && historyPanel.treeKind === "bookmarks",
      closedBufferCount,
      canCloseLeft: activeIndex > 0,
      canCloseRight: activeIndex >= 0 && activeIndex < bufferList.length - 1,
      canEnterCommand: state.mode === "NORMAL" || state.mode === "INSERT",
      canEnterNormal: state.mode === "INSERT",
      canEnterInsert: state.mode === "NORMAL" && active && !active.isEditable,
      copySelectionEnabled,
      buffers: bufferList.slice(0, 30).map((b) => ({
        id: b.id,
        title: b.title || "[No title]",
        isActive: b === active,
      })),
    };
  }

  function snapshotsEqual(a, b) {
    if (!a || !b) return false;
    if (a.platform !== b.platform) return false;
    if (a.mode !== b.mode) return false;
    if (a.bufferCount !== b.bufferCount) return false;
    if (a.activeBufferId !== b.activeBufferId) return false;
    if (a.activeBufferIsEditable !== b.activeBufferIsEditable) return false;
    if (a.canGoBack !== b.canGoBack) return false;
    if (a.canGoForward !== b.canGoForward) return false;
    if (a.canReload !== b.canReload) return false;
    if (a.isBookmarkable !== b.isBookmarkable) return false;
    if (a.splitEnabled !== b.splitEnabled) return false;
    if (a.splitMode !== b.splitMode) return false;
    if (a.focusedPane !== b.focusedPane) return false;
    if (a.urllineVisible !== b.urllineVisible) return false;
    if (a.historyVisible !== b.historyVisible) return false;
    if (a.bookmarksVisible !== b.bookmarksVisible) return false;
    if (a.closedBufferCount !== b.closedBufferCount) return false;
    if (a.canCloseLeft !== b.canCloseLeft) return false;
    if (a.canCloseRight !== b.canCloseRight) return false;
    if (a.canEnterCommand !== b.canEnterCommand) return false;
    if (a.canEnterNormal !== b.canEnterNormal) return false;
    if (a.canEnterInsert !== b.canEnterInsert) return false;
    if (a.copySelectionEnabled !== b.copySelectionEnabled) return false;

    if (a.buffers.length !== b.buffers.length) return false;
    for (let i = 0; i < a.buffers.length; i += 1) {
      const ab = a.buffers[i];
      const bb = b.buffers[i];
      if (
        ab.id !== bb.id ||
        ab.title !== bb.title ||
        ab.isActive !== bb.isActive
      ) {
        return false;
      }
    }

    return true;
  }

  function showAbout() {
    if (!win || win.isDestroyed()) return;
    dialog.showMessageBoxSync(win, {
      type: "info",
      title: `About ${app.getName()}`,
      message: `${app.getName()}`,
      detail: `Version ${app.getVersion()}`,
      buttons: ["OK"],
    });
  }

  function closeAllBuffers() {
    const all = buffers.getBuffers().slice();
    for (const buffer of all) {
      buffers.close(buffer.id);
    }
    sync();
  }

  function buildTemplate(snapshot) {
    const noctraMenu = {
      label: app.getName(),
      submenu: [
        { label: `About ${app.getName()}`, click: showAbout },
        { type: "separator" },
        {
          label: "Preferences…",
          accelerator: "CmdOrCtrl+,",
          click: () =>
            dispatchAndSync(win, { type: INTENTS.OPEN_SETTINGS_BUFFER }, state),
        },
        {
          label: "Reload Configuration",
          click: () =>
            dispatchAndSync(win, { type: INTENTS.CONFIG_RELOAD }, state),
        },
        { type: "separator" },
        ...(isMac
          ? [
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
            ]
          : []),
        {
          label: `Quit ${app.getName()}`,
          accelerator: "CmdOrCtrl+Q",
          click: () => dispatchAndSync(win, { type: INTENTS.QUIT }, state),
        },
      ],
    };

    const bufferListItems = snapshot.buffers.map((b) => ({
      label: `${b.id}: ${b.title}`,
      type: "radio",
      checked: b.isActive,
      click: () =>
        dispatchAndSync(win, { type: INTENTS.SWITCH_BUFFER, id: b.id }, state),
    }));

    const fileMenu = {
      label: "File",
      submenu: [
        {
          label: "New Buffer",
          accelerator: "CmdOrCtrl+T",
          click: () => dispatchAndSync(win, { type: INTENTS.NEW_BUFFER }, state),
        },
        { type: "separator" },
        {
          label: "Close Buffer",
          accelerator: "CmdOrCtrl+W",
          click: () => dispatchAndSync(win, { type: INTENTS.CLOSE_BUFFER }, state),
        },
        {
          label: "Close Buffers to the Left",
          enabled: snapshot.canCloseLeft,
          click: () =>
            dispatchAndSync(win, { type: INTENTS.CLOSE_LEFT_BUFFERS }, state),
        },
        {
          label: "Close Buffers to the Right",
          enabled: snapshot.canCloseRight,
          click: () =>
            dispatchAndSync(win, { type: INTENTS.CLOSE_RIGHT_BUFFERS }, state),
        },
        {
          label: "Close All Buffers",
          enabled: snapshot.bufferCount > 0,
          click: closeAllBuffers,
        },
        { type: "separator" },
        {
          label: "Reopen Closed Buffer",
          accelerator: "CmdOrCtrl+Shift+T",
          enabled: snapshot.closedBufferCount > 0,
          click: () => dispatchAndSync(win, { type: INTENTS.REOPEN_BUFFER }, state),
        },
        { type: "separator" },
        ...bufferListItems,
      ],
    };

    const editMenu = {
      label: "Edit",
      submenu: [
        {
          label: "Previous Page",
          accelerator: "CmdOrCtrl+[",
          enabled: snapshot.canGoBack,
          click: () => dispatchAndSync(win, { type: INTENTS.NAV_BACK }, state),
        },
        {
          label: "Next Page",
          accelerator: "CmdOrCtrl+]",
          enabled: snapshot.canGoForward,
          click: () => dispatchAndSync(win, { type: INTENTS.NAV_FORWARD }, state),
        },
        {
          label: "Reload Page",
          accelerator: "CmdOrCtrl+R",
          enabled: snapshot.canReload,
          click: () => dispatchAndSync(win, { type: INTENTS.RELOAD_PAGE }, state),
        },
        { type: "separator" },
        {
          label: snapshot.copySelectionEnabled
            ? "Disable Copy Selection to Clipboard"
            : "Enable Copy Selection to Clipboard",
          click: () =>
            dispatchAndSync(
              win,
              { type: INTENTS.TOGGLE_COPY_SELECTION_TO_CLIPBOARD },
              state,
            ),
        },
      ],
    };

    const recentHistory = getRecentHistoryEntries(5);
    const historyEntriesItems = recentHistory.map((entry) => ({
      label: truncateLabel(entry.title || entry.url || "Untitled"),
      click: () =>
        dispatchAndSync(
          win,
          { type: INTENTS.OPEN_URL, url: entry.url },
          state,
        ),
    }));

    const historyMenu = {
      label: "History",
      submenu: [
        {
          label: "Show History Panel",
          type: "checkbox",
          checked: snapshot.historyVisible,
          click: () =>
            dispatchAndSync(win, { type: INTENTS.HISTORY_TOGGLE }, state),
        },
        { type: "separator" },
        {
          label: "Clear Today's History",
          click: () => {
            if (historyService && typeof historyService.deleteToday === "function") {
              historyService.deleteToday();
            }
            sync();
          },
        },
        {
          label: "Clear All History",
          click: () => {
            if (historyService && typeof historyService.deleteAll === "function") {
              historyService.deleteAll();
            }
            sync();
          },
        },
        { type: "separator" },
        {
          label: "Save Session Snapshot",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () =>
            dispatchAndSync(win, { type: INTENTS.SESSION_SAVE }, state),
        },
        {
          label: "Restore Session Snapshot",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () =>
            dispatchAndSync(win, { type: INTENTS.SESSION_RESTORE }, state),
        },
        ...(historyEntriesItems.length > 0 ? [{ type: "separator" }, ...historyEntriesItems] : []),
      ],
    };

    const bookmarkTree =
      bookmarksService && typeof bookmarksService.readBookmarksTree === "function"
        ? bookmarksService.readBookmarksTree()
        : { root: [] };
    const bookmarkTreeItems = buildBookmarkSubmenu(bookmarkTree.root || []);

    const bookmarksMenu = {
      label: "Bookmarks",
      submenu: [
        {
          label: "Show Bookmarks Panel",
          type: "checkbox",
          checked: snapshot.bookmarksVisible,
          click: () =>
            dispatchAndSync(win, { type: INTENTS.BOOKMARKS_TOGGLE }, state),
        },
        { type: "separator" },
        {
          label: "Add Bookmark (Root)",
          enabled: snapshot.isBookmarkable,
          click: () =>
            dispatchAndSync(win, { type: INTENTS.BOOKMARKS_ADD_ROOT_ACTIVE }, state),
        },
        {
          label: "Add Bookmark (Scoped)",
          enabled: snapshot.isBookmarkable,
          click: () =>
            dispatchAndSync(
              win,
              { type: INTENTS.BOOKMARKS_ADD_SCOPED_PROMPT },
              state,
            ),
        },
        ...(bookmarkTreeItems.length > 0 ? [{ type: "separator" }, ...bookmarkTreeItems] : []),
      ],
    };

    const viewMenu = {
      label: "View",
      submenu: [
        {
          label: "Show URL Line",
          type: "checkbox",
          checked: snapshot.urllineVisible,
          click: () => dispatchAndSync(win, { type: INTENTS.TOGGLE_URLLINE }, state),
        },
        { type: "separator" },
        {
          label: "Split Vertical",
          click: () => dispatchAndSync(win, { type: INTENTS.SPLIT_VERTICAL }, state),
        },
        {
          label: "Close Right Split",
          enabled: snapshot.splitEnabled,
          click: () =>
            dispatchAndSync(win, { type: INTENTS.SPLIT_CLOSE_RIGHT }, state),
        },
        {
          label: "Split DevTools",
          enabled: snapshot.canSplitDevtools,
          click: () => dispatchAndSync(win, { type: INTENTS.SPLIT_DEVTOOLS }, state),
        },
        { type: "separator" },
        {
          label: "Focus Left Pane",
          enabled: snapshot.splitEnabled,
          click: () =>
            dispatchAndSync(win, { type: INTENTS.FOCUS_SPLIT_LEFT }, state),
        },
        {
          label: "Focus Right Pane",
          enabled: snapshot.splitEnabled,
          click: () =>
            dispatchAndSync(win, { type: INTENTS.FOCUS_SPLIT_RIGHT }, state),
        },
        {
          label: "Toggle Focus Context",
          click: () =>
            dispatchAndSync(win, { type: INTENTS.TOGGLE_FOCUS_CONTEXT }, state),
        },
        { type: "separator" },
        {
          label: "Enter Command Mode",
          enabled: snapshot.canEnterCommand,
          click: () => dispatchAndSync(win, { type: INTENTS.SHOW_COMMAND }, state),
        },
        {
          label: "Enter Normal Mode",
          enabled: snapshot.canEnterNormal,
          click: () => dispatchAndSync(win, { type: INTENTS.ENTER_NORMAL }, state),
        },
        {
          label: "Enter Insert Mode",
          enabled: snapshot.canEnterInsert,
          click: () => dispatchAndSync(win, { type: INTENTS.ENTER_INSERT }, state),
        },
      ],
    };

    const toolsMenu = {
      label: "Tools",
      submenu: [
        {
          label: "Notifications",
          click: () =>
            dispatchAndSync(win, { type: INTENTS.OPEN_NOTIFICATIONS_BUFFER }, state),
        },
      ],
    };

    const helpMenu = {
      label: "Help",
      submenu: [
        {
          label: "Getting Started",
          click: () => openDoc("docs/getting-started.md"),
        },
        {
          label: "Keybindings",
          click: () => openDoc("docs/keybindings.md"),
        },
        {
          label: "Commands",
          click: () => openDoc("docs/commands.md"),
        },
        {
          label: "Configuration",
          click: () => openDoc("docs/configuration.md"),
        },
        { type: "separator" },
        {
          label: "FAQ",
          click: () => openDoc("docs/faq.md"),
        },
        { type: "separator" },
        {
          label: "Open Repository README",
          click: () => openDoc("README.md"),
        },
      ],
    };

    return [
      noctraMenu,
      fileMenu,
      editMenu,
      historyMenu,
      bookmarksMenu,
      viewMenu,
      toolsMenu,
      helpMenu,
    ];
  }

  function sync() {
    const next = captureSnapshot();
    if (snapshotsEqual(lastSnapshot, next)) return;
    lastSnapshot = next;
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildTemplate(next)));
  }

  function rebuild() {
    lastSnapshot = null;
    sync();
  }

  function setFolderIcon(icon) {
    folderIcon = icon || null;
    rebuild();
  }

  return { sync, rebuild, setFolderIcon };
}

module.exports = {
  createAppMenu,
};
