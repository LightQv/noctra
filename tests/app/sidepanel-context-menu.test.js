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

test("sidepanel actions open in new tab creates buffer with url", () => {
  const created = [];
  const buffers = {
    create(url) {
      created.push(url);
    },
  };
  const actions = createSidepanelContextMenuActions({
    panel: {},
    node: { entry: { url: "https://example.com" } },
    buffers,
  });
  actions.openInNewTab();
  assert.deepEqual(created, ["https://example.com"]);
});

test("sidepanel actions open in split delegates to buffers", () => {
  const splits = [];
  const buffers = {
    openUrlInRightSplit(url) {
      splits.push(url);
    },
  };
  const actions = createSidepanelContextMenuActions({
    panel: {},
    node: { entry: { url: "https://example.com" } },
    buffers,
  });
  actions.openInSplit();
  assert.deepEqual(splits, ["https://example.com"]);
});

test("sidepanel actions delete history entry calls service", () => {
  const deletions = [];
  const historyService = {
    deleteEntry(dateKey, entryId) {
      deletions.push({ dateKey, entryId });
    },
  };
  const panel = {
    treeKind: "history",
    reloadData() {},
    render() {},
  };
  const actions = createSidepanelContextMenuActions({
    panel,
    node: { dateKey: "2024-01-01", entry: { id: "e1" } },
    historyService,
  });
  actions.deleteEntry();
  assert.equal(deletions.length, 1);
  assert.deepEqual(deletions[0], { dateKey: "2024-01-01", entryId: "e1" });
});

test("sidepanel actions delete history day calls service", () => {
  const deletions = [];
  const historyService = {
    deleteDate(dateKey) {
      deletions.push(dateKey);
    },
  };
  const panel = {
    treeKind: "history",
    reloadData() {},
    render() {},
  };
  const actions = createSidepanelContextMenuActions({
    panel,
    node: { dateKey: "2024-01-01" },
    historyService,
  });
  actions.deleteFolder();
  assert.deepEqual(deletions, ["2024-01-01"]);
});

test("sidepanel actions delete all bookmarks delegates to service", () => {
  let deleted = false;
  const bookmarksService = {
    deleteAll() {
      deleted = true;
    },
  };
  const panel = {
    treeKind: "bookmarks",
    reloadData() {},
    render() {},
  };
  const actions = createSidepanelContextMenuActions({
    panel,
    bookmarksService,
  });
  actions.deleteAll();
  assert.equal(deleted, true);
});

test("sidepanel actions hide sidepanel calls panel.hide", () => {
  let hidden = false;
  const panel = {
    hide() {
      hidden = true;
    },
  };
  const actions = createSidepanelContextMenuActions({ panel });
  actions.hideSidepanel();
  assert.equal(hidden, true);
});

test("sidepanel actions open folder links creates buffers for each entry", () => {
  const created = [];
  const buffers = {
    createMany(urls) {
      for (const url of urls) {
        created.push(url);
      }
    },
  };
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
    panel,
    node,
    buffers,
  });
  actions.openFolderLinksInNewTabs();
  assert.deepEqual(created, ["https://a.test", "https://b.test"]);
});

test("sidepanel actions open history day links creates buffers for each entry", () => {
  const created = [];
  const buffers = {
    createMany(urls) {
      for (const url of urls) {
        created.push(url);
      }
    },
  };
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
    panel,
    node,
    buffers,
  });
  actions.openFolderLinksInNewTabs();
  assert.deepEqual(created, ["https://a.test", "https://b.test"]);
});

test("sidepanel actions show in folder delegates to downloads service", () => {
  let calledId = null;
  const downloadsService = {
    showInFolder(id) {
      calledId = id;
    },
  };
  const actions = createSidepanelContextMenuActions({
    downloadsService,
    node: { id: "dl-1" },
  });
  actions.showInFolder();
  assert.equal(calledId, "dl-1");
});

test("sidepanel actions open file delegates to downloads service", () => {
  let calledId = null;
  const downloadsService = {
    openFile(id) {
      calledId = id;
    },
  };
  const actions = createSidepanelContextMenuActions({
    downloadsService,
    node: { id: "dl-2" },
  });
  actions.openFile();
  assert.equal(calledId, "dl-2");
});

test("sidepanel actions delete all complete delegates to downloads service", () => {
  let cleared = false;
  const downloadsService = {
    clearCompleted() {
      cleared = true;
    },
  };
  const panel = {
    reloadData() {},
    render() {},
  };
  const actions = createSidepanelContextMenuActions({
    panel,
    downloadsService,
  });
  actions.deleteAllComplete();
  assert.equal(cleared, true);
});

test("sidepanel actions no-op when node is missing", () => {
  const buffers = { create() {}, openUrlInRightSplit() {} };
  const actions = createSidepanelContextMenuActions({
    panel: {},
    node: null,
    buffers,
  });
  assert.doesNotThrow(() => actions.openInNewTab());
  assert.doesNotThrow(() => actions.openInSplit());
  assert.doesNotThrow(() => actions.deleteEntry());
  assert.doesNotThrow(() => actions.deleteFolder());
  assert.doesNotThrow(() => actions.openFolderLinksInNewTabs());
});
