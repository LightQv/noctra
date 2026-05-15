const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

const originalLoad = Module._load;

let lastMenuTemplate = null;
let applicationMenuSet = false;

const mockMenu = {
  buildFromTemplate: (template) => {
    lastMenuTemplate = template;
    return { items: template };
  },
  setApplicationMenu: () => {
    applicationMenuSet = true;
  },
};

const mockDialog = {
  showMessageBoxSync: () => {},
};

const mockApp = {
  getName: () => "Noctra",
  getVersion: () => "0.1.0",
  isDefaultProtocolClient: () => false,
  setAsDefaultProtocolClient: () => {},
};

const INTENTS = {
  NEW_BUFFER: "NEW_BUFFER",
  CLOSE_BUFFER: "CLOSE_BUFFER",
  CLOSE_LEFT_BUFFERS: "CLOSE_LEFT_BUFFERS",
  CLOSE_RIGHT_BUFFERS: "CLOSE_RIGHT_BUFFERS",
  REOPEN_BUFFER: "REOPEN_BUFFER",
  SWITCH_BUFFER: "SWITCH_BUFFER",
  NAV_BACK: "NAV_BACK",
  NAV_FORWARD: "NAV_FORWARD",
  RELOAD_PAGE: "RELOAD_PAGE",
  TOGGLE_COPY_SELECTION_TO_CLIPBOARD: "TOGGLE_COPY_SELECTION_TO_CLIPBOARD",
  BOOKMARKS_ADD_ROOT_ACTIVE: "BOOKMARKS_ADD_ROOT_ACTIVE",
  BOOKMARKS_ADD_SCOPED_PROMPT: "BOOKMARKS_ADD_SCOPED_PROMPT",
  TOGGLE_URLLINE: "TOGGLE_URLLINE",
  HISTORY_TOGGLE: "HISTORY_TOGGLE",
  BOOKMARKS_TOGGLE: "BOOKMARKS_TOGGLE",
  SPLIT_VERTICAL: "SPLIT_VERTICAL",
  SPLIT_CLOSE_RIGHT: "SPLIT_CLOSE_RIGHT",
  SPLIT_DEVTOOLS: "SPLIT_DEVTOOLS",
  FOCUS_SPLIT_LEFT: "FOCUS_SPLIT_LEFT",
  FOCUS_SPLIT_RIGHT: "FOCUS_SPLIT_RIGHT",
  TOGGLE_FOCUS_CONTEXT: "TOGGLE_FOCUS_CONTEXT",
  SHOW_COMMAND: "SHOW_COMMAND",
  ENTER_NORMAL: "ENTER_NORMAL",
  ENTER_INSERT: "ENTER_INSERT",
  OPEN_SETTINGS_BUFFER: "OPEN_SETTINGS_BUFFER",
  CONFIG_RELOAD: "CONFIG_RELOAD",
  QUIT: "QUIT",
  OPEN_URL: "OPEN_URL",
  SESSION_SAVE: "SESSION_SAVE",
  SESSION_RESTORE: "SESSION_RESTORE",
  HISTORY_DELETE_ALL: "HISTORY_DELETE_ALL",
  HISTORY_DELETE_TODAY: "HISTORY_DELETE_TODAY",
  OPEN_NOTIFICATIONS_BUFFER: "OPEN_NOTIFICATIONS_BUFFER",
};

function createMockBuffer(id, title, isEditable = false) {
  return {
    id,
    title,
    isEditable,
    webContents: null,
  };
}

function createMockBuffers(overrides = {}) {
  const bufferList = overrides.buffers || [];
  const active = overrides.active || null;
  const splitEnabled = overrides.splitEnabled || false;
  const closedCount = overrides.closedBufferCount || 0;

  return {
    getActive: () => active,
    getBuffers: () => bufferList,
    isSplitEnabled: () => splitEnabled,
    getSplitStatus: () => ({
      enabled: splitEnabled,
      mode: "regular",
      focusedPane: "left",
      divider: { visible: false, offsetPx: 0 },
    }),
    isUrllineVisible: () => overrides.urllineVisible || false,
    getClosedBufferCount: () => closedCount,
    close: () => {},
  };
}

