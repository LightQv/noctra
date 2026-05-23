const test = require("node:test");
const assert = require("node:assert/strict");

// ─── Helpers ───

function makeMockBuffer(id, options = {}) {
  return {
    id,
    url: options.url || "https://example.com",
    isEditable: options.isEditable || false,
    virtualDocument: options.virtualDocument || null,
    virtualUrl: options.virtualUrl || null,
  };
}

function makeMockBuffers(buffersArray = []) {
  return {
    buffers: buffersArray.slice(),
    split: {
      enabled: false,
      mode: "regular",
      rightPaneBuffer: null,
    },
    isSplitEnabled() {
      return this.split.enabled;
    },
    getBufferByWebContents() {
      return null;
    },
    getRightPaneBuffer() {
      return this.split.rightPaneBuffer;
    },
    getBuffers() {
      return this.buffers.slice();
    },
  };
}

// ─── End-to-end UI Shell smoke tests ───

test("ui-shell IPC context menu dispatches through overlay", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const ipcSource = fs.readFileSync(
    path.join(__dirname, "../../runtime/ipcRegistration.js"),
    "utf-8",
  );

  const onContextMenuIndex = ipcSource.indexOf("const onContextMenu");
  assert.ok(onContextMenuIndex >= 0, "ipcRegistration must define onContextMenu");

  const afterOnContextMenu = ipcSource.slice(onContextMenuIndex);

  // Verify native Menu dependency is removed
  assert.ok(
    !ipcSource.includes('require("electron")') ||
      !ipcSource.includes("Menu.buildFromTemplate"),
    "ipcRegistration must not use native Menu.buildFromTemplate",
  );

  // Verify uiShell.showContextMenu is called
  const showMenuIndex = afterOnContextMenu.indexOf("uiShell.showContextMenu");
  assert.ok(
    showMenuIndex >= 0,
    "onContextMenu must call uiShell.showContextMenu",
  );
});

test("web context menu registration dispatches through overlay", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const regSource = fs.readFileSync(
    path.join(__dirname, "../../runtime/contextMenuRegistration.js"),
    "utf-8",
  );

  // Verify native Menu dependency is removed
  assert.ok(
    !regSource.includes("Menu.buildFromTemplate"),
    "contextMenuRegistration must not use native Menu.buildFromTemplate",
  );

  // Verify uiShell.showContextMenu is called
  const showMenuIndex = regSource.indexOf("uiShell.showContextMenu");
  assert.ok(
    showMenuIndex >= 0,
    "contextMenuRegistration must call uiShell.showContextMenu",
  );
});

test("sidepanel showContextMenu dispatches through overlay", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const panelSource = fs.readFileSync(
    path.join(__dirname, "../../core/history/panel.js"),
    "utf-8",
  );

  const showContextMenuIndex = panelSource.indexOf("showContextMenu(target, _x, _y)");
  assert.ok(showContextMenuIndex >= 0, "panel must define showContextMenu");

  // Verify native Menu dependency is removed
  assert.ok(
    !panelSource.includes("Menu.buildFromTemplate"),
    "panel must not use native Menu.buildFromTemplate",
  );

  const afterShowContextMenu = panelSource.slice(showContextMenuIndex);

  // Verify uiShell.showContextMenu is called
  const showMenuIndex = afterShowContextMenu.indexOf("uiShell.showContextMenu");
  assert.ok(
    showMenuIndex >= 0,
    "showContextMenu must call uiShell.showContextMenu",
  );
});

// ─── Full action pipeline test via template click ───

test("ui shell tabline template click dispatches intent through full pipeline", () => {
  const {
    buildUIShellContextMenuTemplate,
  } = require("../../core/adapters/platform/contextMenuBuilder");
  const {
    createUIShellContextMenuActions,
  } = require("../../core/adapters/platform/contextMenuActions");

  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = {
    CLOSE_BUFFER: "CLOSE_BUFFER",
    CLOSE_LEFT_BUFFERS: "CLOSE_LEFT_BUFFERS",
    CLOSE_RIGHT_BUFFERS: "CLOSE_RIGHT_BUFFERS",
    CLOSE_ALL_BUFFERS: "CLOSE_ALL_BUFFERS",
    DUPLICATE_BUFFER: "DUPLICATE_BUFFER",
    OPEN_URL_IN_SPLIT: "OPEN_URL_IN_SPLIT",
  };

  const buffers = makeMockBuffers([
    makeMockBuffer(1),
    makeMockBuffer(2),
    makeMockBuffer(3),
  ]);

  const uiActions = createUIShellContextMenuActions({
    clipboard: {},
    buffers,
    dispatch,
    state: {},
    INTENTS,
    startUrllineEdit: () => {},
  });

  const actions = uiActions.forTablineTab(2);
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: {
      isFirst: false,
      isLast: false,
      isSplitEnabled: false,
      buffer: buffers.buffers[1],
    },
    actions,
  });

  // Simulate clicking every menu item
  for (const item of template) {
    if (typeof item.click === "function") {
      item.click();
    }
  }

  // All items should have dispatched something
  assert.equal(dispatched.type, "OPEN_URL_IN_SPLIT", "last clicked item (Split Buffer) should dispatch OPEN_URL_IN_SPLIT");
});

