const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildUIShellContextMenuTemplate,
} = require("../../core/adapters/platform/contextMenuBuilder");
const {
  createUIShellContextMenuActions,
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
    closeTab: stub("closeTab"),
    closeAllTabsToLeft: stub("closeAllTabsToLeft"),
    closeAllTabsToRight: stub("closeAllTabsToRight"),
    closeAllTabs: stub("closeAllTabs"),
    duplicateTab: stub("duplicateTab"),
    splitTab: stub("splitTab"),
    copyUrl: stub("copyUrl"),
    editUrl: stub("editUrl"),
    hideUrlline: stub("hideUrlline"),
  };
}

function makeTablineRuntimeSnapshot(overrides = {}) {
  return {
    isFirst: false,
    isLast: false,
    isSplitEnabled: false,
    isEditable: false,
    hasVirtualDocument: false,
    isDashboard: false,
    ...overrides,
  };
}

// ─── Tabline template tests ───

test("ui shell tabline: has all items in correct order", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot(),
    actions,
  });
  const labels = template.map((i) => i.label).filter(Boolean);
  assert.deepEqual(labels, [
    "Close Tab",
    "Close All Tabs to the Left",
    "Close All Tabs to the Right",
    "Close All Tabs",
    "Duplicate Tab",
    "Split Tab",
  ]);
});

test("ui shell tabline: close left disabled when tab is first", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isFirst: true }),
    actions,
  });
  const item = template.find((i) => i.label === "Close All Tabs to the Left");
  assert.equal(item.enabled, false);
});

test("ui shell tabline: close left enabled when tab is not first", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isFirst: false }),
    actions,
  });
  const item = template.find((i) => i.label === "Close All Tabs to the Left");
  assert.equal(item.enabled, true);
});

test("ui shell tabline: close right disabled when tab is last", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isLast: true }),
    actions,
  });
  const item = template.find((i) => i.label === "Close All Tabs to the Right");
  assert.equal(item.enabled, false);
});

test("ui shell tabline: close right enabled when tab is not last", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isLast: false }),
    actions,
  });
  const item = template.find((i) => i.label === "Close All Tabs to the Right");
  assert.equal(item.enabled, true);
});

test("ui shell tabline: split disabled when split already active", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isSplitEnabled: true }),
    actions,
  });
  const item = template.find((i) => i.label === "Split Tab");
  assert.equal(item.enabled, false);
});

test("ui shell tabline: split disabled for editable buffer", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isEditable: true }),
    actions,
  });
  const item = template.find((i) => i.label === "Split Tab");
  assert.equal(item.enabled, false);
});

test("ui shell tabline: split disabled for non-dashboard virtual document", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({
      hasVirtualDocument: true,
      isDashboard: false,
    }),
    actions,
  });
  const item = template.find((i) => i.label === "Split Tab");
  assert.equal(item.enabled, false);
});

test("ui shell tabline: split enabled for dashboard virtual document", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({
      hasVirtualDocument: true,
      isDashboard: true,
    }),
    actions,
  });
  const item = template.find((i) => i.label === "Split Tab");
  assert.equal(item.enabled, true);
});

test("ui shell tabline: split enabled for regular web buffer", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({
      hasVirtualDocument: false,
      isDashboard: false,
    }),
    actions,
  });
  const item = template.find((i) => i.label === "Split Tab");
  assert.equal(item.enabled, true);
});

test("ui shell tabline: duplicate disabled for editable buffer", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isEditable: true }),
    actions,
  });
  const item = template.find((i) => i.label === "Duplicate Tab");
  assert.equal(item.enabled, false);
});

test("ui shell tabline: duplicate enabled for non-editable buffer", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isEditable: false }),
    actions,
  });
  const item = template.find((i) => i.label === "Duplicate Tab");
  assert.equal(item.enabled, true);
});

// ─── Tabline action tests ───

