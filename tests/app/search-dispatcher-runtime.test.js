const test = require("node:test");
const assert = require("node:assert/strict");

const { createSearchHandlers } = require("../../core/dispatcher/handlers/search");
const { INTENTS } = require("../../core/intents");
const { createState } = require("../../core/state");

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createHarness(overrides = {}) {
  const state = createState();
  const notifications = [];
  const sentCommands = [];
  let findInPageCalls = 0;

  const webContentsActions = {
    isUsableWebContents: () => true,
    sendSearchRuntimeCommand: async (webContents, action, payload, options) => {
      sentCommands.push({ webContents, action, payload, options });
      return {
        ok: true,
        requestId: options.requestId,
        payload: { total: 3, activeIndex: 1, visibleHintCount: 1 },
      };
    },
    findInPage: () => {
      findInPageCalls += 1;
      return 1;
    },
    ...overrides.webContentsActions,
  };

  const buffer = {
    id: 1,
    isEditable: false,
    url: "https://example.com",
    webContents: {},
    ...overrides.buffer,
  };

  const deps = {
    buffers: {
      getActive: () => buffer,
    },
    notificationsService: {
      notify: (entry) => notifications.push(entry),
    },
    webContentsActions,
    dispatch: () => {},
  };

  let handlers = null;
  deps.dispatch = (_win, intent, runtimeState) => {
    if (handlers && typeof handlers[intent.type] === "function") {
      handlers[intent.type]({ win: null, intent, state: runtimeState });
    }
  };
  handlers = createSearchHandlers(deps);

  return {
    state,
    notifications,
    sentCommands,
    handlers,
    getFindInPageCalls: () => findInPageCalls,
  };
}

test("search submit uses runtime command and updates count", async () => {
  const harness = createHarness();

  harness.handlers[INTENTS.SEARCH_SUBMIT]({
    win: null,
    intent: { type: INTENTS.SEARCH_SUBMIT, query: "noctra" },
    state: harness.state,
  });
  await tick();

  assert.equal(harness.sentCommands.length, 1);
  assert.equal(harness.sentCommands[0].action, "start");
  assert.equal(harness.sentCommands[0].payload.query, "noctra");
  assert.equal(harness.getFindInPageCalls(), 0);
  assert.equal(harness.state.searchMatchIndex, 1);
  assert.equal(harness.state.searchMatchTotal, 3);
});

test("search next and prev dispatch runtime actions", async () => {
  const harness = createHarness();
  harness.state.searchActive = true;
  harness.state.searchQuery = "term";

  harness.handlers[INTENTS.SEARCH_NEXT]({
    win: null,
    intent: { type: INTENTS.SEARCH_NEXT },
    state: harness.state,
  });
  harness.handlers[INTENTS.SEARCH_PREV]({
    win: null,
    intent: { type: INTENTS.SEARCH_PREV },
    state: harness.state,
  });
  await tick();

  assert.equal(harness.sentCommands.length, 2);
  assert.equal(harness.sentCommands[0].action, "next");
  assert.equal(harness.sentCommands[1].action, "prev");
  assert.equal(harness.getFindInPageCalls(), 0);
});

test("search runtime update ignores stale request responses", async () => {
  const pending = [];
  const harness = createHarness({
    webContentsActions: {
      sendSearchRuntimeCommand: (_webContents, action, _payload, options) => {
        return new Promise((resolve) => {
          pending.push({ action, requestId: options.requestId, resolve });
        });
      },
    },
  });

  harness.handlers[INTENTS.SEARCH_SUBMIT]({
    win: null,
    intent: { type: INTENTS.SEARCH_SUBMIT, query: "noctra" },
    state: harness.state,
  });
  harness.handlers[INTENTS.SEARCH_NEXT]({
    win: null,
    intent: { type: INTENTS.SEARCH_NEXT },
    state: harness.state,
  });

  assert.equal(pending.length, 2);
  const submitRequest = pending[0];
  const nextRequest = pending[1];

  nextRequest.resolve({
    ok: true,
    requestId: nextRequest.requestId,
    payload: { total: 9, activeIndex: 4, visibleHintCount: 3 },
  });
  await tick();
  assert.equal(harness.state.searchMatchIndex, 4);

  submitRequest.resolve({
    ok: true,
    requestId: submitRequest.requestId,
    payload: { total: 9, activeIndex: 1, visibleHintCount: 3 },
  });
  await tick();

  assert.equal(harness.state.searchMatchIndex, 4);
  assert.equal(harness.state.searchMatchTotal, 9);
});

