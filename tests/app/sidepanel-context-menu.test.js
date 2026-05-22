const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSidepanelContextMenuTemplate,
} = require("../../core/adapters/platform/contextMenuBuilder");
const {
  createSidepanelContextMenuActions,
} = require("../../core/adapters/platform/contextMenuActions");

test("sidepanel context menu template for history day", () => {
  const actions = {
    openFolderLinksInNewTabs() {},
    deleteFolder() {},
    hideSidepanel() {},
  };
  const template = buildSidepanelContextMenuTemplate({
    treeKind: "history",
    rowType: "day",
    runtimeSnapshot: {},
    actions,
  });
  assert.equal(template.length, 5);
  assert.equal(template[0].label, "Open Every Link in New Tab");
  assert.equal(template[2].label, "Delete Folder");
  assert.equal(template[4].label, "Hide Sidepanel");
});

test("sidepanel context menu template for history entry", () => {
  const actions = {
    openInNewTab() {},
    openInSplit() {},
    deleteEntry() {},
    hideSidepanel() {},
  };
  const template = buildSidepanelContextMenuTemplate({
    treeKind: "history",
    rowType: "entry",
    runtimeSnapshot: {},
    actions,
  });
  assert.equal(template.length, 6);
  assert.equal(template[0].label, "Open in New Tab");
  assert.equal(template[1].label, "Open in Split");
  assert.equal(template[3].label, "Delete Entry");
  assert.equal(template[5].label, "Hide Sidepanel");
});

test("sidepanel context menu template for history background", () => {
  const actions = {
    deleteAll() {},
    hideSidepanel() {},
  };
  const template = buildSidepanelContextMenuTemplate({
    treeKind: "history",
    rowType: "",
    runtimeSnapshot: {},
    actions,
  });
  assert.equal(template.length, 3);
  assert.equal(template[0].label, "Delete All");
  assert.equal(template[2].label, "Hide Sidepanel");
});

test("sidepanel context menu template for bookmarks folder", () => {
  const actions = {
    openFolderLinksInNewTabs() {},
    deleteFolder() {},
    hideSidepanel() {},
  };
  const template = buildSidepanelContextMenuTemplate({
    treeKind: "bookmarks",
    rowType: "folder",
    runtimeSnapshot: {},
    actions,
  });
  assert.equal(template.length, 5);
  assert.equal(template[0].label, "Open Every Link in New Tab");
  assert.equal(template[2].label, "Delete Folder");
});

test("sidepanel context menu template for bookmarks entry", () => {
  const actions = {
    openInNewTab() {},
    openInSplit() {},
    deleteEntry() {},
    hideSidepanel() {},
  };
  const template = buildSidepanelContextMenuTemplate({
    treeKind: "bookmarks",
    rowType: "entry",
    runtimeSnapshot: {},
    actions,
  });
  assert.equal(template.length, 6);
  assert.equal(template[0].label, "Open in New Tab");
  assert.equal(template[1].label, "Open in Split");
  assert.equal(template[3].label, "Delete Entry");
});

test("sidepanel context menu template for bookmarks background", () => {
  const actions = {
    deleteAll() {},
    hideSidepanel() {},
  };
  const template = buildSidepanelContextMenuTemplate({
    treeKind: "bookmarks",
    rowType: "",
    runtimeSnapshot: {},
    actions,
  });
  assert.equal(template.length, 3);
  assert.equal(template[0].label, "Delete All");
});

test("sidepanel context menu template for download row", () => {
  const actions = {
    showInFolder() {},
    openFile() {},
    hideSidepanel() {},
  };
  const template = buildSidepanelContextMenuTemplate({
    treeKind: "downloads",
    rowType: "download",
    runtimeSnapshot: { isCompleted: true, hasSavePath: true },
    actions,
  });
  assert.equal(template.length, 4);
  assert.equal(template[0].label, "Open File Location");
  assert.equal(template[0].enabled, true);
  assert.equal(template[1].label, "Open File");
  assert.equal(template[1].enabled, true);
  assert.equal(template[3].label, "Hide Sidepanel");
});