function createMockHistoryPanel(overrides = {}) {
  return {
    isVisible: () => overrides.visible || false,
    treeKind: overrides.treeKind || "history",
  };
}

function createMockState(mode = "NORMAL") {
  return { mode };
}

function createDeps(overrides = {}) {
  return {
    win: { isDestroyed: () => false },
    state: createMockState(overrides.mode),
    buffers: createMockBuffers(overrides),
    historyPanel: createMockHistoryPanel(overrides),
    dispatch: () => {},
    INTENTS,
    app: mockApp,
    dialog: mockDialog,
    isBookmarkableBuffer: (buffer) =>
      Boolean(buffer && !buffer.isEditable && buffer.title !== "[No title]"),
    openDoc: () => {},
    configService: {
      getConfigValue: (key, defaultValue) =>
        overrides.copySelectionEnabled !== undefined
          ? overrides.copySelectionEnabled
          : defaultValue,
    },
    historyService: overrides.historyService || {
      readHistoryTree: () => [],
      deleteToday: () => {},
      deleteAll: () => {},
    },
    bookmarksService: overrides.bookmarksService || {
      readBookmarksTree: () => ({ root: [] }),
    },
    entryIcons: overrides.entryIcons || null,
    nativeTheme: overrides.nativeTheme || { shouldUseDarkColors: () => false },
  };
}

function loadAppMenuUnderMock() {
  Module._load = function (request, parent) {
    if (request === "electron" && parent.filename.includes("appMenu.js")) {
      return { Menu: mockMenu, dialog: mockDialog };
    }
    return originalLoad.apply(this, arguments);
  };

  const key = require.resolve("../../core/adapters/platform/appMenu");
  delete require.cache[key];
  const mod = require("../../core/adapters/platform/appMenu");
  Module._load = originalLoad;
  return mod;
}

const { createAppMenu } = loadAppMenuUnderMock();

test("appMenu builds template on first sync", () => {
  lastMenuTemplate = null;
  applicationMenuSet = false;

  const deps = createDeps();
  const appMenu = createAppMenu(deps);
  appMenu.sync();

  assert.equal(applicationMenuSet, true);
  assert.ok(Array.isArray(lastMenuTemplate));
  assert.ok(lastMenuTemplate.length > 0);
});

test("appMenu skips sync when snapshot unchanged", () => {
  lastMenuTemplate = null;
  let buildCount = 0;
  const origBuildFromTemplate = mockMenu.buildFromTemplate;
  mockMenu.buildFromTemplate = (template) => {
    buildCount += 1;
    lastMenuTemplate = template;
    return { items: template };
  };

  const deps = createDeps();
  const appMenu = createAppMenu(deps);
  appMenu.sync();
  appMenu.sync();

  assert.equal(buildCount, 1);

  mockMenu.buildFromTemplate = origBuildFromTemplate;
});

test("appMenu rebuild forces refresh", () => {
  let buildCount = 0;
  const origBuildFromTemplate = mockMenu.buildFromTemplate;
  mockMenu.buildFromTemplate = (template) => {
    buildCount += 1;
    lastMenuTemplate = template;
    return { items: template };
  };

  const deps = createDeps();
  const appMenu = createAppMenu(deps);
  appMenu.sync();
  appMenu.rebuild();

  assert.equal(buildCount, 2);

  mockMenu.buildFromTemplate = origBuildFromTemplate;
});

test("setFolderIcon triggers rebuild", () => {
  let buildCount = 0;
  const origBuildFromTemplate = mockMenu.buildFromTemplate;
  mockMenu.buildFromTemplate = (template) => {
    buildCount += 1;
    lastMenuTemplate = template;
    return { items: template };
  };

  const deps = createDeps();
  const appMenu = createAppMenu(deps);
  appMenu.sync();
  appMenu.setFolderIcon({ isEmpty: () => false });

  assert.equal(buildCount, 2);

  mockMenu.buildFromTemplate = origBuildFromTemplate;
});

test("buffer list is capped at 30 items", () => {
  const manyBuffers = [];
  for (let i = 1; i <= 35; i += 1) {
    manyBuffers.push(createMockBuffer(i, `Buffer ${i}`));
  }

  const deps = createDeps({
    buffers: manyBuffers,
    active: manyBuffers[0],
  });
  const appMenu = createAppMenu(deps);
  appMenu.sync();

  const fileMenu = lastMenuTemplate.find((m) => m.label === "File");
  const bufferItems = fileMenu.submenu.filter(
    (item) => item.type === "radio",
  );
  assert.equal(bufferItems.length, 30);
});

