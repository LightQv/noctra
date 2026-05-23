const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildWebContextMenuTemplate,
} = require("../../core/adapters/platform/contextMenuBuilder");
const {
  createWebContextMenuActions,
} = require("../../core/adapters/platform/contextMenuActions");

function makeActionsStub() {
  const calls = {};
  const stub = (name) =>
    function (...args) {
      calls[name] = calls[name] || [];
      calls[name].push(args);
    };
  return {
    calls,
    cut: stub("cut"),
    copy: stub("copy"),
    paste: stub("paste"),
    deleteItem: stub("deleteItem"),
    selectAll: stub("selectAll"),
    inspectElement: stub("inspectElement"),
    searchSelection: stub("searchSelection"),
    openLinkInNewTab: stub("openLinkInNewTab"),
    openLinkInSplit: stub("openLinkInSplit"),
    copyLinkAddress: stub("copyLinkAddress"),
    openImageInNewTab: stub("openImageInNewTab"),
    saveImageAs: stub("saveImageAs"),
    copyImage: stub("copyImage"),
    copyImageAddress: stub("copyImageAddress"),
    sendByEmail: stub("sendByEmail"),
    goBack: stub("goBack"),
    goForward: stub("goForward"),
    reload: stub("reload"),
    bookmarkPage: stub("bookmarkPage"),
    savePageAs: stub("savePageAs"),
    toggleDevTools: stub("toggleDevTools"),
    closeSplit: stub("closeSplit"),
  };
}

function makeRuntimeSnapshot(overrides = {}) {
  return {
    canGoBack: false,
    canGoForward: false,
    defaultSearchEngine: "duckduckgo",
    isSplitEnabled: false,
    isRightPane: false,
    isBookmarkable: false,
    ...overrides,
  };
}

// ─── Template composition tests ───

test("web context menu: video blocked returns empty template", () => {
  const template = buildWebContextMenuTemplate({
    params: { mediaType: "video", hasVideoContents: true },
    runtimeSnapshot: makeRuntimeSnapshot(),
    actions: {},
  });
  assert.deepEqual(template, []);
});

test("web context menu: editable input has cut/copy/paste/delete/select-all + inspect", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { isEditable: true, x: 10, y: 20 },
    runtimeSnapshot: makeRuntimeSnapshot(),
    actions: actions,
  });
  assert.equal(template.length, 8);
  assert.equal(template[0].label, "Cut");
  assert.equal(template[1].label, "Copy");
  assert.equal(template[2].label, "Paste");
  assert.equal(template[3].label, "Delete");
  assert.equal(template[4].type, "separator");
  assert.equal(template[5].label, "Select All");
  assert.equal(template[6].type, "separator");
  assert.equal(template[7].label, "Inspect Element");
});

test("web context menu: text selection has copy, search, inspect", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { selectionText: "hello world", x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot(),
    actions: actions,
  });
  assert.equal(template.length, 5);
  assert.equal(template[0].label, "Copy");
  assert.equal(template[2].label, 'Search "hello world" in duckduckgo');
  assert.equal(template[4].label, "Inspect Element");
});

test("web context menu: text selection truncates long text", () => {
  const actions = makeActionsStub();
  const longText = "a".repeat(50);
  const template = buildWebContextMenuTemplate({
    params: { selectionText: longText, x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot(),
    actions: actions,
  });
  const searchItem = template.find((i) => i.label && i.label.startsWith("Search"));
  assert.ok(searchItem);
  assert.ok(searchItem.label.includes("…"));
  assert.ok(searchItem.label.length < `Search "${longText}" in duckduckgo`.length);
});

test("web context menu: link has open/split/window/copy/search/inspect", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { linkURL: "https://example.com", linkText: "Example", x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot(),
    actions: actions,
  });
  assert.ok(template.some((i) => i.label === "Open Link in New Buffer"));
  assert.ok(template.some((i) => i.label === "Open Link in Split"));
  assert.ok(template.some((i) => i.label === "Open Link in New Window"));
  const windowItem = template.find((i) => i.label === "Open Link in New Window");
  assert.equal(windowItem.enabled, false);
  assert.ok(template.some((i) => i.label === "Copy Link Address"));
  assert.ok(template.some((i) => i.label && i.label.startsWith('Search "Example"')));
  assert.ok(template.some((i) => i.label === "Inspect Element"));
});