test("search clear resets state and sends runtime clear", async () => {
  const harness = createHarness();
  harness.state.searchActive = true;
  harness.state.searchQuery = "noctra";
  harness.state.searchMatchIndex = 2;
  harness.state.searchMatchTotal = 10;

  harness.handlers[INTENTS.SEARCH_CLEAR]({
    win: null,
    intent: { type: INTENTS.SEARCH_CLEAR },
    state: harness.state,
  });
  await tick();

  assert.equal(harness.sentCommands[0].action, "clear");
  assert.equal(harness.state.mode, "NORMAL");
  assert.equal(harness.state.searchActive, false);
  assert.equal(harness.state.searchQuery, "");
  assert.equal(harness.state.searchMatchIndex, 0);
  assert.equal(harness.state.searchMatchTotal, 0);
  assert.equal(harness.notifications.length, 0);
});

test("search hint open and input update hint mode and runtime actions", async () => {
  const harness = createHarness({
    webContentsActions: {
      sendSearchRuntimeCommand: async (_wc, action, _payload, options) => {
        if (action === "hint-open") {
          return {
            ok: true,
            requestId: options.requestId,
            payload: { total: 5, activeIndex: 1, visibleHintCount: 3 },
          };
        }
        if (action === "hint-input") {
          return {
            ok: true,
            requestId: options.requestId,
            payload: {
              total: 5,
              activeIndex: 2,
              visibleHintCount: 3,
              hints: [
                { label: "a", index: 2 },
                { label: "s", index: 3 },
                { label: "d", index: 4 },
              ],
              jumped: true,
            },
          };
        }
        return {
          ok: true,
          requestId: options.requestId,
          payload: { total: 5, activeIndex: 1, visibleHintCount: 0 },
        };
      },
    },
  });

  harness.state.searchActive = true;
  harness.state.searchQuery = "noctra";

  harness.handlers[INTENTS.SEARCH_HINT_OPEN]({
    win: null,
    intent: { type: INTENTS.SEARCH_HINT_OPEN },
    state: harness.state,
  });
  await tick();
  assert.equal(harness.state.searchHintMode, true);
  assert.equal(harness.state.searchVisibleHintCount, 3);

  harness.handlers[INTENTS.SEARCH_HINT_INPUT]({
    win: null,
    intent: { type: INTENTS.SEARCH_HINT_INPUT, input: "a" },
    state: harness.state,
  });
  await tick();
  assert.equal(harness.state.searchHintMode, true);
  assert.equal(harness.state.searchHintInput, "a");
  assert.equal(harness.state.searchVisibleHintCount, 3);
  assert.equal(harness.state.searchMatchIndex, 2);
});

test("search submit reports runtime error without native fallback", async () => {
  const harness = createHarness({
    webContentsActions: {
      sendSearchRuntimeCommand: async () => ({
        ok: false,
        error: { message: "runtime down" },
      }),
    },
  });

  harness.handlers[INTENTS.SEARCH_SUBMIT]({
    win: null,
    intent: { type: INTENTS.SEARCH_SUBMIT, query: "fallback" },
    state: harness.state,
  });
  await tick();

  assert.equal(harness.getFindInPageCalls(), 0);
  assert.equal(
    harness.notifications.some((entry) => entry.code === "search_runtime_error"),
    true,
  );
});

test("search submit reports thrown runtime error message", async () => {
  const harness = createHarness({
    webContentsActions: {
      sendSearchRuntimeCommand: async () => {
        throw new Error("runtime exploded");
      },
    },
  });

  harness.handlers[INTENTS.SEARCH_SUBMIT]({
    win: null,
    intent: { type: INTENTS.SEARCH_SUBMIT, query: "boom" },
    state: harness.state,
  });
  await tick();

  assert.equal(
    harness.notifications.some(
      (entry) =>
        entry.code === "search_runtime_error" &&
        entry.message === "runtime exploded",
    ),
    true,
  );
});
