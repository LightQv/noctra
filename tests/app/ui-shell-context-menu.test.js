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
    buffer: { isEditable: false, virtualDocument: null, virtualUrl: null, url: "https://example.com" },
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
    runtimeSnapshot: makeTablineRuntimeSnapshot({
      buffer: { isEditable: true },
    }),
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
      buffer: { isEditable: false, virtualDocument: { html: "<div>virtual</div>" }, virtualUrl: "noctra://other" },
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
      buffer: { isEditable: false, virtualDocument: { html: "<div>dashboard</div>" }, virtualUrl: "noctra://dashboard" },
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
      buffer: { isEditable: false, virtualDocument: null, virtualUrl: null, url: "https://example.com" },
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
    runtimeSnapshot: makeTablineRuntimeSnapshot({
      buffer: { isEditable: true },
    }),
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
    runtimeSnapshot: makeTablineRuntimeSnapshot({
      buffer: { isEditable: false },
    }),
    actions,
  });
  const item = template.find((i) => i.label === "Duplicate Tab");
  assert.equal(item.enabled, true);
});

// ─── Tabline action tests ───

test("ui shell actions: closeTab dispatches CLOSE_BUFFER intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { CLOSE_BUFFER: "CLOSE_BUFFER" };
  const buffers = { buffers: [{ id: 3 }] };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(3);
  actions.closeTab();
  assert.equal(dispatched.type, "CLOSE_BUFFER");
  assert.equal(dispatched.id, 3);
});

test("ui shell actions: closeAllTabsToLeft dispatches CLOSE_LEFT_BUFFERS intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { CLOSE_LEFT_BUFFERS: "CLOSE_LEFT_BUFFERS" };
  const buffers = {
    buffers: [{ id: 1 }, { id: 2 }, { id: 3 }],
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(3);
  actions.closeAllTabsToLeft();
  assert.equal(dispatched.type, "CLOSE_LEFT_BUFFERS");
  assert.equal(dispatched.index, 2);
});

test("ui shell actions: closeAllTabsToRight dispatches CLOSE_RIGHT_BUFFERS intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { CLOSE_RIGHT_BUFFERS: "CLOSE_RIGHT_BUFFERS" };
  const buffers = {
    buffers: [{ id: 1 }, { id: 2 }, { id: 3 }],
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(1);
  actions.closeAllTabsToRight();
  assert.equal(dispatched.type, "CLOSE_RIGHT_BUFFERS");
  assert.equal(dispatched.index, 0);
});

test("ui shell actions: closeAllTabs dispatches CLOSE_ALL_BUFFERS intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { CLOSE_ALL_BUFFERS: "CLOSE_ALL_BUFFERS" };
  const buffers = { buffers: [{ id: 1 }] };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(1);
  actions.closeAllTabs();
  assert.equal(dispatched.type, "CLOSE_ALL_BUFFERS");
});

test("ui shell actions: duplicateTab dispatches DUPLICATE_BUFFER intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { DUPLICATE_BUFFER: "DUPLICATE_BUFFER" };
  const buffers = { buffers: [{ id: 5 }] };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(5);
  actions.duplicateTab();
  assert.equal(dispatched.type, "DUPLICATE_BUFFER");
  assert.equal(dispatched.bufferId, 5);
});

test("ui shell actions: splitTab dispatches OPEN_URL_IN_SPLIT intent for regular URL buffer", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { OPEN_URL_IN_SPLIT: "OPEN_URL_IN_SPLIT" };
  const buffers = {
    buffers: [{ id: 7, url: "https://example.com" }],
    isSplitEnabled: () => false,
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(7);
  actions.splitTab();
  assert.equal(dispatched.type, "OPEN_URL_IN_SPLIT");
  assert.equal(dispatched.url, "https://example.com");
});

test("ui shell actions: splitTab dispatches OPEN_URL_IN_SPLIT intent for dashboard", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { OPEN_URL_IN_SPLIT: "OPEN_URL_IN_SPLIT" };
  const buffers = {
    buffers: [{
      id: 8,
      url: "noctra://dashboard",
      virtualUrl: "noctra://dashboard",
      virtualDocument: { html: "<div>dashboard</div>" },
    }],
    isSplitEnabled: () => false,
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(8);
  actions.splitTab();
  assert.equal(dispatched.type, "OPEN_URL_IN_SPLIT");
  assert.equal(dispatched.url, "noctra://dashboard");
});

test("ui shell actions: splitTab no-op for editable buffer", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { OPEN_URL_IN_SPLIT: "OPEN_URL_IN_SPLIT" };
  const buffers = {
    buffers: [{ id: 9, isEditable: true }],
    isSplitEnabled: () => false,
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(9);
  actions.splitTab();
  assert.equal(dispatched, null);
});

test("ui shell actions: splitTab dispatches OPEN_URL_IN_SPLIT when split already active", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { OPEN_URL_IN_SPLIT: "OPEN_URL_IN_SPLIT" };
  const buffers = {
    buffers: [{ id: 10, url: "https://example.com" }],
    isSplitEnabled: () => true,
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(10);
  actions.splitTab();
  assert.equal(dispatched.type, "OPEN_URL_IN_SPLIT");
  assert.equal(dispatched.url, "https://example.com");
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