test("menu items reflect disabled state based on context", () => {
  const active = createMockBuffer(1, "Test", false);
  active.webContents = {
    navigationHistory: {
      canGoBack: () => false,
      canGoForward: () => false,
    },
    isDestroyed: () => false,
  };

  const deps = createDeps({
    buffers: [active],
    active,
    mode: "NORMAL",
    splitEnabled: false,
    urllineVisible: false,
    visible: false,
    closedBufferCount: 0,
  });
  const appMenu = createAppMenu(deps);
  appMenu.sync();

  const editMenu = lastMenuTemplate.find((m) => m.label === "Edit");
  const navBack = editMenu.submenu.find((item) => item.label === "Previous Page");
  const navForward = editMenu.submenu.find((item) => item.label === "Next Page");

  assert.equal(navBack.enabled, false);
  assert.equal(navForward.enabled, false);
});

test("checkbox items reflect panel visibility", () => {
  const active = createMockBuffer(1, "Test", false);

  const deps = createDeps({
    buffers: [active],
    active,
    mode: "NORMAL",
    urllineVisible: true,
    visible: true,
    treeKind: "history",
  });
  const appMenu = createAppMenu(deps);
  appMenu.sync();

  const viewMenu = lastMenuTemplate.find((m) => m.label === "View");
  const urlLine = viewMenu.submenu.find((item) => item.label === "Show URL Line");

  const historyMenu = lastMenuTemplate.find((m) => m.label === "History");
  const historyPanel = historyMenu.submenu.find(
    (item) => item.label === "Show History Panel",
  );

  assert.equal(urlLine.checked, true);
  assert.equal(historyPanel.checked, true);
});

test("copy selection label reflects enabled state", () => {
  const active = createMockBuffer(1, "Test", false);

  const depsEnabled = createDeps({
    buffers: [active],
    active,
    mode: "NORMAL",
    copySelectionEnabled: true,
  });
  const appMenuEnabled = createAppMenu(depsEnabled);
  appMenuEnabled.sync();

  const editMenuEnabled = lastMenuTemplate.find((m) => m.label === "Edit");
  const copyItemEnabled = editMenuEnabled.submenu.find(
    (item) => item.label && item.label.includes("Copy Selection"),
  );
  assert.equal(copyItemEnabled.label, "Disable Copy Selection to Clipboard");

  const depsDisabled = createDeps({
    buffers: [active],
    active,
    mode: "NORMAL",
    copySelectionEnabled: false,
  });
  const appMenuDisabled = createAppMenu(depsDisabled);
  appMenuDisabled.sync();

  const editMenuDisabled = lastMenuTemplate.find((m) => m.label === "Edit");
  const copyItemDisabled = editMenuDisabled.submenu.find(
    (item) => item.label && item.label.includes("Copy Selection"),
  );
  assert.equal(copyItemDisabled.label, "Enable Copy Selection to Clipboard");
});

test("history menu contains session and clear actions", () => {
  const active = createMockBuffer(1, "Test", false);

  const deps = createDeps({
    buffers: [active],
    active,
    mode: "NORMAL",
  });
  const appMenu = createAppMenu(deps);
  appMenu.sync();

  const historyMenu = lastMenuTemplate.find((m) => m.label === "History");
  assert.ok(historyMenu, "History menu should exist");

  const clearToday = historyMenu.submenu.find(
    (item) => item.label === "Clear Today's History",
  );
  const clearAll = historyMenu.submenu.find(
    (item) => item.label === "Clear All History",
  );
  const saveSession = historyMenu.submenu.find(
    (item) => item.label === "Save Session Snapshot",
  );
  const restoreSession = historyMenu.submenu.find(
    (item) => item.label === "Restore Session Snapshot",
  );

  assert.ok(clearToday, "Clear Today's History should exist");
  assert.ok(clearAll, "Clear All History should exist");
  assert.ok(saveSession, "Save Session Snapshot should exist");
  assert.equal(saveSession.accelerator, "CmdOrCtrl+Shift+S");
  assert.ok(restoreSession, "Restore Session Snapshot should exist");
  assert.equal(restoreSession.accelerator, "CmdOrCtrl+Shift+Y");
});