test("web context menu: image has open/save/copy/copy-address/email/inspect", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { hasImageContents: true, srcURL: "https://example.com/img.png", x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot(),
    actions: actions,
  });
  assert.ok(template.some((i) => i.label === "Open Image in New Buffer"));
  assert.ok(template.some((i) => i.label === "Save Image As..."));
  assert.ok(template.some((i) => i.label === "Copy Image"));
  assert.ok(template.some((i) => i.label === "Copy Image Address"));
  assert.ok(template.some((i) => i.label === "Send by Email"));
  assert.ok(template.some((i) => i.label === "Inspect Element"));
});

test("web context menu: linked image has link actions then image actions", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: {
      linkURL: "https://example.com",
      hasImageContents: true,
      srcURL: "https://example.com/img.png",
      x: 0,
      y: 0,
    },
    runtimeSnapshot: makeRuntimeSnapshot(),
    actions: actions,
  });
  const labels = template.map((i) => i.label).filter(Boolean);
  const linkOpenIndex = labels.indexOf("Open Link in New Buffer");
  const imageOpenIndex = labels.indexOf("Open Image in New Buffer");
  assert.ok(linkOpenIndex >= 0);
  assert.ok(imageOpenIndex >= 0);
  assert.ok(linkOpenIndex < imageOpenIndex);
});

test("web context menu: page background has nav/bookmark/save/devtools", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot(),
    actions: actions,
  });
  assert.ok(template.some((i) => i.label === "Previous Page"));
  assert.ok(template.some((i) => i.label === "Next Page"));
  assert.ok(template.some((i) => i.label === "Refresh"));
  assert.ok(template.some((i) => i.label === "Bookmark..."));
  assert.ok(template.some((i) => i.label === "Save As..."));
  assert.ok(template.some((i) => i.label === "DevTools"));
});

test("web context menu: right pane shows close split first", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot({ isRightPane: true }),
    actions: actions,
  });
  assert.equal(template[0].label, "Close Split");
});

// ─── Disabled state tests ───

test("web context menu: previous/next disabled when cannot navigate", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot({ canGoBack: false, canGoForward: false }),
    actions: actions,
  });
  const prev = template.find((i) => i.label === "Previous Page");
  const next = template.find((i) => i.label === "Next Page");
  assert.equal(prev.enabled, false);
  assert.equal(next.enabled, false);
});

test("web context menu: previous/next enabled when can navigate", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot({ canGoBack: true, canGoForward: true }),
    actions: actions,
  });
  const prev = template.find((i) => i.label === "Previous Page");
  const next = template.find((i) => i.label === "Next Page");
  assert.equal(prev.enabled, true);
  assert.equal(next.enabled, true);
});

test("web context menu: bookmark disabled when not bookmarkable", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot({ isBookmarkable: false }),
    actions: actions,
  });
  const bookmark = template.find((i) => i.label === "Bookmark...");
  assert.equal(bookmark.enabled, false);
});

test("web context menu: bookmark enabled when bookmarkable", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot({ isBookmarkable: true }),
    actions: actions,
  });
  const bookmark = template.find((i) => i.label === "Bookmark...");
  assert.equal(bookmark.enabled, true);
});

test("web context menu: devtools disabled when split enabled", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot({ isSplitEnabled: true }),
    actions: actions,
  });
  const devtools = template.find((i) => i.label === "DevTools");
  assert.equal(devtools.enabled, false);
});

test("web context menu: devtools enabled when split disabled", () => {
  const actions = makeActionsStub();
  const template = buildWebContextMenuTemplate({
    params: { x: 0, y: 0 },
    runtimeSnapshot: makeRuntimeSnapshot({ isSplitEnabled: false }),
    actions: actions,
  });
  const devtools = template.find((i) => i.label === "DevTools");
  assert.equal(devtools.enabled, true);
});

