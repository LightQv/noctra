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
    closeBuffer: stub("closeBuffer"),
    closeAllBuffersToLeft: stub("closeAllBuffersToLeft"),
    closeAllBuffersToRight: stub("closeAllBuffersToRight"),
    closeAllBuffers: stub("closeAllBuffers"),
    duplicateBuffer: stub("duplicateBuffer"),
    splitBuffer: stub("splitBuffer"),
    newBuffer: stub("newBuffer"),
    reopenClosedBuffer: stub("reopenClosedBuffer"),
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
    "Close Buffer",
    "Close Buffers to the Left",
    "Close Buffers to the Right",
    "Close All Buffers",
    "Duplicate Buffer",
    "Split Buffer",
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
  const item = template.find((i) => i.label === "Close Buffers to the Left");
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
  const item = template.find((i) => i.label === "Close Buffers to the Left");
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
  const item = template.find((i) => i.label === "Close Buffers to the Right");
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
  const item = template.find((i) => i.label === "Close Buffers to the Right");
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
  const item = template.find((i) => i.label === "Split Buffer");
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
  const item = template.find((i) => i.label === "Split Buffer");
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
  const item = template.find((i) => i.label === "Split Buffer");
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
  const item = template.find((i) => i.label === "Split Buffer");
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
  const item = template.find((i) => i.label === "Split Buffer");
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
  const item = template.find((i) => i.label === "Duplicate Buffer");
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
  const item = template.find((i) => i.label === "Duplicate Buffer");
  assert.equal(item.enabled, true);
});

// ─── Tabline action tests ───

test("ui shell actions: closeBuffer dispatches CLOSE_BUFFER intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { CLOSE_BUFFER: "CLOSE_BUFFER" };
  const buffers = { buffers: [{ id: 3 }] };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(3);
  actions.closeBuffer();
  assert.equal(dispatched.type, "CLOSE_BUFFER");
  assert.equal(dispatched.id, 3);
});

test("ui shell actions: closeAllBuffersToLeft dispatches CLOSE_LEFT_BUFFERS intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { CLOSE_LEFT_BUFFERS: "CLOSE_LEFT_BUFFERS" };
  const buffers = {
    buffers: [{ id: 1 }, { id: 2 }, { id: 3 }],
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(3);
  actions.closeAllBuffersToLeft();
  assert.equal(dispatched.type, "CLOSE_LEFT_BUFFERS");
  assert.equal(dispatched.index, 2);
});

test("ui shell actions: closeAllBuffersToRight dispatches CLOSE_RIGHT_BUFFERS intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { CLOSE_RIGHT_BUFFERS: "CLOSE_RIGHT_BUFFERS" };
  const buffers = {
    buffers: [{ id: 1 }, { id: 2 }, { id: 3 }],
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(1);
  actions.closeAllBuffersToRight();
  assert.equal(dispatched.type, "CLOSE_RIGHT_BUFFERS");
  assert.equal(dispatched.index, 0);
});

test("ui shell actions: closeAllBuffers dispatches CLOSE_ALL_BUFFERS intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { CLOSE_ALL_BUFFERS: "CLOSE_ALL_BUFFERS" };
  const buffers = { buffers: [{ id: 1 }] };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(1);
  actions.closeAllBuffers();
  assert.equal(dispatched.type, "CLOSE_ALL_BUFFERS");
});

test("ui shell actions: duplicateBuffer dispatches DUPLICATE_BUFFER intent", () => {
  let dispatched = null;
  const dispatch = (win, intent) => { dispatched = intent; };
  const INTENTS = { DUPLICATE_BUFFER: "DUPLICATE_BUFFER" };
  const buffers = { buffers: [{ id: 5 }] };
  const actions = createUIShellContextMenuActions({
    clipboard: {}, buffers, dispatch, state: {}, INTENTS, startUrllineEdit: () => {}, win: {},
  }).forTablineTab(5);
  actions.duplicateBuffer();
  assert.equal(dispatched.type, "DUPLICATE_BUFFER");
  assert.equal(dispatched.bufferId, 5);
});

test("ui shell actions: splitBuffer dispatches OPEN_URL_IN_SPLIT intent for regular URL buffer", () => {
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
  actions.splitBuffer();
  assert.equal(dispatched.type, "OPEN_URL_IN_SPLIT");
  assert.equal(dispatched.url, "https://example.com");
});

test("ui shell actions: splitBuffer dispatches OPEN_URL_IN_SPLIT intent for dashboard", () => {
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
  actions.splitBuffer();
  assert.equal(dispatched.type, "OPEN_URL_IN_SPLIT");
  assert.equal(dispatched.url, "noctra://dashboard");
});

test("ui shell actions: splitBuffer no-op for editable buffer", () => {
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
  actions.splitBuffer();
  assert.equal(dispatched, null);
});

test("ui shell actions: splitBuffer dispatches OPEN_URL_IN_SPLIT when split already active", () => {
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
  actions.splitBuffer();
  assert.equal(dispatched.type, "OPEN_URL_IN_SPLIT");
  assert.equal(dispatched.url, "https://example.com");
});