test("sidepanel context menu template disables download actions when appropriate", () => {
  const actions = {
    showInFolder() {},
    openFile() {},
    hideSidepanel() {},
  };
  const template = buildSidepanelContextMenuTemplate({
    treeKind: "downloads",
    rowType: "download",
    runtimeSnapshot: { isCompleted: false, hasSavePath: false },
    actions,
  });
  assert.equal(template[0].enabled, false);
  assert.equal(template[1].enabled, false);
});

test("sidepanel context menu template for downloads background", () => {
  const actions = {
    deleteAllComplete() {},
    hideSidepanel() {},
  };
  const template = buildSidepanelContextMenuTemplate({
    treeKind: "downloads",
    rowType: "",
    runtimeSnapshot: {},
    actions,
  });
  assert.equal(template.length, 3);
  assert.equal(template[0].label, "Delete All Complete");
  assert.equal(template[2].label, "Hide Sidepanel");
});

function makeIntents() {
  return {
    NEW_BUFFER: "NEW_BUFFER",
    OPEN_URL_IN_SPLIT: "OPEN_URL_IN_SPLIT",
    NEW_BUFFERS: "NEW_BUFFERS",
    DELETE_HISTORY_ENTRY: "DELETE_HISTORY_ENTRY",
    DELETE_HISTORY_DATE: "DELETE_HISTORY_DATE",
    DELETE_BOOKMARK_NODE: "DELETE_BOOKMARK_NODE",
    HISTORY_DELETE_ALL: "HISTORY_DELETE_ALL",
    BOOKMARKS_DELETE_ALL: "BOOKMARKS_DELETE_ALL",
    DOWNLOADS_CLEAR_COMPLETED: "DOWNLOADS_CLEAR_COMPLETED",
    SHOW_DOWNLOAD_IN_FOLDER: "SHOW_DOWNLOAD_IN_FOLDER",
    OPEN_DOWNLOAD_FILE: "OPEN_DOWNLOAD_FILE",
    HISTORY_HIDE: "HISTORY_HIDE",
    BOOKMARKS_HIDE: "BOOKMARKS_HIDE",
    DOWNLOADS_HIDE: "DOWNLOADS_HIDE",
  };
}

function makeDispatch() {
  const intents = [];
  function dispatch(win, intent) {
    intents.push(intent);
  }
  dispatch.intents = intents;
  return dispatch;
}

test("sidepanel actions open in new tab dispatches NEW_BUFFER intent", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel: {},
    node: { entry: { url: "https://example.com" } },
    buffers: {},
  });
  actions.openInNewTab();
  assert.equal(d.intents.length, 1);
  assert.equal(d.intents[0].type, "NEW_BUFFER");
  assert.equal(d.intents[0].url, "https://example.com");
});

test("sidepanel actions open in split dispatches OPEN_URL_IN_SPLIT intent", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel: {},
    node: { entry: { url: "https://example.com" } },
    buffers: {},
  });
  actions.openInSplit();
  assert.equal(d.intents.length, 1);
  assert.equal(d.intents[0].type, "OPEN_URL_IN_SPLIT");
  assert.equal(d.intents[0].url, "https://example.com");
});

test("sidepanel actions delete history entry dispatches DELETE_HISTORY_ENTRY intent", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const panel = {
    treeKind: "history",
  };
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel,
    node: { dateKey: "2024-01-01", entry: { id: "e1" } },
    buffers: {},
  });
  actions.deleteEntry();
  assert.equal(d.intents.length, 1);
  assert.equal(d.intents[0].type, "DELETE_HISTORY_ENTRY");
  assert.equal(d.intents[0].dateKey, "2024-01-01");
  assert.equal(d.intents[0].entryId, "e1");
});

test("sidepanel actions delete history day dispatches DELETE_HISTORY_DATE intent", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const panel = {
    treeKind: "history",
  };
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel,
    node: { dateKey: "2024-01-01" },
    buffers: {},
  });
  actions.deleteFolder();
  assert.equal(d.intents.length, 1);
  assert.equal(d.intents[0].type, "DELETE_HISTORY_DATE");
  assert.equal(d.intents[0].dateKey, "2024-01-01");
});