// ─── Action dispatcher tests ───

test("web actions: inspectElement delegates to webContents", () => {
  let inspected = null;
  const webContents = {
    isDestroyed: () => false,
    inspectElement(x, y) {
      inspected = { x, y };
    },
  };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch: () => {}, state: {}, INTENTS: {}, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  actions.inspectElement(5, 10);
  assert.deepEqual(inspected, { x: 5, y: 10 });
});

test("web actions: inspectElement no-op when webContents destroyed", () => {
  const webContents = { isDestroyed: () => true };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch: () => {}, state: {}, INTENTS: {}, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  assert.doesNotThrow(() => actions.inspectElement(5, 10));
});

test("web actions: copy delegates to webContents", () => {
  let called = false;
  const webContents = { isDestroyed: () => false, copy() { called = true; } };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch: () => {}, state: {}, INTENTS: {}, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  actions.copy();
  assert.equal(called, true);
});

test("web actions: searchSelection dispatches SEARCH_WEB intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const configService = { getConfigValue: () => "duckduckgo" };
  const webContents = { isDestroyed: () => false };
  const INTENTS = { SEARCH_WEB: "SEARCH_WEB" };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch, state: {}, INTENTS, configService, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  actions.searchSelection("query text");
  assert.equal(dispatched.type, "SEARCH_WEB");
  assert.equal(dispatched.engine, "duckduckgo");
  assert.equal(dispatched.query, "query text");
});

test("web actions: openLinkInNewTab validates URL before creating buffer", () => {
  let created = null;
  const validateNavigableUrl = (url) => ({ ok: url.startsWith("https"), url });
  const buffers = { create: (url) => { created = url; } };
  const dispatch = (win, intent) => { if (intent.type === "NEW_BUFFER") created = intent.url; };
  const INTENTS = { NEW_BUFFER: "NEW_BUFFER" };
  const webContents = { isDestroyed: () => false };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers, dispatch, state: {}, INTENTS, configService: {}, validateNavigableUrl, isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});

  actions.openLinkInNewTab("https://example.com");
  assert.equal(created, "https://example.com");

  created = null;
  actions.openLinkInNewTab("javascript:alert(1)");
  assert.equal(created, null);
});

test("web actions: openLinkInSplit dispatches OPEN_URL_IN_SPLIT intent after validation", () => {
  let dispatched = null;
  const validateNavigableUrl = (url) => ({ ok: url.startsWith("https"), url });
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { OPEN_URL_IN_SPLIT: "OPEN_URL_IN_SPLIT" };
  const webContents = { isDestroyed: () => false };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch, state: {}, INTENTS, configService: {}, validateNavigableUrl, isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});

  actions.openLinkInSplit("https://example.com");
  assert.equal(dispatched.type, "OPEN_URL_IN_SPLIT");
  assert.equal(dispatched.url, "https://example.com");

  dispatched = null;
  actions.openLinkInSplit("javascript:void(0)");
  assert.equal(dispatched, null);
});