test("ui shell actions: closeTab calls buffers.close with tabId", () => {
  let closedId = null;
  const buffers = {
    buffers: [{ id: 3 }],
    close(id) { closedId = id; },
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(3);
  actions.closeTab();
  assert.equal(closedId, 3);
});

test("ui shell actions: closeAllTabsToLeft delegates to closeAllLeftOf", () => {
  let calledIndex = null;
  const buffers = {
    buffers: [{ id: 1 }, { id: 2 }, { id: 3 }],
    closeAllLeftOf(index) { calledIndex = index; },
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(3);
  actions.closeAllTabsToLeft();
  assert.equal(calledIndex, 2);
});

test("ui shell actions: closeAllTabsToRight delegates to closeAllRightOf", () => {
  let calledIndex = null;
  const buffers = {
    buffers: [{ id: 1 }, { id: 2 }, { id: 3 }],
    closeAllRightOf(index) { calledIndex = index; },
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(1);
  actions.closeAllTabsToRight();
  assert.equal(calledIndex, 0);
});

test("ui shell actions: closeAllTabs delegates to closeAllBuffers", () => {
  let called = false;
  const buffers = {
    buffers: [{ id: 1 }],
    closeAllBuffers() { called = true; },
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(1);
  actions.closeAllTabs();
  assert.equal(called, true);
});

test("ui shell actions: duplicateTab delegates to duplicateBuffer", () => {
  let dupId = null;
  const buffers = {
    buffers: [{ id: 5 }],
    duplicateBuffer(id) { dupId = id; },
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(5);
  actions.duplicateTab();
  assert.equal(dupId, 5);
});

test("ui shell actions: splitTab opens split for regular URL buffer", () => {
  let splitOpened = false;
  let splitUrl = null;
  const buffers = {
    buffers: [{ id: 7, url: "https://example.com" }],
    isSplitEnabled: () => false,
    openVerticalSplit: () => { splitOpened = true; },
    openUrlInRightSplit: (url) => { splitUrl = url; },
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(7);
  actions.splitTab();
  assert.equal(splitOpened, true);
  assert.equal(splitUrl, "https://example.com");
});

test("ui shell actions: splitTab copies virtualDocument for dashboard", () => {
  let splitOpened = false;
  let copiedBuffer = null;
  const dashboardBuffer = {
    id: 8,
    url: "noctra://dashboard",
    virtualUrl: "noctra://dashboard",
    virtualDocument: { html: "<div>dashboard</div>" },
  };
  const buffers = {
    buffers: [dashboardBuffer],
    isSplitEnabled: () => false,
    openVerticalSplit: () => { splitOpened = true; },
    openBufferInRightSplit: (buf) => { copiedBuffer = buf; },
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(8);
  actions.splitTab();
  assert.equal(splitOpened, true);
  assert.equal(copiedBuffer, dashboardBuffer);
});

test("ui shell actions: splitTab no-op for editable buffer", () => {
  let splitOpened = false;
  const buffers = {
    buffers: [{ id: 9, isEditable: true }],
    isSplitEnabled: () => false,
    openVerticalSplit: () => { splitOpened = true; },
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(9);
  actions.splitTab();
  assert.equal(splitOpened, false);
});

test("ui shell actions: splitTab replaces right pane when split already active", () => {
  let splitOpened = false;
  let splitUrl = null;
  const buffers = {
    buffers: [{ id: 10, url: "https://example.com" }],
    isSplitEnabled: () => true,
    openVerticalSplit: () => { splitOpened = true; },
    openUrlInRightSplit: (url) => { splitUrl = url; },
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(10);
  actions.splitTab();
  assert.equal(splitOpened, false); // already active, don't open again
  assert.equal(splitUrl, "https://example.com");
});

// ─── Urlline template tests ───

test("ui shell urlline url target has copy and edit", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "urlline",
    target: "url",
    runtimeSnapshot: {},
    actions,
  });
  assert.equal(template.length, 2);
  assert.equal(template[0].label, "Copy URL Address");
  assert.equal(template[1].label, "Edit URL");
});

test("ui shell urlline background target has hide urlline", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "urlline",
    target: "background",
    runtimeSnapshot: {},
    actions,
  });
  assert.equal(template.length, 1);
  assert.equal(template[0].label, "Hide Urlline");
});

// ─── Urlline action tests ───

test("ui shell actions: copyUrl writes pane buffer URL to clipboard", () => {
  let written = null;
  const clipboard = { writeText: (text) => { written = text; } };
  const buffers = {
    getPaneBuffer: (_pane) => ({ url: "https://example.com" }),
  };
  const actions = createUIShellContextMenuActions({
    clipboard, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit: () => {}, win: {},
  }).forUrllineUrl("left");
  actions.copyUrl();
  assert.equal(written, "https://example.com");
});

test("ui shell actions: editUrl starts urlline edit for pane buffer", () => {
  let startedPane = null;
  let startedUrl = null;
  const startUrllineEdit = (pane, url) => {
    startedPane = pane;
    startedUrl = url;
  };
  const buffers = {
    getPaneBuffer: (_pane) => ({ url: "https://example.com", isEditable: false }),
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit, win: {},
  }).forUrllineUrl("right");
  actions.editUrl();
  assert.equal(startedPane, "right");
  assert.equal(startedUrl, "https://example.com");
});

test("ui shell actions: editUrl no-op for editable buffer", () => {
  let started = false;
  const startUrllineEdit = () => { started = true; };
  const buffers = {
    getPaneBuffer: (_pane) => ({ url: "noctra://settings", isEditable: true }),
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch: () => {}, state: {}, INTENTS: {}, startUrllineEdit, win: {},
  }).forUrllineUrl("left");
  actions.editUrl();
  assert.equal(started, false);
});

test("ui shell actions: hideUrlline dispatches TOGGLE_URLLINE", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { TOGGLE_URLLINE: "TOGGLE_URLLINE" };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers: {}, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forUrllineUrl("left");
  actions.hideUrlline();
  assert.equal(dispatched.type, "TOGGLE_URLLINE");
});
