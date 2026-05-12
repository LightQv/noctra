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
  const historyPanel = viewMenu.submenu.find(
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