test("bookmarks menu contains add actions and tree", () => {
  const active = createMockBuffer(1, "Test", false);

  const deps = createDeps({
    buffers: [active],
    active,
    mode: "NORMAL",
    bookmarksService: {
      readBookmarksTree: () => ({
        root: [
          {
            type: "folder",
            id: "f-1",
            name: "Dev",
            children: [
              {
                type: "entry",
                id: "e-1",
                title: "GitHub",
                url: "https://github.com",
              },
            ],
          },
        ],
      }),
    },
  });
  const appMenu = createAppMenu(deps);
  appMenu.sync();

  const bookmarksMenu = lastMenuTemplate.find((m) => m.label === "Bookmarks");
  assert.ok(bookmarksMenu, "Bookmarks menu should exist");

  const addRoot = bookmarksMenu.submenu.find(
    (item) => item.label === "Add Bookmark (Root)",
  );
  const addScoped = bookmarksMenu.submenu.find(
    (item) => item.label === "Add Bookmark (Scoped)",
  );
  assert.ok(addRoot, "Add Bookmark (Root) should exist");
  assert.ok(addScoped, "Add Bookmark (Scoped) should exist");

  const folderItem = bookmarksMenu.submenu.find(
    (item) => item.label === "Dev",
  );
  assert.ok(folderItem, "Bookmark folder 'Dev' should exist");
  assert.ok(Array.isArray(folderItem.submenu), "Folder should have submenu");

  const entryItem = folderItem.submenu.find(
    (item) => item.label === "GitHub",
  );
  assert.ok(entryItem, "Bookmark entry 'GitHub' should exist");
});

test("tools menu contains downloads and notifications", () => {
  const active = createMockBuffer(1, "Test", false);

  const deps = createDeps({
    buffers: [active],
    active,
    mode: "NORMAL",
  });
  const appMenu = createAppMenu(deps);
  appMenu.sync();

  const toolsMenu = lastMenuTemplate.find((m) => m.label === "Tools");
  assert.ok(toolsMenu, "Tools menu should exist");

  const downloads = toolsMenu.submenu.find(
    (item) => item.label === "Downloads",
  );
  assert.ok(downloads, "Downloads should exist in Tools menu");

  const notifications = toolsMenu.submenu.find(
    (item) => item.label === "Notifications",
  );
  assert.ok(notifications, "Notifications should exist in Tools menu");
});

test("history menu lists recent entries", () => {
  const active = createMockBuffer(1, "Test", false);

  const deps = createDeps({
    buffers: [active],
    active,
    mode: "NORMAL",
    historyService: {
      readHistoryTree: () => [
        {
          key: "2024-01-01",
          entries: [
            { id: "1", url: "https://example.com", title: "Example" },
            { id: "2", url: "https://test.com", title: "Test" },
          ],
        },
        {
          key: "2023-12-31",
          entries: [
            { id: "3", url: "https://old.com", title: "Old Site" },
          ],
        },
      ],
      deleteToday: () => {},
      deleteAll: () => {},
    },
  });
  const appMenu = createAppMenu(deps);
  appMenu.sync();

  const historyMenu = lastMenuTemplate.find((m) => m.label === "History");
  const entryItems = historyMenu.submenu.filter(
    (item) =>
      item.label &&
      item.label !== "Show History Panel" &&
      item.label !== "Clear Today's History" &&
      item.label !== "Clear All History" &&
      item.label !== "Save Session Snapshot" &&
      item.label !== "Restore Session Snapshot" &&
      item.type !== "separator",
  );

  assert.equal(entryItems.length, 3, "Should list 3 history entries");
  assert.ok(
    entryItems.some((item) => item.label === "Example"),
    "Should contain 'Example' entry",
  );
  assert.ok(
    entryItems.some((item) => item.label === "Test"),
    "Should contain 'Test' entry",
  );
  assert.ok(
    entryItems.some((item) => item.label === "Old Site"),
    "Should contain 'Old Site' entry",
  );
});
