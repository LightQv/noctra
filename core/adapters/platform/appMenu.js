const { BrowserWindow, Menu, dialog, nativeImage, shell } = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const { promisify } = require("util");
const { getDocsBasePath } = require("./openExternal");
const { resolveTheme, resolveThemeMode } = require("../../../ui/theme");

const execFileAsync = promisify(execFile);

function createAppMenu({
  win,
  state,
  buffers,
  sidepanelController,
  dispatch,
  INTENTS,
  app,
  isBookmarkableBuffer,
  openDoc,
  configService,
  historyService,
  bookmarksService,
  entryIcons,
  nativeTheme,
  createWindow,
}) {
  const sidepanel = sidepanelController;
  let lastSnapshot = null;
  const isMac = process.platform === "darwin";
  const isLinux = process.platform === "linux";
  let folderIcon = null;
  let aboutWindow = null;
  let linuxDefaultBrowserStatus = {
    isDefault: false,
    canSetDefault: isLinux,
    integrated: !isLinux,
    lastCheckedAt: 0,
    pending: false,
  };

  async function getLinuxDefaultBrowserStatus() {
    if (!isLinux) {
      return {
        isDefault: false,
        canSetDefault: false,
        integrated: true,
      };
    }

    try {
      const { stdout: desktopOut } = await execFileAsync("xdg-settings", [
        "get",
        "default-web-browser",
      ]);
      const currentDefault = String(desktopOut || "").trim();

      const { stdout: appImageOut } = await execFileAsync("sh", [
        "-c",
        "test -f ~/.local/share/applications/noctra.desktop -a -f ~/.local/share/icons/hicolor/512x512/apps/noctra-dark.png -a -f ~/.local/share/icons/hicolor/512x512/apps/noctra-light.png && printf yes || printf no",
      ]);
      const integrated = String(appImageOut || "").trim() === "yes";

      return {
        isDefault: currentDefault === "noctra.desktop",
        canSetDefault: true,
        integrated,
      };
    } catch {
      return {
        isDefault: false,
        canSetDefault: false,
        integrated: false,
      };
    }
  }

  function refreshLinuxDefaultBrowserStatus(force = false) {
    if (!isLinux) return;
    if (linuxDefaultBrowserStatus.pending) return;
    const ageMs = Date.now() - linuxDefaultBrowserStatus.lastCheckedAt;
    if (!force && ageMs < 5000) return;

    linuxDefaultBrowserStatus.pending = true;
    getLinuxDefaultBrowserStatus()
      .then((status) => {
        linuxDefaultBrowserStatus = {
          ...linuxDefaultBrowserStatus,
          ...status,
          lastCheckedAt: Date.now(),
          pending: false,
        };
        rebuild();
      })
      .catch(() => {
        linuxDefaultBrowserStatus.pending = false;
      });
  }

  function buildSetDefaultBrowserMenuItem() {
    if (isMac) {
      const isDefault = app.isDefaultProtocolClient("http");
      return {
        label: "Set as Default Browser",
        enabled: !isDefault,
        click: () => {
          app.setAsDefaultProtocolClient("http");
          app.setAsDefaultProtocolClient("https");
          rebuild();
        },
      };
    }

    if (isLinux) {
      const canSet = linuxDefaultBrowserStatus.canSetDefault;
      const integrated = linuxDefaultBrowserStatus.integrated;
      const enabled = canSet && integrated && !linuxDefaultBrowserStatus.isDefault;
      let label = "Set as Default Browser";
      if (!integrated) {
        label = "Set as Default Browser (run --integrate first)";
      }
      return {
        label,
        enabled,
        click: async () => {
          try {
            await execFileAsync("xdg-settings", [
              "set",
              "default-web-browser",
              "noctra.desktop",
            ]);
            refreshLinuxDefaultBrowserStatus(true);
          } catch {
            dialog.showErrorBox(
              "Set as Default Browser",
              "Unable to set Noctra as the default browser via xdg-settings.",
            );
          }
        },
      };
    }

    return null;
  }

  function dispatchAndSync(win, intent, state) {
    dispatch(win, intent, state);
    sync();
  }

  function truncateLabel(label, maxLen = 60) {
    const s = String(label || "").trim();
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  }

  function pickEntryIcon() {
    if (!entryIcons) return null;
    if (isMac) return entryIcons.macos || null;
    const isDark =
      nativeTheme && typeof nativeTheme.shouldUseDarkColors === "function"
        ? nativeTheme.shouldUseDarkColors()
        : false;
    return isDark ? entryIcons.dark : entryIcons.light;
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

  function buildBookmarkSubmenu(nodes, activeEntryIcon) {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return [];
    }
    return nodes.map((node) => {
      if (node.type === "folder") {
        const item = {
          label: node.name || "Untitled Folder",
          submenu: buildBookmarkSubmenu(node.children || [], activeEntryIcon),
        };
        if (folderIcon) {
          item.icon = folderIcon;
        }
        return item;
      }
      const item = {
        label: truncateLabel(node.title || node.url || "Untitled"),
        click: () =>
          dispatchAndSync(
            win,
            { type: INTENTS.OPEN_URL, url: node.url },
            state,
          ),
      };
      if (activeEntryIcon) {
        item.icon = activeEntryIcon;
      }
      return item;
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
      canSplitDevtools,
      isBookmarkable: isBookmarkableBuffer(active),
      splitEnabled: buffers.isSplitEnabled(),
      splitMode: buffers.getSplitStatus().mode,
      focusedPane: buffers.getSplitStatus().focusedPane,
      urllineVisible: buffers.isUrllineVisible(),
      historyVisible: sidepanel.isVisible() && sidepanel.treeKind === "history",
      bookmarksVisible:
        sidepanel.isVisible() && sidepanel.treeKind === "bookmarks",
      closedBufferCount,
      canCloseLeft: activeIndex > 0,
      canCloseRight: activeIndex >= 0 && activeIndex < bufferList.length - 1,
      canEnterCommand: state.mode === "NORMAL" || state.mode === "INSERT",
      canEnterNormal: state.mode === "INSERT",
      canEnterInsert: state.mode === "NORMAL" && active && !active.isEditable,
      copySelectionEnabled,
      osDarkMode:
        nativeTheme && typeof nativeTheme.shouldUseDarkColors === "function"
          ? nativeTheme.shouldUseDarkColors()
          : false,
      linuxDefaultBrowserIsDefault: linuxDefaultBrowserStatus.isDefault,
      linuxDefaultBrowserCanSet: linuxDefaultBrowserStatus.canSetDefault,
      linuxDefaultBrowserIntegrated: linuxDefaultBrowserStatus.integrated,
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
    if (a.osDarkMode !== b.osDarkMode) return false;
    if (a.linuxDefaultBrowserIsDefault !== b.linuxDefaultBrowserIsDefault) {
      return false;
    }
    if (a.linuxDefaultBrowserCanSet !== b.linuxDefaultBrowserCanSet) {
      return false;
    }
    if (a.linuxDefaultBrowserIntegrated !== b.linuxDefaultBrowserIntegrated) {
      return false;
    }

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

    if (aboutWindow && !aboutWindow.isDestroyed()) {
      aboutWindow.focus();
      return;
    }

    const appName = String(app.getName() || "Noctra");
    const appVersion = String(app.getVersion() || "0.0.0");
    const description =
      "A Vim-inspired browser shell built for keyboard-first browsing.";
    const docsBasePath = getDocsBasePath().replace(/\/$/, "");
    const docsUrl = `${docsBasePath}/docs/getting-started.md`;
    const githubUrl = "https://github.com/LightQv/noctra";
    const darkIconPath = path.join(
      __dirname,
      "../../../assets/icons/icon-dark_512.png",
    );
    const lightIconPath = path.join(
      __dirname,
      "../../../assets/icons/icon-light_512.png",
    );
    const isDarkMode =
      resolveThemeMode(
        configService && typeof configService.getConfigValue === "function"
          ? configService.getConfigValue("global.theme", {})
          : {},
        {
          systemPrefersDark:
            nativeTheme && typeof nativeTheme.shouldUseDarkColors === "function"
              ? nativeTheme.shouldUseDarkColors()
              : true,
        },
      ) !== "light";
    const theme = resolveTheme(
      configService && typeof configService.getConfigValue === "function"
        ? configService.getConfigValue("global.theme", {})
        : {},
      {
        systemPrefersDark:
          nativeTheme && typeof nativeTheme.shouldUseDarkColors === "function"
            ? nativeTheme.shouldUseDarkColors()
            : true,
      },
    );
    const preferredIconPath = isDarkMode ? darkIconPath : lightIconPath;
    const iconImage = nativeImage.createFromPath(preferredIconPath);
    const fallbackIconImage = nativeImage.createFromPath(darkIconPath);
    const iconUrl = !iconImage.isEmpty() ? iconImage.toDataURL() : "";
    const resolvedIconUrl =
      iconUrl.length > 0
        ? iconUrl
        : !fallbackIconImage.isEmpty()
          ? fallbackIconImage.toDataURL()
          : "";

    const allowOpenAboutUrl = (rawUrl) => {
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== "https:") return false;
        return rawUrl === docsUrl || rawUrl === githubUrl;
      } catch {
        return false;
      }
    };

    aboutWindow = new BrowserWindow({
      width: 352,
      height: 410,
      title: "",
      parent: win,
      modal: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      titleBarStyle: isMac ? "hiddenInset" : "default",
      backgroundColor: theme.appBackground,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    if (typeof aboutWindow.setMenuBarVisibility === "function") {
      aboutWindow.setMenuBarVisibility(false);
    }

    aboutWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (allowOpenAboutUrl(url)) {
        shell.openExternal(url);
      }
      return { action: "deny" };
    });

    aboutWindow.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      if (allowOpenAboutUrl(url)) {
        shell.openExternal(url);
      }
    });

    aboutWindow.on("closed", () => {
      aboutWindow = null;
    });

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>About ${escapeHtml(appName)}</title>
    <style>
      :root {
        color-scheme: ${isDarkMode ? "dark" : "light"};
        --bg: ${theme.appBackground};
        --text: ${theme.brightTextColor};
        --muted: ${theme.mutedTextColor};
        --button: ${theme.elevatedBackground};
        --button-border: ${theme.borderColor};
        --button-hover: ${theme.subtleBackground};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
      }
      .outer {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 68px 38px;
      }
      .content {
        width: 100%;
        text-align: center;
      }
      .icon {
        width: 98px;
        height: 98px;
        display: block;
        margin: 0 auto 22px;
        border-radius: 22px;
        object-fit: cover;
      }
      .appname {
        margin: 0;
        font-size: 30px;
        font-weight: 700;
        line-height: 1.12;
      }
      .description {
        margin: 12px 0 0;
        font-size: 12px;
        line-height: 1.5;
        color: var(--muted);
        max-width: 240px;
        margin-left: auto;
        margin-right: auto;
      }
      .version {
        margin: 20px 0 0;
        font-size: 13px;
        line-height: 1.2;
      }
      .version-value {
        color: var(--muted);
      }
      .actions {
        margin-top: 34px;
        display: flex;
        justify-content: center;
        gap: 12px;
      }
      .action {
        appearance: none;
        border: 1px solid var(--button-border);
        border-radius: 10px;
        background: var(--button);
        color: var(--text);
        font-size: 12px;
        font-weight: 500;
        text-decoration: none;
        min-width: 102px;
        padding: 7px 12px;
      }
      .action:hover {
        background: var(--button-hover);
      }
    </style>
  </head>
  <body>
    <main class="outer">
      <section class="content">
        <img class="icon" src="${resolvedIconUrl}" alt="${escapeHtml(appName)} icon" />
        <h1 class="appname">${escapeHtml(appName)}</h1>
        <p class="description">${escapeHtml(description)}</p>
        <p class="version">Version <span class="version-value">${escapeHtml(appVersion)}</span></p>
        <div class="actions">
          <a class="action" href="${docsUrl}" target="_blank" rel="noreferrer">Docs</a>
          <a class="action" href="${githubUrl}" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </section>
    </main>
  </body>