test("web context menu template click dispatches intent through full pipeline", () => {
  const {
    buildWebContextMenuTemplate,
  } = require("../../core/adapters/platform/contextMenuBuilder");
  const {
    createWebContextMenuActions,
  } = require("../../core/adapters/platform/contextMenuActions");

  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = {
    NAV_BACK: "NAV_BACK",
    NAV_FORWARD: "NAV_FORWARD",
    RELOAD_PAGE: "RELOAD_PAGE",
    BOOKMARKS_ADD_SCOPED_PROMPT: "BOOKMARKS_ADD_SCOPED_PROMPT",
    SPLIT_DEVTOOLS: "SPLIT_DEVTOOLS",
  };

  const targetBuffer = { id: 42, url: "https://example.com", title: "Example" };
  const buffers = {
    getBufferByWebContents: () => targetBuffer,
    isSplitEnabled: () => false,
  };

  const webContents = {
    isDestroyed: () => false,
    navigationHistory: {
      canGoBack: () => true,
      canGoForward: () => true,
    },
  };

  const actions = createWebContextMenuActions({
    clipboard: {},
    dialog: {},
    buffers,
    dispatch,
    state: {},
    INTENTS,
    configService: { getConfigValue: () => "duckduckgo" },
    validateNavigableUrl: () => ({ ok: true }),
    isBookmarkableBuffer: () => true,
    win: {},
  })(webContents, { x: 0, y: 0 });

  const template = buildWebContextMenuTemplate({
    params: { x: 0, y: 0 },
    runtimeSnapshot: {
      canGoBack: true,
      canGoForward: true,
      defaultSearchEngine: "duckduckgo",
      isSplitEnabled: false,
      isRightPane: false,
      isBookmarkable: true,
    },
    actions,
  });

  // Click "Previous Page"
  const prevPage = template.find((i) => i.label === "Previous Page");
  prevPage.click();
  assert.equal(dispatched.type, "NAV_BACK");

  // Click "Next Page"
  dispatched = null;
  const nextPage = template.find((i) => i.label === "Next Page");
  nextPage.click();
  assert.equal(dispatched.type, "NAV_FORWARD");

  // Click "Refresh"
  dispatched = null;
  const refresh = template.find((i) => i.label === "Refresh");
  refresh.click();
  assert.equal(dispatched.type, "RELOAD_PAGE");

  // Click "Bookmark..."
  dispatched = null;
  const bookmark = template.find((i) => i.label === "Bookmark...");
  bookmark.click();
  assert.equal(dispatched.type, "BOOKMARKS_ADD_SCOPED_PROMPT");

  // Click "DevTools"
  dispatched = null;
  const devtools = template.find((i) => i.label === "DevTools");
  devtools.click();
  assert.equal(dispatched.type, "SPLIT_DEVTOOLS");
});

test("sidepanel context menu template click dispatches intent through full pipeline", () => {
  const {
    buildSidepanelContextMenuTemplate,
  } = require("../../core/adapters/platform/contextMenuBuilder");
  const {
    createSidepanelContextMenuActions,
  } = require("../../core/adapters/platform/contextMenuActions");

  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = {
    NEW_BUFFER: "NEW_BUFFER",
    OPEN_URL_IN_SPLIT: "OPEN_URL_IN_SPLIT",
    DELETE_HISTORY_ENTRY: "DELETE_HISTORY_ENTRY",
    HISTORY_HIDE: "HISTORY_HIDE",
  };

  const panel = { treeKind: "history" };
  const node = { entry: { url: "https://example.com", id: "e1" }, dateKey: "2024-01-01" };

  const actions = createSidepanelContextMenuActions({
    dispatch,
    win: {},
    state: {},
    INTENTS,
    panel,
    node,
    buffers: {},
  });

  const template = buildSidepanelContextMenuTemplate({
    treeKind: "history",
    rowType: "entry",
    runtimeSnapshot: {},
    actions,
  });

  // Click "Open in New Buffer"
  const openInNewBuffer = template.find((i) => i.label === "Open in New Buffer");
  openInNewBuffer.click();
  assert.equal(dispatched.type, "NEW_BUFFER");
  assert.equal(dispatched.url, "https://example.com");

  // Click "Open in Split"
  dispatched = null;
  const openInSplit = template.find((i) => i.label === "Open in Split");
  openInSplit.click();
  assert.equal(dispatched.type, "OPEN_URL_IN_SPLIT");
  assert.equal(dispatched.url, "https://example.com");

  // Click "Delete Entry"
  dispatched = null;
  const deleteEntry = template.find((i) => i.label === "Delete Entry");
  deleteEntry.click();
  assert.equal(dispatched.type, "DELETE_HISTORY_ENTRY");
  assert.equal(dispatched.dateKey, "2024-01-01");
  assert.equal(dispatched.entryId, "e1");

  // Click "Hide Sidepanel"
  dispatched = null;
  const hide = template.find((i) => i.label === "Hide Sidepanel");
  hide.click();
  assert.equal(dispatched.type, "HISTORY_HIDE");
});