test("ui shell tabline background: has new/reopen buffer items", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "background",
    runtimeSnapshot: { canReopenClosedBuffer: true },
    actions,
  });
  const labels = template.map((i) => i.label).filter(Boolean);
  assert.deepEqual(labels, ["New Buffer", "Reopen Closed Buffer"]);
  assert.equal(template[1].enabled, true);
});

test("ui shell tabline background: reopen closed buffer disabled when unavailable", () => {
  const actions = makeActionsStub();
  const template = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "background",
    runtimeSnapshot: { canReopenClosedBuffer: false },
    actions,
  });
  const reopenItem = template.find((i) => i.label === "Reopen Closed Buffer");
  assert.equal(reopenItem.enabled, false);
});

test("ui shell actions: tabline background newBuffer dispatches NEW_BUFFER intent", () => {
  let dispatched = null;
  const dispatch = (_win, intent) => {
    dispatched = intent;
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {},
    buffers: {},
    dispatch,
    state: {},
    INTENTS: { NEW_BUFFER: "NEW_BUFFER", REOPEN_BUFFER: "REOPEN_BUFFER" },
    startUrllineEdit: () => {},
    win: {},
  }).forTablineBackground();
  actions.newBuffer();
  assert.equal(dispatched.type, "NEW_BUFFER");
});

test("ui shell actions: tabline background reopenClosedBuffer dispatches REOPEN_BUFFER intent", () => {
  let dispatched = null;
  const dispatch = (_win, intent) => {
    dispatched = intent;
  };
  const actions = createUIShellContextMenuActions({
    clipboard: {},
    buffers: {},
    dispatch,
    state: {},
    INTENTS: { NEW_BUFFER: "NEW_BUFFER", REOPEN_BUFFER: "REOPEN_BUFFER" },
    startUrllineEdit: () => {},
    win: {},
  }).forTablineBackground();
  actions.reopenClosedBuffer();
  assert.equal(dispatched.type, "REOPEN_BUFFER");
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

// ─── Disabled state reaction tests ───

test("ui shell tabline: split enabled state reacts to snapshot change", () => {
  const actions = makeActionsStub();

  // When split is NOT enabled, split tab should be enabled (for a regular web buffer)
  const templateEnabled = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isSplitEnabled: false }),
    actions,
  });
  const splitItemEnabled = templateEnabled.find((i) => i.label === "Split Buffer");
  assert.equal(splitItemEnabled.enabled, true, "split tab should be enabled when split is inactive");

  // When split IS enabled, split tab should be disabled
  const templateDisabled = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isSplitEnabled: true }),
    actions,
  });
  const splitItemDisabled = templateDisabled.find((i) => i.label === "Split Buffer");
  assert.equal(splitItemDisabled.enabled, false, "split tab should be disabled when split is active");
});

test("ui shell tabline: duplicate enabled state reacts to buffer editability change", () => {
  const actions = makeActionsStub();

  const templateEditable = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({
      buffer: { isEditable: true },
    }),
    actions,
  });
  const dupItemEditable = templateEditable.find((i) => i.label === "Duplicate Buffer");
  assert.equal(dupItemEditable.enabled, false, "duplicate should be disabled for editable buffer");

  const templateNonEditable = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({
      buffer: { isEditable: false },
    }),
    actions,
  });
  const dupItemNonEditable = templateNonEditable.find((i) => i.label === "Duplicate Buffer");
  assert.equal(dupItemNonEditable.enabled, true, "duplicate should be enabled for non-editable buffer");
});

test("ui shell tabline: close left/right enabled states react to tab position change", () => {
  const actions = makeActionsStub();

  // First tab: close left disabled, close right enabled
  const templateFirst = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isFirst: true, isLast: false }),
    actions,
  });
  assert.equal(
    templateFirst.find((i) => i.label === "Close Buffers to the Left").enabled,
    false,
  );
  assert.equal(
    templateFirst.find((i) => i.label === "Close Buffers to the Right").enabled,
    true,
  );

  // Middle tab: both enabled
  const templateMiddle = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isFirst: false, isLast: false }),
    actions,
  });
  assert.equal(
    templateMiddle.find((i) => i.label === "Close Buffers to the Left").enabled,
    true,
  );
  assert.equal(
    templateMiddle.find((i) => i.label === "Close Buffers to the Right").enabled,
    true,
  );

  // Last tab: close left enabled, close right disabled
  const templateLast = buildUIShellContextMenuTemplate({
    zone: "tabline",
    target: "tab",
    runtimeSnapshot: makeTablineRuntimeSnapshot({ isFirst: false, isLast: true }),
    actions,
  });
  assert.equal(
    templateLast.find((i) => i.label === "Close Buffers to the Left").enabled,
    true,
  );
  assert.equal(
    templateLast.find((i) => i.label === "Close Buffers to the Right").enabled,
    false,
  );
});