test("web actions: copyLinkAddress writes to clipboard", () => {
  let written = null;
  const clipboard = { writeText: (text) => { written = text; } };
  const webContents = { isDestroyed: () => false };
  const actions = createWebContextMenuActions({
    clipboard, dialog: {}, buffers: {}, dispatch: () => {}, state: {}, INTENTS: {}, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  actions.copyLinkAddress("https://example.com");
  assert.equal(written, "https://example.com");
});

test("web actions: saveImageAs delegates downloadURL to webContents", () => {
  let downloaded = null;
  const webContents = { isDestroyed: () => false, downloadURL: (url) => { downloaded = url; } };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch: () => {}, state: {}, INTENTS: {}, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  actions.saveImageAs("https://example.com/img.png");
  assert.equal(downloaded, "https://example.com/img.png");
});

test("web actions: saveImageAs no-op when webContents destroyed", () => {
  const webContents = { isDestroyed: () => true, downloadURL: () => { throw new Error("should not be called"); } };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch: () => {}, state: {}, INTENTS: {}, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  assert.doesNotThrow(() => actions.saveImageAs("https://example.com/img.png"));
});

test("web actions: bookmarkPage dispatches BOOKMARKS_ADD_SCOPED_PROMPT for bookmarkable buffer", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { BOOKMARKS_ADD_SCOPED_PROMPT: "BOOKMARKS_ADD_SCOPED_PROMPT" };
  const targetBuffer = { id: 1, url: "https://example.com", title: "Example" };
  const buffers = {
    getBufferByWebContents: () => targetBuffer,
  };
  const webContents = { isDestroyed: () => false };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers, dispatch, state: {}, INTENTS, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => true, win: {},
  })(webContents, {});
  actions.bookmarkPage();
  assert.equal(dispatched.type, "BOOKMARKS_ADD_SCOPED_PROMPT");
  assert.equal(dispatched.url, "https://example.com");
});

test("web actions: bookmarkPage no-op when buffer not bookmarkable", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { BOOKMARKS_ADD_SCOPED_PROMPT: "BOOKMARKS_ADD_SCOPED_PROMPT" };
  const buffers = { getBufferByWebContents: () => ({ id: 1, url: "https://example.com" }) };
  const webContents = { isDestroyed: () => false };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers, dispatch, state: {}, INTENTS, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  actions.bookmarkPage();
  assert.equal(dispatched, null);
});

test("web actions: goBack dispatches NAV_BACK with bufferId", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { NAV_BACK: "NAV_BACK" };
  const targetBuffer = { id: 42 };
  const buffers = { getBufferByWebContents: () => targetBuffer };
  const webContents = { isDestroyed: () => false };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers, dispatch, state: {}, INTENTS, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  actions.goBack();
  assert.equal(dispatched.type, "NAV_BACK");
  assert.equal(dispatched.bufferId, 42);
});

test("web actions: toggleDevTools dispatches SPLIT_DEVTOOLS intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { SPLIT_DEVTOOLS: "SPLIT_DEVTOOLS" };
  const webContents = { isDestroyed: () => false };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch, state: {}, INTENTS, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  actions.toggleDevTools();
  assert.equal(dispatched.type, "SPLIT_DEVTOOLS");
});

test("web actions: closeSplit dispatches SPLIT_CLOSE_RIGHT intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { SPLIT_CLOSE_RIGHT: "SPLIT_CLOSE_RIGHT" };
  const webContents = { isDestroyed: () => false };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch, state: {}, INTENTS, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  actions.closeSplit();
  assert.equal(dispatched.type, "SPLIT_CLOSE_RIGHT");
});

test("web actions: copyImageAt delegates to webContents.copyImageAt when available", () => {
  let copiedAt = null;
  const webContents = {
    isDestroyed: () => false,
    copyImageAt: (x, y) => { copiedAt = { x, y }; },
  };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch: () => {}, state: {}, INTENTS: {}, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  actions.copyImage(10.7, 20.3);
  assert.deepEqual(copiedAt, { x: 11, y: 20 });
});

test("web actions: copyImageAt no-op when method missing", () => {
  const webContents = { isDestroyed: () => false };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch: () => {}, state: {}, INTENTS: {}, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  assert.doesNotThrow(() => actions.copyImage(0, 0));
});

test("web actions: sendByEmail opens mailto with encoded URL", () => {
  // We can't easily stub shell.openExternal without mocking the module,
  // so we verify the action exists and has the right shape.
  const webContents = { isDestroyed: () => false };
  const actions = createWebContextMenuActions({
    clipboard: {}, dialog: {}, buffers: {}, dispatch: () => {}, state: {}, INTENTS: {}, configService: {}, validateNavigableUrl: () => ({ ok: true }), isBookmarkableBuffer: () => false, win: {},
  })(webContents, {});
  assert.equal(typeof actions.sendByEmail, "function");
});