test("sidepanel actions delete all bookmarks dispatches BOOKMARKS_DELETE_ALL intent", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const panel = {
    treeKind: "bookmarks",
  };
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel,
    buffers: {},
  });
  actions.deleteAll();
  assert.equal(d.intents.length, 1);
  assert.equal(d.intents[0].type, "BOOKMARKS_DELETE_ALL");
});

test("sidepanel actions hide sidepanel dispatches hide intent", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const panel = {
    treeKind: "history",
  };
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel,
    buffers: {},
  });
  actions.hideSidepanel();
  assert.equal(d.intents.length, 1);
  assert.equal(d.intents[0].type, "HISTORY_HIDE");
});

test("sidepanel actions open folder links dispatches NEW_BUFFERS intent for bookmarks", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const panel = {
    treeKind: "bookmarks",
    days: [],
    findFavoriteNodeLocation() {
      return null;
    },
  };
  const node = {
    type: "folder",
    children: [
      { type: "entry", url: "https://a.test" },
      { type: "folder", children: [{ type: "entry", url: "https://b.test" }] },
    ],
  };
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel,
    node,
    buffers: {},
  });
  actions.openFolderLinksInNewTabs();
  assert.equal(d.intents.length, 1);
  assert.equal(d.intents[0].type, "NEW_BUFFERS");
  assert.deepEqual(d.intents[0].urls, ["https://a.test", "https://b.test"]);
});

test("sidepanel actions open history day links dispatches NEW_BUFFERS intent", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const panel = {
    treeKind: "history",
    days: [
      {
        key: "2024-01-01",
        entries: [
          { url: "https://a.test" },
          { url: "https://b.test" },
        ],
      },
    ],
  };
  const node = { dateKey: "2024-01-01" };
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel,
    node,
    buffers: {},
  });
  actions.openFolderLinksInNewTabs();
  assert.equal(d.intents.length, 1);
  assert.equal(d.intents[0].type, "NEW_BUFFERS");
  assert.deepEqual(d.intents[0].urls, ["https://a.test", "https://b.test"]);
});

test("sidepanel actions show in folder dispatches SHOW_DOWNLOAD_IN_FOLDER intent", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel: {},
    node: { id: "dl-1" },
    buffers: {},
  });
  actions.showInFolder();
  assert.equal(d.intents.length, 1);
  assert.equal(d.intents[0].type, "SHOW_DOWNLOAD_IN_FOLDER");
  assert.equal(d.intents[0].downloadId, "dl-1");
});

test("sidepanel actions open file dispatches OPEN_DOWNLOAD_FILE intent", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel: {},
    node: { id: "dl-2" },
    buffers: {},
  });
  actions.openFile();
  assert.equal(d.intents.length, 1);
  assert.equal(d.intents[0].type, "OPEN_DOWNLOAD_FILE");
  assert.equal(d.intents[0].downloadId, "dl-2");
});

test("sidepanel actions delete all complete dispatches DOWNLOADS_CLEAR_COMPLETED intent", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const panel = {
    reloadData() {},
    render() {},
  };
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel,
    buffers: {},
  });
  actions.deleteAllComplete();
  assert.equal(d.intents.length, 1);
  assert.equal(d.intents[0].type, "DOWNLOADS_CLEAR_COMPLETED");
});

test("sidepanel actions no-op when node is missing", () => {
  const d = makeDispatch();
  const INTENTS = makeIntents();
  const actions = createSidepanelContextMenuActions({
    dispatch: d,
    win: {},
    state: {},
    INTENTS,
    panel: {},
    node: null,
    buffers: {},
  });
  assert.doesNotThrow(() => actions.openInNewTab());
  assert.doesNotThrow(() => actions.openInSplit());
  assert.doesNotThrow(() => actions.deleteEntry());
  assert.doesNotThrow(() => actions.deleteFolder());
  assert.doesNotThrow(() => actions.openFolderLinksInNewTabs());
  assert.equal(d.intents.length, 0);
});