</html>`;

    aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    aboutWindow.once("ready-to-show", () => {
      if (aboutWindow && !aboutWindow.isDestroyed()) {
        aboutWindow.show();
      }
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function closeAllBuffers() {
    const all = buffers.getBuffers().slice();
    for (const buffer of all) {
      buffers.close(buffer.id);
    }
    sync();
  }

  function buildTemplate(snapshot) {
    const activeEntryIcon = pickEntryIcon();
    const setDefaultBrowserItem = buildSetDefaultBrowserMenuItem();

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
        ...(isMac && setDefaultBrowserItem
          ? [{ type: "separator" }, setDefaultBrowserItem]
          : []),
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
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            if (typeof createWindow === "function") {
              createWindow();
            }
          },
        },
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
        ...(!isMac && setDefaultBrowserItem
          ? [setDefaultBrowserItem, { type: "separator" }]
          : []),
        ...bufferListItems,
      ],
    };

    const editMenu = {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
        { type: "separator" },
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
    const historyEntriesItems = recentHistory.map((entry) => {
      const item = {
        label: truncateLabel(entry.title || entry.url || "Untitled"),
        click: () =>
          dispatchAndSync(
            win,
            { type: INTENTS.OPEN_URL, url: entry.url },
            state,
          ),
      };
      if (activeEntryIcon) {
        item.icon = activeEntryIcon;
      }
      return item;
    });

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
          accelerator: "CmdOrCtrl+Shift+Y",
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
    const bookmarkTreeItems = buildBookmarkSubmenu(bookmarkTree.root || [], activeEntryIcon);

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
        {
          label: "Import Bookmarks...",
          click: () =>
            dispatchAndSync(win, { type: INTENTS.BOOKMARKS_IMPORT }, state),
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
          label: "Downloads",
          click: () =>
            dispatchAndSync(win, { type: INTENTS.DOWNLOADS_LIVE_MODAL }, state),
        },
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
    refreshLinuxDefaultBrowserStatus(false);
    const next = captureSnapshot();
    if (snapshotsEqual(lastSnapshot, next)) return;
    lastSnapshot = next;
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildTemplate(next)));
  }

  const REBUILD_DEBOUNCE_MS = 50;
  let debounceTimer = null;

  function rebuild() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      lastSnapshot = null;
      sync();
    }, REBUILD_DEBOUNCE_MS);
  }

  function flush() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    lastSnapshot = null;
    sync();
  }

  function setFolderIcon(icon) {
    folderIcon = icon || null;
    rebuild();
  }

  return { sync, rebuild, flush, setFolderIcon };
}

module.exports = {
  createAppMenu,
};
